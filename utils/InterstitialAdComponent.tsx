import { useEffect } from "react";
import {
  InterstitialAd as InterstitialAdModule,
  AdEventType,
} from "react-native-google-mobile-ads";

interface Props {
  onClose?: () => void;
  adUnitId?: string;
}

const InterstitialAdComponent = ({
  onClose,
  adUnitId = "ca-app-pub-4516568539037938/4288649621",
}: // adUnitId = TestIds.INTERSTITIAL,
Props) => {
  useEffect(() => {
    const interstitial = InterstitialAdModule.createForAdRequest(adUnitId, {
      requestNonPersonalizedAdsOnly: true,
    });

    const unsubscribeLoaded = interstitial.addAdEventListener(
      AdEventType.LOADED,
      () => {
        interstitial.show();
      }
    );

    const unsubscribeClosed = interstitial.addAdEventListener(
      AdEventType.CLOSED,
      () => {
        if (onClose) onClose();
      }
    );

    // If the ad fails to load (offline / no fill), continue as if it closed
    // so callers waiting on onClose are never left hanging.
    const unsubscribeError = interstitial.addAdEventListener(
      AdEventType.ERROR,
      () => {
        if (onClose) onClose();
      }
    );

    interstitial.load();

    return () => {
      unsubscribeLoaded();
      unsubscribeClosed();
      unsubscribeError();
    };
  }, []);

  return null; // No UI needed
};

export default InterstitialAdComponent;
