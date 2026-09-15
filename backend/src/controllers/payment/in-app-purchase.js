const Transaction = require("../../models/Transaction");
const User = require("../../models/User");
const UserInventory = require("../../models/UserInventory");
const sendNotification = require("../../utils/sendNotification");

const verifyInAppPurchase = async (req, res) => {
  const { transactionId, purchaseDetails } = req.params;
  const user = req.user;
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  if (!transactionId || !purchaseDetails) {
    return res.status(400).json({
      success: false,
      message: "Transaction or purchase details not found",
    });
  }

  const purchasedContent = purchaseDetails.split("-"); // name-qty-amount
  const item = purchasedContent[0];
  const quantity = Number(purchasedContent[1]);
  const totalAmount = Number(purchasedContent[2]);

  try {
    let amountInWiz = Number((totalAmount * 1000) / 0.01).toFixed(2);
    const payment = {
      tx_ref: transactionId,
    };

    if (user.score >= amountInWiz) {
      // convert amount to wizoint and deduce from user balance
      //   user.score -= amountInWiz;
      //   await user.save();
      const userDetails = await User.findByIdAndUpdate(user._id, {
        $inc: { score: -amountInWiz },
      });

      const transaction = await Transaction.create({
        userId: user._id,
        transactionId,
        reference: `In app purchase ${transactionId}`,
        item,
        quantity,
        amount: amountInWiz,
        currency: "wizpoint",
        status: "success",
      });

      // credit userinventory with the items purchased
      const userInventory = await UserInventory.findOneAndUpdate(
        { userId: user._id, name: item },
        { $inc: { quantity } },
        { new: true, upsert: true }
      );

      await sendNotification(
        user._id,
        `In App Purchase of ${quantity} Qty of ${item}`
      );

      return res.json({
        success: true,
        message: "Payment verified successfully",
        data: payment,
        transaction,
        userInventory,
        userDetails,
      });
    } else {
      // save failed transaction
      const transaction = await Transaction.create({
        userId: user._id,
        transactionId,
        reference: "In app purchase",
        item,
        quantity,
        amount: totalAmount,
        currency: "wizpoint",
        status: "failed",
      });

      return res.status(400).json({
        transaction,
        success: false,
        message: "Payment was not successful, Insufficient balance",
      });
    }
  } catch (err) {
    console.log("err ", err);
    return res.status(500).json({
      success: false,
      message: "Verification failed",
      error: err.response?.data || err.message,
    });
  }
};

module.exports = { verifyInAppPurchase };
