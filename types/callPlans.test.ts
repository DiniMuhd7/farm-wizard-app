import { describe, expect, it } from "@jest/globals";
import { resolveCallPlan } from "./callPlans";

describe("resolveCallPlan", () => {
  it("applies Airbundle to an Airbundle account calling another 9tel user", () => {
    expect(resolveCallPlan("9tel", true)).toBe("airbundle");
  });

  it("does not resolve a removed free plan for a 9tel destination without an Airbundle", () => {
    expect(resolveCallPlan("9tel", false)).toBe("unmetered");
  });

  it("applies Prepaid to a carrier destination regardless of Airbundle status", () => {
    expect(resolveCallPlan("carrier", false)).toBe("prepaid");
    expect(resolveCallPlan("carrier", true)).toBe("prepaid");
  });

  it("fails open to unmetered when the destination can't be classified", () => {
    expect(resolveCallPlan("unknown", false)).toBe("unmetered");
    expect(resolveCallPlan("unknown", true)).toBe("unmetered");
  });
});
