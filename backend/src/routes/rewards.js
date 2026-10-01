const express = require("express");
const { rateLimit } = require("express-rate-limit");
const { protect } = require("../middleware/auth");
const { getWelcomeReward } = require("../controllers/rewards");

const router = express.Router();
const rewardRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Please wait before checking your reward again." },
});

router.get("/welcome", rewardRateLimit, protect, getWelcomeReward);

module.exports = router;
