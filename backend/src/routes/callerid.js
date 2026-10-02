const express = require("express");
const { rateLimit } = require("express-rate-limit");
const { protect } = require("../middleware/auth");
const { startVerification, getVerificationStatus, cancelVerification, verificationCallback } = require("../controllers/callerid");

const router = express.Router();
const ownerRateLimit = (limit, message) => rateLimit({
  windowMs: 60 * 1000,
  limit,
  keyGenerator: (req) => `user:${req.user._id.toString()}`,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: "rate_limited", message },
});
const startVerificationRateLimit = ownerRateLimit(3, "Please wait before requesting another verification call.");
const statusRateLimit = ownerRateLimit(30, "Please wait before checking verification status again.");
const cancelRateLimit = ownerRateLimit(10, "Please wait before trying to cancel verification again.");
const callbackRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many verification callback attempts." },
});

router.post("/start", protect, startVerificationRateLimit, startVerification);
router.get("/status", protect, statusRateLimit, getVerificationStatus);
router.post("/cancel", protect, cancelRateLimit, cancelVerification);
// Called by Twilio, not the mobile client — see verificationCallback's own
// comment for how it's authenticated instead.
router.post("/callback", callbackRateLimit, verificationCallback);

module.exports = router;
