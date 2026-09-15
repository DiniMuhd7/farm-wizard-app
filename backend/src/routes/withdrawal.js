const express = require("express");
const { protect } = require("../middleware/auth");
const {
  submitWithdrawal,
  getWithdrawals,
  getUserWithdrawals,
  adminProcessWithdrawal,
  getProcessedWithdrawals,
} = require("../controllers/withdrawal");

const router = express.Router();

router.post("/request", protect, submitWithdrawal);
router.get("/all", getWithdrawals);
router.get("/processed", getProcessedWithdrawals);
router.get("/user-withdrwals", protect, getUserWithdrawals);
router.post("/admin-process-withdrawal", adminProcessWithdrawal);

module.exports = router;
