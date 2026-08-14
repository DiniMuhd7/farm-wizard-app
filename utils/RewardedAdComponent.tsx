import { useEffect } from "react";
import {
  RewardedAd,
  RewardedAdEventType,
  AdEventType,
  TestIds,
} from "react-native-google-mobile-ads";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "REWARDED_AD_VIEW_COUNT";

interface Props {
  onRewardEarned?: (reward: { amount: number; type: string }) => void;
  onClose?: () => void;
  adUnitId?: string;
}

const RewardedAdComponent = ({
  onRewardEarned,
  onClose,
  adUnitId = __DEV__ ? TestIds.REWARDED : "ca-app-pub-4516568539037938/1775609882",
}: // adUnitId = TestIds.REWARDED,
Props) => {
  useEffect(() => {
    const now = Date.now();
    const rewarded = RewardedAd.createForAdRequest(adUnitId, {
      requestNonPersonalizedAdsOnly: true,
    });

    const unsubscribeLoaded = rewarded.addAdEventListener(
      RewardedAdEventType.LOADED,
      () => rewarded.show()
    );

    const unsubscribeClosed = rewarded.addAdEventListener(
      AdEventType.CLOSED,
      () => onClose?.()
    );

    // If the ad fails to load (offline / no fill), report close so the
    // caller can reset its state instead of waiting forever.
    const unsubscribeError = rewarded.addAdEventListener(
      AdEventType.ERROR,
      () => onClose?.()
    );

    const unsubscribeReward = rewarded.addAdEventListener(
      RewardedAdEventType.EARNED_REWARD,
      async (reward) => {
        onRewardEarned?.(reward);

        let stored = await AsyncStorage.getItem(STORAGE_KEY);
        let data = stored ? JSON.parse(stored) : { timestamp: now, count: 0 };

        const expired = now - data.timestamp >= 24 * 60 * 60 * 1000;

        if (expired) {
          data = { timestamp: now, count: 0 };
          // await scheduleAdResetNotification();
        }

        data.count += 1;
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      }
    );

    rewarded.load();

    return () => {
      unsubscribeLoaded();
      unsubscribeClosed();
      unsubscribeError();
      unsubscribeReward();
    };
  }, [adUnitId, onClose, onRewardEarned]);

  return null;
};
/*
const scheduleAdResetNotification = async () => {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "🎁 Ad rewards are available!",
      body: "You can now watch ads again for rewards.",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 24 * 60 * 60,
    },
  });
};*/

export default RewardedAdComponent;
