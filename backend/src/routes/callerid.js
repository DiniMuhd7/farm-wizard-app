const express = require("express");
const { protect } = require("../middleware/auth");
const { startVerification, getVerificationStatus, verificationCallback } = require("../controllers/callerid");

const router = express.Router();
router.post("/start", protect, startVerification);
router.get("/status", protect, getVerificationStatus);
// Called by Twilio, not the mobile client — see verificationCallback's own
// comment for how it's authenticated instead.
router.post("/callback", verificationCallback);

module.exports = router;
