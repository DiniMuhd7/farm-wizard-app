/**
 * Welcome reward: one grant per verified phone identity, atomic
 * reservation, and settlement driven only by Twilio-reported outcomes.
 */

jest.mock("../../models/User", () => ({ findById: jest.fn() }));
jest.mock("../../models/WelcomeReward", () => ({
  create: jest.fn(),
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
}));

describe("rewards controller", () => {
  let User, WelcomeReward, rewards;
  const leanUser = (u) => ({ select: () => ({ lean: async () => u }) });

  beforeEach(() => {
    jest.resetModules();
    process.env.JWT_SECRET = "test-secret";
    User = require("../../models/User");
    WelcomeReward = require("../../models/WelcomeReward");
    Object.values(User).forEach((f) => f.mockReset());
    Object.values(WelcomeReward).forEach((f) => f.mockReset());
    rewards = require("./index");
  });

  it("does not grant to guests or accounts without a verified phone", async () => {
    User.findById.mockReturnValueOnce(leanUser({ _id: "u1", isGuest: true, verifiedCallerId: "+15550001" }));
    expect(await rewards.ensureWelcomeReward("u1")).toBeNull();
    User.findById.mockReturnValueOnce(leanUser({ _id: "u1" }));
    expect(await rewards.ensureWelcomeReward("u1")).toBeNull();
    expect(WelcomeReward.create).not.toHaveBeenCalled();
  });

  it("grants 60 seconds keyed by a hash, never the raw phone number", async () => {
    User.findById.mockReturnValue(leanUser({ _id: "u1", verifiedCallerId: "+15550001" }));
    WelcomeReward.create.mockImplementation(async (doc) => doc);
    await rewards.ensureWelcomeReward("u1");
    const doc = WelcomeReward.create.mock.calls[0][0];
    expect(doc.grantedSeconds).toBe(60);
    expect(doc.identityHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(doc)).not.toContain("+15550001");
  });

  it("returns the existing ledger row on a duplicate-key race", async () => {
    User.findById.mockReturnValue(leanUser({ _id: "u1", verifiedCallerId: "+15550001" }));
    WelcomeReward.create.mockRejectedValue({ code: 11000 });
    WelcomeReward.findOne.mockResolvedValue({ state: "redeemed" });
    expect(await rewards.ensureWelcomeReward("u1")).toEqual({ state: "redeemed" });
  });

  it("reserves atomically and reports 0 when someone else holds or used it", async () => {
    WelcomeReward.findOneAndUpdate.mockResolvedValueOnce({ grantedSeconds: 60, usedSeconds: 0 });
    expect(await rewards.reserveForCall("u1", "CA1")).toBe(60);
    WelcomeReward.findOneAndUpdate.mockResolvedValueOnce(null);
    expect(await rewards.reserveForCall("u1", "CA2")).toBe(0);
    expect(await rewards.reserveForCall("u1", "")).toBe(0);
  });

  it("redeems on a connected call and releases on an unconnected one", async () => {
    WelcomeReward.findOneAndUpdate.mockResolvedValue({});
    expect(await rewards.settleForCall("u1", "CA1", { connected: true, durationSeconds: 45 })).toBe("redeemed");
    expect(WelcomeReward.findOneAndUpdate.mock.calls[0][0]).toMatchObject({ state: "reserved", reservedCallSid: "CA1" });
    expect(WelcomeReward.findOneAndUpdate.mock.calls[0][1].usedSeconds).toBe(45);
    expect(await rewards.settleForCall("u1", "CA1", { connected: false, durationSeconds: 0 })).toBe("released");
  });

  it("is a no-op for a call that held no reservation", async () => {
    WelcomeReward.findOneAndUpdate.mockResolvedValue(null);
    expect(await rewards.settleForCall("u1", "CA9", { connected: true, durationSeconds: 30 })).toBeNull();
  });
});
