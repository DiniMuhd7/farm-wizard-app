const DailyChallengeScore = require("../../models/DailyChallengeScore");
const { todayStr, cropForDate } = require("../../utils/dailyChallenge");

// GET /api/v1/leaderboard/daily
// Returns today's challenge crop and the ranked scores for today.
const getDailyChallenge = async (req, res) => {
  try {
    const date = todayStr();
    const crop = cropForDate(date);
    const { limit = 100 } = req.query;

    const scores = await DailyChallengeScore.find({ date })
      .sort({ bestScore: -1 })
      .limit(parseInt(limit))
      .exec();

    const ranked = scores.map((s, index) => ({
      userId: s.userId,
      fullName: s.fullName,
      avatar: s.avatar,
      bestScore: s.bestScore,
      position: index + 1,
    }));

    return res.json({ success: true, date, crop, leaderboard: ranked });
  } catch (error) {
    console.error("getDailyChallenge error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// POST /api/v1/leaderboard/daily/submit  { score }
// Records the user's best score for today's challenge.
const submitDailyChallengeScore = async (req, res) => {
  try {
    const user = req.user;
    const { score } = req.body;
    const numScore = Number(score);

    if (isNaN(numScore)) {
      return res
        .status(400)
        .json({ success: false, message: "A numeric score is required" });
    }

    const date = todayStr();
    const crop = cropForDate(date);

    let entry = await DailyChallengeScore.findOne({ userId: user._id, date });
    if (!entry) {
      entry = await DailyChallengeScore.create({
        userId: user._id,
        date,
        crop,
        bestScore: numScore,
        fullName: user.fullName,
        avatar: user.avatar,
      });
    } else if (numScore > entry.bestScore) {
      entry.bestScore = numScore;
      entry.fullName = user.fullName;
      entry.avatar = user.avatar;
      await entry.save();
    }

    // current rank
    const better = await DailyChallengeScore.countDocuments({
      date,
      bestScore: { $gt: entry.bestScore },
    });

    return res.json({
      success: true,
      message: "Daily challenge score recorded",
      date,
      crop,
      bestScore: entry.bestScore,
      position: better + 1,
    });
  } catch (error) {
    console.error("submitDailyChallengeScore error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

module.exports = { getDailyChallenge, submitDailyChallengeScore };
