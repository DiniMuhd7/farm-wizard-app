const crypto = require("crypto");
const User = require("../../models/User");

const verifyResetCode = async (req, res) => {
  const { email, code } = req.body;

  if (!email || !code) {
    return res.status(400).json({ message: "Invalid params" });
  }

  const user = await User.findOne({ email });

  if (!user) return res.status(404).json({ message: "User not found" });

  const hashedCode = crypto.createHash("sha256").update(code).digest("hex");

  const isCodeValid =
    user.resetCode === hashedCode && user.resetCodeExpires > Date.now();

  if (!isCodeValid) {
    return res
      .status(200)
      .json({ message: "Invalid or expired code", isCodeValid });
  }

  return res
    .status(200)
    .json({ message: "Password updated successfully", isCodeValid });
};

const resetPassword = async (req, res) => {
  const { email, code, newPassword } = req.body;

  if (!email || !code || !newPassword) {
    return res
      .status(400)
      .json({ message: "Invalid parameters please try again!" });
  }

  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ message: "User not found" });

  // The code must be re-checked here, not just at the earlier /verify-otp
  // step — otherwise this endpoint would reset any account's password given
  // only its email, with no verification at all, since nothing else on this
  // request is authenticated.
  const hashedCode = crypto.createHash("sha256").update(code).digest("hex");
  const isCodeValid =
    user.resetCode === hashedCode && user.resetCodeExpires > Date.now();
  if (!isCodeValid) {
    return res.status(400).json({ message: "Invalid or expired code" });
  }

  user.password = newPassword; // hashed by the pre("save") hook on User
  user.resetCode = undefined;
  user.resetCodeExpires = undefined;

  await user.save();
  return res.status(200).json({ message: "Password updated successfully" });
};

module.exports = { resetPassword, verifyResetCode };

/*
exports.verifyResetCodeAndChangePassword = async (req, res) => {
  const { email, code, newPassword } = req.body;

  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ message: "User not found" });

  const hashedCode = crypto.createHash("sha256").update(code).digest("hex");

  const isCodeValid =
    user.resetCode === hashedCode && user.resetCodeExpires > Date.now();

  if (!isCodeValid) {
    return res.status(400).json({ message: "Invalid or expired code" });
  }

  // Update password and clear reset fields
  user.password = newPassword; // Remember to hash this before save if you're not using middleware
  user.resetCode = undefined;
  user.resetCodeExpires = undefined;

  await user.save();

  res.status(200).json({ message: "Password updated successfully" });
};
*/
