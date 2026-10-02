/**
 * Credits top-up and Airbundle purchase fulfillment: both run after a
 * payment provider has already confirmed money changed hands, so these
 * tests focus on (a) the balance/entitlement math being correct and (b) a
 * failure here triggering a refund instead of silently keeping the user's
 * money without granting what they paid for.
 */

jest.mock("../../models/User", () => ({ findById: jest.fn(), findByIdAndUpdate: jest.fn() }));
jest.mock("../numbers", () => ({ purchaseAndAssignNumber: jest.fn() }));

const User = require("../../models/User");
const { _private } = require("./index");
const { fulfillCreditsOrder, fulfillAirbundleOrder } = _private;

function fakeOrder(overrides) {
  return {
    _id: "order1",
    user: "user1",
    status: "pending",
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("fulfillCreditsOrder", () => {
  beforeEach(() => {
    User.findById.mockReset();
    User.findByIdAndUpdate.mockReset();
  });

  it("adds the paid-for credits to the user's balance and marks the order paid", async () => {
    User.findByIdAndUpdate.mockResolvedValue({});
    const order = fakeOrder({ creditsCents: 1000 });

    const result = await fulfillCreditsOrder(order);

    expect(User.findByIdAndUpdate).toHaveBeenCalledWith("user1", { $inc: { creditsBalanceCents: 1000 } });
    expect(order.status).toBe("paid");
    expect(order.fulfilledCreditsCents).toBe(1000);
    expect(result).toBe(1000);
  });

  it("is a no-op on webhook redelivery once already fulfilled", async () => {
    const order = fakeOrder({ creditsCents: 1000, status: "paid", fulfilledCreditsCents: 1000 });

    const result = await fulfillCreditsOrder(order);

    expect(User.findByIdAndUpdate).not.toHaveBeenCalled();
    expect(result).toBe(1000);
  });

  it("never falsely reports success: a failure leaves the order unpaid rather than granting credit", async () => {
    User.findByIdAndUpdate.mockRejectedValue(new Error("db down"));
    const order = fakeOrder({ creditsCents: 1000 });

    const result = await fulfillCreditsOrder(order);

    expect(result).toBeNull();
    expect(order.status).not.toBe("paid");
    expect(order.fulfilledCreditsCents).toBeUndefined();
  });
});

describe("fulfillAirbundleOrder", () => {
  beforeEach(() => {
    User.findById.mockReset();
    User.findByIdAndUpdate.mockReset();
  });

  it("adds the bundle's minutes and grants ad-free access through now + premiumDays", async () => {
    User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ premiumUntil: null }) });
    User.findByIdAndUpdate.mockResolvedValue({});
    const order = fakeOrder({ premiumDays: 30, bundleMinutes: 1500 });
    const before = Date.now();

    const result = await fulfillAirbundleOrder(order);

    expect(result).toBe(30);
    expect(order.status).toBe("paid");
    expect(order.fulfilledPremiumDays).toBe(30);
    const [userId, update] = User.findByIdAndUpdate.mock.calls[0];
    expect(userId).toBe("user1");
    expect(update.isPremium).toBe(true);
    expect(update.$inc).toEqual({ airbundleMinutes: 1500 });
    const expectedMin = before + 29 * 24 * 60 * 60 * 1000;
    expect(update.premiumUntil.getTime()).toBeGreaterThan(expectedMin);
  });

  it("extends an already-active ad-free period instead of overwriting it with a shorter one", async () => {
    const stillActive = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000); // 10 days left
    User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ premiumUntil: stillActive }) });
    User.findByIdAndUpdate.mockResolvedValue({});
    const order = fakeOrder({ premiumDays: 30 });

    await fulfillAirbundleOrder(order);

    const [, update] = User.findByIdAndUpdate.mock.calls[0];
    // Base is the existing premiumUntil (10 days out), plus 30 more days —
    // not "now + 30", which would discard the 10 days already paid for.
    const expectedUntil = stillActive.getTime() + 30 * 24 * 60 * 60 * 1000;
    expect(update.premiumUntil.getTime()).toBe(expectedUntil);
  });

  it("is a no-op on webhook redelivery once already fulfilled", async () => {
    const order = fakeOrder({ premiumDays: 30, status: "paid", fulfilledPremiumDays: 30 });

    const result = await fulfillAirbundleOrder(order);

    expect(User.findByIdAndUpdate).not.toHaveBeenCalled();
    expect(result).toBe(30);
  });

  it("never falsely reports success: a failure leaves the order unpaid rather than granting the bundle", async () => {
    User.findById.mockReturnValue({ select: jest.fn().mockRejectedValue(new Error("db down")) });
    const order = fakeOrder({ premiumDays: 30 });

    const result = await fulfillAirbundleOrder(order);

    expect(result).toBeNull();
    expect(order.status).not.toBe("paid");
    expect(order.fulfilledPremiumDays).toBeUndefined();
  });
});
