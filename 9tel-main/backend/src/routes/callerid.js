const express = require("express");
const { rateLimit } = require("express-rate-limit");
const { protect } = require("../middleware/auth");
const { startVerification, submitVerificationCode, getVerificationStatus, cancelVerification, callStatusCallback } = require("../controllers/callerid");

const router = express.Router();
const callbackRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many verification status callbacks." },
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
router.post("/verify", rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
}), protect, rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  keyGenerator: (req) => `user:${req.user._id.toString()}`,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: "rate_limited", message: "Too many code attempts. Please wait a minute and try again." },
}), submitVerificationCode);
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
// Called by Twilio, not the mobile client — authenticated by its signature.
// It can only mark the matching pending session failed (call did not connect).
router.post("/call-status", callbackRateLimit, callStatusCallback);

module.exports = router;
