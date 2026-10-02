const crypto = require("crypto");
const User = require("../../models/User");
const { twilioRequestIsValid } = require("../../utils/twilioSignature");

const E164 = /^\+[1-9]\d{6,14}$/;
const VERIFICATION_TTL_MS = 10 * 60 * 1000;
const REQUIRED_TWILIO_CONFIG = ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "PUBLIC_BASE_URL"];

function missingTwilioConfig() {
  return REQUIRED_TWILIO_CONFIG.filter((key) => !process.env[key]);
}

function developerTestNumbers() {
  if (process.env.NODE_ENV === "production" || process.env.CALLER_ID_DEV_TEST_MODE !== "true") return [];
  return String(process.env.CALLER_ID_DEV_TEST_NUMBERS || "")
    .split(",")
    .map((number) => number.trim())
    .filter((number) => E164.test(number));
}

function hashCallbackToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function twilioClient() {
  const twilio = require("twilio");
  return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

function clearPendingVerification() {
  return {
    callerIdVerificationNumber: null,
    callerIdVerificationTokenHash: null,
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

function providerError(error) {
  if (error.code === "21211") {
    return { status: 400, code: "invalid_phone_number", message: "The provider could not call this number. Check the country code and try again." };
  }
  if (error.code === "21408") {
    return { status: 400, code: "country_not_enabled", message: "Calling this country is not enabled for verification. Contact support." };
  }
  if (error.code === "20429") {
    return { status: 429, code: "verification_rate_limited", message: "Too many verification attempts. Wait a few minutes before trying again." };
  }
  return { status: 503, code: "provider_unavailable", message: "The voice verification service is temporarily unavailable. Try again later." };
}

function isOwner(req) {
  return Boolean(req.user?._id);
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
    const missing = isDeveloperTest ? [] : missingTwilioConfig();
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
    const callbackToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashCallbackToken(callbackToken);
    const pending = await User.findOneAndUpdate(
      { _id: req.user._id, callerIdStatus: { $ne: "pending" } },
      {
        $set: {
          callerIdStatus: "pending",
          callerIdVerificationMethod: null,
          callerIdLastAttemptedNumber: phoneNumber,
          callerIdVerificationNumber: phoneNumber,
          callerIdVerificationTokenHash: tokenHash,
          callerIdVerificationExpiresAt: expiresAt,
        },
        $unset: { verifiedCallerId: "" },
      },
      { new: true }
    );
    if (!pending) {
      return res.status(409).json({ code: "verification_pending", message: "Cancel or finish the current verification before starting another." });
    }

    let validationCode;
    try {
      const callbackUrl = `${process.env.PUBLIC_BASE_URL.replace(/\/$/, "")}/api/v1/callerid/callback?token=${callbackToken}`;
      const validation = await twilioClient().validationRequests.create({
        phoneNumber,
        friendlyName: "9tel caller ID verification",
        statusCallback: callbackUrl,
      });
      validationCode = validation?.validationCode;
    } catch (error) {
      await User.findOneAndUpdate(
        { _id: req.user._id, callerIdStatus: "pending", callerIdVerificationTokenHash: tokenHash },
        { callerIdStatus: "failed", callerIdVerificationMethod: null, ...clearPendingVerification() }
      );
      const failure = providerError(error);
      if (failure.code === "provider_unavailable") {
        console.error("Unable to start caller ID verification", {
          providerCode: error.code || null,
          providerStatus: error.status || null,
        });
      }
      return res.status(failure.status).json({ code: failure.code, message: failure.message });
    }

    // Twilio's call asks the user to key in this code, and it is only ever
    // returned in this create response. It is relayed once to the authenticated
    // owner for display, never stored or logged, and must not be cached.
    res.set?.("Cache-Control", "no-store");
    return res.status(200).json({
      phoneNumber,
      callerIdStatus: "pending",
      ...(validationCode ? { validationCode: String(validationCode) } : {}),
      expiresAt: expiresAt.toISOString(),
      message: validationCode
        ? `We’re calling ${phoneNumber}. Answer and enter the code shown on screen on your phone keypad.`
        : `We’re calling ${phoneNumber}. Answer and follow the spoken instructions.`,
    });
  } catch (error) {
    console.error("Unable to start caller ID verification", { code: error.code || null });
    return res.status(503).json({ code: "verification_unavailable", message: "Caller ID verification is temporarily unavailable. Try again later." });
  }
};

// GET /api/v1/callerid/status
exports.getVerificationStatus = async (req, res) => {
  if (!isOwner(req)) return res.status(401).json({ code: "unauthorized", message: "Sign in to check caller ID status." });

  const user = await User.findById(req.user._id).select(
    "verifiedCallerId callerIdStatus callerIdVerificationMethod callerIdVerificationNumber callerIdLastAttemptedNumber callerIdVerificationExpiresAt"
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
      ? { phoneNumber: user.callerIdVerificationNumber }
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

// POST /api/v1/callerid/callback — only Twilio's signed callback can confirm a
// real verification. The random callback token binds this response to the
// current pending attempt and is never sent to the app.
exports.verificationCallback = async (req, res) => {
  if (!twilioRequestIsValid(req)) {
    console.warn("Rejected Twilio caller ID callback: signature validation failed", {
      hasAuthToken: Boolean(process.env.TWILIO_AUTH_TOKEN),
      hasPublicBaseUrl: Boolean(process.env.PUBLIC_BASE_URL),
    });
    return res.status(403).type("text/plain").send("Invalid Twilio signature");
  }

  const token = String(req.query?.token || "");
  if (!/^[a-f0-9]{64}$/.test(token)) return res.status(200).type("text/plain").send("OK");

  const tokenHash = hashCallbackToken(token);
  const phoneNumber = String(req.body?.PhoneNumber || "").trim();
  const status = String(req.body?.VerificationStatus || "").toLowerCase();
  try {
    if (status === "success" && E164.test(phoneNumber)) {
      const verified = await User.findOneAndUpdate(
        {
          callerIdStatus: "pending",
          callerIdVerificationTokenHash: tokenHash,
          callerIdVerificationNumber: phoneNumber,
          callerIdVerificationExpiresAt: { $gt: new Date() },
        },
        {
          verifiedCallerId: phoneNumber,
          callerIdStatus: "verified",
          callerIdVerificationMethod: "twilio",
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
    } else {
      const callerIdStatus = status === "expired" ? "expired" : "failed";
      await User.findOneAndUpdate(
        { callerIdStatus: "pending", callerIdVerificationTokenHash: tokenHash },
        { callerIdStatus, callerIdVerificationMethod: null, ...clearPendingVerification() }
      );
    }
  } catch (error) {
    console.error("Unable to save caller ID verification result", { code: error.code || null });
    return res.status(500).type("text/plain").send("Unable to save verification");
  }

  return res.status(200).type("text/plain").send("OK");
};

exports._private = { developerTestNumbers, hashCallbackToken };
