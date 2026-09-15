const User = require("../models/User");

// Maximum WizPoints a user can EARN per day (UTC). Spending (conversion,
// cosmetics) is not affected. Tune this to your ad revenue per user.
// At 1000 WZP = $0.01, 10000 WZP/day caps daily earnings at ~$0.10/user.
const DAILY_WZP_CAP = 10000;

const todayStr = () => new Date().toISOString().slice(0, 10);

// Credits `requested` WizPoints to the user's score, clamped so total
// earnings for the day never exceed DAILY_WZP_CAP. Returns the updated user
// plus how much was actually granted.
const creditScore = async (userId, requested) => {
  const amount = Math.max(0, Number(requested) || 0);
  const user = await User.findById(userId);
  if (!user) return { updated: null, granted: 0, capped: false };

  const today = todayStr();
  const earnedToday =
    user.dailyEarned && user.dailyEarned.date === today
      ? user.dailyEarned.amount || 0
      : 0;

  const remaining = Math.max(0, DAILY_WZP_CAP - earnedToday);
  const granted = Math.min(amount, remaining);

  const updated = await User.findByIdAndUpdate(
    userId,
    {
      $inc: { score: granted },
      dailyEarned: { date: today, amount: earnedToday + granted },
    },
    { new: true }
  );

  return { updated, granted, capped: granted < amount };
};

module.exports = { creditScore, DAILY_WZP_CAP };
