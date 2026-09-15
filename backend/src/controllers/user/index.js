const Earning = require("../../models/Earning");
const Notification = require("../../models/Notification");
const Transaction = require("../../models/Transaction");
const usdEarning = require("../../models/usdEarning");
const User = require("../../models/User");
const bcrypt = require("bcryptjs");
const UserInventory = require("../../models/UserInventory");
const Withdrawal = require("../../models/Withdrawal");
const UserPlantLevel = require("../../models/UserPlantLevel");
const sendNotification = require("../../utils/sendNotification");
const sendPush = require("../../utils/sendPush");
const DeletedUserData = require("../../models/DeletedUserData");
const { creditScore } = require("../../utils/creditScore");

const getUser = (req, res) => {
  const user = req.user;
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }
  return res.json({
    success: true,
    user,
  });
  //   if (!req.res) {
  //     return res.json({ success: false, message: "Un authorize access" });
  //   }
  //   res.json({
  //     success: true,
  //     profile: {
  //       fullname: req.res.fullname,
  //       email: req.res.email,
  //       avatar: req.res.avatar ? req.res.avatar : "",
  //     },
  //   });
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

const submitConversion = async (req, res) => {
  const { amount } = req.body;

  const userId = req.user._id;
  if (!userId) {
    return res.status(404).json({ success: false, message: "User not found" });
  }
  if (!amount) {
    return res.status(404).json({
      success: false,
      message: "Some fields are missing, All required",
    });
  }

  try {
    const usdConversion = (Number(amount * 0.01) / 1000).toFixed(8);
    const userDetails = await User.findByIdAndUpdate(
      userId,
      {
        $inc: { score: -amount, usdBalance: usdConversion },
      },
      { new: true }
    );

    const newUsdEarning = await usdEarning.create({
      userId,
      amount,
    });

    const formattedAmount = Number(amount).toFixed(2);
    const formattedUsd = Number(usdConversion).toFixed(5);
    await sendNotification(
      userId,
      `You converted ${formattedAmount} token to ${formattedUsd} USD `
    );

    return res.json({
      success: true,
      message: `Token converted to ${usdConversion} USD successfully`,
      userDetails,
      newUsdEarning,
    });
  } catch (err) {
    console.log("err", err);
    return res.status(500).json({
      success: false,
      message: "Failed to convert",
      error: err.response?.data || err.message,
    });
  }
};

const submitRewardEarned = async (req, res) => {
  const { amount } = req.body;

  const userId = req.user._id;
  if (!userId) {
    return res.status(404).json({ success: false, message: "User not found" });
  }
  if (!amount) {
    return res.status(404).json({
      success: false,
      message: "Some fields are missing, All required",
    });
  }

  try {
    // Capped at the daily earning limit to deter grinding/farming.
    const { updated: userDetails, granted } = await creditScore(userId, amount);

    await sendNotification(userId, `You earned ${granted} token watching ads  `);

    return res.json({
      success: true,
      message:
        granted < amount
          ? `Daily reward limit reached. You earned ${granted} token.`
          : `You earn ${granted} token for watching ads successfully`,
      userDetails,
    });
  } catch (err) {
    console.log("err", err);
    return res.status(500).json({
      success: false,
      message: "Failed to convert",
      error: err.response?.data || err.message,
    });
  }
};

// POST /api/v1/user/push-token  { token }
// The app registers its Expo push token so the server can push to it.
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

// POST /api/v1/user/broadcast  { title, message }   (admin only)
// Sends a push + in-app notification to every user with a push token.
const broadcastNotification = async (req, res) => {
  try {
    if (req.user.userType !== "admin") {
      return res
        .status(403)
        .json({ success: false, message: "Admins only" });
    }
    const { title, message } = req.body;
    if (!message) {
      return res
        .status(400)
        .json({ success: false, message: "A message is required" });
    }

    const users = await User.find({
      notification_token: { $ne: null },
    }).select("_id notification_token");

    // Fire notifications without blocking the response on every send.
    Promise.allSettled(
      users.map((u) =>
        sendNotification(u._id, message, title || "Farm Wizard")
      )
    ).catch(() => {});

    return res.json({
      success: true,
      message: `Broadcast queued to ${users.length} users`,
    });
  } catch (err) {
    console.log("broadcastNotification error", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to broadcast" });
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

const deleteUser = async (req, res) => {
  const { email } = req?.params;

  // if (!email) {
  //   return res.status(400).json({
  //     status: 404,
  //     message: "email or Id required, pls provide valid parameter user",
  //   });
  // }

  try {
    // const user = await User.findById(id);
    // const user = await User.findOne({ email });

    // if (!user) {
    //   return res.status(404).json({
    //     status: 404,
    //     message: "User doest not exist, Please try again",
    //   });
    // }
    let user;
    if (email) {
      user = await User.findOne({ email });
    }

    if (user) {
      // Step 1: Fetch all related data
      const [
        earnings,
        notifications,
        transactions,
        usdEarnings,
        inventory,
        plantLevels,
        withdrawals,
      ] = await Promise.all([
        Earning.find({ userId: user._id }),
        Notification.find({ userId: user._id }),
        Transaction.find({ userId: user._id }),
        usdEarning.find({ userId: user._id }),
        UserInventory.find({ userId: user._id }),
        UserPlantLevel.find({ userId: user._id }),
        Withdrawal.find({ userId: user._id }),
      ]);

      // Step 2: Save the backup
      await DeletedUserData.create({
        userId: user._id,
        user: {
          fullName: user.fullName,
          email: user.email,
          password: user.password,
          userType: user.userType,
          createdAt: user.createdAt,
          lastLoginDate: user.lastLoginDate,
          isPremium: user.isPremium,
          score: user.score,
          usdBalance: user.usdBalance,
          avatar: user.avatar,
          country: user.country,
          language: user.language,
        },
        earnings,
        notifications,
        transactions,
        usdEarnings,
        inventory,
        plantLevels,
        withdrawals,
      });

      // Step 3: Delete all data
      await Promise.all([
        Earning.deleteMany({ userId: user._id }),
        Notification.deleteMany({ userId: user._id }),
        Transaction.deleteMany({ userId: user._id }),
        usdEarning.deleteMany({ userId: user._id }),
        UserInventory.deleteMany({ userId: user._id }),
        UserPlantLevel.deleteMany({ userId: user._id }),
        Withdrawal.deleteMany({ userId: user._id }),
      ]);

      const deletedUser = await User.deleteOne({ _id: user._id });
    }

    // return res
    //   .status(200)
    //   .json({ status: 200, message: "User deleted sucessfully", deletedUser });
    return res.status(200).json({ message: "User deleted sucessfully" });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ status: 500, message: "Error deleting user" });
  }
};

const restoreDeletedUser = async (req, res) => {
  const userId = req.user._id;
  if (!userId) {
    return res.status(404).json({
      status: 404,
      message: "User doest not exist, Please try again",
    });
  }
  // Step 1: Get backup
  const backup = await DeletedUserData.findOne({ userId });
  if (!backup) {
    throw new Error("No backup found for this user");
  }

  // Step 2: Restore the user
  const restoredUser = await User.create({
    _id: backup.userId, // Maintain same ID
    ...backup.user,
  });

  // Step 3: Restore related collections
  const restorePromises = [];

  if (backup.earnings?.length) {
    restorePromises.push(Earning.insertMany(backup.earnings));
  }
  if (backup.notifications?.length) {
    restorePromises.push(Notification.insertMany(backup.notifications));
  }
  if (backup.transactions?.length) {
    restorePromises.push(Transaction.insertMany(backup.transactions));
  }
  if (backup.usdEarnings?.length) {
    restorePromises.push(usdEarning.insertMany(backup.usdEarnings));
  }
  if (backup.inventory?.length) {
    restorePromises.push(UserInventory.insertMany(backup.inventory));
  }
  if (backup.plantLevels?.length) {
    restorePromises.push(UserPlantLevel.insertMany(backup.plantLevels));
  }
  if (backup.withdrawals?.length) {
    restorePromises.push(Withdrawal.insertMany(backup.withdrawals));
  }

  await Promise.all(restorePromises);

  // Step 4: Optionally delete the backup after successful restore
  await DeletedUserData.deleteOne({ userId });

  return res.status(200).json({
    status: 200,
    message: "User restored successfully",
    restoredUser,
  });
};

module.exports = {
  getUser,
  updateUserDetails,
  submitConversion,
  submitRewardEarned,
  savePushToken,
  broadcastNotification,
  promoteUser,
  bootstrapAdmin,
  deleteUser,
  restoreDeletedUser,
};
