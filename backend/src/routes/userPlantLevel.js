const express = require("express");
const {
  getUserPlantLevels,
  updatePlantLevel,
  getUserPlantLevel,
} = require("../controllers/plant-level/userPlantLevel");
const { protect } = require("../middleware/auth");

const router = express.Router();

router.get("/get-plant-levels", protect, getUserPlantLevels);
router.get("/get-plant-level", protect, getUserPlantLevel);
router.patch("/update", protect, updatePlantLevel);

module.exports = router;
