const express = require("express");
const { rateLimit } = require("express-rate-limit");
const { protect } = require("../middleware/auth");
const { getBalance } = require("../controllers/credits");

const router = express.Router();
const balanceRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Please wait before checking your balance again." },
});

router.get("/balance", balanceRateLimit, protect, getBalance);

module.exports = router;
