import { describe, expect, it, jest, beforeEach, afterEach } from "@jest/globals";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(async () => "test-token"),
}));

import { AvailableCountriesError, getAvailableNumberCountries, getPaymentPrices, waitForPaymentOutcome } from "./payments";

const originalFetch = global.fetch;

describe("getAvailableNumberCountries", () => {
  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
  });

  it("returns the purchasable country codes on a successful response", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ countryCodes: ["US", "GB"] }),
    })) as any;

    const result = await getAvailableNumberCountries([
      { value: "us" },
      { value: "gb" },
      { value: "ng" },
    ]);

    expect(result).toEqual(["US", "GB"]);
  });

  it("surfaces the backend's error message on a non-OK response", async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      json: async () => ({ message: "Please wait before checking country availability again." }),
    })) as any;

    await expect(getAvailableNumberCountries([{ value: "us" }])).rejects.toThrow(
      "Please wait before checking country availability again."
    );
  });

  it("surfaces a distinct service_unavailable code/message when the backend reports a missing provider configuration, instead of a generic failure", async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      json: async () => ({
        code: "service_unavailable",
        message: "9tel's number service isn't configured in this environment yet. Please try again later.",
      }),
    })) as any;

    let caught: unknown;
    try {
      await getAvailableNumberCountries([{ value: "us" }]);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(AvailableCountriesError);
    expect((caught as AvailableCountriesError).code).toBe("service_unavailable");
    expect((caught as Error).message).toBe(
      "9tel's number service isn't configured in this environment yet. Please try again later."
    );
  });

  it("tags a generic non-OK response as provider_error, not service_unavailable", async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      json: async () => ({ message: "Unable to load available countries right now. Please try again." }),
    })) as any;

    let caught: unknown;
    try {
      await getAvailableNumberCountries([{ value: "us" }]);
    } catch (error) {
      caught = error;
    }
    expect((caught as AvailableCountriesError).code).toBe("provider_error");
  });

  it("falls back to a generic message when a non-OK response has no JSON body", async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      json: async () => {
        throw new Error("not json");
      },
    })) as any;

    await expect(getAvailableNumberCountries([{ value: "us" }])).rejects.toThrow(
      "Unable to load available countries right now."
    );
  });

  it("rejects with a clear message instead of returning an empty list for a malformed payload", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ unexpected: "shape" }),
    })) as any;

    await expect(getAvailableNumberCountries([{ value: "us" }])).rejects.toThrow(
      "Unable to load available countries right now."
    );
  });

  it("surfaces a retryable error instead of hanging forever on a network failure", async () => {
    global.fetch = jest.fn(async () => {
      throw new TypeError("Network request failed");
    }) as any;

    await expect(getAvailableNumberCountries([{ value: "us" }])).rejects.toThrow(
      "Unable to reach 9tel right now. Check your connection and try again."
    );
  });

  it("surfaces a timeout-specific message when the request is aborted", async () => {
    jest.useFakeTimers();
    global.fetch = jest.fn((_url: string, options: any) => {
      return new Promise((_resolve, reject) => {
        options.signal.addEventListener("abort", () => {
          const err = new Error("Aborted");
          err.name = "AbortError";
          reject(err);
        });
      });
    }) as any;

    const pending = expect(getAvailableNumberCountries([{ value: "us" }])).rejects.toThrow(
      "Loading available countries timed out. Please try again."
    );
    await jest.advanceTimersByTimeAsync(15000);
    await pending;
  });

  it("skips the network call entirely when no valid country codes are given", async () => {
    global.fetch = jest.fn() as any;

    const result = await getAvailableNumberCountries([{ value: "" }, { value: "usa" }]);

    expect(result).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe("waitForPaymentOutcome", () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  const respondWith = (...statuses: (string | null)[]) => {
    const queue = [...statuses];
    global.fetch = jest.fn(async () => {
      const status = queue.length > 1 ? queue.shift() : queue[0];
      if (status === null) throw new Error("offline");
      return { ok: true, json: async () => ({ status, phoneNumber: null }) };
    }) as any;
  };

  it.each(["paid", "failed", "cancelled", "refunded"] as const)("resolves %s as soon as the backend reports it", async (status) => {
    respondWith("pending", status);
    await expect(waitForPaymentOutcome("order1", 1000, 1)).resolves.toBe(status);
  });

  it("keeps polling through transient errors", async () => {
    respondWith(null, "paid");
    await expect(waitForPaymentOutcome("order1", 1000, 1)).resolves.toBe("paid");
  });

  it("reports pending (not failed) when the deadline passes without a terminal status", async () => {
    respondWith("pending");
    await expect(waitForPaymentOutcome("order1", 20, 5)).resolves.toBe("pending");
  });
});


describe("getPaymentPrices", () => {
  afterEach(() => { global.fetch = originalFetch; });

  it("returns backend-authoritative FX-derived NGN prices", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ rate: 1500, ngn: { airbundles: { "500": 12000 }, creditPacks: { "500": 7500 }, number: 7500 } }),
    })) as any;

    await expect(getPaymentPrices()).resolves.toEqual({
      rate: 1500,
      ngn: { airbundles: { "500": 12000 }, creditPacks: { "500": 7500 }, number: 7500 },
    });
  });

  it("rejects malformed price responses instead of showing a guessed NGN amount", async () => {
    global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ ngn: {} }) })) as any;
    await expect(getPaymentPrices()).rejects.toThrow("Unable to load current NGN prices.");
  });
});
