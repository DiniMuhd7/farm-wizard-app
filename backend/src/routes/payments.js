const express = require("express");
const { protect } = require("../middleware/auth");
const {
  createStripeSession,
  createFlutterwaveSession,
  createCreditsStripeSession,
  createCreditsFlutterwaveSession,
  createPremiumStripeSession,
  createPremiumFlutterwaveSession,
  flutterwaveWebhook,
  getOrderStatus,
  paymentReturnPage,
} = require("../controllers/payments");

const router = express.Router();
router.post("/stripe/create-session", protect, createStripeSession);
router.post("/flutterwave/create-session", protect, createFlutterwaveSession);
// Pay As You Go credits top-up checkout — same providers, a different
// product (balance, not a phone number). See controllers/payments'
// CREDIT_PACKS and fulfillCreditsOrder.
router.post("/stripe/create-credits-session", protect, createCreditsStripeSession);
router.post("/flutterwave/create-credits-session", protect, createCreditsFlutterwaveSession);
// Premium (ad-free 9tel-to-9tel calling) checkout — see controllers/payments'
// PREMIUM_PRICE_USD_CENTS/PREMIUM_PRICE_NGN and fulfillPremiumOrder.
router.post("/stripe/create-premium-session", protect, createPremiumStripeSession);
router.post("/flutterwave/create-premium-session", protect, createPremiumFlutterwaveSession);
// Flutterwave's webhook is authenticated by a header string-compare (see
// the controller's own comment), not a body signature, so it has no
// special body-parsing requirement — unlike the Stripe webhook, which is
// mounted directly in index.js, ahead of the JSON parser, for exactly that
// reason.
router.post("/flutterwave/webhook", flutterwaveWebhook);
router.get("/orders/:id", protect, getOrderStatus);
router.get("/return", paymentReturnPage);

module.exports = router;
