import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { BannerAdSize } from "react-native-google-mobile-ads";
import BannerAdComponent from "@/utils/BannerAdComponent";

// The call-session interstitial placement, rendered directly above the
// network connection-strength card on app/(screens)/call.tsx. A full-screen
// interstitial would cover the call controls mid-call, so this is an inline
// placement reusing the app's existing AdMob banner component/configuration
// (BannerAdComponent). It degrades gracefully: until an ad has actually
// loaded — or when it's blocked, has no fill, or isn't configured — the slot
// takes no layout space, and it never overlaps the call controls or status.
export default function CallInterstitialSlot({ adUnitId }: { adUnitId?: string }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <View testID="call-interstitial-slot" style={loaded ? s.loaded : s.collapsed}>
      <BannerAdComponent adUnitId={adUnitId} size={BannerAdSize.BANNER} onLoadChange={setLoaded} />
    </View>
  );
}

const s = StyleSheet.create({
  collapsed: { marginTop: 0 },
  loaded: { marginTop: 20 },
});
