const { default: axios } = require("axios");
const User = require("../../models/User");
const Transaction = require("../../models/Transaction");
const UserInventory = require("../../models/UserInventory");

const verifyPayment = async (req, res) => {
  const { transactionId, purchaseDetails } = req.params;

  if (!transactionId || !purchaseDetails) {
    return res.status(400).json({
      success: false,
      message: "Transaction or purchase details not found",
    });
  }

  const purchasedContent = purchaseDetails.split("-"); // name-qty-amount
  const item = purchasedContent[0];
  const quantity = purchasedContent[1];
  const totalAmount = purchasedContent[2];

  try {
    const response = await axios.get(
      `https://api.flutterwave.com/v3/transactions/${transactionId}/verify`,
      {
        headers: {
          Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
        },
      }
    );

    const payment = response.data.data;

    if (payment.status === "successful") {
      // Optionally store to DB or log
      //   console.log("payment status ", payment);

      const user = await User.findOne({ email: payment.customer.email });

      const transaction = await Transaction.create({
        userId: user._id,
        transactionId,
        reference: payment.tx_ref,
        card: payment.card,
        item,
        quantity,
        amount: totalAmount,
        currency: payment.currency,
        status: payment.status,
      });

      // credit userinventory with the items purchased
      const userInventory = await UserInventory.findOneAndUpdate(
        { userId: user._id, name: item },
        { $inc: { quantity } },
        { new: true, upsert: true }
      );

      return res.json({
        success: true,
        message: "Payment verified successfully",
        data: payment,
        transaction,
        userInventory,
      });
    } else {
      // save failed transaction
      const user = await User.findOne({ email: payment.customer.email });
      const transaction = await Transaction.create({
        userId: user._id,
        transactionId,
        reference: payment.tx_ref,
        card: payment.card,
        item,
        quantity,
        amount: totalAmount,
        currency: payment.currency,
        status: payment.status,
      });
      return res.status(400).json({
        transaction,
        success: false,
        message: "Payment was not successful",
      });
    }
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Verification failed",
      error: err.response?.data || err.message,
    });
  }
};

const verifyUpgradePayment = async (req, res) => {
  const { transactionId } = req.params;

  if (!transactionId) {
    return res.status(400).json({
      success: false,
      message: "Transaction details not found",
    });
  }

  try {
    const response = await axios.get(
      `https://api.flutterwave.com/v3/transactions/${transactionId}/verify`,
      {
        headers: {
          Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
        },
      }
    );

    const payment = response.data.data;

    if (payment.status === "successful") {
      const user = await User.findOne({ email: payment.customer.email });

      const transaction = await Transaction.create({
        userId: user._id,
        transactionId,
        reference: payment.tx_ref,
        card: payment.card,
        item: "Account Upgrade",
        quantity: 1,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
      });

      // Upgrade user account
      const updatedUser = await User.findOneAndUpdate(
        { email: payment.customer.email },
        { isPremium: true },
        { new: true, upsert: true }
      );

      return res.json({
        success: true,
        message: "Payment verified successfully",
        data: payment,
        updatedUser,
      });
    } else {
      // save failed transaction
      const user = await User.findOne({ email: payment.customer.email });
      const transaction = await Transaction.create({
        userId: user._id,
        transactionId,
        reference: payment.tx_ref,
        card: payment.card,
        item: "Account Upgrade",
        quantity: 1,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
      });
      return res.status(400).json({
        transaction,
        success: false,
        message: "Payment was not successful",
      });
    }
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Verification failed",
      error: err.response?.data || err.message,
    });
  }
};
module.exports = { verifyPayment, verifyUpgradePayment };
