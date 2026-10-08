const express = require("express");
const { rateLimit } = require("express-rate-limit");
const { protect } = require("../middleware/auth");
const { listPlans, listMine, getOne } = require("../controllers/esim");

const router = express.Router();
const limiter = rateLimit({ windowMs: 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false, message: { message: "Please slow down." } });
router.get("/plans", limiter, protect, listPlans);
router.get("/mine", limiter, protect, listMine);
router.get("/:id", limiter, protect, getOne);

module.exports = router;
