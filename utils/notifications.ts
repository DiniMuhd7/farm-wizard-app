import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { API_BASE } from "@/config/client";

// Local push notifications driven by in-app events and game activity.

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const COME_BACK_ID = "come-back-reminder";
const PAUSED_SESSION_ID = "paused-session-reminder";
const LAST_ENGAGEMENT_KEY = "last-engagement-nudge";
const LAST_NOTIFIED_KEY = "last-notified-app-notification";
let lastGameplayStatusAt = 0;

export const initNotifications = async () => {
  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Farm Wizard",
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

// Registers this device's Expo push token with the backend so the server
// can deliver push notifications (rewards, level-ups, broadcasts, etc.).
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
        Authorization: `JWT ${authToken}`,
      },
      body: JSON.stringify({ token: pushToken }),
    });
  } catch (e) {
    // Push tokens require a physical device; ignore failures silently.
    console.warn("registerPushToken failed:", (e as any)?.message);
  }
};

// Daily nudge if the player hasn't opened the app; rescheduled on every
// app open so it only fires after 24h of inactivity.
export const scheduleComeBackReminder = async () => {
  try {
    await Notifications.cancelScheduledNotificationAsync(COME_BACK_ID).catch(
      () => {}
    );
    await Notifications.scheduleNotificationAsync({
      identifier: COME_BACK_ID,
      content: {
        title: "🌱 Your farm misses you!",
        body: "Come back to Farm Wizard — your crops are waiting to grow and earn you points.",
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 24 * 60 * 60 },
    });
  } catch (e) {
    console.warn("Failed to schedule come-back reminder:", e);
  }
};

// Reminder when the player pauses and exits mid-session.
export const schedulePausedSessionReminder = async (plantName?: string) => {
  try {
    await Notifications.cancelScheduledNotificationAsync(
      PAUSED_SESSION_ID
    ).catch(() => {});
    await Notifications.scheduleNotificationAsync({
      identifier: PAUSED_SESSION_ID,
      content: {
        title: "⏸️ Your session is paused",
        body: plantName
          ? `Your ${plantName} is waiting — come back and finish growing it!`
          : "Your plant is waiting — come back and finish the session!",
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 2 * 60 * 60 },
    });
  } catch (e) {
    console.warn("Failed to schedule paused-session reminder:", e);
  }
};

export const cancelPausedSessionReminder = async () => {
  try {
    await Notifications.cancelScheduledNotificationAsync(PAUSED_SESSION_ID);
  } catch (e) {
    // nothing scheduled — fine
  }
};

// Fired right after a completed session.
export const notifySessionComplete = async (points?: number) => {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "🎉 Session complete!",
        body:
          points !== undefined
            ? `Great harvest! You earned ${points} points. Play again to grow your balance.`
            : "Great harvest! Play again to grow your balance.",
      },
      trigger: null, // immediate
    });
  } catch (e) {
    console.warn("Failed to send session-complete notification:", e);
  }
};

// Mirror new in-app notifications (from the bell menu) as push notifications.
// Only notifies for notifications newer than the last one already shown.
export const notifyNewAppNotifications = async (notifications: any[]) => {
  try {
    if (!Array.isArray(notifications) || notifications.length === 0) return;
    const latest = notifications[0];
    const id = String(latest._id || latest.id || latest.createdAt || "");
    if (!id) return;

    const lastSeen = await AsyncStorage.getItem(LAST_NOTIFIED_KEY);
    await AsyncStorage.setItem(LAST_NOTIFIED_KEY, id);

    // First run: just record the marker, don't replay old notifications.
    if (lastSeen === null || lastSeen === id) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Farm Wizard",
        body: latest.message || "You have a new notification.",
      },
      trigger: null,
    });
  } catch (e) {
    console.warn("Failed to mirror app notification:", e);
  }
};


export const scheduleSmartEngagementNudge = async (context?: {
  averageHealth?: number;
  harvests?: number;
  gardenPoints?: number;
}) => {
  try {
    const now = Date.now();
    const last = Number(await AsyncStorage.getItem(LAST_ENGAGEMENT_KEY));
    if (last && now - last < 8 * 60 * 60 * 1000) return;

    const title = context?.averageHealth && context.averageHealth >= 80
      ? "🌟 Your garden is trending up"
      : "🌿 A quick garden check?";
    const body = context?.harvests
      ? `Your average harvest health is ${context.averageHealth || 0}%. Plant again now for smarter rewards and upgrades.`
      : "Start a crop session to unlock personalized rewards, care tips, and performance trends.";

    await AsyncStorage.setItem(LAST_ENGAGEMENT_KEY, String(now));
    await Notifications.scheduleNotificationAsync({
      content: { title, body, data: { screen: "home", type: "engagement" } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 4 * 60 * 60 },
    });
  } catch (e) {
    console.warn("Failed to schedule engagement nudge:", e);
  }
};
