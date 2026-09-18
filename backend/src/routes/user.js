const express = require("express");
const {
  getUser,
  deleteUser,
  updateUserDetails,
  promoteUser,
  bootstrapAdmin,
  savePushToken,
} = require("../controllers/user");
const { protect } = require("../middleware/auth");

const router = express.Router();

router.get("/user", protect, getUser);
router.post("/promote", protect, promoteUser);
router.post("/bootstrap-admin", bootstrapAdmin);
router.patch("/update", protect, updateUserDetails);
router.post("/push-token", protect, savePushToken);
router.get("/delete/:email", deleteUser);

module.exports = router;
