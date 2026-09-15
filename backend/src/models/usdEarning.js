const mongoose = require("mongoose");
// usd convestion history

const usdEarningSchema = new mongoose.Schema(
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
    reference: { type: String },
    status: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("UsdEarning", usdEarningSchema);
