const Earning = require("../../models/Earning");
const User = require("../../models/User");
const UserPlantLevel = require("../../models/UserPlantLevel");
const { goodResponse } = require("../../utils/response");
const sendNotification = require("../../utils/sendNotification");
const { creditScore } = require("../../utils/creditScore");

// Get all plant levels for a user
const getUserPlantLevels = async (req, res) => {
  try {
    const userId = req.user._id;
    if (!userId) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    const levels = await UserPlantLevel.find({ user: userId });

    return res.json(levels);
  } catch (err) {
    return res.status(500).json({ error: "Server Error" });
  }
};
// Get single plant level for a user
const getUserPlantLevel = async (req, res) => {
  try {
    const userId = req.user._id;
    const { plantName } = req.query;

    if (!userId) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    if (!plantName) {
      return res
        .status(404)
        .json({ success: false, message: "Plant name is missing" });
    }
    const plantLevel = await UserPlantLevel.findOne({
      user: userId,
      plantName,
    });

    return goodResponse(res, "Data fetched successfully", { plantLevel }, 200);
  } catch (err) {
    return res.status(500).json({ error: "Server Error" });
  }
};

// Update a user's level for a specific plant
const updatePlantLevel = async (req, res) => {
  const userId = req.user._id;
  const { plantName, level, score } = req.body;

  if (!userId || !plantName) {
    return res.status(404).json({
      success: false,
      message: "User not found or plant name is missing",
    });
  }

  if (
    !plantName ||
    !level ||
    !score ||
    typeof score !== "number" ||
    score <= 0
  ) {
    return res
      .status(404)
      .json({ success: false, message: "All fields are reuired" });
  }

  try {
    const updatedPlantLevel = await UserPlantLevel.findOneAndUpdate(
      { user: userId, plantName },
      { level, updatedAt: new Date() },
      { upsert: true, new: true } // create if not exists
    );
    // const user = await User.findById(userId);

    // update user score
    // user.score += score;
    // await user.save();

    // Credit the harvest score, capped at the daily earning limit.
    const { updated: updateUser, granted } = await creditScore(userId, score);

    //  create earning chart
    const earning_ref = "plant: " + plantName + " upgrade to level: " + level;
    const earning = await Earning.create({
      userId,
      score: granted,
      reference: earning_ref,
      status: "New",
    });

    await sendNotification(
      userId,
      `You upgrade your plant seed ${plantName} to level ${level}, Keep playing to earn more tokens  `
    );

    return goodResponse(
      res,
      "Data updated successfully",
      { updatedPlantLevel, updateUser, earning },
      200
    );
  } catch (err) {
    console.log("fail", err);
    return res.status(500).json({ error: "Could not update plant level" });
  }
};

module.exports = { getUserPlantLevels, updatePlantLevel, getUserPlantLevel };
