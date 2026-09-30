const express = require("express");
const { protect } = require("../middleware/auth");
const { checkAvailability, getMyNumber, listAvailableCountries } = require("../controllers/numbers");

const router = express.Router();
router.get("/mine", protect, getMyNumber);
router.get("/available-countries", protect, listAvailableCountries);
// Free, no-purchase preview of what number a country would give you — the
// actual purchase only happens after a payment is confirmed (see
// routes/payments.js and controllers/numbers' purchaseAndAssignNumber,
// which is not itself exposed as a public route).
router.get("/available", protect, checkAvailability);

module.exports = router;
