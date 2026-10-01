import { describe, expect, it, jest, afterEach } from "@jest/globals";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(async () => "test-token"),
}));

import { getCreditsBalance, hasSufficientCreditsForOneMinute } from "./credits";

const originalFetch = global.fetch;

describe("getCreditsBalance", () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns the backend's reported balance", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ balanceCents: 120, currency: "usd", ratePerMinuteCents: 9 }),
    })) as any;

    const result = await getCreditsBalance();

    expect(result).toEqual({ balanceCents: 120, currency: "usd", ratePerMinuteCents: 9 });
  });

  it("throws a clear error on a non-OK response", async () => {
    global.fetch = jest.fn(async () => ({ ok: false, json: async () => ({}) })) as any;

    await expect(getCreditsBalance()).rejects.toThrow("Unable to check your Pay As You Go balance right now.");
  });
});

describe("hasSufficientCreditsForOneMinute", () => {
  it("is true when the balance covers at least one billable minute", () => {
    expect(hasSufficientCreditsForOneMinute({ balanceCents: 9, currency: "usd", ratePerMinuteCents: 9 })).toBe(true);
    expect(hasSufficientCreditsForOneMinute({ balanceCents: 100, currency: "usd", ratePerMinuteCents: 9 })).toBe(true);
  });

  it("is false when the balance can't cover even one billable minute", () => {
    expect(hasSufficientCreditsForOneMinute({ balanceCents: 8, currency: "usd", ratePerMinuteCents: 9 })).toBe(false);
    expect(hasSufficientCreditsForOneMinute({ balanceCents: 0, currency: "usd", ratePerMinuteCents: 9 })).toBe(false);
  });
});
