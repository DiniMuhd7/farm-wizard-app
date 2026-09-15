const express = require("express");
const { protect } = require("../middleware/auth");
const {
  saveGameState,
  getGameState,
  clearGameState,
} = require("../controllers/game-state");

const router = express.Router();

router.post("/save", protect, saveGameState);
router.get("/get/:name", protect, getGameState);
router.delete("/clear/:name", protect, clearGameState);

module.exports = router;
