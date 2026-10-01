const express = require("express");
const { rateLimit } = require("express-rate-limit");
const { protect } = require("../middleware/auth");
const { checkAvailability, getMyNumber, getProviderStatus, listAvailableCountries, lookupNumber } = require("../controllers/numbers");

const router = express.Router();
const availableCountriesRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Please wait before checking country availability again." },
});
const lookupRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Please wait before checking another number." },
});
const providerStatusRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Please wait before checking provider status again." },
});

router.get("/mine", protect, getMyNumber);
router.get("/available-countries", availableCountriesRateLimit, protect, listAvailableCountries);
// Admin-only diagnostic — lets support confirm whether the number provider
// (Twilio) is actually configured in this deployment, without exposing the
// credential values, when "Unable to load available countries" is reported.
router.get("/provider-status", providerStatusRateLimit, protect, getProviderStatus);
// Free, no-purchase preview of what number a country would give you — the
// actual purchase only happens after a payment is confirmed (see
// routes/payments.js and controllers/numbers' purchaseAndAssignNumber,
// which is not itself exposed as a public route).
router.get("/available", protect, checkAvailability);
// Eligibility check for the calling-plan model (Free/Premium 9tel-to-9tel
// vs. Pay As You Go credits to a carrier) — see services/callPlans.ts.
// POST (not GET) so the phone number travels in the body, not a logged
// query string.
router.post("/lookup", lookupRateLimit, protect, lookupNumber);

module.exports = router;
