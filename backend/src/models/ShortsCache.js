const mongoose = require("mongoose");

// Caches the daily list of YouTube Shorts so we hit the YouTube Data API at
// most once per day (quota friendly).
const shortsCacheSchema = new mongoose.Schema(
  {
    date: { type: String, unique: true, index: true }, // YYYY-MM-DD (UTC)
    videos: { type: Array, default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ShortsCache", shortsCacheSchema);
