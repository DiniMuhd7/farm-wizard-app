const mongoose = require("mongoose");

const deletedUserDataSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  deletedAt: { type: Date, default: Date.now },

  // User info
  user: mongoose.Schema.Types.Mixed,

  // Related data
  earnings: [mongoose.Schema.Types.Mixed],
  notifications: [mongoose.Schema.Types.Mixed],
  transactions: [mongoose.Schema.Types.Mixed],
  usdEarnings: [mongoose.Schema.Types.Mixed],
  inventory: [mongoose.Schema.Types.Mixed],
  plantLevels: [mongoose.Schema.Types.Mixed],
  withdrawals: [mongoose.Schema.Types.Mixed],
});

module.exports = mongoose.model("DeletedUserData", deletedUserDataSchema);
