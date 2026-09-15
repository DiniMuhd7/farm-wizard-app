const express = require("express");

const { protect } = require("../middleware/auth");
const { createOrder } = require("../controllers/payment/paypal");
const { initializeTransaction } = require("../controllers/payment/paystack");
const {
  verifyPayment,
  verifyUpgradePayment,
} = require("../controllers/payment/flutterwave");
const {
  verifyInAppPurchase,
} = require("../controllers/payment/in-app-purchase");

const router = express.Router();

router.post("/paypal/create-order", createOrder);

router.post("/paystack/initialize-transaction", initializeTransaction);
router.get(
  "/flutterwave/verify-payment/:transactionId/:purchaseDetails",
  verifyPayment
);
router.get(
  "/flutterwave/verify-upgrade-payment/:transactionId",
  verifyUpgradePayment
);

router.get(
  "/in-app-purchase/verify-purchase/:transactionId/:purchaseDetails",
  protect,
  verifyInAppPurchase
);

module.exports = router;
