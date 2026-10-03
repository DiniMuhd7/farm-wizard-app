const User = require("../../models/User");

// Prepaid rate for 9tel-to-carrier calls, in whole US cents per
// minute, billed in whole-minute increments (rounded up) against the
// authoritative duration Twilio reports once the call ends — see
// controllers/voice's outgoingDialStatus, the only other place this balance
// is ever decremented. Configurable per deployment; the mobile app never
// hard-codes this number, it only displays whatever the backend reports.
const RATE_PER_MINUTE_CENTS = Number(process.env.CARRIER_RATE_PER_MINUTE_CENTS || process.env.CREDITS_RATE_PER_MINUTE_CENTS || 9);
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
// Idempotent per provider call sid: a BilledCall row with a unique callSid is
// claimed before the debit, so a redelivered/replayed Twilio webhook (or two
// concurrent deliveries) debits at most once. If the debit itself fails the
// claim is released so a later redelivery can bill the call. Without a sid
// there is nothing to dedupe on, so the debit is applied as before.
exports.debitForCompletedCall = async (userId, durationSeconds, ratePerMinuteCents = RATE_PER_MINUTE_CENTS, callSid) => {
  // Backward-compatible third argument: existing callers passed callSid here.
  if (typeof ratePerMinuteCents === "string" && callSid === undefined) {
    callSid = ratePerMinuteCents;
    ratePerMinuteCents = RATE_PER_MINUTE_CENTS;
  }
  if (!durationSeconds) return;
  const minutes = Math.max(1, Math.ceil(Number(durationSeconds) / 60) || 0);
  const costCents = minutes * ratePerMinuteCents;
  const BilledCall = callSid ? require("../../models/BilledCall") : null;
  try {
    if (BilledCall) {
      try {
        await BilledCall.create({ callSid, user: userId, costCents });
      } catch (error) {
        if (error?.code === 11000) return;
        throw error;
      }
    }
    try {
      await User.findByIdAndUpdate(userId, { $inc: { creditsBalanceCents: -costCents } });
    } catch (error) {
      if (BilledCall) await BilledCall.deleteOne({ callSid }).catch(() => {});
      throw error;
    }
  } catch (error) {
    console.error("Unable to debit credits for completed call:", error.message);
  }
};
