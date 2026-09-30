const express = require("express");
const { protect } = require("../middleware/auth");
const { checkAvailability, getMyNumber, listAvailableCountries } = require("../controllers/numbers");

const router = express.Router();
const availabilityRequestWindows = new Map();
const AVAILABILITY_REQUEST_LIMIT = 4;
const AVAILABILITY_WINDOW_MS = 60 * 1000;

function rateLimitAvailableCountries(req, res, next) {
  const now = Date.now();
  const userId = req.user._id.toString();
  let window = availabilityRequestWindows.get(userId);

  if (!window || window.expiresAt <= now) {
    window = { count: 0, expiresAt: now + AVAILABILITY_WINDOW_MS };
    availabilityRequestWindows.set(userId, window);
  }

  if (window.count >= AVAILABILITY_REQUEST_LIMIT) {
    res.set("Retry-After", String(Math.ceil((window.expiresAt - now) / 1000)));
    return res.status(429).json({ message: "Please wait before checking country availability again." });
  }

  window.count += 1;
  if (availabilityRequestWindows.size > 1000) {
    for (const [id, currentWindow] of availabilityRequestWindows) {
      if (currentWindow.expiresAt <= now) availabilityRequestWindows.delete(id);
    }
  }
  return next();
}

router.get("/mine", protect, getMyNumber);
router.get("/available-countries", protect, rateLimitAvailableCountries, listAvailableCountries);
// Free, no-purchase preview of what number a country would give you — the
// actual purchase only happens after a payment is confirmed (see
// routes/payments.js and controllers/numbers' purchaseAndAssignNumber,
// which is not itself exposed as a public route).
router.get("/available", protect, checkAvailability);

module.exports = router;
