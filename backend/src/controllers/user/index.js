const User = require("../../models/User");
const Call = require("../../models/Call");
const bcrypt = require("bcryptjs");

const getUser = (req, res) => {
  const user = req.user;
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }
  return res.json({
    success: true,
    user,
  });
};

const updateUserDetails = async (req, res) => {
  const { fullName, avatar, newPassword } = req.body;
  const user = req.user;
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  try {
    let hashedPassword = user.password; // fallback if not updating password

    if (newPassword) {
      hashedPassword = await bcrypt.hash(newPassword, 8);
    }
    const userDetails = await User.findOneAndUpdate(
      { _id: user._id },
      // { fullName, avatar, password: hashedPassword },
      { fullName, avatar },
      { upsert: true, new: true }
    );
    res
      .status(200)
      .json({ message: "user details updated successfully", userDetails });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Error updating user" });
  }
};

// POST /api/v1/user/promote  { email, role: "admin" | "user" }   (admin only)
// Lets an existing admin promote or demote another user.
const promoteUser = async (req, res) => {
  try {
    if (req.user.userType !== "admin") {
      return res.status(403).json({ success: false, message: "Admins only" });
    }
    const { email, role } = req.body;
    if (!email || !["admin", "user"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "email and a valid role (admin|user) are required",
      });
    }
    const target = await User.findOneAndUpdate(
      { email: String(email).toLowerCase() },
      { userType: role },
      { new: true }
    );
    if (!target) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    return res.json({
      success: true,
      message: `${target.email} is now ${role}`,
      user: { email: target.email, userType: target.userType },
    });
  } catch (err) {
    console.log("promoteUser error", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to update role" });
  }
};

// POST /api/v1/user/bootstrap-admin  { email, secret }
// One-time way to create the FIRST admin without DB access. Requires the
// ADMIN_BOOTSTRAP_SECRET env var to be set and matched. After the first
// admin exists, use /promote instead.
const bootstrapAdmin = async (req, res) => {
  try {
    const { email, secret } = req.body;
    if (!process.env.ADMIN_BOOTSTRAP_SECRET) {
      return res
        .status(403)
        .json({ success: false, message: "Admin bootstrap is disabled" });
    }
    if (secret !== process.env.ADMIN_BOOTSTRAP_SECRET) {
      return res
        .status(403)
        .json({ success: false, message: "Invalid bootstrap secret" });
    }
    const target = await User.findOneAndUpdate(
      { email: String(email || "").toLowerCase() },
      { userType: "admin" },
      { new: true }
    );
    if (!target) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    return res.json({
      success: true,
      message: `${target.email} promoted to admin`,
    });
  } catch (err) {
    console.log("bootstrapAdmin error", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to bootstrap admin" });
  }
};

// GET /api/v1/user/delete/:email
// Permanently removes the account and its call history. No backup/restore
// step — the old version of this backed up several farm-game economy
// collections (earnings, inventory, plant levels, withdrawals, ...) before
// deleting, for a "restore" endpoint that was never actually wired to any
// route. None of that data model exists anymore, so this just deletes.
const deleteUser = async (req, res) => {
  const { email } = req?.params;

  try {
    let user;
    if (email) {
      user = await User.findOne({ email });
    }

    if (user) {
      await Call.deleteMany({ user: user._id });
      await User.deleteOne({ _id: user._id });
    }

    return res.status(200).json({ message: "User deleted sucessfully" });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ status: 500, message: "Error deleting user" });
  }
};

// POST /api/v1/user/push-token  { token }
// Stores this device's Expo push token. On its own this does not deliver
// incoming-call pushes while the app is closed — that additionally needs a
// Twilio Push Credential (APNs/FCM) linked to the caller's Access Token
// grants, configured outside this codebase. See services/voice.ts /
// utils/notifications.ts on the mobile side for what currently uses this.
const savePushToken = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res
        .status(400)
        .json({ success: false, message: "Push token is required" });
    }
    await User.findByIdAndUpdate(req.user._id, { notification_token: token });
    return res.json({ success: true, message: "Push token saved" });
  } catch (err) {
    console.log("savePushToken error", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to save push token" });
  }
};

module.exports = {
  getUser,
  updateUserDetails,
  promoteUser,
  bootstrapAdmin,
  deleteUser,
  savePushToken,
};
