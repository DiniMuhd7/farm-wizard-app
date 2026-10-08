const express = require("express");
const { rateLimit } = require("express-rate-limit");
const { protect } = require("../middleware/auth");
const { getForwarding, setForwarding } = require("../controllers/forwarding");

const router = express.Router();
const limiter = rateLimit({ windowMs: 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false, message: { message: "Please slow down." } });
router.get("/", limiter, protect, getForwarding);
router.put("/", limiter, protect, setForwarding);

module.exports = router;
