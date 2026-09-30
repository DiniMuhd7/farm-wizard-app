const express = require("express");
const { rateLimit } = require("express-rate-limit");
const { protect } = require("../middleware/auth");
const { checkAvailability, getMyNumber, listAvailableCountries } = require("../controllers/numbers");

const router = express.Router();
const availableCountriesRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Please wait before checking country availability again." },
});

router.get("/mine", protect, getMyNumber);
router.get("/available-countries", availableCountriesRateLimit, protect, listAvailableCountries);
// Free, no-purchase preview of what number a country would give you — the
// actual purchase only happens after a payment is confirmed (see
// routes/payments.js and controllers/numbers' purchaseAndAssignNumber,
// which is not itself exposed as a public route).
router.get("/available", protect, checkAvailability);

module.exports = router;
