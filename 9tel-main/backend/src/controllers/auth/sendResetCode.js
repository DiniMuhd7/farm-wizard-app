const crypto = require("crypto");
const sendEmail = require("../../utils/sendEmail");
const User = require("../../models/User");

exports.sendResetCode = async (req, res) => {
  const { email } = req.body;

  if (!email || email.trim() === "")
    return res.status(404).json({ message: "Please provide valid email" });

  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ message: "User not found" });

  // Generate a 6-digit code
  const resetCode = Math.floor(100000 + Math.random() * 900000).toString();

  // Store a hashed version in DB for security
  user.resetCode = crypto.createHash("sha256").update(resetCode).digest("hex");
  user.resetCodeExpires = Date.now() + 15 * 60 * 1000; // 15 minutes

  await user.save();

  // Email content
  const message = `
  <h3>Hello ${user.fullName},</h3>
  <p>Your password reset code is:</p>
  <h2 style="color:#333;">${resetCode}</h2>
  <p>This code will expire in 15 minutes.</p>
  `;
  // console.log("message ", message);

  try {
    const mail = await sendEmail({
      email: user.email,
      subject: "Your Password Reset Code",
      message,
    });
    // console.log("message ", mail);

    return res.status(200).json({ message: "Reset code sent to email" });
  } catch (err) {
    user.resetCode = undefined;
    user.resetCodeExpires = undefined;
    await user.save();
    return res.status(500).json({ message: "Failed to send email" });
  }
};
