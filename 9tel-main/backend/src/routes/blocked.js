const express = require("express");
const { rateLimit } = require("express-rate-limit");
const { protect } = require("../middleware/auth");
const { listBlocked, blockNumber, unblockNumber } = require("../controllers/blocked");

const router = express.Router();
const limiter = rateLimit({ windowMs: 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false, message: { message: "Please slow down." } });
router.get("/", limiter, protect, listBlocked);
router.post("/", limiter, protect, blockNumber);
router.delete("/:id", limiter, protect, unblockNumber);

module.exports = router;
