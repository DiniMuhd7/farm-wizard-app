const Notification = require("../models/Notification");
const User = require("../models/User");
const sendPush = require("./sendPush");

// Saves an in-app notification AND delivers it as a device push (when the
// user has a registered push token). Title defaults to the app name.
const sendNotification = async (userId, message, title = "Farm Wizard") => {
  try {
    await Notification.create({
      userId,
      message,
    });

    const user = await User.findById(userId).select("notification_token");
    if (user && user.notification_token) {
      await sendPush(user.notification_token, title, message);
    }
  } catch (err) {
    console.error("Error saving notifcations:", err);
  }
};

module.exports = sendNotification;
