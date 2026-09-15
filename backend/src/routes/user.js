const express = require("express");
const {
  getUser,
  deleteUser,
  updateUserDetails,
  submitConversion,
  submitRewardEarned,
  savePushToken,
  broadcastNotification,
  promoteUser,
  bootstrapAdmin,
} = require("../controllers/user");
const { protect } = require("../middleware/auth");
const {
  getUserItems,
  reduceItemQuantity,
  addtemQuantity,
} = require("../controllers/user/userInventory");
const { getIdle, collectIdle } = require("../controllers/idle");

const router = express.Router();

router.get("/user", protect, getUser);
router.get("/inventory", protect, getUserItems);
router.post("/submit-conversion", protect, submitConversion);
router.post("/reward-earned", protect, submitRewardEarned);
router.post("/push-token", protect, savePushToken);
router.post("/broadcast", protect, broadcastNotification);
router.post("/promote", protect, promoteUser);
router.post("/bootstrap-admin", bootstrapAdmin);
router.get("/idle", protect, getIdle);
router.post("/idle/collect", protect, collectIdle);
router.patch("/update", protect, updateUserDetails);
router.patch("/reduce-qty", protect, reduceItemQuantity);
router.patch("/add-qty", protect, addtemQuantity);
router.get("/delete/:email", deleteUser);

module.exports = router;
