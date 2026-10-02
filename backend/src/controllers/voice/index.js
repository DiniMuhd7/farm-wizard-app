const crypto = require("crypto");
const { twilioRequestIsValid, escapedXml } = require("../../utils/twilioSignature");

const TOKEN_TTL_SECONDS = 60 * 60;
const E164 = /^\+[1-9]\d{6,14}$/;
const CLIENT_IDENTITY = /^client:[A-Za-z0-9_-]{1,121}$/;

const base64Url = (value) => Buffer.from(value).toString("base64url");

function requireVoiceConfiguration() {
  const required = [
    "TWILIO_ACCOUNT_SID",
    "TWILIO_API_KEY_SID",
    "TWILIO_API_KEY_SECRET",
    "TWILIO_TWIML_APP_SID",
  ];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) throw new Error(`Voice service is not configured: ${missing.join(", ")}`);
}

function createVoiceAccessToken(identity) {
  requireVoiceConfiguration();
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ typ: "JWT", alg: "HS256", cty: "twilio-fpa;v=1" }));
  const payload = base64Url(JSON.stringify({
    jti: `${process.env.TWILIO_API_KEY_SID}-${crypto.randomUUID()}`,
    iss: process.env.TWILIO_API_KEY_SID,
    sub: process.env.TWILIO_ACCOUNT_SID,
    iat: now,
    exp: now + TOKEN_TTL_SECONDS,
    grants: {
      identity,
      voice: {
        incoming: { allow: true },
        outgoing: { application_sid: process.env.TWILIO_TWIML_APP_SID },
      },
    },
  }));
  const signingInput = `${header}.${payload}`;
  const signature = crypto.createHmac("sha256", process.env.TWILIO_API_KEY_SECRET).update(signingInput).digest("base64url");
  return `${signingInput}.${signature}`;
}

function isAllowedDestination(destination) {
  if (CLIENT_IDENTITY.test(destination)) return true;
  if (!E164.test(destination)) return false;
  const prefixes = (process.env.TWILIO_ALLOWED_DESTINATION_PREFIXES || "").split(",").map((value) => value.trim()).filter(Boolean);
  return prefixes.length > 0 && prefixes.some((prefix) => destination.startsWith(prefix));
}

exports.issueToken = (req, res) => {
  try {
    const identity = `user-${req.user._id.toString()}`;
    return res.status(200).json({ token: createVoiceAccessToken(identity), identity, expiresIn: TOKEN_TTL_SECONDS });
  } catch (error) {
    console.error("Unable to issue Twilio Voice token", error.message);
    return res.status(503).json({ message: "Voice calling is not configured" });
  }
};

function resolveCallerIdentity(caller) {
  const verifiedIsAuthoritative =
    caller?.verifiedCallerId &&
    E164.test(caller.verifiedCallerId) &&
    caller.callerIdStatus === "verified" &&
    // Only a number the provider itself approved as an outbound caller ID may
    // be presented. A spoken-code (possession) verification proves ownership
    // to 9tel but does not make the number provider-approved, so presenting
    // it could be rejected or spoof; those accounts use the shared fallback.
    (caller.callerIdVerificationMethod === "twilio" || !caller.callerIdVerificationMethod);
  if (verifiedIsAuthoritative) return { callerId: caller.verifiedCallerId, callerIdStatus: "verified" };
  const fallback = process.env.TWILIO_CALLER_ID;
  if (!fallback || !E164.test(fallback)) return null;
  return { callerId: fallback, callerIdStatus: "unverified" };
}

exports.outgoingCallTwiML = async (req, res) => {
  if (!twilioRequestIsValid(req)) return res.status(403).type("text/plain").send("Invalid Twilio signature");
  const destination = String(req.body?.To || "").trim();

  // Caller identity is resolved server-side only. A user's own number is used
  // as the outbound identity solely when Twilio's signed verification callback
  // persisted it (callerIdStatus "verified"). Unverified, pending, failed,
  // expired and developer-test numbers never become the From identity; those
  // callers use the provider-owned TWILIO_CALLER_ID. Calls are never blocked
  // merely because the caller ID is unverified.
  const from = String(req.body?.From || "");
  const callerMatch = from.match(/^client:user-([A-Za-z0-9]+)$/);
  let caller = null;
  if (callerMatch) {
    const User = require("../../models/User");
    caller = await User.findById(callerMatch[1])
      .select("verifiedCallerId callerIdStatus callerIdVerificationMethod phoneNumber isGuest")
      .lean();
  }
  const callerIdentity = resolveCallerIdentity(caller);
  if (!callerIdentity) {
    console.error("Outbound call refused: no verified caller ID and TWILIO_CALLER_ID is missing or not E.164");
    return res
      .status(503)
      .type("text/plain")
      .send("Voice caller ID is not configured: set TWILIO_CALLER_ID to a Twilio-owned or Twilio-verified E.164 number so unverified accounts can place calls.");
  }
  const callerId = callerIdentity.callerId;
  const baseUrl = `${process.env.PUBLIC_BASE_URL?.replace(/\/$/, "") || ""}/api/v1/voice/outgoing/status`;
  const action = escapedXml(baseUrl);

  // If the dialed number happens to belong to another 9tel user, try
  // reaching their app directly first — free, instant, no PSTN leg — and
  // only fall back to actually dialing the number over the phone network if
  // they're not reachable that way (app closed, not registered, or just
  // doesn't pick up in time). A plain phone number with no 9tel account
  // behind it skips straight to the normal dial-the-number path below, same
  // as before. This lookup is intentionally allowed regardless of
  // TWILIO_ALLOWED_DESTINATION_PREFIXES — it's a known, already-provisioned
  // number belonging to this system, not an arbitrary external destination.
  if (E164.test(destination)) {
    const User = require("../../models/User");
    // A 9tel account is identified by either its provisioned 9tel number or
    // its own verified real number — the same two numbers
    // controllers/numbers' lookupNumber matches on, so what the app
    // previews is exactly what gets routed.
    const owner = await User.findOne({
      status: { $ne: "inactive" },
      $or: [{ phoneNumber: destination }, { verifiedCallerId: destination }],
    }).select("_id").lean();
    if (owner && String(owner._id) !== callerMatch?.[1]) {
      const identity = escapedXml(`user-${owner._id.toString()}`);
      // Short timeout: this is the "try the app" attempt, not the real
      // call — if it's going to connect at all, it'll ring and answer well
      // within this, and a genuinely offline/unregistered client fails
      // near-instantly anyway. Keeping this short bounds how long the
      // caller waits before the PSTN fallback kicks in.
      const fallbackAction = escapedXml(`${baseUrl}?fallbackTo=${encodeURIComponent(destination)}`);
      return res.type("text/xml").send(
        `<?xml version="1.0" encoding="UTF-8"?><Response><Dial callerId="${callerId}" timeout="12" action="${fallbackAction}" method="POST"><Client>${identity}</Client></Dial></Response>`
      );
    }
  }

  if (!isAllowedDestination(destination)) return res.status(400).type("text/xml").send("<Response><Say>That destination is not permitted.</Say></Response>");

  // Carrier (PSTN) leg. Enforced here, server-side, from the database — the
  // app's own checks are only a courtesy. Order of precedence:
  //   1. enough Pay As You Go credits for a minute -> normal billed call
  //   2. otherwise the user's one-time welcome minute, hard-capped by
  //      Twilio itself via <Dial timeLimit>, never by the client
  //   3. otherwise the call is refused
  // Calls to the caller's own numbers never qualify for the reward.
  let timeLimitAttr = "";
  if (callerMatch && E164.test(destination)) {
    const { RATE_PER_MINUTE_CENTS } = require("../credits");
    const User = require("../../models/User");
    const account = await User.findById(callerMatch[1]).select("creditsBalanceCents").lean();
    const hasCredits = (account?.creditsBalanceCents || 0) >= RATE_PER_MINUTE_CENTS;
    if (!hasCredits) {
      const ownNumber = destination === caller?.verifiedCallerId || destination === caller?.phoneNumber;
      let freeSeconds = 0;
      if (!ownNumber && !caller?.isGuest) {
        try {
          const { ensureWelcomeReward, reserveForCall } = require("../rewards");
          await ensureWelcomeReward(callerMatch[1]);
          freeSeconds = await reserveForCall(callerMatch[1], String(req.body?.CallSid || ""));
        } catch (error) {
          // Never surface this distinction to the caller (they always see
          // the same plain "not enough credit" message below) — but log it
          // loudly and distinctly from an ordinary "not eligible" outcome,
          // since this branch means the reward system itself is broken
          // (e.g. missing JWT_SECRET) rather than this account simply not
          // qualifying. See GET /api/v1/rewards/diagnostics for the
          // operator-facing, per-user version of this same distinction.
          console.error("Welcome reward configuration failure — reward could not be evaluated:", {
            userId: callerMatch[1],
            error: error.message,
          });
        }
      }
      if (!freeSeconds) {
        return res.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?><Response><Say>You do not have enough credit to place this call. Please top up and try again.</Say></Response>`);
      }
      timeLimitAttr = ` timeLimit="${freeSeconds}"`;
    }
  }
  const noun = destination.startsWith("client:") ? `<Client>${escapedXml(destination.slice(7))}</Client>` : `<Number>${escapedXml(destination)}</Number>`;
  return res.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?><Response><Dial callerId="${callerId}"${timeLimitAttr} action="${action}" method="POST">${noun}</Dial></Response>`);
};

// Twilio hits this whenever someone dials a 9tel number on the PSTN. `To` is
// the number they dialed (one of the numbers provisioned via
// POST /api/v1/numbers/provision); `From` is the caller. We look up which
// user owns that number and ring their app via the same Client identity the
// mobile app registers with (see controllers/voice issueToken, and
// services/voice.ts's Voice.Event.CallInvite listener on the client side).
//
// If the callee's app isn't registered and connected (closed/killed, or push
// isn't configured), Dial's `timeout` elapses with no answer and control
// passes to the `action` URL below with the dial's outcome — NOT to a fixed
// fallback TwiML block after </Dial>, which would also fire (and confusingly
// play an "unavailable" message) after every ordinary *successful* call too,
// since <Dial> falls through to whatever follows it once the call ends for
// any reason, answered or not.
exports.incomingCallTwiML = async (req, res) => {
  if (!twilioRequestIsValid(req)) return res.status(403).type("text/plain").send("Invalid Twilio signature");
  const dialedNumber = String(req.body?.To || "").trim();
  if (!E164.test(dialedNumber)) {
    return res.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?><Response><Say>This number is not in service.</Say></Response>`);
  }

  const User = require("../../models/User");
  const owner = await User.findOne({ phoneNumber: dialedNumber }).select("_id").lean();
  if (!owner) {
    // A number Twilio still routes to us but no user currently holds —
    // e.g. released after account deletion but not yet deprovisioned on
    // Twilio's side. Fail safe rather than dial an empty/wrong identity.
    return res.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?><Response><Say>This number is not currently assigned. Goodbye.</Say></Response>`);
  }

  const identity = escapedXml(`user-${owner._id.toString()}`);
  const action = escapedXml(
    `${process.env.PUBLIC_BASE_URL?.replace(/\/$/, "") || ""}/api/v1/voice/incoming/status?userId=${owner._id.toString()}`
  );
  return res.type("text/xml").send(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Dial timeout="25" answerOnBridge="true" action="${action}" method="POST"><Client>${identity}</Client></Dial></Response>`
  );
};

// Shared by both status callbacks below: only actually-failed-to-connect
// outcomes get a spoken message. A normal call that connected and was later
// hung up by either side also reaches an `action` URL (that's how <Dial>
// works), and must NOT play "unavailable" on the way out.
function respondToDialOutcome(res, dialCallStatus) {
  if (dialCallStatus === "completed") {
    return res.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`);
  }
  return res
    .type("text/xml")
    .send(`<?xml version="1.0" encoding="UTF-8"?><Response><Say>The person you are calling is unavailable. Please try again later.</Say></Response>`);
}

function normalizedDialStatus(rawStatus) {
  const allowed = ["completed", "no-answer", "busy", "failed", "canceled"];
  return allowed.includes(rawStatus) ? rawStatus : "failed";
}

async function logCall({ userId, direction, counterparty, dialCallStatus, dialCallDuration, callSid }) {
  try {
    const Call = require("../../models/Call");
    await Call.create({
      user: userId,
      direction,
      counterparty,
      status: normalizedDialStatus(dialCallStatus),
      durationSeconds: Number(dialCallDuration) || 0,
      callSid,
    });
  } catch (error) {
    // Never let CDR logging break the live call flow — the person on the
    // call has already heard the outcome via TwiML by the time this runs.
    console.error("Unable to log call record:", error.message);
  }
}

// Called once the outbound Dial leg from /outgoing ends, however it ended.
// `From` on THIS request is the same client identity that placed the call
// (Twilio resends the original request's parameters here), e.g.
// "client:user-<id>" — that's how we know which user to attribute it to.
//
// A `fallbackTo` query param means this was the app-to-app attempt (see
// outgoingCallTwiML) and it didn't connect — fall back to a real PSTN call
// to the same number, exactly like an ordinary outbound call. That second
// leg's own action callback (no fallbackTo param on it) is what actually
// logs the call and speaks the final outcome — a call that had to fall
// back still ends up as exactly one entry in the caller's history, not two.
exports.outgoingDialStatus = async (req, res) => {
  if (!twilioRequestIsValid(req)) return res.status(403).type("text/plain").send("Invalid Twilio signature");
  const dialCallStatus = req.body?.DialCallStatus;
  const fallbackTo = req.query?.fallbackTo ? String(req.query.fallbackTo) : null;

  if (fallbackTo && dialCallStatus !== "completed") {
    // No isAllowedDestination check here on purpose: fallbackTo only ever
    // gets set in outgoingCallTwiML after confirming it's an existing 9tel
    // user's own provisioned number, not arbitrary caller-supplied input —
    // the prefix allow-list exists to gate arbitrary external PSTN spend,
    // which doesn't apply to a number this system already owns.
    const callerId = process.env.TWILIO_CALLER_ID;
    const action = escapedXml(`${process.env.PUBLIC_BASE_URL?.replace(/\/$/, "") || ""}/api/v1/voice/outgoing/status`);
    return res.type("text/xml").send(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Dial callerId="${callerId}" action="${action}" method="POST"><Number>${escapedXml(fallbackTo)}</Number></Dial></Response>`
    );
  }

  const from = String(req.body?.From || "");
  const match = from.match(/^client:user-([A-Za-z0-9]+)$/);
  if (match) {
    await logCall({
      userId: match[1],
      direction: "outbound",
      counterparty: String(req.body?.To || "unknown"),
      dialCallStatus,
      dialCallDuration: req.body?.DialCallDuration,
      callSid: req.body?.DialCallSid,
    });

    // Pay As You Go billing. `fallbackTo` reaching this far (rather than
    // being intercepted above) means the FIRST leg — the app-to-app
    // attempt — connected: a free/premium 9tel-to-9tel call, not a carrier
    // leg, so it must never be billed even though `To` is still the E.164
    // number that was originally dialed (Twilio echoes the parent call's
    // own params here, not the Dial leg's). Every other completed leg with
    // an E.164 `To` is a real PSTN leg that actually reached a carrier —
    // either the one direct-dial path, or the second (fallback) leg after
    // the 9tel app didn't pick up — and is billed against the caller's
    // credits balance using Twilio's own reported duration.
    const to = String(req.body?.To || "").trim();
    const appToAppSuccess = Boolean(fallbackTo) && dialCallStatus === "completed";
    if (!appToAppSuccess && E164.test(to)) {
      // Settle the welcome-reward reservation (if this call held one)
      // before billing: a redeemed free minute is never also debited, and
      // a call that never connected hands the reward back.
      let rewardOutcome = null;
      try {
        const duration = Number(req.body?.DialCallDuration) || 0;
        rewardOutcome = await require("../rewards").settleForCall(match[1], String(req.body?.CallSid || ""), {
          connected: dialCallStatus === "completed" && duration > 0,
          durationSeconds: duration,
        });
      } catch (error) {
        console.error("Unable to settle welcome reward:", error.message);
      }
      // A redeemed free minute (or a redelivered event for one) is never
      // also debited; Twilio's timeLimit already capped it at 60 seconds.
      if (dialCallStatus === "completed" && rewardOutcome !== "redeemed" && rewardOutcome !== "replayed") {
        const { debitForCompletedCall } = require("../credits");
        await debitForCompletedCall(match[1], Number(req.body?.DialCallDuration) || 0, String(req.body?.DialCallSid || req.body?.CallSid || "") || undefined);
      }
    }
  }
  return respondToDialOutcome(res, dialCallStatus);
};

// Called once the inbound Dial leg from /incoming ends. The owning user's id
// travels through as a query param on the `action` URL rather than a second
// DB lookup by number — see incomingCallTwiML above.
exports.incomingDialStatus = async (req, res) => {
  if (!twilioRequestIsValid(req)) return res.status(403).type("text/plain").send("Invalid Twilio signature");
  const userId = String(req.query?.userId || "");
  if (userId) {
    await logCall({
      userId,
      direction: "inbound",
      counterparty: String(req.body?.From || "unknown"),
      dialCallStatus: req.body?.DialCallStatus,
      dialCallDuration: req.body?.DialCallDuration,
      callSid: req.body?.DialCallSid,
    });
  }
  return respondToDialOutcome(res, req.body?.DialCallStatus);
};

exports._private = { createVoiceAccessToken, isAllowedDestination, resolveCallerIdentity };
