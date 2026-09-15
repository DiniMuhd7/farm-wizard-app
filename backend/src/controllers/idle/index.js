const User = require("../../models/User");
const { creditScore } = require("../../utils/creditScore");

// Idle/offline earning: the farm slowly earns WizPoints while the player is
// away, up to a cap, claimed on return. Subject to the daily earning cap.
const IDLE_RATE_PER_HOUR = 50;
const IDLE_MAX_HOURS = 8;

const pendingFor = (user) => {
  const last = user.lastIdleCollected
    ? new Date(user.lastIdleCollected).getTime()
    : Date.now();
  const hours = Math.min(IDLE_MAX_HOURS, (Date.now() - last) / 3600000);
  return { pending: Math.floor(Math.max(0, hours) * IDLE_RATE_PER_HOUR), hours };
};

// GET /api/v1/user/idle
const getIdle = (req, res) => {
  const { pending, hours } = pendingFor(req.user);
  return res.json({
    success: true,
    pending,
    ratePerHour: IDLE_RATE_PER_HOUR,
    maxHours: IDLE_MAX_HOURS,
    full: hours >= IDLE_MAX_HOURS,
  });
};

// POST /api/v1/user/idle/collect
const collectIdle = async (req, res) => {
  try {
    const { pending } = pendingFor(req.user);
    if (pending <= 0) {
      return res.json({
        success: true,
        granted: 0,
        message: "Nothing to collect yet",
        userDetails: req.user,
      });
    }

    const { granted } = await creditScore(req.user._id, pending);
    if (granted <= 0) {
      // Daily cap reached; keep the timer so it can be collected later.
      return res.json({
        success: true,
        granted: 0,
        message: "Daily reward limit reached. Come back tomorrow!",
        userDetails: req.user,
      });
    }

    const userDetails = await User.findByIdAndUpdate(
      req.user._id,
      { lastIdleCollected: new Date() },
      { new: true }
    );

    return res.json({
      success: true,
      granted,
      message: `Collected ${granted} WizPoints!`,
      userDetails,
    });
  } catch (err) {
    console.log("collectIdle error", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to collect idle reward" });
  }
};

module.exports = { getIdle, collectIdle };
