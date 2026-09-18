const express = require("express");
const { protect } = require("../middleware/auth");
const {
  issueToken,
  outgoingCallTwiML,
  incomingCallTwiML,
  outgoingDialStatus,
  incomingDialStatus,
} = require("../controllers/voice");

const router = express.Router();
router.get("/token", protect, issueToken);
// These routes are called by Twilio (the TwiML App, phone number config, and
// each <Dial>'s own `action` callback), not by the mobile client —
// authenticated instead by Twilio's request signature (see
// twilioRequestIsValid in the controller).
router.post("/outgoing", outgoingCallTwiML);
router.post("/outgoing/status", outgoingDialStatus);
router.post("/incoming", incomingCallTwiML);
router.post("/incoming/status", incomingDialStatus);

module.exports = router;
