const express = require("express");
const { rateLimit } = require("express-rate-limit");
const { protect } = require("../middleware/auth");
const { startVerification, getVerificationStatus, verificationCallback } = require("../controllers/callerid");

const router = express.Router();
const startVerificationRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Please wait before requesting another verification code." },
});
const statusRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Please wait before checking verification status again." },
});
const callbackRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many verification callback attempts." },
});

router.post("/start", startVerificationRateLimit, protect, startVerification);
router.get("/status", statusRateLimit, protect, getVerificationStatus);
// Called by Twilio, not the mobile client — see verificationCallback's own
// comment for how it's authenticated instead.
router.post("/callback", callbackRateLimit, verificationCallback);

module.exports = router;
