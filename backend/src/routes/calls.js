const express = require("express");
const { protect } = require("../middleware/auth");
const { getMyCalls, getMyCallStats } = require("../controllers/calls");

const router = express.Router();
router.get("/mine", protect, getMyCalls);
router.get("/stats", protect, getMyCallStats);

module.exports = router;
