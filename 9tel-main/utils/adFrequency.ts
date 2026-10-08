import AsyncStorage from "@react-native-async-storage/async-storage";

// App-wide interstitial frequency gate. AdMob policy discourages showing
// interstitials too often / on repetitive actions, which can trigger ad
// serving limits or policy strikes. Every interstitial in the app should
// go through canShowInterstitial() + markInterstitialShown().

const KEY = "last-interstitial-at";

// Minimum seconds between any two interstitials, anywhere in the app.
export const MIN_INTERSTITIAL_INTERVAL_SEC = 180; // 3 minutes

export const canShowInterstitial = async (
  minIntervalSec: number = MIN_INTERSTITIAL_INTERVAL_SEC
): Promise<boolean> => {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return true;
    return Date.now() - parseInt(raw, 10) >= minIntervalSec * 1000;
  } catch {
    return true;
  }
};

export const markInterstitialShown = async (): Promise<void> => {
  try {
    await AsyncStorage.setItem(KEY, String(Date.now()));
  } catch {
    // ignore
  }
};
