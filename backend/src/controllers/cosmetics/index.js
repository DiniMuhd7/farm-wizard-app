const User = require("../../models/User");
const sendNotification = require("../../utils/sendNotification");

// Catalog of cosmetics that can be bought with WizPoints (score).
// `key` values are what the app uses to render the frame/skin.
const CATALOG = [
  { id: "frame_gold", type: "frame", name: "Gold Frame", price: 5000 },
  { id: "frame_emerald", type: "frame", name: "Emerald Frame", price: 8000 },
  { id: "frame_royal", type: "frame", name: "Royal Frame", price: 15000 },
  { id: "skin_autumn", type: "skin", name: "Autumn Farm", price: 10000 },
  { id: "skin_night", type: "skin", name: "Night Farm", price: 12000 },
  { id: "skin_snow", type: "skin", name: "Snowy Farm", price: 20000 },
  // Farm decorations (placed on the My Farm screen). `emoji` is a
  // placeholder visual until real art assets are added.
  { id: "deco_tree", type: "decoration", name: "Tree", price: 1500, emoji: "🌳" },
  { id: "deco_flower", type: "decoration", name: "Flower Bed", price: 1000, emoji: "🌸" },
  { id: "deco_fence", type: "decoration", name: "Fence", price: 1200, emoji: "🪵" },
  { id: "deco_barn", type: "decoration", name: "Barn", price: 4000, emoji: "🏠" },
  { id: "deco_well", type: "decoration", name: "Water Well", price: 2500, emoji: "⛲" },
  { id: "deco_scarecrow", type: "decoration", name: "Scarecrow", price: 3000, emoji: "🧑‍🌾" },
  { id: "deco_pond", type: "decoration", name: "Pond", price: 3500, emoji: "🏞️" },
  { id: "deco_windmill", type: "decoration", name: "Windmill", price: 6000, emoji: "🌬️" },
];

const findItem = (id) => CATALOG.find((c) => c.id === id);

// GET /api/v1/cosmetics
const getCosmetics = (req, res) => {
  const user = req.user;
  return res.json({
    success: true,
    catalog: CATALOG,
    owned: user.ownedCosmetics || [],
    equipped: {
      frame: user.equippedFrame || null,
      skin: user.equippedSkin || null,
    },
    balance: user.score,
  });
};

// POST /api/v1/cosmetics/buy  { id }
const buyCosmetic = async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.body;
    const item = findItem(id);

    if (!item) {
      return res
        .status(400)
        .json({ success: false, message: "Unknown cosmetic item" });
    }
    if ((user.ownedCosmetics || []).includes(id)) {
      return res
        .status(400)
        .json({ success: false, message: "You already own this item" });
    }
    if (user.score < item.price) {
      return res.status(400).json({
        success: false,
        message: "Not enough WizPoints to buy this item",
      });
    }

    const userDetails = await User.findByIdAndUpdate(
      user._id,
      {
        $inc: { score: -item.price },
        $push: { ownedCosmetics: id },
      },
      { new: true }
    );

    await sendNotification(
      user._id,
      `You unlocked "${item.name}" for ${item.price} WizPoints`
    );

    return res.json({
      success: true,
      message: `${item.name} unlocked!`,
      userDetails,
    });
  } catch (error) {
    console.error("buyCosmetic error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// POST /api/v1/cosmetics/equip  { id }  (id may be null to unequip)
const equipCosmetic = async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.body;

    if (id !== null) {
      const item = findItem(id);
      if (!item) {
        return res
          .status(400)
          .json({ success: false, message: "Unknown cosmetic item" });
      }
      if (!(user.ownedCosmetics || []).includes(id)) {
        return res
          .status(400)
          .json({ success: false, message: "You don't own this item" });
      }
      const field = item.type === "frame" ? "equippedFrame" : "equippedSkin";
      const userDetails = await User.findByIdAndUpdate(
        user._id,
        { [field]: id },
        { new: true }
      );
      return res.json({ success: true, message: "Equipped", userDetails });
    }

    // unequip both is ambiguous; require an id to equip. For unequip send type.
    return res
      .status(400)
      .json({ success: false, message: "An item id is required to equip" });
  } catch (error) {
    console.error("equipCosmetic error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

module.exports = { getCosmetics, buyCosmetic, equipCosmetic, CATALOG };
