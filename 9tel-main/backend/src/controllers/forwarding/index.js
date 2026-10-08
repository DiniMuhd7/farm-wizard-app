const E164 = /^\+[1-9]\d{6,14}$/;
const MODES = ["always", "no_answer"];

const present = (doc) => ({
  enabled: Boolean(doc?.enabled),
  mode: doc?.mode || "no_answer",
  number: doc?.number || null,
});

// GET /api/v1/forwarding
exports.getForwarding = async (req, res) => {
  try {
    const CallForwarding = require("../../models/CallForwarding");
    const doc = await CallForwarding.findOne({ user: req.user._id }).lean();
    return res.status(200).json({ forwarding: present(doc), hasNumber: Boolean(req.user.phoneNumber) });
  } catch (error) {
    console.error("Unable to load call forwarding:", error.message);
    return res.status(500).json({ message: "Call forwarding could not be loaded. Please try again." });
  }
};

// PUT /api/v1/forwarding  { enabled, mode, number }
exports.setForwarding = async (req, res) => {
  const enabled = req.body?.enabled === true;
  const mode = String(req.body?.mode || "no_answer");
  const number = req.body?.number == null || req.body.number === "" ? null : String(req.body.number).trim();
  if (!MODES.includes(mode)) return res.status(400).json({ message: "Choose when to forward calls." });
  if (number !== null && !E164.test(number)) {
    return res.status(400).json({ message: "Enter a valid number with country code, e.g. +2348012345678." });
  }
  if (enabled && !number) return res.status(400).json({ message: "Enter the number to forward calls to." });
  if (enabled && !req.user.phoneNumber) {
    return res.status(403).json({ message: "Get a 9tel number first — forwarding applies to calls made to it." });
  }

  try {
    if (number) {
      if (number === req.user.phoneNumber) {
        return res.status(400).json({ message: "You can't forward calls to your own 9tel number." });
      }
      // Forwarding to the 9tel number of an account that forwards back would
      // ring in a loop, so forwarding to any 9tel-provisioned number is refused.
      const User = require("../../models/User");
      if (await User.exists({ phoneNumber: number })) {
        return res.status(400).json({ message: "Forward to a regular phone number, not a 9tel number." });
      }
      // Forwarded calls cost money, so the same destination allow-list that
      // protects outbound calling applies here too.
      const { isAllowedDestination } = require("../voice")._private;
      if (!isAllowedDestination(number)) {
        return res.status(400).json({ message: "Calls can't be forwarded to that country or number." });
      }
    }
    const CallForwarding = require("../../models/CallForwarding");
    const doc = await CallForwarding.findOneAndUpdate(
      { user: req.user._id },
      { $set: { enabled, mode, ...(number ? { number } : {}) } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    return res.status(200).json({ forwarding: present(doc) });
  } catch (error) {
    console.error("Unable to save call forwarding:", error.message);
    return res.status(500).json({ message: "Call forwarding could not be saved. Please try again." });
  }
};
