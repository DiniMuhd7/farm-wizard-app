const express = require("express");
const { protect } = require("../middleware/auth");
const {
  createStripeSession,
  createFlutterwaveSession,
  flutterwaveWebhook,
  getOrderStatus,
  paymentReturnPage,
} = require("../controllers/payments");

const router = express.Router();
router.post("/stripe/create-session", protect, createStripeSession);
router.post("/flutterwave/create-session", protect, createFlutterwaveSession);
// Flutterwave's webhook is authenticated by a header string-compare (see
// the controller's own comment), not a body signature, so it has no
// special body-parsing requirement — unlike the Stripe webhook, which is
// mounted directly in index.js, ahead of the JSON parser, for exactly that
// reason.
router.post("/flutterwave/webhook", flutterwaveWebhook);
router.get("/orders/:id", protect, getOrderStatus);
router.get("/return", paymentReturnPage);

module.exports = router;
