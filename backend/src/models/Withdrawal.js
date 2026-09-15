const mongoose = require("mongoose");

const withdrawalSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    destination: {
      type: String,
      required: true,
    },
    withdrawType: {
      type: String,
      required: true,
    },
    provider: {
      type: String,
      required: true,
    },
    reference: { type: String },
    network: { type: String },
    status: { type: String, default: "Request" },
  },
  { timestamps: true }
);
module.exports = mongoose.model("Withdrawal", withdrawalSchema);
