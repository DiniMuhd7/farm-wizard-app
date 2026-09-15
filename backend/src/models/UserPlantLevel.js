const mongoose = require("mongoose");

const userPlantLevelSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  plantName: { type: String, required: true }, // e.g., "Apple"
  level: { type: Number, default: 1 }, // User's current level for the plant
  updatedAt: { type: Date, default: Date.now },
});

userPlantLevelSchema.index({ user: 1, plantName: 1 }, { unique: true }); // prevent duplicates

const UserPlantLevel = mongoose.model("UserPlantLevel", userPlantLevelSchema);
module.exports = UserPlantLevel;
