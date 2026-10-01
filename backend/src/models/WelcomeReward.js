const mongoose = require("mongoose");

// Immutable-identity ledger for the one-time "first minute free" welcome
// reward on a 9tel-to-local-carrier call. One row per verified phone
// identity, ever:
//   - `user` is unique, so an account can't hold two grants.
//   - `identityHash` (HMAC of the verified phone number, see
//     controllers/rewards) is unique, so deleting an account and
//     re-registering — or registering a second account with the same
//     verified number — can never produce a second grant. The row is
//     deliberately NOT removed when a user is deleted.
// Only the backend ever changes `state`; the mobile app just reads it.
const welcomeRewardSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    identityHash: { type: String, required: true, unique: true },
    grantedSeconds: { type: Number, required: true },
    usedSeconds: { type: Number, default: 0 },
    // available -> reserved (a call is in flight) -> redeemed (connected),
    // or reserved -> available again if that call never connected.
    state: { type: String, enum: ["available", "reserved", "redeemed"], default: "available" },
    reservedCallSid: String,
    reservedAt: Date,
    redeemedAt: Date,
    redeemedCallSid: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("WelcomeReward", welcomeRewardSchema);
