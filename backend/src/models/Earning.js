const mongoose = require("mongoose");

const earningSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    score: {
      type: Number,
      required: true,
    },
    reference: { type: String },
    status: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Earning", earningSchema);
