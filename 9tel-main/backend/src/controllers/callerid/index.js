const crypto = require("crypto");
const User = require("../../models/User");
const { twilioRequestIsValid } = require("../../utils/twilioSignature");

const E164 = /^\+[1-9]\d{6,14}$/;
const CODE_LENGTH = 6;
const VERIFICATION_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 30 * 1000;
const REQUIRED_CONFIG = ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "PUBLIC_BASE_URL", "TWILIO_CALLER_ID", "JWT_SECRET"];
const FAILED_CALL_STATUSES = ["failed", "busy", "no-answer", "canceled"];

function missingConfig() {
  return REQUIRED_CONFIG.filter((key) => !process.env[key]);
}

function developerTestNumbers() {
  if (process.env.NODE_ENV === "production" || process.env.CALLER_ID_DEV_TEST_MODE !== "true") return [];
  return String(process.env.CALLER_ID_DEV_TEST_NUMBERS || "")
    .split(",")
    .map((number) => number.trim())
    .filter((number) => E164.test(number));
}

function twilioClient() {
  const twilio = require("twilio");
  return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

function generateCode() {
  return String(crypto.randomInt(0, 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, "0");
}

// Only this keyed hash is persisted. It is bound to the user, session and
// number so a hash cannot be replayed against another session or account.
function hashCode(userId, sessionId, phoneNumber, code) {
  return crypto
    .createHmac("sha256", process.env.JWT_SECRET)
    .update(`callerid:${userId}:${sessionId}:${phoneNumber}:${code}`)
    .digest("hex");
}

function codeMatches(expectedHash, userId, sessionId, phoneNumber, code) {
  if (!expectedHash) return false;
  const expected = Buffer.from(expectedHash, "hex");
  const actual = Buffer.from(hashCode(userId, sessionId, phoneNumber, code), "hex");
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

// Spoken twice, digit by digit, so it is easy to catch and write down.
function spokenCodeTwiML(code) {
  const digits = code.split("").join(", ");
  const sentence = `Your 9tel verification code is ${digits}.`;
  return (
    `<Response><Say>${sentence} Enter this code in the 9tel app. Do not share it.</Say>` +
    `<Pause length="2"/><Say>I repeat. ${sentence} Goodbye.</Say></Response>`
  );
}

function clearPendingVerification() {
  return {
    callerIdVerificationNumber: null,
    callerIdVerificationCodeHash: null,
    callerIdVerificationSessionId: null,
    callerIdVerificationAttempts: 0,
    callerIdVerificationCallSid: null,
    callerIdVerificationExpiresAt: null,
  };
}

function expirePendingVerification(userId, now = new Date()) {
  return User.findOneAndUpdate(
    {
      _id: userId,
      callerIdStatus: "pending",
      $or: [
        { callerIdVerificationExpiresAt: { $lte: now } },
        { callerIdVerificationExpiresAt: null },
        { callerIdVerificationExpiresAt: { $exists: false } },
      ],
    },
    { callerIdStatus: "expired", callerIdVerificationMethod: null, ...clearPendingVerification() },
    { new: true }
  );
}

function failPendingSession(userId, sessionId, callerIdStatus = "failed") {
  return User.findOneAndUpdate(
    { _id: userId, callerIdStatus: "pending", callerIdVerificationSessionId: sessionId },
    { callerIdStatus, callerIdVerificationMethod: null, ...clearPendingVerification() },
    { new: true }
  );
}

function providerError(error) {
  if (error.code === 21211 || error.code === "21211") {
    return { status: 400, code: "invalid_phone_number", message: "The provider could not call this number. Check the country code and try again." };
  }
  if (error.code === 21408 || error.code === "21408") {
    return { status: 400, code: "country_not_enabled", message: "Calling this country is not enabled for verification. Contact support." };
  }
  if (error.code === 20429 || error.code === "20429") {
    return { status: 429, code: "verification_rate_limited", message: "Too many verification attempts. Wait a few minutes before trying again." };
  }
  return { status: 503, code: "provider_unavailable", message: "The voice verification service is temporarily unavailable. Try again later." };
}

// The correlation id is the random session id: safe to log and to return to
// the owner. It reveals nothing about the code.
function logAttempt(level, event, sessionId, extra = {}) {
  console[level](`Caller ID verification: ${event}`, { correlationId: sessionId || null, ...extra });
}

function respond(res, status, correlationId, body) {
  res.set?.("Cache-Control", "no-store");
  if (correlationId) res.set?.("X-Correlation-ID", correlationId);
  return res.status(status).json(correlationId ? { correlationId, ...body } : body);
}

function isOwner(req) {
  return Boolean(req.user?._id);
}

// Atomically consumes the current pending session. The filter pins status,
// session, number and expiry, so of any number of concurrent or replayed
// submissions exactly one can ever flip the account to verified.
async function completeVerification(userId, sessionId, phoneNumber) {
  const verified = await User.findOneAndUpdate(
    {
      _id: userId,
      callerIdStatus: "pending",
      callerIdVerificationSessionId: sessionId,
      callerIdVerificationNumber: phoneNumber,
      callerIdVerificationExpiresAt: { $gt: new Date() },
    },
    {
      verifiedCallerId: phoneNumber,
      callerIdStatus: "verified",
      callerIdVerificationMethod: "spoken_code",
      ...clearPendingVerification(),
    },
    { new: true }
  );
  if (verified) {
    try {
      await require("../rewards").ensureWelcomeReward(verified._id);
    } catch (rewardError) {
      console.error("Unable to record welcome reward:", rewardError.message);
    }
  }
  return verified;
}

// POST /api/v1/callerid/start { phoneNumber }
exports.startVerification = async (req, res) => {
  if (!isOwner(req)) return res.status(401).json({ code: "unauthorized", message: "Sign in to verify a caller ID." });

  const phoneNumber = String(req.body?.phoneNumber || "").trim();
  if (!E164.test(phoneNumber)) {
    return res.status(400).json({ code: "invalid_phone_number", message: "Enter a valid number in E.164 format, including the country code." });
  }

  try {
    const takenByOther = await User.findOne({ verifiedCallerId: phoneNumber, _id: { $ne: req.user._id } }).select("_id").lean();
    if (takenByOther) {
      return res.status(409).json({ code: "caller_id_in_use", message: "That number is already verified on another 9tel account." });
    }

    const testNumbers = developerTestNumbers();
    const isDeveloperTest = testNumbers.includes(phoneNumber);
    const missing = isDeveloperTest ? [] : missingConfig();
    if (missing.length) {
      console.warn("Caller ID verification configuration is incomplete", { missing });
      return res.status(503).json({
        code: "caller_id_configuration_error",
        missing,
        message: `Voice verification is not configured. Missing server settings: ${missing.join(", ")}.`,
      });
    }

    await expirePendingVerification(req.user._id);

    if (isDeveloperTest) {
      const result = await User.findOneAndUpdate(
        { _id: req.user._id, callerIdStatus: { $ne: "pending" } },
        {
          $set: {
            callerIdStatus: "verified",
            callerIdVerificationMethod: "developer_test",
            callerIdLastAttemptedNumber: phoneNumber,
            ...clearPendingVerification(),
          },
          $unset: { verifiedCallerId: "" },
        },
        { new: true }
      );
      if (!result) {
        return res.status(409).json({ code: "verification_pending", message: "Cancel or finish the current verification before starting another." });
      }
      console.info("Caller ID verified using the non-production allowlist", { mode: "developer_test" });
      return res.status(200).json({
        phoneNumber,
        callerIdStatus: "verified",
        method: "developer_test",
        message: "Developer test verification completed. No provider call was placed.",
      });
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + VERIFICATION_TTL_MS);
    const sessionId = crypto.randomBytes(12).toString("hex");
    const code = generateCode();
    // Compare-and-set: one active session per account, and a server-side
    // resend cooldown that cancel-then-restart cannot bypass.
    const pending = await User.findOneAndUpdate(
      {
        _id: req.user._id,
        callerIdStatus: { $ne: "pending" },
        $or: [
          { callerIdLastRequestedAt: null },
          { callerIdLastRequestedAt: { $exists: false } },
          { callerIdLastRequestedAt: { $lte: new Date(now.getTime() - RESEND_COOLDOWN_MS) } },
        ],
      },
      {
        $set: {
          callerIdStatus: "pending",
          callerIdVerificationMethod: null,
          callerIdLastAttemptedNumber: phoneNumber,
          callerIdLastRequestedAt: now,
          callerIdVerificationNumber: phoneNumber,
          callerIdVerificationCodeHash: hashCode(String(req.user._id), sessionId, phoneNumber, code),
          callerIdVerificationSessionId: sessionId,
          callerIdVerificationAttempts: 0,
          callerIdVerificationCallSid: null,
          callerIdVerificationExpiresAt: expiresAt,
        },
        $unset: { verifiedCallerId: "" },
      },
      { new: true }
    );
    if (!pending) {
      const current = await User.findById(req.user._id).select("callerIdStatus callerIdLastRequestedAt").lean();
      if (current && current.callerIdStatus !== "pending") {
        return res.status(429).json({ code: "resend_cooldown", message: "Please wait a few seconds before requesting another verification call." });
      }
      return res.status(409).json({ code: "verification_pending", message: "Cancel or finish the current verification before starting another." });
    }

    let callSid;
    try {
      const baseUrl = process.env.PUBLIC_BASE_URL.replace(/\/$/, "");
      const call = await twilioClient().calls.create({
        to: phoneNumber,
        from: process.env.TWILIO_CALLER_ID,
        twiml: spokenCodeTwiML(code),
        timeout: 30,
        statusCallback: `${baseUrl}/api/v1/callerid/call-status?session=${sessionId}`,
        statusCallbackMethod: "POST",
        statusCallbackEvent: ["completed"],
      });
      callSid = call?.sid;
    } catch (error) {
      await failPendingSession(req.user._id, sessionId);
      const failure = providerError(error);
      logAttempt("error", "voice call could not be placed", sessionId, { providerCode: error.code || null, providerStatus: error.status || null });
      return respond(res, failure.status, sessionId, { code: failure.code, message: failure.message });
    }

    // Best-effort bookkeeping: the call is already placed and the code spoken,
    // so a failure here must not kill the session.
    if (callSid) {
      try {
        await User.findOneAndUpdate(
          { _id: req.user._id, callerIdStatus: "pending", callerIdVerificationSessionId: sessionId },
          { callerIdVerificationCallSid: callSid }
        );
      } catch (error) {
        logAttempt("warn", "could not record call sid", sessionId);
      }
    }
    logAttempt("info", "voice call requested", sessionId);
    // The code is never returned to or displayed in the app: it is only
    // spoken on the possession-verification call.
    return respond(res, 200, sessionId, {
      phoneNumber,
      callerIdStatus: "pending",
      expiresAt: expiresAt.toISOString(),
      maxAttempts: MAX_ATTEMPTS,
      message: `We’re calling ${phoneNumber}. Answer, listen for the code, then enter it here.`,
    });
  } catch (error) {
    console.error("Unable to start caller ID verification", { code: error.code || null });
    return res.status(503).json({ code: "verification_unavailable", message: "Caller ID verification is temporarily unavailable. Try again later." });
  }
};

// POST /api/v1/callerid/verify { code }
exports.submitVerificationCode = async (req, res) => {
  if (!isOwner(req)) return res.status(401).json({ code: "unauthorized", message: "Sign in to verify a caller ID." });

  const code = String(req.body?.code ?? "").trim();
  if (!new RegExp(`^\\d{${CODE_LENGTH}}$`).test(code)) {
    return res.status(400).json({ code: "invalid_code_format", message: `Enter the ${CODE_LENGTH}-digit code you heard on the call.` });
  }
  if (!process.env.JWT_SECRET) {
    return res.status(503).json({ code: "caller_id_configuration_error", message: "Voice verification is not configured." });
  }

  try {
    const user = await User.findById(req.user._id)
      .select("callerIdStatus callerIdVerificationNumber callerIdVerificationCodeHash callerIdVerificationSessionId callerIdVerificationExpiresAt")
      .lean();
    const sessionId = user?.callerIdVerificationSessionId;
    if (!user || user.callerIdStatus !== "pending" || !sessionId) {
      return res.status(409).json({ code: "no_active_verification", message: "There is no active verification. Request a new call." });
    }
    if (!user.callerIdVerificationExpiresAt || new Date(user.callerIdVerificationExpiresAt).getTime() <= Date.now()) {
      await expirePendingVerification(req.user._id);
      logAttempt("info", "code submitted after expiry", sessionId);
      return respond(res, 410, sessionId, { code: "verification_expired", callerIdStatus: "expired", message: "This code expired. Request a new call." });
    }

    // Every guess is counted atomically *before* it is compared, so parallel
    // submissions cannot exceed the attempt limit.
    const counted = await User.findOneAndUpdate(
      {
        _id: req.user._id,
        callerIdStatus: "pending",
        callerIdVerificationSessionId: sessionId,
        callerIdVerificationAttempts: { $lt: MAX_ATTEMPTS },
        callerIdVerificationExpiresAt: { $gt: new Date() },
      },
      { $inc: { callerIdVerificationAttempts: 1 } },
      { new: true }
    );
    if (!counted) {
      // Not counted: the session ran out of attempts, or was consumed,
      // cancelled or expired after the check above. Report which.
      const latest = await User.findById(req.user._id)
        .select("callerIdStatus callerIdVerificationSessionId callerIdVerificationAttempts callerIdVerificationExpiresAt")
        .lean();
      const stillActive = latest?.callerIdStatus === "pending" && latest.callerIdVerificationSessionId === sessionId;
      if (!stillActive) {
        return respond(res, 409, sessionId, { code: "no_active_verification", message: "This verification is no longer active. Check your status or request a new call." });
      }
      if (new Date(latest.callerIdVerificationExpiresAt).getTime() <= Date.now()) {
        await expirePendingVerification(req.user._id);
        return respond(res, 410, sessionId, { code: "verification_expired", callerIdStatus: "expired", message: "This code expired. Request a new call." });
      }
      await failPendingSession(req.user._id, sessionId);
      logAttempt("warn", "attempt limit reached", sessionId);
      return respond(res, 429, sessionId, { code: "too_many_attempts", callerIdStatus: "failed", message: "Too many incorrect codes. Request a new call." });
    }

    const phoneNumber = user.callerIdVerificationNumber;
    if (!codeMatches(user.callerIdVerificationCodeHash, String(req.user._id), sessionId, phoneNumber, code)) {
      const attemptsRemaining = Math.max(0, MAX_ATTEMPTS - counted.callerIdVerificationAttempts);
      logAttempt("info", "incorrect code", sessionId, { attemptsRemaining });
      if (attemptsRemaining === 0) {
        await failPendingSession(req.user._id, sessionId);
        return respond(res, 429, sessionId, { code: "too_many_attempts", callerIdStatus: "failed", message: "Too many incorrect codes. Request a new call." });
      }
      return respond(res, 400, sessionId, { code: "incorrect_code", attemptsRemaining, message: "That code is not correct. Check the code you heard and try again." });
    }

    let verified;
    try {
      verified = await completeVerification(req.user._id, sessionId, phoneNumber);
    } catch (error) {
      if (error?.code === 11000) {
        await failPendingSession(req.user._id, sessionId);
        return respond(res, 409, sessionId, { code: "caller_id_in_use", message: "That number is already verified on another 9tel account." });
      }
      throw error;
    }
    if (!verified) {
      // Another request consumed, cancelled or expired this session first.
      return respond(res, 409, sessionId, { code: "no_active_verification", message: "This verification is no longer active. Check your status or request a new call." });
    }
    logAttempt("info", "verified", sessionId);
    return respond(res, 200, sessionId, {
      callerIdStatus: "verified",
      verifiedCallerId: verified.verifiedCallerId,
      method: "spoken_code",
    });
  } catch (error) {
    console.error("Unable to verify caller ID code", { code: error.code || null });
    return res.status(503).json({ code: "verification_unavailable", message: "Caller ID verification is temporarily unavailable. Try again later." });
  }
};

// GET /api/v1/callerid/status
exports.getVerificationStatus = async (req, res) => {
  if (!isOwner(req)) return res.status(401).json({ code: "unauthorized", message: "Sign in to check caller ID status." });

  const user = await User.findById(req.user._id).select(
    "verifiedCallerId callerIdStatus callerIdVerificationMethod callerIdVerificationNumber callerIdVerificationSessionId callerIdVerificationAttempts callerIdLastAttemptedNumber callerIdVerificationExpiresAt"
  );
  if (user?.callerIdStatus === "pending") {
    const expiry = user.callerIdVerificationExpiresAt ? new Date(user.callerIdVerificationExpiresAt).getTime() : 0;
    if (expiry <= Date.now()) {
      const expired = await expirePendingVerification(req.user._id);
      if (expired) {
        return res.status(200).json({
          verifiedCallerId: null,
          callerIdStatus: "expired",
          ...(expired.callerIdLastAttemptedNumber ? { phoneNumber: expired.callerIdLastAttemptedNumber } : {}),
        });
      }
      const current = await User.findById(req.user._id).select("verifiedCallerId callerIdStatus");
      return res.status(200).json({
        verifiedCallerId: current?.callerIdStatus === "verified" ? current.verifiedCallerId || null : null,
        callerIdStatus: current?.callerIdStatus || "unverified",
      });
    }
  }

  const isProductionTestRecord =
    process.env.NODE_ENV === "production" && user?.callerIdVerificationMethod === "developer_test";
  const callerIdStatus = isProductionTestRecord
    ? "unverified"
    : user?.callerIdStatus || (user?.verifiedCallerId ? "verified" : "unverified");
  const method = user?.callerIdVerificationMethod || (callerIdStatus === "verified" ? "twilio" : undefined);
  return res.status(200).json({
    verifiedCallerId: callerIdStatus === "verified" && method !== "developer_test" ? user?.verifiedCallerId || null : null,
    callerIdStatus,
    ...(callerIdStatus === "verified" && method ? { method } : {}),
    ...(callerIdStatus === "verified" && method === "developer_test" && user?.callerIdLastAttemptedNumber
      ? { phoneNumber: user.callerIdLastAttemptedNumber }
      : {}),
    ...(callerIdStatus === "pending" && user?.callerIdVerificationNumber
      ? {
          phoneNumber: user.callerIdVerificationNumber,
          expiresAt: new Date(user.callerIdVerificationExpiresAt).toISOString(),
          attemptsRemaining: Math.max(0, MAX_ATTEMPTS - (user.callerIdVerificationAttempts || 0)),
          correlationId: user.callerIdVerificationSessionId,
        }
      : {}),
    ...(["failed", "expired"].includes(callerIdStatus) && user?.callerIdLastAttemptedNumber
      ? { phoneNumber: user.callerIdLastAttemptedNumber }
      : {}),
  });
};

// POST /api/v1/callerid/cancel
exports.cancelVerification = async (req, res) => {
  if (!isOwner(req)) return res.status(401).json({ code: "unauthorized", message: "Sign in to cancel caller ID verification." });

  const canceled = await User.findOneAndUpdate(
    { _id: req.user._id, callerIdStatus: "pending" },
    { callerIdStatus: "unverified", callerIdVerificationMethod: null, ...clearPendingVerification() },
    { new: true }
  );
  return res.status(200).json({ callerIdStatus: canceled ? "unverified" : "unchanged" });
};

// POST /api/v1/callerid/call-status?session=<id> — Twilio's signed status
// callback for the verification call. It can only ever move the matching
// pending session to "failed" when the provider reports the call did not
// connect; it never verifies anything (only the owner's code submission can).
exports.callStatusCallback = async (req, res) => {
  if (!twilioRequestIsValid(req)) {
    console.warn("Rejected Twilio caller ID status callback: signature validation failed");
    return res.status(403).type("text/plain").send("Invalid Twilio signature");
  }
  const sessionId = String(req.query?.session || "");
  const callStatus = String(req.body?.CallStatus || "").toLowerCase();
  if (!/^[a-f0-9]{24}$/.test(sessionId) || !FAILED_CALL_STATUSES.includes(callStatus)) {
    return res.status(200).type("text/plain").send("OK");
  }
  try {
    const updated = await User.findOneAndUpdate(
      { callerIdStatus: "pending", callerIdVerificationSessionId: sessionId },
      { callerIdStatus: "failed", callerIdVerificationMethod: null, ...clearPendingVerification() }
    );
    logAttempt("info", `voice call ${callStatus}`, sessionId, { applied: Boolean(updated) });
  } catch (error) {
    console.error("Unable to save caller ID call status", { code: error.code || null });
    return res.status(500).type("text/plain").send("Unable to save status");
  }
  return res.status(200).type("text/plain").send("OK");
};

exports._private = { developerTestNumbers, hashCode, spokenCodeTwiML, MAX_ATTEMPTS, VERIFICATION_TTL_MS };
