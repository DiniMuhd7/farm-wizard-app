const express = require("express");
const { getReferral, redeemReferral } = require("../controllers/referral");
const { protect } = require("../middleware/auth");

const router = express.Router();

router.get("/", protect, getReferral);
router.post("/redeem", protect, redeemReferral);

module.exports = router;
