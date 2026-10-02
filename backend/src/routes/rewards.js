const express = require("express");
const { rateLimit } = require("express-rate-limit");
const { protect } = require("../middleware/auth");
const { getWelcomeReward, getRewardDiagnostics } = require("../controllers/rewards");

const router = express.Router();
const rewardRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Please wait before checking your reward again." },
});
const diagnosticsRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Please wait before checking reward diagnostics again." },
});

router.get("/welcome", rewardRateLimit, protect, getWelcomeReward);
// Admin-only diagnostic — lets support tell apart ineligible, ungranted,
// reserved, consumed ("redeemed"), and configuration-failed welcome-reward
// states for a given user, without exposing their phone number or its hash
// to anyone. See controllers/rewards' getRewardDiagnostics.
router.get("/diagnostics", diagnosticsRateLimit, protect, getRewardDiagnostics);

module.exports = router;
