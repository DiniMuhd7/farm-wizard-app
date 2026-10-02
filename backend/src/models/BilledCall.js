const mongoose = require("mongoose");

// Idempotency ledger for Prepaid debits. One row per provider call leg
// that has been billed; the unique callSid means a redelivered or replayed
// completion webhook can never debit the same call twice.
const billedCallSchema = new mongoose.Schema(
  {
    callSid: { type: String, required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    costCents: { type: Number, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("BilledCall", billedCallSchema);
