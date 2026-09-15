const UserInventory = require("../../models/UserInventory");

// GET all items for a specific user
const getUserItems = async (req, res) => {
  const userId = req.user._id;

  if (!userId) {
    return res.status(404).json({ success: false, message: "User not found" });
  }
  try {
    const items = await UserInventory.find({ userId });

    // if (items.length === 0) {
    //   return res.status(404).json({ message: "No items found for this user" });
    // }

    const pesticideItems = items.filter((item) => item.name === "Pesticide")[0];
    const fertilizerItems = items.filter(
      (item) => item.name === "Fertilizer"
    )[0];
    const waterItems = items.filter((item) => item.name === "Water")[0];
    // const appleItems = items.filter((item) => item.name === "Apple")[0];
    // const mongoItems = items.filter((item) => item.name === "Mongo")[0];
    // const pawpawtems = items.filter((item) => item.name === "Paw Paw")[0];
    // const maizeItems = items.filter((item) => item.name === "Maize")[0];
    // const orangeItems = items.filter((item) => item.name === "Orange")[0];

    const data = {
      pesticideItems,
      fertilizerItems,
      waterItems,
    };
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const reduceItemQuantity = async (req, res) => {
  const { name, amount } = req.body;
  const userId = req.user._id;

  if (!userId || !name || typeof amount !== "number" || amount <= 0) {
    return res.status(400).json({ message: "Invalid input" });
  }

  try {
    const item = await UserInventory.findOne({ userId, name });

    if (!item) {
      return res.status(404).json({ message: "Item not found" });
    }

    if (item.quantity < amount) {
      return res.status(400).json({
        message: `Cannot reduce by ${amount}. Current quantity is ${item.quantity}.`,
      });
    }

    item.quantity -= amount;

    // Optional: delete if zero
    // if (item.quantity === 0) {
    //   await item.remove();
    //   return res.status(200).json({ message: 'Item removed after quantity reached zero' });
    // }

    await item.save();
    res.status(200).json(item);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const addtemQuantity = async (req, res) => {
  const { name, amount } = req.body;
  const userId = req.user._id;

  if (!userId || !name || typeof amount !== "number" || amount <= 0) {
    return res.status(400).json({ message: "Invalid input" });
  }

  try {
    const item = await UserInventory.findOne({ userId, name });

    if (!item) {
      return res.status(404).json({ message: "Item not found" });
    }

    item.quantity += amount;

    await item.save();
    res.status(200).json(item);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getUserItems, reduceItemQuantity, addtemQuantity };
