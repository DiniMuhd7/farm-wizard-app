const crypto = require("crypto");

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

function escapedXml(value) {
  return value.replace(/[<>&'\"]/g, (character) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", "\"": "&quot;" })[character]);
}

function isAllowedDestination(destination) {
  if (CLIENT_IDENTITY.test(destination)) return true;
  if (!E164.test(destination)) return false;
  const prefixes = (process.env.TWILIO_ALLOWED_DESTINATION_PREFIXES || "").split(",").map((value) => value.trim()).filter(Boolean);
  return prefixes.length > 0 && prefixes.some((prefix) => destination.startsWith(prefix));
}

function twilioRequestIsValid(req) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const publicBaseUrl = process.env.PUBLIC_BASE_URL;
  if (!authToken || !publicBaseUrl) return false;
  const url = `${publicBaseUrl.replace(/\/$/, "")}${req.originalUrl}`;
  const params = Object.keys(req.body || {}).sort().map((key) => `${key}${req.body[key]}`).join("");
  const expected = crypto.createHmac("sha1", authToken).update(url + params).digest("base64");
  const received = req.get("X-Twilio-Signature") || "";
  return received.length === expected.length && crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected));
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

exports.outgoingCallTwiML = (req, res) => {
  if (!twilioRequestIsValid(req)) return res.status(403).type("text/plain").send("Invalid Twilio signature");
  const destination = String(req.body?.To || "").trim();
  if (!isAllowedDestination(destination)) return res.status(400).type("text/xml").send("<Response><Say>That destination is not permitted.</Say></Response>");
  const callerId = process.env.TWILIO_CALLER_ID;
  if (!callerId || !E164.test(callerId)) return res.status(503).type("text/plain").send("Voice caller ID is not configured");
  const noun = destination.startsWith("client:") ? `<Client>${escapedXml(destination.slice(7))}</Client>` : `<Number>${escapedXml(destination)}</Number>`;
  const action = escapedXml(`${process.env.PUBLIC_BASE_URL?.replace(/\/$/, "") || ""}/api/v1/voice/outgoing/status`);
  return res.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?><Response><Dial callerId="${callerId}" action="${action}" method="POST">${noun}</Dial></Response>`);
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
exports.outgoingDialStatus = async (req, res) => {
  if (!twilioRequestIsValid(req)) return res.status(403).type("text/plain").send("Invalid Twilio signature");
  const from = String(req.body?.From || "");
  const match = from.match(/^client:user-([A-Za-z0-9]+)$/);
  if (match) {
    await logCall({
      userId: match[1],
      direction: "outbound",
      counterparty: String(req.body?.To || "unknown"),
      dialCallStatus: req.body?.DialCallStatus,
      dialCallDuration: req.body?.DialCallDuration,
      callSid: req.body?.DialCallSid,
    });
  }
  return respondToDialOutcome(res, req.body?.DialCallStatus);
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

exports._private = { createVoiceAccessToken, isAllowedDestination };
