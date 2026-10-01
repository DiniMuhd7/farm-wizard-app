import { describe, expect, it, jest, beforeEach, afterEach } from "@jest/globals";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(async () => "test-token"),
}));

import { getAvailableNumberCountries } from "./payments";

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
