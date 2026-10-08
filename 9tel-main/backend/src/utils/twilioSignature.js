const crypto = require("crypto");

// Validates that a request genuinely came from Twilio, using Twilio's own
// request-signing scheme: HMAC-SHA1 of (full webhook URL + sorted POST
// param key+value pairs, concatenated), using the account's Auth Token.
// Requires the body to already be parsed as application/x-www-form-urlencoded
// (see backend/index.js's express.urlencoded() — Twilio never sends JSON).
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

function escapedXml(value) {
  return value.replace(/[<>&'"]/g, (character) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[character]);
}

module.exports = { twilioRequestIsValid, escapedXml };
