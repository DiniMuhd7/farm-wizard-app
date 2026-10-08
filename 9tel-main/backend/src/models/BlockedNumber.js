const mongoose = require("mongoose");

// A number a user has chosen to block. Blocked callers cannot ring the user's
// 9tel number or app, and their texts are dropped (see controllers/voice and
// controllers/messages).
const blockedNumberSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    number: { type: String, required: true }, // E.164
    label: { type: String, default: "", maxlength: 60 },
  },
  { timestamps: true }
);

blockedNumberSchema.index({ user: 1, number: 1 }, { unique: true });

module.exports = mongoose.model("BlockedNumber", blockedNumberSchema);
