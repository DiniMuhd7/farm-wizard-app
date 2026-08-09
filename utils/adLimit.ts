import AsyncStorage from "@react-native-async-storage/async-storage";

// AdMob-friendly rewarded-ad cap. Rewards are optional, user-initiated,
// and limited per 24-hour window so the app does not encourage repeated
// ad clicking or make ads the primary app mechanic.
const STORAGE_KEY = "REWARDED_AD_VIEW_COUNT";

export const getRemainingAdViews = async (limit = 3): Promise<number> => {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    const now = Date.now();
    const data = stored ? JSON.parse(stored) : { timestamp: now, count: 0 };
    const expired = now - data.timestamp >= 24 * 60 * 60 * 1000;
    return expired ? limit : Math.max(limit - (data.count || 0), 0);
  } catch {
    return limit;
  }
};

export const canShowRewardedAd = async (limit = 3): Promise<boolean> => {
  return (await getRemainingAdViews(limit)) > 0;
};
