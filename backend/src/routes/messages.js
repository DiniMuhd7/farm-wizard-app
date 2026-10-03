const express = require("express");
const { rateLimit } = require("express-rate-limit");
const { protect } = require("../middleware/auth");
const { listMessages, sendMessage, incomingMessage } = require("../controllers/messages");

const router = express.Router();
const sendLimit = rateLimit({ windowMs: 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false, message: { message: "Please wait before sending another message." } });
router.get("/", protect, listMessages);
router.post("/", protect, sendLimit, sendMessage);
router.post("/incoming", incomingMessage);
module.exports = router;
