const express = require("express");
const { getLeaderboard } = require("../controllers/user/leaderboard");
const {
  getDailyChallenge,
  submitDailyChallengeScore,
} = require("../controllers/leaderboard/dailyChallenge");
const { protect } = require("../middleware/auth");
const router = express.Router();

router.get("/all", getLeaderboard);
router.get("/daily", getDailyChallenge);
router.post("/daily/submit", protect, submitDailyChallengeScore);

module.exports = router;
