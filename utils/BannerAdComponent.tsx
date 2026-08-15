import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Linking,
  StyleSheet,
} from "react-native";
import { BannerAd, BannerAdSize, TestIds } from "react-native-google-mobile-ads";
import { Cross, ChevronRight } from "lucide-react-native";

interface Props {
  adUnitId?: string;
  size?: BannerAdSize;
  style?: object;
}

const LIFEGATE_URL = "https://mobile.dshub.com.ng";

const openLifeGate = () => Linking.openURL(LIFEGATE_URL).catch(() => {});

// In-house fallback banner shown whenever AdMob has no ad to serve.
// Farm Wizard themed so the fallback feels like part of the garden UI while
// still feeling like part of the garden UI when AdMob has no fill.
const LifeGateBanner = () => (
  <TouchableOpacity
    style={styles.lifeGate}
    activeOpacity={0.88}
    onPress={openLifeGate}
    accessibilityRole="link"
    accessibilityLabel="Open LifeGate Mobile health app"
  >
    <View style={styles.lifeGateIcon}>
      <Cross size={23} color="#17351F" strokeWidth={3} />
    </View>
    <View style={styles.lifeGateTextWrap}>
      <Text style={styles.lifeGateTitle}>LifeGate Mobile</Text>
      <Text style={styles.lifeGateBody}>
        Healthy gardeners grow healthy gardens — check care options anytime.
      </Text>
    </View>
    <View style={styles.ctaButton}>
      <Text style={styles.ctaText}>Open</Text>
      <ChevronRight size={15} color="#17351F" strokeWidth={3} />
    </View>
  </TouchableOpacity>
);

const BannerAdComponent = ({
  adUnitId = __DEV__ ? TestIds.BANNER : "ca-app-pub-4516568539037938/3383596217",
  style = {},
}: Props) => {
  // AdMob banner fills the slot when it loads; while it has no fill we
  // show the LifeGate house banner instead. If AdMob later loads (it
  // refreshes periodically), the house banner is hidden again.
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <View style={[styles.container, style]}>
      {failed && !loaded && <LifeGateBanner />}
      <View style={loaded ? undefined : styles.hidden}>
        <BannerAd
          unitId={adUnitId}
          size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
          requestOptions={{
            requestNonPersonalizedAdsOnly: true,
          }}
          onAdLoaded={() => {
            setLoaded(true);
            setFailed(false);
          }}
          onAdFailedToLoad={(error) => {
            setLoaded(false);
            setFailed(true);
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
  },
  hidden: {
    height: 0,
    overflow: "hidden",
  },
  lifeGate: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#17351F",
    borderTopWidth: 1,
    borderTopColor: "#F7E7A1",
    borderBottomWidth: 1,
    borderBottomColor: "#2F7D3D",
    height: 50,
    paddingVertical: 4,
    paddingHorizontal: 10,
    width: "100%",
  },
  lifeGateIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F7E7A1",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  lifeGateTextWrap: {
    flex: 1,
  },
  lifeGateTitle: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 13,
    marginTop: 1,
  },
  lifeGateBody: {
    color: "#E7F8E7",
    fontSize: 10,
    marginTop: 0,
  },
  ctaButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9D65C",
    borderRadius: 999,
    paddingVertical: 5,
    paddingLeft: 12,
    paddingRight: 8,
    marginLeft: 8,
  },
  ctaText: {
    color: "#17351F",
    fontSize: 12,
    fontWeight: "800",
  },
});

export default BannerAdComponent;
