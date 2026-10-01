const User = require("../../models/User");

// Pay As You Go rate for 9tel-to-carrier calls, in whole US cents per
// minute, billed in whole-minute increments (rounded up) against the
// authoritative duration Twilio reports once the call ends — see
// controllers/voice's outgoingDialStatus, the only other place this balance
// is ever decremented. Configurable per deployment; the mobile app never
// hard-codes this number, it only displays whatever the backend reports.
const RATE_PER_MINUTE_CENTS = Number(process.env.CREDITS_RATE_PER_MINUTE_CENTS || 9);
const CURRENCY = "usd";

// GET /api/v1/credits/balance
exports.getBalance = async (req, res) => {
  const user = await User.findById(req.user._id).select("creditsBalanceCents");
  return res.status(200).json({
    balanceCents: user?.creditsBalanceCents || 0,
    currency: CURRENCY,
    ratePerMinuteCents: RATE_PER_MINUTE_CENTS,
  });
};

exports.RATE_PER_MINUTE_CENTS = RATE_PER_MINUTE_CENTS;
exports.CURRENCY = CURRENCY;

// Deducts the cost of a completed carrier call from a user's balance.
// Idempotency note: this is called once per Twilio DialCallStatus webhook
// delivery (see controllers/voice's outgoingDialStatus) — a redelivered
// webhook for the same callSid is a known, accepted gap shared with that
// function's existing call-history logging, not something introduced here.
exports.debitForCompletedCall = async (userId, durationSeconds) => {
  if (!durationSeconds) return;
  const minutes = Math.max(1, Math.ceil(Number(durationSeconds) / 60) || 0);
  const costCents = minutes * RATE_PER_MINUTE_CENTS;
  try {
    await User.findByIdAndUpdate(userId, { $inc: { creditsBalanceCents: -costCents } });
  } catch (error) {
    console.error("Unable to debit credits for completed call:", error.message);
  }
};
