const mongoose = require("mongoose");

const cardSchema = new mongoose.Schema({
  first_6digits: String,
  last_4digits: String,
  issuer: String,
  country: String,
  type: String,
  token: String,
  expiry: String,
});

const transactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reference: { type: String, required: true },
    transactionId: { type: String, required: true },
    card: cardSchema,
    item: { type: String, required: true },
    amount: { type: String, required: true },
    quantity: { type: Number, default: 1 },
    currency: { type: String, default: "USD" },
    status: { type: String, default: "Active" },
  },
  { timestamps: true }
);

transactionSchema.index({ user: 1, reference: 1 }, { unique: true }); // prevent duplicates

const Transaction = mongoose.model("Transaction", transactionSchema);
module.exports = Transaction;
