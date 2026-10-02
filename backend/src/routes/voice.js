const express = require("express");
const { rateLimit } = require("express-rate-limit");
const { protect } = require("../middleware/auth");
const {
  issueToken,
  outgoingCallTwiML,
  incomingCallTwiML,
  outgoingDialStatus,
  incomingDialStatus,
} = require("../controllers/voice");

const router = express.Router();
// Twilio's webhook IPs are shared across accounts, so keep the ceiling high
// enough for legitimate traffic while bounding database work during a flood.
const outgoingCallRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) =>
    res.status(429).type("text/xml").send(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Say>Call setup is busy. Please try again shortly.</Say></Response>`
    ),
});
router.get("/token", protect, issueToken);
// These routes are called by Twilio (the TwiML App, phone number config, and
// each <Dial>'s own `action` callback), not by the mobile client —
// authenticated instead by Twilio's request signature (see
// twilioRequestIsValid in the controller).
router.post("/outgoing", outgoingCallRateLimit, outgoingCallTwiML);
router.post("/outgoing/status", outgoingDialStatus);
router.post("/incoming", incomingCallTwiML);
router.post("/incoming/status", incomingDialStatus);

module.exports = router;
