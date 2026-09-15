const express = require("express");
const { protect } = require("../middleware/auth");
const { getNotifications } = require("../controllers/notification");

const router = express.Router();

router.get("/all", protect, getNotifications);

module.exports = router;
