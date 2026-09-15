const mongoose = require("mongoose");

const GameStateSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      //   unique: true,
    },

    plantName: { type: String },
    userLevel: { type: Number, default: 1 },
    timeLeft: { type: Number, required: true },
    plantHealth: { type: Number, default: 100 },
    waterLevel: { type: Number, default: 100 },
    nutrientLevel: { type: Number, default: 100 },
    score: { type: Number, default: 0 },
    pausedAt: String,
    // pausedAt: { type: Number }, // Unix timestamp

    activeThreat: {
      type: {
        type: String,
        enum: ["storm", "disease"],
      },
      resolved: Boolean,
      createdAt: Number,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("GameState", GameStateSchema);
