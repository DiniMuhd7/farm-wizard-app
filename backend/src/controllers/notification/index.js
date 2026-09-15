const Notification = require("../../models/Notification");

const getNotifications = async (req, res) => {
  const userId = req.user._id;

  if (!userId) {
    return res.status(404).json({ success: false, message: "User not found" });
  }
  try {
    const notifications = await Notification.find({ userId })
      .sort({
        _id: -1,
      })
      .limit(30);

    // if (notifications.length === 0) {
    //   return res.status(404).json({ message: "No notifications found for this user" });
    // }

    const data = {
      notifications,
    };
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
module.exports = { getNotifications };
