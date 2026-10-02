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
// Returns "redeemed", "released", "replayed" (a redelivered event for a call
// this reward was already redeemed by), or null (this call held no reservation).
async function settleForCall(userId, callSid, { connected, durationSeconds }) {
  if (!callSid) return null;
  if (connected) {
    const used = Math.min(WELCOME_SECONDS, Math.max(1, Math.ceil(Number(durationSeconds) || 0)));
    const updated = await WelcomeReward.findOneAndUpdate(
      { user: userId, state: "reserved", reservedCallSid: callSid },
      { state: "redeemed", usedSeconds: used, redeemedAt: new Date(), redeemedCallSid: callSid },
      { new: true }
    );
    if (updated) return "redeemed";
    const already = await WelcomeReward.findOne({ user: userId, state: "redeemed", redeemedCallSid: callSid }).lean();
    return already ? "replayed" : null;
  }
  const released = await WelcomeReward.findOneAndUpdate(
    { user: userId, state: "reserved", reservedCallSid: callSid },
    { state: "available", $unset: { reservedCallSid: 1, reservedAt: 1 } },
    { new: true }
  );
  return released ? "released" : null;
}

// Maps a ledger row to what the app may show. A reservation older than the
// TTL is treated as available again, exactly as reserveForCall would.
function displayState(reward, now = Date.now()) {
  if (reward.state === "redeemed") return { status: "redeemed", seconds: 0 };
  const stale = reward.state === "reserved" && (!reward.reservedAt || new Date(reward.reservedAt).getTime() < now - RESERVATION_TTL_MS);
  const seconds = Math.max(0, reward.grantedSeconds - (reward.usedSeconds || 0));
  if (reward.state === "reserved" && !stale) return { status: "in_use", seconds };
  return { status: "available", seconds };
}

// What the person can actually dial right now, derived server-side from the
// reward and the purchased balance. Purchased credit is used first when the
// balance covers a minute (see controllers/voice); the free minute is the
// fallback when it does not.
function effectiveAvailability(status, balanceCents) {
  const { RATE_PER_MINUTE_CENTS } = require("../credits");
  const freeMinute = status === "available" || status === "in_use";
  const credits = (balanceCents || 0) >= RATE_PER_MINUTE_CENTS;
  if (credits) return "credits";
  return freeMinute ? "free_minute" : "none";
}

// GET /api/v1/rewards/welcome — read-only view for the app. Never trusted
// by the backend for anything; eligibility is re-evaluated at call time.
// The reward is its own entitlement: it is reported separately from the
// purchased monetary balance and is never added to it.
exports.getWelcomeReward = async (req, res) => {
  try {
    res.set?.("Cache-Control", "no-store");
    const user = await User.findById(req.user._id).select("isGuest verifiedCallerId creditsBalanceCents").lean();
    const respondWith = (view) =>
      res.status(200).json({
        ...view,
        grantedSeconds: view.status === "unavailable" || view.status === "verify_phone" ? 0 : WELCOME_SECONDS,
        effectiveAvailability: effectiveAvailability(view.status, user?.creditsBalanceCents),
      });
    if (!user || user.isGuest) return respondWith({ status: "unavailable", seconds: 0 });
    if (!user.verifiedCallerId) return respondWith({ status: "verify_phone", seconds: 0 });
    const reward = await ensureWelcomeReward(req.user._id);
    if (!reward) {
      // Ledger row exists for this phone under a different account, or the
      // account isn't eligible.
      return respondWith({ status: "unavailable", seconds: 0 });
    }
    return respondWith(displayState(reward));
  } catch (error) {
    console.error("Unable to load welcome reward:", error.message);
    return res.status(500).json({ message: "Unable to check your welcome reward right now." });
  }
};

// GET /api/v1/rewards/diagnostics?userId=<id> — admin only.
//
// This exists because the welcome reward can silently fail for a reason
// that's invisible both to the user (who should only ever see a plain
// "not enough credit" message, never internals) and to the generic app
// logs: a missing JWT_SECRET makes identityHash() throw for every single
// user, which the dial-time code path (controllers/voice) already catches
// and folds into the same insufficient-credit denial every other
// ineligible reason produces. Without this endpoint, "configuration
// failure" and "genuinely ineligible" are indistinguishable from the
// outside, which is exactly the ambiguity that made this bug hard to
// diagnose in the first place. Never returns the phone number or its hash.
exports.getRewardDiagnostics = async (req, res) => {
  if (req.user?.userType !== "admin") {
    return res.status(403).json({ message: "Admins only" });
  }
  const configured = { jwtSecret: Boolean(process.env.JWT_SECRET) };
  const userId = String(req.query?.userId || "").trim();
  if (!userId) {
    return res.status(200).json({ configured });
  }
  try {
    const user = await User.findById(userId).select("isGuest status verifiedCallerId").lean();
    if (!user) return res.status(200).json({ configured, user: { exists: false } });

    const eligible = !user.isGuest && user.status !== "inactive" && Boolean(user.verifiedCallerId);
    let rewardState = "ineligible";
    if (eligible) {
      try {
        const reward = await WelcomeReward.findOne({ user: userId });
        rewardState = reward ? reward.state : "ungranted";
      } catch (error) {
        rewardState = "configuration_failed";
      }
    }
    return res.status(200).json({
      configured,
      user: {
        exists: true,
        isGuest: Boolean(user.isGuest),
        status: user.status,
        hasVerifiedCallerId: Boolean(user.verifiedCallerId),
        eligible,
        rewardState,
      },
    });
  } catch (error) {
    console.error("Unable to load reward diagnostics:", error.message);
    return res.status(500).json({ message: "Unable to load reward diagnostics right now." });
  }
};

exports.WELCOME_SECONDS = WELCOME_SECONDS;
exports.ensureWelcomeReward = ensureWelcomeReward;
exports.reserveForCall = reserveForCall;
exports.settleForCall = settleForCall;
exports._private = { identityHash, displayState, effectiveAvailability };
