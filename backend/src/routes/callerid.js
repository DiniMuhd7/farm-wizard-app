const express = require("express");
const { rateLimit } = require("express-rate-limit");
const { protect } = require("../middleware/auth");
const { startVerification, getVerificationStatus, cancelVerification, verificationCallback } = require("../controllers/callerid");

const router = express.Router();
const callbackRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many verification callback attempts." },
});

router.post("/start", rateLimit({
  windowMs: 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
}), protect, rateLimit({
  windowMs: 60 * 1000,
  limit: 3,
  keyGenerator: (req) => `user:${req.user._id.toString()}`,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: "rate_limited", message: "Please wait before requesting another verification call." },
}), startVerification);
router.get("/status", rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
}), protect, rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  keyGenerator: (req) => `user:${req.user._id.toString()}`,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: "rate_limited", message: "Please wait before checking verification status again." },
}), getVerificationStatus);
router.post("/cancel", rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
}), protect, rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  keyGenerator: (req) => `user:${req.user._id.toString()}`,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: "rate_limited", message: "Please wait before trying to cancel verification again." },
}), cancelVerification);
// Called by Twilio, not the mobile client — see verificationCallback's own
// comment for how it's authenticated instead.
router.post("/callback", callbackRateLimit, verificationCallback);

module.exports = router;
