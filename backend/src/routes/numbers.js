const express = require("express");
const { protect } = require("../middleware/auth");
const { provisionNumber, getMyNumber } = require("../controllers/numbers");

const router = express.Router();
router.get("/mine", protect, getMyNumber);
router.post("/provision", protect, provisionNumber);

module.exports = router;
