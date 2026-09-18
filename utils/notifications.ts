import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { API_BASE } from "@/config/client";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export const initNotifications = async () => {
  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "9tel",
        importance: Notifications.AndroidImportance.HIGH,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    }
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") {
      await Notifications.requestPermissionsAsync();
    }
  } catch (e) {
    console.warn("Notification init failed:", e);
  }
};

// Registers this device's Expo push token with the backend. This captures
// the token so the server has somewhere to push to — it is NOT, by itself,
// what makes incoming calls ring in the background. A real "ring while the
// app is closed" pipeline additionally needs a Twilio Push Credential (iOS
// APNs / Android FCM) linked to this Access Token's grants, which is
// account/console configuration outside this codebase. Right now, incoming
// calls only reach the device while the app is open with an active
// connection to Twilio (see context/VoiceCallProvider.tsx).
// Safe to call repeatedly; no-ops without permission, a token, or a session.
export const registerPushToken = async () => {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (status !== "granted") {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== "granted") return;

    const projectId =
      (Constants as any)?.expoConfig?.extra?.eas?.projectId ||
      (Constants as any)?.easConfig?.projectId;

    const tokenResp = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    const pushToken = tokenResp?.data;
    const authToken = await AsyncStorage.getItem("token");
    if (!pushToken || !authToken) return;

    await fetch(`${API_BASE}/api/v1/user/push-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ token: pushToken }),
    });
  } catch (e) {
    // Push tokens require a physical device; ignore failures silently.
    console.warn("registerPushToken failed:", (e as any)?.message);
  }
};
