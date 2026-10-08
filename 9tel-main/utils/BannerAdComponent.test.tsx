import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it, jest } from "@jest/globals";

jest.mock("react-native-google-mobile-ads", () => {
  const ReactActual = require("react");
  return {
    // Mimics the real BannerAd firing either onAdLoaded or
    // onAdFailedToLoad once mounted, driven by adUnitId so each test below
    // can exercise one state deterministically.
    BannerAd: (props: any) => {
      ReactActual.useEffect(() => {
        if (props.unitId === "loaded-slot") props.onAdLoaded?.();
        else props.onAdFailedToLoad?.(new Error("no fill"));
      }, []);
      return null;
    },
    BannerAdSize: { ANCHORED_ADAPTIVE_BANNER: "ANCHORED_ADAPTIVE_BANNER" },
    TestIds: { BANNER: "test-banner-id" },
  };
});

import BannerAdComponent from "./BannerAdComponent";

// This component is rendered as a sibling *after* <Tabs> in
// app/(tabs)/_layout.jsx, right below the custom bottom tab bar. While the
// ad is unloaded/failed it positions its slot absolutely over the bottom of
// the screen (purely so AdMob can measure it) with opacity 0 — if that slot
// stayed tappable it would silently swallow taps meant for the tab bar's
// labels underneath it, even though it's invisible.
describe("BannerAdComponent", () => {
  it("does not intercept touches while unloaded/measuring", () => {
    let renderer: any;
    act(() => {
      renderer = TestRenderer.create(<BannerAdComponent adUnitId="unloaded-slot" />);
    });

    const adSlot = renderer.root.findByProps({ testID: "banner-ad-slot" });
    expect(adSlot.props.pointerEvents).toBe("none");
    expect(adSlot.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ opacity: 0 })])
    );

    act(() => renderer.unmount());
  });

  it("becomes tappable (pointerEvents left as default) once the ad has actually loaded", () => {
    let renderer: any;
    act(() => {
      renderer = TestRenderer.create(<BannerAdComponent adUnitId="loaded-slot" />);
    });

    // The mocked BannerAd fires onAdLoaded synchronously from a useEffect,
    // which `act()` flushes here.
    const adSlot = renderer.root.findByProps({ testID: "banner-ad-slot" });
    expect(adSlot.props.pointerEvents).toBeUndefined();
    expect(adSlot.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ minHeight: 50 })])
    );

    act(() => renderer.unmount());
  });
});
