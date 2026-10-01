import { describe, expect, it } from "@jest/globals";
import { resolveCallPlan } from "./callPlans";

describe("resolveCallPlan", () => {
  it("applies Free to a non-Premium account calling another 9tel user", () => {
    expect(resolveCallPlan("9tel", false)).toBe("free");
  });

  it("applies Premium to a Premium account calling another 9tel user", () => {
    expect(resolveCallPlan("9tel", true)).toBe("premium");
  });

  it("applies Pay As You Go to a carrier destination regardless of Premium status", () => {
    expect(resolveCallPlan("carrier", false)).toBe("payg");
    expect(resolveCallPlan("carrier", true)).toBe("payg");
  });

  it("fails open to unmetered when the destination can't be classified", () => {
    expect(resolveCallPlan("unknown", false)).toBe("unmetered");
    expect(resolveCallPlan("unknown", true)).toBe("unmetered");
  });
});
