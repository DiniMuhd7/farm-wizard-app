const GameState = require("../../models/GameState");

const saveGameState = async (req, res) => {
  try {
    const userId = req.user.id;
    const data = req.body;

    const saved = await GameState.findOneAndUpdate(
      { userId, plantName: data.plantName },
      { ...data, userId },
      { upsert: true, new: true }
    );

    res.json({ success: true, data: saved });
  } catch (err) {
    console.error("Save game state error:", err);
    res.status(500).json({ error: "Failed to save game state" });
  }
};

const getGameState = async (req, res) => {
  try {
    const userId = req.user.id;
    const plantName = req.params.name;

    const gameState = await GameState.findOne({ userId, plantName });
    if (!gameState)
      return res.status(404).json({ error: "No game state found" });

    res.json(gameState);
  } catch (err) {
    console.error("Get game state error:", err);
    res.status(500).json({ error: "Failed to fetch game state" });
  }
};

const clearGameState = async (req, res) => {
  try {
    const userId = req.user.id;
    const plantName = req.params.name;

    if (!plantName) {
      return res.status(400).json({ error: "Plant name is required" });
    }

    await GameState.deleteOne({ userId, plantName });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to clear game state" });
  }
};

module.exports = { saveGameState, getGameState, clearGameState };
