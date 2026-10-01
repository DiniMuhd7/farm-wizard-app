const crypto = require("crypto");
const User = require("../../models/User");
const WelcomeReward = require("../../models/WelcomeReward");

const WELCOME_SECONDS = 60;
// A reservation is held only while its call is in flight. The free call is
// hard-capped at WELCOME_SECONDS by Twilio (<Dial timeLimit>), so a
// reservation older than this can only be one whose status callback never
// arrived, and is safe to hand out again.
const RESERVATION_TTL_MS = 15 * 60 * 1000;

function identityHash(phoneNumber) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is required");
  return crypto.createHmac("sha256", secret).update(`welcome:${phoneNumber}`).digest("hex");
}

// Creates the user's one-and-only ledger row, if they qualify: a real
// (non-guest) account with a phone number verified through Twilio. Safe to
// call repeatedly and concurrently — the unique indexes make every call
// after the first (for this user OR this phone number) a no-op.
async function ensureWelcomeReward(userId) {
  const user = await User.findById(userId).select("isGuest status verifiedCallerId").lean();
  if (!user || user.isGuest || user.status === "inactive" || !user.verifiedCallerId) return null;
  try {
    return await WelcomeReward.create({
      user: user._id,
      identityHash: identityHash(user.verifiedCallerId),
      grantedSeconds: WELCOME_SECONDS,
    });
  } catch (error) {
    if (error?.code === 11000) return WelcomeReward.findOne({ user: user._id });
    throw error;
  }
}

// Atomically claims the reward for one call. Returns the seconds the call
// may run for free (0 = not eligible). The compare-and-set update means two
// simultaneous calls can never both win; a redelivered webhook for the SAME
// call sid gets the same answer back.
async function reserveForCall(userId, callSid) {
  if (!callSid) return 0;
  const reward = await WelcomeReward.findOneAndUpdate(
    {
      user: userId,
      $or: [
        { state: "available" },
        { state: "reserved", reservedCallSid: callSid },
        { state: "reserved", reservedAt: { $lt: new Date(Date.now() - RESERVATION_TTL_MS) } },
      ],
    },
    { state: "reserved", reservedCallSid: callSid, reservedAt: new Date() },
    { new: true }
  );
  return reward ? reward.grantedSeconds - reward.usedSeconds : 0;
}

// Settles the reservation made for `callSid` once Twilio reports how the
// call ended, using Twilio's own status/duration. Idempotent: only a
// reservation still held by this exact call sid is touched.
// Returns "redeemed", "released", or null (this call held no reservation).
async function settleForCall(userId, callSid, { connected, durationSeconds }) {
  if (!callSid) return null;
  if (connected) {
    const used = Math.min(WELCOME_SECONDS, Math.max(1, Math.ceil(Number(durationSeconds) || 0)));
    const updated = await WelcomeReward.findOneAndUpdate(
      { user: userId, state: "reserved", reservedCallSid: callSid },
      { state: "redeemed", usedSeconds: used, redeemedAt: new Date(), redeemedCallSid: callSid },
      { new: true }
    );
    return updated ? "redeemed" : null;
  }
  const released = await WelcomeReward.findOneAndUpdate(
    { user: userId, state: "reserved", reservedCallSid: callSid },
    { state: "available", $unset: { reservedCallSid: 1, reservedAt: 1 } },
    { new: true }
  );
  return released ? "released" : null;
}

// GET /api/v1/rewards/welcome — read-only view for the app. Never trusted
// by the backend for anything; eligibility is re-evaluated at call time.
exports.getWelcomeReward = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("isGuest verifiedCallerId").lean();
    if (!user || user.isGuest) return res.status(200).json({ status: "unavailable", seconds: 0 });
    if (!user.verifiedCallerId) return res.status(200).json({ status: "verify_phone", seconds: 0 });
    const reward = await ensureWelcomeReward(req.user._id);
    if (!reward) {
      // Ledger row exists for this phone under a different account, or the
      // account isn't eligible.
      return res.status(200).json({ status: "unavailable", seconds: 0 });
    }
    if (reward.state === "redeemed") return res.status(200).json({ status: "redeemed", seconds: 0 });
    return res.status(200).json({ status: "available", seconds: reward.grantedSeconds - reward.usedSeconds });
  } catch (error) {
    console.error("Unable to load welcome reward:", error.message);
    return res.status(500).json({ message: "Unable to check your welcome reward right now." });
  }
};

exports.WELCOME_SECONDS = WELCOME_SECONDS;
exports.ensureWelcomeReward = ensureWelcomeReward;
exports.reserveForCall = reserveForCall;
exports.settleForCall = settleForCall;
exports._private = { identityHash };
