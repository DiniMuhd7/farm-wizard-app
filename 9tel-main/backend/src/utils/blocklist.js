const E164 = /^\+[1-9]\d{6,14}$/;

// True when `ownerId` has blocked any of the given numbers. Fails OPEN: a
// database hiccup must never stop someone's calls or texts from working, so
// an error is logged and treated as "not blocked".
exports.isBlockedBy = async (ownerId, numbers) => {
  try {
    const candidates = [...new Set((numbers || []).filter((n) => typeof n === "string" && E164.test(n)))];
    if (!ownerId || !candidates.length) return false;
    const BlockedNumber = require("../models/BlockedNumber");
    return Boolean(await BlockedNumber.exists({ user: ownerId, number: { $in: candidates } }));
  } catch (error) {
    console.error("Blocklist lookup failed:", error.message);
    return false;
  }
};
