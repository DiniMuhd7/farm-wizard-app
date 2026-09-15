const User = require("../../models/User");
const sendNotification = require("../../utils/sendNotification");
const { creditScore } = require("../../utils/creditScore");

// One-directional: only the inviter (referrer) is rewarded. The new user
// who redeems gets nothing — this removes the incentive to mass-create
// throwaway accounts just to collect a signup bonus.
const REFERRER_REWARD = 500; // WizPoints to the person who invited
const REFEREE_REWARD = 0;

// Build a short, human-friendly code from the user id + name.
const makeCode = (user) => {
  const namePart = (user.fullName || "WIZ")
    .replace(/[^a-zA-Z]/g, "")
    .toUpperCase()
    .slice(0, 4)
    .padEnd(4, "X");
  const idPart = String(user._id).slice(-4).toUpperCase();
  return `${namePart}${idPart}`;
};

const ensureReferralCode = async (user) => {
  if (user.referralCode) return user.referralCode;
  // Retry a couple of times in case of a rare collision.
  for (let i = 0; i < 3; i++) {
    const code = i === 0 ? makeCode(user) : makeCode(user) + i;
    const exists = await User.findOne({ referralCode: code });
    if (!exists) {
      user.referralCode = code;
      await user.save();
      return code;
    }
  }
  return null;
};

// GET /api/v1/referral
const getReferral = async (req, res) => {
  try {
    const user = req.user;
    const code = await ensureReferralCode(user);
    return res.json({
      success: true,
      referralCode: code,
      referralCount: user.referralCount || 0,
      alreadyReferred: !!user.referredBy,
      rewards: { referrer: REFERRER_REWARD, referee: REFEREE_REWARD },
    });
  } catch (error) {
    console.error("getReferral error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// POST /api/v1/referral/redeem  { code }
const redeemReferral = async (req, res) => {
  try {
    const user = req.user;
    const { code } = req.body;

    if (!code) {
      return res
        .status(400)
        .json({ success: false, message: "A referral code is required" });
    }
    if (user.referredBy) {
      return res.status(400).json({
        success: false,
        message: "You have already redeemed a referral code",
      });
    }

    const normalized = String(code).trim().toUpperCase();
    const myCode = await ensureReferralCode(user);
    if (normalized === myCode) {
      return res
        .status(400)
        .json({ success: false, message: "You can't use your own code" });
    }

    const referrer = await User.findOne({ referralCode: normalized });
    if (!referrer) {
      return res
        .status(404)
        .json({ success: false, message: "Invalid referral code" });
    }

    // Mark the new user as referred (no reward to them — one-directional),
    // and reward only the referrer (capped by the daily earning limit).
    const userDetails = await User.findByIdAndUpdate(
      user._id,
      { referredBy: normalized },
      { new: true }
    );
    await creditScore(referrer._id, REFERRER_REWARD);
    await User.findByIdAndUpdate(referrer._id, { $inc: { referralCount: 1 } });

    await sendNotification(
      referrer._id,
      `Someone joined with your referral code! You earned ${REFERRER_REWARD} WizPoints.`
    );

    return res.json({
      success: true,
      message: "Referral code applied — thanks for joining!",
      userDetails,
    });
  } catch (error) {
    console.error("redeemReferral error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

module.exports = { getReferral, redeemReferral };
