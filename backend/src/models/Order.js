const mongoose = require("mongoose");

// Tracks a payment attempt for a 9tel number, a Pay As You Go credits
// top-up, or a Premium subscription period, from checkout creation through
// webhook confirmation. `kind` distinguishes which: "number" (the original,
// default flow) gates purchaseAndAssignNumber() (see controllers/numbers);
// "credits" gates a balance top-up (see controllers/credits); "premium"
// gates extending User.isPremium/premiumUntil (see controllers/payments'
// fulfillPremiumOrder) — all three only ever take effect once payment is
// confirmed.
const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    provider: { type: String, enum: ["stripe", "flutterwave"], required: true },
    kind: { type: String, enum: ["number", "credits", "premium"], default: "number" },
    // Only meaningful for kind: "number".
    countryCode: {
      type: String,
      required: function requiredForNumberOrders() {
        return this.kind === "number";
      },
    },
    // Only meaningful for kind: "credits" — how many US cents to add to
    // creditsBalanceCents once payment is confirmed.
    creditsCents: { type: Number, default: 0 },
    // Only meaningful for kind: "premium" — how many days of Premium to
    // grant once payment is confirmed.
    premiumDays: { type: Number, default: 0 },
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
    // Set once a kind: "credits" order's balance top-up is actually applied
    // — same "already fulfilled" dedupe purpose as fulfilledPhoneNumber
    // above, for the credits flow.
    fulfilledCreditsCents: { type: Number, default: null },
    // Set once a kind: "premium" order's entitlement is actually applied —
    // same dedupe purpose, for the premium flow.
    fulfilledPremiumDays: { type: Number, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
