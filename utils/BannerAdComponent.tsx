import React, { useMemo, useState } from "react";
import { View, StyleSheet, useWindowDimensions } from "react-native";
import { BannerAd, BannerAdSize, TestIds } from "react-native-google-mobile-ads";

interface Props {
  adUnitId?: string;
  size?: BannerAdSize;
  style?: object;
}

const BannerAdComponent = ({
  adUnitId = __DEV__ ? TestIds.BANNER : "ca-app-pub-4516568539037938/3383596217",
  size = BannerAdSize.ANCHORED_ADAPTIVE_BANNER,
  style = {},
}: Props) => {
  const { width } = useWindowDimensions();
  // Adaptive banners calculate their creative size from the mounted view width.
  // Keep the ad mounted in a real-width container (rather than height: 0) so
  // gameplay banners request the correct size and can recover when rotation or
  // layout width changes.
  const adRequestKey = useMemo(
    () => `${adUnitId}-${size}-${Math.round(width)}`,
    [adUnitId, size, width]
  );
  const [loaded, setLoaded] = useState(false);

  return (
    <View style={[styles.container, loaded ? styles.containerLoaded : null, style]}>
      <View style={[styles.adSlot, loaded ? styles.visibleAd : styles.measuringAd]}>
        <BannerAd
          key={adRequestKey}
          unitId={adUnitId}
          size={size}
          requestOptions={{
            requestNonPersonalizedAdsOnly: true,
          }}
          onAdLoaded={() => setLoaded(true)}
          onAdFailedToLoad={(error) => {
            setLoaded(false);
            console.warn("Banner ad failed to load:", error?.message || error);
          }}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    backgroundColor: "transparent",
  },
  // Only reserve the ad's height once it has actually loaded. Without this
  // split, the container's minHeight applied unconditionally, so a failed
  // (no-fill) load — which used to be covered by the LifeGate fallback —
  // left a permanent blank 50px gap instead of collapsing away.
  containerLoaded: {
    minHeight: 50,
  },
  adSlot: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  visibleAd: {
    minHeight: 50,
  },
  // Kept mounted off-flow (not unmounted) while unloaded/failed, positioned
  // absolutely so it takes zero layout space but can still measure itself
  // and pop in later if AdMob's own refresh cycle succeeds.
  measuringAd: {
    opacity: 0,
    minHeight: 50,
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
});

export default BannerAdComponent;

