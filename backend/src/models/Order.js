const mongoose = require("mongoose");

// Tracks a payment attempt for a 9tel number, from checkout creation
// through webhook confirmation. This is what actually gates
// purchaseAndAssignNumber() (see controllers/numbers) — a number is only
// ever purchased from Twilio after an Order here reaches "paid".
const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    provider: { type: String, enum: ["stripe", "flutterwave"], required: true },
    countryCode: { type: String, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, required: true },
    // Stripe: the Checkout Session id. Flutterwave: our own tx_ref (a
    // string Flutterwave echoes back verbatim, since v3 Standard doesn't
    // let the caller choose the session identifier the way Stripe does).
    providerReference: { type: String, required: true, unique: true },
    // Captured from the webhook once payment succeeds — needed to issue a
    // refund later without re-fetching anything from the provider.
    // Stripe: the PaymentIntent id. Flutterwave: the numeric transaction id
    // (different from providerReference, which is our own tx_ref string).
    providerChargeId: { type: String, default: null },
    status: {
      type: String,
      // paid_unfulfilled: payment succeeded but the Twilio purchase that
      // was supposed to happen next failed anyway (e.g. that country ran
      // out of numbers in the moments between checkout and fulfillment) —
      // distinct from "failed" (payment itself never succeeded), because
      // this state means a refund is owed.
      enum: ["pending", "paid", "paid_unfulfilled", "refunded", "failed"],
      default: "pending",
    },
    // Set once purchaseAndAssignNumber() actually succeeds for this order —
    // lets the webhook handler tell "already fulfilled, a duplicate
    // delivery of this event" apart from "still needs fulfilling".
    fulfilledPhoneNumber: { type: String, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
