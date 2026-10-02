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

  describe("getRewardDiagnostics", () => {
    const mockRes = () => ({
      statusCode: undefined,
      body: undefined,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.body = payload;
        return this;
      },
    });

    it("refuses non-admins", async () => {
      const res = mockRes();
      await rewards.getRewardDiagnostics({ user: { userType: "user" }, query: {} }, res);
      expect(res.statusCode).toBe(403);
    });

    it("reports configuration status alone when no userId is given", async () => {
      process.env.JWT_SECRET = "test-secret";
      const res = mockRes();
      await rewards.getRewardDiagnostics({ user: { userType: "admin" }, query: {} }, res);
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ configured: { jwtSecret: true } });
    });

    it("distinguishes ineligible, ungranted, reserved, and consumed per-user states", async () => {
      const res1 = mockRes();
      User.findById.mockReturnValueOnce(leanUser({ isGuest: true, status: "active", verifiedCallerId: "+1" }));
      await rewards.getRewardDiagnostics({ user: { userType: "admin" }, query: { userId: "u1" } }, res1);
      expect(res1.body.user).toMatchObject({ eligible: false, rewardState: "ineligible" });

      const res2 = mockRes();
      User.findById.mockReturnValueOnce(leanUser({ isGuest: false, status: "active", verifiedCallerId: "+1" }));
      WelcomeReward.findOne.mockResolvedValueOnce(null);
      await rewards.getRewardDiagnostics({ user: { userType: "admin" }, query: { userId: "u2" } }, res2);
      expect(res2.body.user).toMatchObject({ eligible: true, rewardState: "ungranted" });

      const res3 = mockRes();
      User.findById.mockReturnValueOnce(leanUser({ isGuest: false, status: "active", verifiedCallerId: "+1" }));
      WelcomeReward.findOne.mockResolvedValueOnce({ state: "reserved" });
      await rewards.getRewardDiagnostics({ user: { userType: "admin" }, query: { userId: "u3" } }, res3);
      expect(res3.body.user).toMatchObject({ eligible: true, rewardState: "reserved" });

      const res4 = mockRes();
      User.findById.mockReturnValueOnce(leanUser({ isGuest: false, status: "active", verifiedCallerId: "+1" }));
      WelcomeReward.findOne.mockResolvedValueOnce({ state: "redeemed" });
      await rewards.getRewardDiagnostics({ user: { userType: "admin" }, query: { userId: "u4" } }, res4);
      expect(res4.body.user).toMatchObject({ eligible: true, rewardState: "redeemed" });
    });

    it("reports a configuration failure distinctly from a genuinely ineligible account", async () => {
      const res = mockRes();
      User.findById.mockReturnValueOnce(leanUser({ isGuest: false, status: "active", verifiedCallerId: "+1" }));
      WelcomeReward.findOne.mockRejectedValueOnce(new Error("Mongo connection lost"));
      await rewards.getRewardDiagnostics({ user: { userType: "admin" }, query: { userId: "u5" } }, res);
      expect(res.body.user).toMatchObject({ eligible: true, rewardState: "configuration_failed" });
    });

    it("reports a non-existent user without leaking anything else", async () => {
      const res = mockRes();
      User.findById.mockReturnValueOnce(leanUser(null));
      await rewards.getRewardDiagnostics({ user: { userType: "admin" }, query: { userId: "ghost" } }, res);
      expect(res.body.user).toEqual({ exists: false });
    });
  });
});
