const express = require("express");
const { protect } = require("../middleware/auth");
const {
  getEarningData,
  getUsdEarningData,
} = require("../controllers/user/chart");

const router = express.Router();

router.get("/chart/:type", protect, getEarningData);
router.get("/usd-chart/:type", protect, getUsdEarningData);

module.exports = router;
