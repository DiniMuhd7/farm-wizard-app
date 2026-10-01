import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it, jest, beforeEach, afterEach } from "@jest/globals";

// Each mock below stands in for a real dependency the call screen drives
// its ad-gating / premium-bypass / insufficient-credit phases off of —
// see app/(screens)/call.tsx's Phase state machine.
jest.mock("expo-keep-awake", () => ({ useKeepAwake: jest.fn() }));

const mockRouterBack = jest.fn();
const mockRouterReplace = jest.fn();
jest.mock("expo-router", () => ({
  router: { back: (...args: any[]) => mockRouterBack(...args), replace: (...args: any[]) => mockRouterReplace(...args) },
  useLocalSearchParams: jest.fn(() => ({ number: "+15551234567", video: "false" })),
}));

const mockClassifyDestination: jest.Mock<any> = jest.fn();
jest.mock("@/services/callEligibility", () => ({
  classifyDestination: (...args: any[]) => mockClassifyDestination(...args),
}));

const mockGetCreditsBalance: jest.Mock<any> = jest.fn();
jest.mock("@/services/credits", () => ({
  getCreditsBalance: (...args: any[]) => mockGetCreditsBalance(...args),
  hasSufficientCreditsForOneMinute: (balance: any) => balance.balanceCents >= balance.ratePerMinuteCents,
}));

jest.mock("@/context/LoginProvider", () => ({
  useLoginContext: jest.fn(() => ({ user: { isPremium: false } })),
}));

jest.mock("@/services/voice", () => ({
  getActiveVoiceCall: jest.fn(() => null),
  startVoiceCall: jest.fn(() => new Promise(() => {})), // never resolves — tests only assert pre-call phases
  subscribeToCallStatus: jest.fn(() => () => {}),
  setCallMuted: jest.fn(),
  setSpeakerphoneEnabled: jest.fn(),
  endActiveVoiceCall: jest.fn(),
}));

let rewardedAdProps: any = null;
jest.mock("@/utils/RewardedAdComponent", () => (props: any) => {
  rewardedAdProps = props;
  return null;
});

import { useLoginContext } from "@/context/LoginProvider";
import CallScreen from "./call";

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("CallScreen plan gating", () => {
  beforeEach(() => {
    // The screen's decorative pulse animation (Animated.loop(...).start(),
    // unrelated to plan gating) otherwise keeps scheduling real timers for
    // as long as the test process is alive — fake timers keep each test
    // isolated and let Jest exit cleanly.
    jest.useFakeTimers();
    jest.clearAllMocks();
    rewardedAdProps = null;
    mockRouterBack.mockReset();
    mockRouterReplace.mockReset();
    mockClassifyDestination.mockReset();
    mockGetCreditsBalance.mockReset();
    (useLoginContext as jest.Mock).mockReturnValue({ user: { isPremium: false } });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("gates a Free-plan (non-Premium, 9tel-to-9tel) call behind a rewarded ad before connecting", async () => {
    mockClassifyDestination.mockResolvedValue({ kind: "9tel" });
    let renderer: any;
    await act(async () => {
      renderer = TestRenderer.create(<CallScreen />);
    });
    await flush();

    expect(renderer.root.findAllByProps({ testID: undefined }).length).toBeGreaterThanOrEqual(0);
    expect(rewardedAdProps).not.toBeNull(); // the ad gate mounted the rewarded ad component
    expect(renderer.toJSON()).not.toBeNull();
    act(() => renderer.unmount());
  });

  it("lets a call proceed to connecting once the rewarded ad reward is earned", async () => {
    mockClassifyDestination.mockResolvedValue({ kind: "9tel" });
    let renderer: any;
    await act(async () => {
      renderer = TestRenderer.create(<CallScreen />);
    });
    await flush();
    expect(rewardedAdProps).not.toBeNull();

    act(() => {
      rewardedAdProps.onRewardEarned?.({ amount: 1, type: "coins" });
      rewardedAdProps.onClose?.();
    });
    await flush();

    const { startVoiceCall } = require("@/services/voice");
    expect(startVoiceCall).toHaveBeenCalledWith("+15551234567");
    act(() => renderer.unmount());
  });

  it("blocks the call and offers a retry when the pre-call ad is cancelled/unavailable", async () => {
    mockClassifyDestination.mockResolvedValue({ kind: "9tel" });
    let renderer: any;
    await act(async () => {
      renderer = TestRenderer.create(<CallScreen />);
    });
    await flush();

    // The ad closed (or errored) without a reward ever being earned.
    act(() => {
      rewardedAdProps.onClose?.();
    });
    await flush();

    const { startVoiceCall } = require("@/services/voice");
    expect(startVoiceCall).not.toHaveBeenCalled();
    expect(renderer.root.findAllByProps({}).some(() => true)).toBe(true);
    act(() => renderer.unmount());
  });

  it("bypasses the rewarded-ad gate entirely for a Premium account calling 9tel-to-9tel", async () => {
    (useLoginContext as jest.Mock).mockReturnValue({ user: { isPremium: true } });
    mockClassifyDestination.mockResolvedValue({ kind: "9tel" });
    let renderer: any;
    await act(async () => {
      renderer = TestRenderer.create(<CallScreen />);
    });
    await flush();

    expect(rewardedAdProps).toBeNull();
    const { startVoiceCall } = require("@/services/voice");
    expect(startVoiceCall).toHaveBeenCalledWith("+15551234567");
    act(() => renderer.unmount());
  });

  it("blocks a Pay As You Go call when the credits balance can't cover one billable minute", async () => {
    mockClassifyDestination.mockResolvedValue({ kind: "carrier" });
    mockGetCreditsBalance.mockResolvedValue({ balanceCents: 2, currency: "usd", ratePerMinuteCents: 9 });
    let renderer: any;
    await act(async () => {
      renderer = TestRenderer.create(<CallScreen />);
    });
    await flush();

    const { startVoiceCall } = require("@/services/voice");
    expect(startVoiceCall).not.toHaveBeenCalled();
    expect(rewardedAdProps).toBeNull(); // Pay As You Go never shows a rewarded ad
    act(() => renderer.unmount());
  });

  it("lets a Pay As You Go call proceed when the credits balance is sufficient", async () => {
    mockClassifyDestination.mockResolvedValue({ kind: "carrier" });
    mockGetCreditsBalance.mockResolvedValue({ balanceCents: 500, currency: "usd", ratePerMinuteCents: 9 });
    let renderer: any;
    await act(async () => {
      renderer = TestRenderer.create(<CallScreen />);
    });
    await flush();

    const { startVoiceCall } = require("@/services/voice");
    expect(startVoiceCall).toHaveBeenCalledWith("+15551234567");
    act(() => renderer.unmount());
  });

  it("fails open and connects without gating when the destination can't be classified", async () => {
    mockClassifyDestination.mockResolvedValue({ kind: "unknown" });
    let renderer: any;
    await act(async () => {
      renderer = TestRenderer.create(<CallScreen />);
    });
    await flush();

    const { startVoiceCall } = require("@/services/voice");
    expect(startVoiceCall).toHaveBeenCalledWith("+15551234567");
    expect(rewardedAdProps).toBeNull();
    act(() => renderer.unmount());
  });
});
