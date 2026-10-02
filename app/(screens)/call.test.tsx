import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it, jest, beforeEach, afterEach } from "@jest/globals";

// Each mock below stands in for a real dependency the call screen drives
// its plan-gating / insufficient-credit phases and ad placement off of —
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

jest.mock("@/services/rewards", () => ({
  getWelcomeReward: jest.fn(async () => ({ status: "unavailable" })),
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

jest.mock("@/components/CallInterstitialSlot", () => {
  const ReactActual = require("react");
  const { View } = require("react-native");
  return () => ReactActual.createElement(View, { testID: "call-interstitial-slot" });
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
    mockRouterBack.mockReset();
    mockRouterReplace.mockReset();
    mockClassifyDestination.mockReset();
    mockGetCreditsBalance.mockReset();
    (useLoginContext as jest.Mock).mockReturnValue({ user: { isPremium: false } });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("connects a 9tel-to-9tel call without any ad gate or pre-call screen", async () => {
    mockClassifyDestination.mockResolvedValue({ kind: "9tel" });
    let renderer: any;
    await act(async () => {
      renderer = TestRenderer.create(<CallScreen />);
    });
    await flush();

    const { startVoiceCall } = require("@/services/voice");
    expect(startVoiceCall).toHaveBeenCalledWith("+15551234567");
    act(() => renderer.unmount());
  });

  it("shows the interstitial placement directly above the connection-strength section, ahead of the call controls", async () => {
    mockClassifyDestination.mockResolvedValue({ kind: "9tel" });
    let renderer: any;
    await act(async () => {
      renderer = TestRenderer.create(<CallScreen />);
    });
    await flush();

    const slot = renderer.root.findByProps({ testID: "call-interstitial-slot" });
    const quality = renderer.root.findAll((node: any) => node.children?.includes?.("Your call is protected by 9tel."))[0];
    // Siblings under the call page: the slot (via its wrapper) must be
    // immediately followed by the connection-strength card.
    const page = slot.parent.parent;
    const children = page.children.filter((child: any) => typeof child !== "string");
    const contains = (child: any, target: any) => child === target || child.findAll((node: any) => node === target).length > 0;
    const slotIndex = children.findIndex((child: any) => contains(child, slot));
    const qualityIndex = children.findIndex((child: any) => contains(child, quality));
    expect(slotIndex).toBeGreaterThan(-1);
    expect(qualityIndex).toBe(slotIndex + 1);
    act(() => renderer.unmount());
  });

  it("keeps the call screen ad-free for an Airbundle account calling 9tel-to-9tel", async () => {
    (useLoginContext as jest.Mock).mockReturnValue({ user: { isPremium: true } });
    mockClassifyDestination.mockResolvedValue({ kind: "9tel" });
    let renderer: any;
    await act(async () => {
      renderer = TestRenderer.create(<CallScreen />);
    });
    await flush();

    expect(renderer.root.findAllByProps({ testID: "call-interstitial-slot" })).toHaveLength(0);
    const { startVoiceCall } = require("@/services/voice");
    expect(startVoiceCall).toHaveBeenCalledWith("+15551234567");
    act(() => renderer.unmount());
  });

  it("blocks a Prepaid call when the credits balance can't cover one billable minute", async () => {
    mockClassifyDestination.mockResolvedValue({ kind: "carrier" });
    mockGetCreditsBalance.mockResolvedValue({ balanceCents: 2, currency: "usd", ratePerMinuteCents: 9 });
    let renderer: any;
    await act(async () => {
      renderer = TestRenderer.create(<CallScreen />);
    });
    await flush();

    const { startVoiceCall } = require("@/services/voice");
    expect(startVoiceCall).not.toHaveBeenCalled();
    act(() => renderer.unmount());
  });

  it("lets a Prepaid call proceed when the credits balance is sufficient", async () => {
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
    act(() => renderer.unmount());
  });
});
