const User = require("../../models/User");

const getLeaderboard = async (req, res) => {
  const { page = 1, limit = 100 } = req.query;
  const skip = (page - 1) * limit;

  try {
    const users = await User.find({})
      .sort({ score: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .exec();

    // Add position to each user
    const usersWithPosition = users.map((user, index) => ({
      ...user.toObject(),
      position: skip + index + 1,
    }));

    res.json(usersWithPosition);
  } catch (error) {
    console.error("Error fetching top users:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = { getLeaderboard };
