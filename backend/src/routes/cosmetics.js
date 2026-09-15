const express = require("express");
const {
  getCosmetics,
  buyCosmetic,
  equipCosmetic,
} = require("../controllers/cosmetics");
const { protect } = require("../middleware/auth");

const router = express.Router();

router.get("/", protect, getCosmetics);
router.post("/buy", protect, buyCosmetic);
router.post("/equip", protect, equipCosmetic);

module.exports = router;
