const mongoose = require("mongoose");

// Tracks a Flutterwave payment attempt for a 9tel number, a Prepaid credits
// top-up, or an Airbundle minute bundle, from checkout creation through
// verified confirmation. `kind` distinguishes which: "number" (the original,
// default flow) gates purchaseAndAssignNumber() (see controllers/numbers);
// "credits" gates a balance top-up (see controllers/credits); "airbundle"
// gates adding User.airbundleMinutes and extending User.isPremium/
// premiumUntil (see controllers/payments' fulfillAirbundleOrder) — all only
// ever take effect once payment is verified. "premium" is the legacy name
// for "airbundle", kept so existing orders still load and fulfill; "stripe"
// is likewise only retained for orders created before Stripe was removed.
const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    provider: { type: String, enum: ["stripe", "flutterwave"], required: true },
    kind: { type: String, enum: ["number", "credits", "airbundle", "premium"], default: "number" },
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
    // Only meaningful for kind: "airbundle" — how many minutes the bundle
    // adds once payment is confirmed.
    bundleMinutes: { type: Number, default: 0 },
    // Only meaningful for kind: "airbundle"/"premium" — how many days of
    // ad-free entitlement to grant once payment is confirmed.
    premiumDays: { type: Number, default: 0 },
    amount: { type: Number, required: true },
    currency: { type: String, required: true },
    // Flutterwave: our own tx_ref (a string Flutterwave echoes back
    // verbatim).
    providerReference: { type: String, required: true, unique: true },
    // Captured from the webhook once payment succeeds — needed to issue a
    // refund later without re-fetching anything from the provider.
    // Flutterwave: the numeric transaction id (different from
    // providerReference, which is our own tx_ref string).
    providerChargeId: { type: String, default: null },
    status: {
      type: String,
      // paid_unfulfilled: payment succeeded but the Twilio purchase that
      // was supposed to happen next failed anyway (e.g. that country ran
      // out of numbers in the moments between checkout and fulfillment) —
      // distinct from "failed" (payment itself never succeeded), because
      // this state means a refund is owed.
      // cancelled: the person backed out of Flutterwave's checkout page.
      // processing: payment verified; claimed by exactly one fulfiller.
      enum: ["pending", "processing", "paid", "paid_unfulfilled", "refunded", "failed", "cancelled"],
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
    // Set once a kind: "airbundle"/"premium" order's entitlement is actually
    // applied — same dedupe purpose, for the Airbundle flow.
    fulfilledPremiumDays: { type: Number, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
