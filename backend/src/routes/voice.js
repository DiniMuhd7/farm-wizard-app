const express = require("express");
const { protect } = require("../middleware/auth");
const { issueToken, outgoingCallTwiML } = require("../controllers/voice");

const router = express.Router();
router.get("/token", protect, issueToken);
// This route is called by Twilio's TwiML App, not by the mobile client.
router.post("/outgoing", outgoingCallTwiML);

module.exports = router;
