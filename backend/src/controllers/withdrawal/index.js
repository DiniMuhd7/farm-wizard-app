const User = require("../../models/User");
const Withdrawal = require("../../models/Withdrawal");
const sendNotification = require("../../utils/sendNotification");

const submitWithdrawal = async (req, res) => {
  const { amount, destination, withdrawType, reference, provider, network } =
    req.body;

  const userId = req.user._id;
  if (!userId) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  if (!amount || !destination || !withdrawType || !reference) {
    return res.status(404).json({
      success: false,
      message: "Some fields are missing, All required",
    });
  }

  // Minimum withdrawal: $1 (1000 WZP = $0.01, so $1 = 100,000 WZP).
  const usdValue = (Number(amount) * 0.01) / 1000;
  if (usdValue < 1) {
    return res.status(200).json({
      success: false,
      message: "Minimum withdrawal is $1 (100,000 WizPoints). Keep playing!",
    });
  }

  try {
    const withdrawal = await Withdrawal.findOne({ userId, status: "Request" });

    if (withdrawal) {
      return res.status(200).json({
        success: false,
        message: "You have pending withdrawal",
        withdrawal,
      });
    }

    // update user corresponding balance
    const userDetails = await User.findByIdAndUpdate(
      userId,
      {
        // $inc: { usdBalance: -amount },
        $inc: { score: -amount },
      },
      { new: true }
    );
    const newWithdrawal = await Withdrawal.create({
      userId,
      amount,
      destination,
      provider,
      withdrawType,
      reference,
      network,
    });
    await sendNotification(
      userId,
      `Withdrawal Request of ${amount} USD Submitted `
    );

    return res.json({
      success: true,
      message: `Withdraw request of ${amount} USD submitted successfully, You will received update shortly`,
      data: { newWithdrawal, userDetails },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Failed to save",
      error: err.response?.data || err.message,
    });
  }
};
const adminProcessWithdrawal = async (req, res) => {
  const { withdrawId } = req.body;

  if (!withdrawId) {
    return res
      .status(404)
      .json({ success: false, message: "withdrawId not found" });
  }

  try {
    const withdrawal = await Withdrawal.findById(withdrawId);

    if (!withdrawal) {
      return res.status(200).json({
        success: false,
        message: "Withdrawal not found",
        withdrawal,
      });
    }
    const updatedWithdrawal = await Withdrawal.findByIdAndUpdate(
      withdrawId,
      {
        status: "Paid",
      },
      { new: true }
    );

    await sendNotification(
      updatedWithdrawal.userId,
      `Your Withdrawal of ${updatedWithdrawal.amount} USD processesed sucessfully `
    );

    return res.json({
      success: true,
      message: `Withdraw request has been process successfully`,
      data: { updatedWithdrawal },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Failed to save",
      error: err.response?.data || err.message,
    });
  }
};

const getWithdrawals = async (req, res) => {
  const { page = 1, limit = 100 } = req.query;
  const skip = (page - 1) * limit;

  try {
    const withdrawals = await Withdrawal.find({ status: "Request" })
      .populate("userId")
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .exec();

    res.json(withdrawals);
  } catch (error) {
    console.error("Error fetching withdrawals : ", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
const getProcessedWithdrawals = async (req, res) => {
  const { page = 1, limit = 100 } = req.query;
  const skip = (page - 1) * limit;

  try {
    const withdrawals = await Withdrawal.find({ status: "Paid" })
      .populate("userId")
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .exec();

    res.json(withdrawals);
  } catch (error) {
    console.error("Error fetching withdrawals : ", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const getUserWithdrawals = async (req, res) => {
  const { page = 1, limit = 100 } = req.query;
  const skip = (page - 1) * limit;

  const userId = req.user._id;
  if (!userId) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  try {
    const userWithdrawals = await Withdrawal.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .exec();

    res.json(userWithdrawals);
  } catch (error) {
    console.error("Error fetching userWithdrawals : ", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
module.exports = {
  submitWithdrawal,
  getWithdrawals,
  getUserWithdrawals,
  adminProcessWithdrawal,
  getProcessedWithdrawals,
};
