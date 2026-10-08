import { describe, expect, it, jest, afterEach } from "@jest/globals";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(async () => "test-token"),
}));

import { classifyDestination } from "./callEligibility";

const originalFetch = global.fetch;

describe("classifyDestination", () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("classifies client: identities as 9tel without a network call", async () => {
    global.fetch = jest.fn() as any;

    const result = await classifyDestination("client:user-123");

    expect(result).toEqual({ kind: "9tel" });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("classifies an E.164 number owned by a 9tel user as 9tel", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ phoneNumber: "+15551234567", is9telNumber: true }),
    })) as any;

    const result = await classifyDestination("+15551234567");

    expect(result).toEqual({ kind: "9tel" });
  });

  it("classifies an E.164 number not owned by a 9tel user as carrier", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ phoneNumber: "+15551234567", is9telNumber: false }),
    })) as any;

    const result = await classifyDestination("+15551234567");

    expect(result).toEqual({ kind: "carrier" });
  });

  it("fails open to unknown instead of guessing for a non-E.164, non-client destination", async () => {
    global.fetch = jest.fn() as any;

    const result = await classifyDestination("John Doe");

    expect(result).toEqual({ kind: "unknown" });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("fails open to unknown on a backend error instead of blocking the call", async () => {
    global.fetch = jest.fn(async () => ({ ok: false, json: async () => ({ message: "down" }) })) as any;

    const result = await classifyDestination("+15551234567");

    expect(result).toEqual({ kind: "unknown" });
  });

  it("fails open to unknown on a network failure instead of blocking the call", async () => {
    global.fetch = jest.fn(async () => {
      throw new TypeError("Network request failed");
    }) as any;

    const result = await classifyDestination("+15551234567");

    expect(result).toEqual({ kind: "unknown" });
  });

  it("fails open to unknown for a malformed response payload", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ unexpected: "shape" }),
    })) as any;

    const result = await classifyDestination("+15551234567");

    expect(result).toEqual({ kind: "unknown" });
  });

  it("returns unknown for an empty destination", async () => {
    const result = await classifyDestination("");
    expect(result).toEqual({ kind: "unknown" });
  });
});
