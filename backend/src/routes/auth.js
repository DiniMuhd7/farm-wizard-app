const express = require("express");
const { registerUser, loginUser, issueGuestSession, signOut } = require("../controllers/auth");
const { sendResetCode } = require("../controllers/auth/sendResetCode");
const { protect } = require("../middleware/auth");
const {
  verifyResetCode,
  resetPassword,
} = require("../controllers/auth/verifyResetCode");

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/guest", issueGuestSession);

router.get("/sign-out", protect, signOut);

router.post("/forget-password", sendResetCode);
router.post("/verify-otp", verifyResetCode);
router.post("/reset-password", resetPassword);

module.exports = router;
