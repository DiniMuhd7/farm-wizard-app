/**
 * Regression tests for the Prepaid / welcome-reward precedence at
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
jest.mock("../../models/Call", () => ({ create: jest.fn() }));
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

  it("lets a sufficient Prepaid balance skip the reward entirely", async () => {
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

  it("uses the shared caller ID when the account caller ID is unverified", async () => {
    User.findById
      .mockReturnValueOnce(leanUser({ verifiedCallerId: CALLER_ID, callerIdStatus: "unverified", callerIdVerificationMethod: "twilio", phoneNumber: null, isGuest: false }))
      .mockReturnValueOnce(leanUser({ creditsBalanceCents: 100 }));

    const res = mockRes();
    await outgoingCallTwiML(req(), res);

    expect(res.body).toContain('callerId="+15550000000"');
    expect(res.body).not.toContain(`callerId="${CALLER_ID}"`);
  });

  it("uses a caller ID only after persisted authoritative verification", async () => {
    User.findById
      .mockReturnValueOnce(leanUser({ verifiedCallerId: CALLER_ID, callerIdStatus: "verified", callerIdVerificationMethod: "twilio", phoneNumber: null, isGuest: false }))
      .mockReturnValueOnce(leanUser({ creditsBalanceCents: 100 }));

    const res = mockRes();
    await outgoingCallTwiML(req(), res);

    expect(res.body).toContain(`callerId="${CALLER_ID}"`);
    expect(res.body).not.toContain('callerId="+15550000000"');
  });

  it("never uses a developer-test number as an outbound caller ID", async () => {
    User.findById
      .mockReturnValueOnce(leanUser({ verifiedCallerId: CALLER_ID, callerIdStatus: "verified", callerIdVerificationMethod: "developer_test", phoneNumber: null, isGuest: false }))
      .mockReturnValueOnce(leanUser({ creditsBalanceCents: 100 }));

    const res = mockRes();
    await outgoingCallTwiML(req(), res);

    expect(res.body).toContain('callerId="+15550000000"');
    expect(res.body).not.toContain(`callerId="${CALLER_ID}"`);
  });

  it("does not use a user-controlled pending number as the From identity (spoofing prevention)", async () => {
    User.findById
      .mockReturnValueOnce(leanUser({ verifiedCallerId: CALLER_ID, callerIdStatus: "pending", callerIdVerificationMethod: null, phoneNumber: null, isGuest: false }))
      .mockReturnValueOnce(leanUser({ creditsBalanceCents: 100 }));

    const res = mockRes();
    await outgoingCallTwiML(req({ CallerId: CALLER_ID }), res);

    expect(res.body).toContain('callerId="+15550000000"');
    expect(res.body).not.toContain(CALLER_ID);
  });

  it("places the call for an account with no caller ID at all using the fallback identity", async () => {
    User.findById
      .mockReturnValueOnce(leanUser({ verifiedCallerId: null, callerIdStatus: "unverified", phoneNumber: null, isGuest: false }))
      .mockReturnValueOnce(leanUser({ creditsBalanceCents: 100 }));

    const res = mockRes();
    await outgoingCallTwiML(req(), res);

    expect(res.body).toContain('callerId="+15550000000"');
    expect(res.body).toContain(`<Number>${DESTINATION}</Number>`);
  });

  it("returns an actionable configuration error when an unverified caller has no safe fallback", async () => {
    delete process.env.TWILIO_CALLER_ID;
    User.findById.mockReturnValueOnce(leanUser({ verifiedCallerId: null, callerIdStatus: "unverified", phoneNumber: null, isGuest: false }));

    const res = mockRes();
    await outgoingCallTwiML(req(), res);

    expect(res.statusCode).toBe(503);
    expect(res.body).toContain("TWILIO_CALLER_ID");
    expect(res.body).not.toMatch(/verif(y|ication) (required|your)/i);
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

describe("voice controller — caller identity and reward settlement", () => {
  const USER_ID = "507f1f77bcf86cd799439011";
  let voice, credits, rewards;

  beforeEach(() => {
    jest.resetModules();
    process.env.TWILIO_CALLER_ID = "+15550000000";
    voice = require("./index");
    credits = require("../credits");
    rewards = require("../rewards");
    credits.debitForCompletedCall.mockReset();
    rewards.settleForCall.mockReset();
  });

  it("presents only provider-approved verified numbers; spoken-code numbers use the shared fallback", () => {
    const { resolveCallerIdentity } = voice._private;
    const base = { verifiedCallerId: "+15551230000", callerIdStatus: "verified" };
    expect(resolveCallerIdentity({ ...base, callerIdVerificationMethod: "twilio" }).callerId).toBe("+15551230000");
    expect(resolveCallerIdentity({ ...base, callerIdVerificationMethod: "spoken_code" })).toEqual({ callerId: "+15550000000", callerIdStatus: "unverified" });
    expect(resolveCallerIdentity({ ...base, callerIdVerificationMethod: "developer_test" }).callerId).toBe("+15550000000");
    expect(resolveCallerIdentity({ callerIdStatus: "unverified" })).toEqual({ callerId: "+15550000000", callerIdStatus: "unverified" });
  });

  function statusReq(overrides = {}) {
    return {
      query: {},
      body: { From: `client:user-${USER_ID}`, To: "+15559876543", CallSid: "CAparent", DialCallStatus: "completed", DialCallDuration: "60", ...overrides },
    };
  }
  const res = () => ({ type() { return this; }, send(b) { this.body = b; return this; }, status() { return this; } });

  it("does not debit credits for a call that redeemed the free minute", async () => {
    rewards.settleForCall.mockResolvedValue("redeemed");
    await voice.outgoingDialStatus(statusReq(), res());
    expect(rewards.settleForCall).toHaveBeenCalledWith(USER_ID, "CAparent", { connected: true, durationSeconds: 60 });
    expect(credits.debitForCompletedCall).not.toHaveBeenCalled();
  });

  it("does not bill a replayed completion event for a redeemed reward", async () => {
    rewards.settleForCall.mockResolvedValue("replayed");
    await voice.outgoingDialStatus(statusReq(), res());
    expect(credits.debitForCompletedCall).not.toHaveBeenCalled();
  });

  it("releases the reservation and does not bill when the call never connected", async () => {
    rewards.settleForCall.mockResolvedValue("released");
    await voice.outgoingDialStatus(statusReq({ DialCallStatus: "no-answer", DialCallDuration: "0" }), res());
    expect(rewards.settleForCall).toHaveBeenCalledWith(USER_ID, "CAparent", { connected: false, durationSeconds: 0 });
    expect(credits.debitForCompletedCall).not.toHaveBeenCalled();
  });

  it("bills purchased credit with the provider duration when no reward was held", async () => {
    rewards.settleForCall.mockResolvedValue(null);
    await voice.outgoingDialStatus(statusReq({ DialCallDuration: "125" }), res());
    expect(credits.debitForCompletedCall).toHaveBeenCalledWith(USER_ID, 125, "CAparent");
  });
});
