import { describe, expect, it } from "@jest/globals";
import { describeEffectiveAvailability, describeWelcomeReward } from "@/services/rewards";

jest.mock("@react-native-async-storage/async-storage", () => ({ getItem: jest.fn() }));
jest.mock("@/config/client", () => ({ API_BASE: "https://api.example.test" }));

describe("describeWelcomeReward", () => {
  it("shows the free minute as available", () => {
    expect(describeWelcomeReward({ status: "available", seconds: 60, grantedSeconds: 60 }).title).toBe("1 free minute available");
  });

  it("shows the free minute as in use", () => {
    expect(describeWelcomeReward({ status: "in_use", seconds: 60 }).title).toBe("Free minute in use");
  });

  it("shows the reward as used once redeemed", () => {
    expect(describeWelcomeReward({ status: "redeemed", seconds: 0 }).title).toBe("Reward used");
  });

  it("asks unverified accounts to verify", () => {
    expect(describeWelcomeReward({ status: "verify_phone", seconds: 0 }).title).toMatch(/verify/i);
  });

  it("falls back safely for unavailable or unknown state without exposing internals", () => {
    const display = describeWelcomeReward({ status: "unavailable", seconds: 0 });
    expect(display.title).toBe("No reward available");
    expect(display.detail).not.toMatch(/fraud|hash|identity/i);
    expect(describeWelcomeReward(null).title).toBe("No reward available");
  });
});

describe("describeEffectiveAvailability", () => {
  it("uses the free minute when there is no purchased credit", () => {
    expect(describeEffectiveAvailability({ status: "available", seconds: 60, effectiveAvailability: "free_minute" }, false)).toMatch(/free minute/);
  });

  it("uses purchased credit when available", () => {
    expect(describeEffectiveAvailability({ status: "redeemed", seconds: 0, effectiveAvailability: "credits" }, true)).toMatch(/purchased credit/);
  });

  it("asks to top up when neither is available", () => {
    expect(describeEffectiveAvailability({ status: "redeemed", seconds: 0, effectiveAvailability: "none" }, false)).toMatch(/Top up/);
  });
});
