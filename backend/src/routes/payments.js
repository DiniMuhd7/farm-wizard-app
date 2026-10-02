const express = require("express");
const { rateLimit } = require("express-rate-limit");
const { protect } = require("../middleware/auth");
const {
  createFlutterwaveSession,
  createCreditsFlutterwaveSession,
  createAirbundleFlutterwaveSession,
  flutterwaveWebhook,
  getOrderStatus,
  getPrices,
  paymentReturnPage,
} = require("../controllers/payments");

const router = express.Router();
// Checkout-session creation calls out to Flutterwave and creates a pending
// Order on every request — rate-limited the same way numbers.js' /lookup
// is, so a burst of requests can't hammer either the provider API or the
// database.
const checkoutRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Please wait before trying to pay again." },
});
// Flutterwave is the only payment provider. Every create-session body
// includes `currency` ("USD" or "NGN"), chosen by the person before paying.
// Order polling, the post-checkout return page and the webhook all touch the
// database, so they get a (more generous) limiter of their own.
const statusRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests. Please slow down." },
});
router.post("/flutterwave/create-session", checkoutRateLimit, protect, createFlutterwaveSession);
// Prepaid credits top-up checkout — a different product (balance, not a
// phone number). See controllers/payments' CREDIT_PACKS and
// fulfillCreditsOrder.
router.post("/flutterwave/create-credits-session", checkoutRateLimit, protect, createCreditsFlutterwaveSession);
// Airbundle (minute bundles with ad-free 9tel-to-9tel calling) checkout —
// see controllers/payments' AIRBUNDLES and fulfillAirbundleOrder.
router.post("/flutterwave/create-airbundle-session", checkoutRateLimit, protect, createAirbundleFlutterwaveSession);
// Flutterwave's webhook is authenticated by a header string-compare (see
// the controller's own comment), not a body signature, so it has no
// special body-parsing requirement.
router.post("/flutterwave/webhook", statusRateLimit, flutterwaveWebhook);
router.get("/prices", statusRateLimit, protect, getPrices);
router.get("/orders/:id", statusRateLimit, protect, getOrderStatus);
router.get("/return", statusRateLimit, paymentReturnPage);

module.exports = router;
