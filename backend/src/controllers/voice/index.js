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
  return res.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?><Response><Dial callerId="${callerId}">${noun}</Dial></Response>`);
};

exports._private = { createVoiceAccessToken, isAllowedDestination };
