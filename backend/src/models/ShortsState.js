const mongoose = require("mongoose");

// Tracks video ids already served so the Shorts feed doesn't repeat them.
const shortsStateSchema = new mongoose.Schema(
  {
    key: { type: String, unique: true, default: "served" },
    ids: { type: [String], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ShortsState", shortsStateSchema);
