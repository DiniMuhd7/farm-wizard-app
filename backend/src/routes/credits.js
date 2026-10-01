const express = require("express");
const { protect } = require("../middleware/auth");
const { getBalance } = require("../controllers/credits");

const router = express.Router();
router.get("/balance", protect, getBalance);

module.exports = router;
