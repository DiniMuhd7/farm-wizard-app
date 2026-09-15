const mongoose = require("mongoose");

// One row per user per day for the daily-challenge leaderboard.
const dailyChallengeScoreSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    date: { type: String, required: true }, // YYYY-MM-DD (UTC)
    crop: { type: String },
    bestScore: { type: Number, default: 0 },
    fullName: String,
    avatar: Number,
  },
  { timestamps: true }
);

dailyChallengeScoreSchema.index({ date: 1, bestScore: -1 });
dailyChallengeScoreSchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("DailyChallengeScore", dailyChallengeScoreSchema);
