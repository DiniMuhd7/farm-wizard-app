/**
 * Pay As You Go credits: balance reads must reflect exactly what the
 * backend has stored (never a client-side guess), and completed-call
 * billing must be derived from Twilio's own authoritative duration, never
 * invented client-side.
 */

jest.mock("../../models/User", () => ({ findById: jest.fn(), findByIdAndUpdate: jest.fn() }));

function mockRes() {
  return {
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
  };
}

const ORIGINAL_ENV = process.env;

describe("credits controller", () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV, CREDITS_RATE_PER_MINUTE_CENTS: "10" };
    const User = require("../../models/User");
    User.findById.mockReset();
    User.findByIdAndUpdate.mockReset();
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("getBalance returns the user's stored balance and the configured rate", async () => {
    const User = require("../../models/User");
    User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ creditsBalanceCents: 345 }) });
    const { getBalance } = require("./index");

    const res = mockRes();
    await getBalance({ user: { _id: "u1" } }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ balanceCents: 345, currency: "usd", ratePerMinuteCents: 10 });
  });

  it("getBalance defaults to zero for a user with no balance recorded yet", async () => {
    const User = require("../../models/User");
    User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });
    const { getBalance } = require("./index");

    const res = mockRes();
    await getBalance({ user: { _id: "u1" } }, res);

    expect(res.body.balanceCents).toBe(0);
  });

  it("debitForCompletedCall rounds up to the next whole minute at the configured rate", async () => {
    const User = require("../../models/User");
    User.findByIdAndUpdate.mockResolvedValue({});
    const { debitForCompletedCall } = require("./index");

    // 61 seconds -> 2 billed minutes -> 20 cents at 10c/min
    await debitForCompletedCall("u1", 61);

    expect(User.findByIdAndUpdate).toHaveBeenCalledWith("u1", { $inc: { creditsBalanceCents: -20 } });
  });

  it("debitForCompletedCall does nothing for a zero-duration (never-connected) leg", async () => {
    const User = require("../../models/User");
    const { debitForCompletedCall } = require("./index");

    await debitForCompletedCall("u1", 0);

    expect(User.findByIdAndUpdate).not.toHaveBeenCalled();
  });
});
