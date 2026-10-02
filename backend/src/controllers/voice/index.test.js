/**
 * Regression tests for the Pay As You Go / welcome-reward precedence at
 * actual dial time (outgoingCallTwiML). These exist because the ordering
 * bug this guards against — a generic "not enough credit" denial reached
 * before an eligible unused welcome reward is ever considered — is only
 * observable at the point a carrier call is actually placed, not from the
 * rewards controller's own unit tests (see controllers/rewards/index.test.js)
 * or the read-only /rewards/welcome endpoint, neither of which exercises
 * this precedence.
 */

jest.mock("../../utils/twilioSignature", () => ({
  twilioRequestIsValid: jest.fn(() => true),
  escapedXml: (value) => String(value).replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c])),
}));
jest.mock("../../models/User", () => ({ findById: jest.fn(), findOne: jest.fn() }));
jest.mock("../credits", () => ({ RATE_PER_MINUTE_CENTS: 9, debitForCompletedCall: jest.fn() }));
jest.mock("../rewards", () => ({
  ensureWelcomeReward: jest.fn(),
  reserveForCall: jest.fn(),
  settleForCall: jest.fn(),
}));

function mockRes() {
  return {
    statusCode: undefined,
    body: undefined,
    contentType: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    type(value) {
      this.contentType = value;
      return this;
    },
    send(payload) {
      this.body = payload;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

function leanUser(value) {
  return { select: () => ({ lean: async () => value }) };
}

describe("voice controller — outgoingCallTwiML welcome-reward precedence", () => {
  const CALLER_ID = "+15551230000";
  const DESTINATION = "+15559876543";
  const USER_ID = "507f1f77bcf86cd799439011";

  let User, credits, rewards, outgoingCallTwiML;

  beforeEach(() => {
    jest.resetModules();
    process.env.PUBLIC_BASE_URL = "https://api.9tel.app";
    process.env.TWILIO_ALLOWED_DESTINATION_PREFIXES = "+1";
    process.env.TWILIO_CALLER_ID = "+15550000000";
    User = require("../../models/User");
    credits = require("../credits");
    rewards = require("../rewards");
    User.findById.mockReset();
    User.findOne.mockReset();
    credits.debitForCompletedCall.mockReset();
    rewards.ensureWelcomeReward.mockReset();
    rewards.reserveForCall.mockReset();
    rewards.settleForCall.mockReset();
    // No 9tel account owns the dialed destination in any of these cases —
    // every scenario below is a genuine carrier (PSTN) call.
    User.findOne.mockReturnValue(leanUser(null));
    ({ outgoingCallTwiML } = require("./index"));
  });

  function req(overrides = {}) {
    return {
      originalUrl: "/api/v1/voice/outgoing",
      body: {
        To: DESTINATION,
        From: `client:user-${USER_ID}`,
        CallSid: "CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        ...overrides,
      },
    };
  }

  it("reserves the welcome minute for an eligible first-time verified user with zero credit", async () => {
    User.findById
      .mockReturnValueOnce(leanUser({ verifiedCallerId: CALLER_ID, phoneNumber: null, isGuest: false })) // caller lookup
      .mockReturnValueOnce(leanUser({ creditsBalanceCents: 0 })); // credits balance lookup
    rewards.ensureWelcomeReward.mockResolvedValue({ _id: "reward1" });
    rewards.reserveForCall.mockResolvedValue(60);

    const res = mockRes();
    await outgoingCallTwiML(req(), res);

    expect(rewards.ensureWelcomeReward).toHaveBeenCalledWith(USER_ID);
    expect(rewards.reserveForCall).toHaveBeenCalledWith(USER_ID, "CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");
    expect(res.body).toContain('timeLimit="60"');
    expect(res.body).toContain(`<Number>${DESTINATION}</Number>`);
    expect(res.body).not.toContain("do not have enough credit");
  });

  it("denies the call for an ineligible account (unverified phone) with zero credit", async () => {
    User.findById
      .mockReturnValueOnce(leanUser({ verifiedCallerId: null, phoneNumber: null, isGuest: false }))
      .mockReturnValueOnce(leanUser({ creditsBalanceCents: 0 }));
    // The real ensureWelcomeReward (see controllers/rewards) returns null for
    // an account without a verified phone, which is what's being simulated
    // here — reserveForCall then finds no ledger row to reserve from.
    rewards.ensureWelcomeReward.mockResolvedValue(null);
    rewards.reserveForCall.mockResolvedValue(0);

    const res = mockRes();
    await outgoingCallTwiML(req(), res);

    expect(res.body).toContain("do not have enough credit");
  });

  it("denies the call when the welcome reward has already been consumed", async () => {
    User.findById
      .mockReturnValueOnce(leanUser({ verifiedCallerId: CALLER_ID, phoneNumber: null, isGuest: false }))
      .mockReturnValueOnce(leanUser({ creditsBalanceCents: 0 }));
    rewards.ensureWelcomeReward.mockResolvedValue({ _id: "reward1" });
    rewards.reserveForCall.mockResolvedValue(0); // already redeemed/reserved elsewhere

    const res = mockRes();
    await outgoingCallTwiML(req(), res);

    expect(res.body).toContain("do not have enough credit");
  });

  it("lets a sufficient Pay As You Go balance skip the reward entirely", async () => {
    User.findById
      .mockReturnValueOnce(leanUser({ verifiedCallerId: CALLER_ID, phoneNumber: null, isGuest: false }))
      .mockReturnValueOnce(leanUser({ creditsBalanceCents: 100 }));

    const res = mockRes();
    await outgoingCallTwiML(req(), res);

    expect(rewards.ensureWelcomeReward).not.toHaveBeenCalled();
    expect(rewards.reserveForCall).not.toHaveBeenCalled();
    expect(res.body).not.toContain('timeLimit="60"');
    expect(res.body).toContain(`<Number>${DESTINATION}</Number>`);
  });

  it("only lets one of two concurrent attempts win the same reward", async () => {
    User.findById.mockImplementation(() => leanUser({ verifiedCallerId: CALLER_ID, phoneNumber: null, isGuest: false, creditsBalanceCents: 0 }));
    rewards.ensureWelcomeReward.mockResolvedValue({ _id: "reward1" });
    // Simulates the real atomic compare-and-set in reserveForCall: the
    // first caller to reach it wins, the second gets 0.
    rewards.reserveForCall.mockResolvedValueOnce(60).mockResolvedValueOnce(0);

    const resA = mockRes();
    const resB = mockRes();
    await Promise.all([
      outgoingCallTwiML(req({ CallSid: "CA_first" }), resA),
      outgoingCallTwiML(req({ CallSid: "CA_second" }), resB),
    ]);

    const winners = [resA, resB].filter((res) => res.body.includes('timeLimit="60"'));
    const losers = [resA, resB].filter((res) => res.body.includes("do not have enough credit"));
    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(1);
  });

  it("fails closed to the insufficient-credit message if the reward lookup errors", async () => {
    User.findById
      .mockReturnValueOnce(leanUser({ verifiedCallerId: CALLER_ID, phoneNumber: null, isGuest: false }))
      .mockReturnValueOnce(leanUser({ creditsBalanceCents: 0 }));
    rewards.ensureWelcomeReward.mockRejectedValue(new Error("database unavailable"));

    const res = mockRes();
    await outgoingCallTwiML(req(), res);

    expect(res.body).toContain("do not have enough credit");
  });

  it("never grants the reward for a call to the caller's own verified/provisioned number", async () => {
    User.findById
      .mockReturnValueOnce(leanUser({ verifiedCallerId: DESTINATION, phoneNumber: null, isGuest: false }))
      .mockReturnValueOnce(leanUser({ creditsBalanceCents: 0 }));

    const res = mockRes();
    await outgoingCallTwiML(req(), res);

    expect(rewards.ensureWelcomeReward).not.toHaveBeenCalled();
    expect(res.body).toContain("do not have enough credit");
  });

  it("never grants the reward to a guest account", async () => {
    User.findById
      .mockReturnValueOnce(leanUser({ verifiedCallerId: CALLER_ID, phoneNumber: null, isGuest: true }))
      .mockReturnValueOnce(leanUser({ creditsBalanceCents: 0 }));

    const res = mockRes();
    await outgoingCallTwiML(req(), res);

    expect(rewards.ensureWelcomeReward).not.toHaveBeenCalled();
    expect(res.body).toContain("do not have enough credit");
  });
});
