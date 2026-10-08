const mongoose = require("mongoose");

const E164 = /^\+[1-9]\d{6,14}$/;
const MAX_BLOCKED = 500;

const present = (doc) => ({ id: String(doc._id), number: doc.number, label: doc.label || "", blockedAt: doc.createdAt });

// GET /api/v1/blocked
exports.listBlocked = async (req, res) => {
  try {
    const BlockedNumber = require("../../models/BlockedNumber");
    const rows = await BlockedNumber.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(MAX_BLOCKED).lean();
    return res.status(200).json({ blocked: rows.map(present) });
  } catch (error) {
    console.error("Unable to list blocked numbers:", error.message);
    return res.status(500).json({ message: "Blocked numbers could not be loaded. Please try again." });
  }
};

// POST /api/v1/blocked  { number, label? }
exports.blockNumber = async (req, res) => {
  const number = String(req.body?.number || "").trim();
  const label = String(req.body?.label || "").trim().slice(0, 60);
  if (!E164.test(number)) return res.status(400).json({ message: "Enter a valid number with country code, e.g. +2348012345678." });
  if (number === req.user.phoneNumber || number === req.user.verifiedCallerId) {
    return res.status(400).json({ message: "You can't block your own number." });
  }
  try {
    const BlockedNumber = require("../../models/BlockedNumber");
    if ((await BlockedNumber.countDocuments({ user: req.user._id })) >= MAX_BLOCKED) {
      return res.status(400).json({ message: `You can block up to ${MAX_BLOCKED} numbers.` });
    }
    const existing = await BlockedNumber.findOne({ user: req.user._id, number }).lean();
    if (existing) return res.status(409).json({ message: "That number is already blocked." });
    const created = await BlockedNumber.create({ user: req.user._id, number, label });
    return res.status(201).json({ blocked: present(created) });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ message: "That number is already blocked." });
    console.error("Unable to block number:", error.message);
    return res.status(500).json({ message: "That number could not be blocked. Please try again." });
  }
};

// DELETE /api/v1/blocked/:id
exports.unblockNumber = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: "Blocked number not found." });
  try {
    const BlockedNumber = require("../../models/BlockedNumber");
    const removed = await BlockedNumber.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!removed) return res.status(404).json({ message: "Blocked number not found." });
    return res.status(200).json({ removed: true });
  } catch (error) {
    console.error("Unable to unblock number:", error.message);
    return res.status(500).json({ message: "That number could not be unblocked. Please try again." });
  }
};
