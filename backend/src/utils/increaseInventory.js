const UserInventory = require("../models/UserInventory");

const increaseInventory = async (userId, itemName, quantityToAdd = 1) => {
  try {
    await UserInventory.findOneAndUpdate(
      { userId, name: itemName },
      { $inc: { quantity: quantityToAdd } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } catch (err) {
    console.error("Error updating inventory:", err);
  }
};

module.exports = increaseInventory;
