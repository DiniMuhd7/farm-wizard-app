const mongoose = require("mongoose");
const { ESIM_PLANS } = require("../../utils/esimCatalog");

// GET /api/v1/esim/plans
exports.listPlans = (req, res) => {
  const plans = ESIM_PLANS.map(({ priceNgnFallback, ...plan }) => plan);
  return res.status(200).json({ plans });
};

function publicProfile(doc) {
  return {
    id: String(doc._id),
    planId: doc.planId,
    countryCode: doc.countryCode,
    country: doc.country,
    dataGB: doc.dataGB,
    validityDays: doc.validityDays,
    iccid: doc.iccid,
    smdpAddress: doc.smdpAddress,
    matchingId: doc.matchingId,
    activationCode: doc.activationCode,
    qrUrl: doc.qrUrl,
    purchasedAt: doc.createdAt,
  };
}

// GET /api/v1/esim/mine
exports.listMine = async (req, res) => {
  try {
    const ESim = require("../../models/ESim");
    const profiles = await ESim.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(50).lean();
    return res.status(200).json({ esims: profiles.map(publicProfile) });
  } catch (error) {
    console.error("Unable to list eSIMs:", error.message);
    return res.status(500).json({ message: "Your eSIMs could not be loaded. Please try again." });
  }
};

// GET /api/v1/esim/:id
exports.getOne = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: "eSIM not found." });
  try {
    const ESim = require("../../models/ESim");
    const profile = await ESim.findOne({ _id: req.params.id, user: req.user._id }).lean();
    if (!profile) return res.status(404).json({ message: "eSIM not found." });
    return res.status(200).json({ esim: publicProfile(profile) });
  } catch (error) {
    console.error("Unable to load eSIM:", error.message);
    return res.status(500).json({ message: "This eSIM could not be loaded. Please try again." });
  }
};
