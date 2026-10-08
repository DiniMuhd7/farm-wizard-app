const mongoose = require("mongoose");

// An eSIM profile bought by a user. The activation code is effectively a
// one-time credential for installing the profile, so it is only ever returned
// to its owner (see controllers/esim).
const esimSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    // One profile per paid order — also what makes fulfillment idempotent.
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, unique: true },
    planId: { type: String, required: true },
    countryCode: { type: String, required: true },
    country: { type: String, required: true },
    dataGB: { type: Number, required: true },
    validityDays: { type: Number, required: true },
    provider: { type: String, required: true },
    providerOrderId: { type: String, default: "" },
    iccid: { type: String, required: true },
    smdpAddress: { type: String, default: null },
    matchingId: { type: String, default: null },
    activationCode: { type: String, required: true },
    qrUrl: { type: String, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ESim", esimSchema);
