const mongoose = require("mongoose");

const userInventorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    quantity: {
      type: Number,
      default: 1,
      min: 0,
    },
  },
  { timestamps: true }
);
userInventorySchema.index({ userId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("UserInventory", userInventorySchema);
