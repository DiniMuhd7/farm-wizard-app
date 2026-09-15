const axios = require("axios");

// Delivers a push notification to a device via Expo's push service.
// The app registers an Expo push token (ExponentPushToken[...]) which we
// store on the user; FCM credentials (google-services.json) handle Android
// delivery behind Expo.
const sendPush = async (pushToken, title, body, data = {}) => {
  if (!pushToken || !String(pushToken).startsWith("ExponentPushToken")) {
    return; // no valid token registered for this user
  }
  try {
    await axios.post(
      "https://exp.host/--/api/v2/push/send",
      { to: pushToken, title, body, sound: "default", data },
      {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err) {
    console.warn("Push send failed:", err?.response?.data || err.message);
  }
};

module.exports = sendPush;
