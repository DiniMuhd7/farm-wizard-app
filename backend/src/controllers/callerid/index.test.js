/**
 * Caller-ID verification: the account's verification state is persisted
 * backend-side (User.callerIdStatus — unverified -> pending -> verified,
 * or back to unverified on a failed/cancelled Twilio callback) rather than
 * only ever inferred client-side from whether verifiedCallerId happens to
 * be null. Also covers that the Twilio callback is only ever trusted when
 * its signature validates, and that a number already verified on another
 * account can't be claimed twice.
 */

const mockValidationRequestsCreate = jest.fn();
jest.mock("twilio", () => jest.fn(() => ({
  validationRequests: { create: mockValidationRequestsCreate },
})));
jest.mock("../../models/User", () => ({ findOne: jest.fn(), findById: jest.fn(), findByIdAndUpdate: jest.fn() }));
jest.mock("../../utils/twilioSignature", () => ({
  twilioRequestIsValid: jest.fn(() => true),
}));
jest.mock("../rewards", () => ({ ensureWelcomeReward: jest.fn() }));

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
    json(payload) {
      this.body = payload;
      return this;
    },
    send(payload) {
      this.body = payload;
      return this;
    },
  };
}

describe("callerid controller", () => {
  let User, twilioSignature, rewards, callerid;

  beforeEach(() => {
    jest.resetModules();
    process.env.TWILIO_ACCOUNT_SID = "AC_test";
    process.env.TWILIO_AUTH_TOKEN = "token_test";
    process.env.PUBLIC_BASE_URL = "https://api.9tel.app";
    User = require("../../models/User");
    twilioSignature = require("../../utils/twilioSignature");
    rewards = require("../rewards");
    User.findOne.mockReset();
    User.findById.mockReset();
    User.findByIdAndUpdate.mockReset();
    mockValidationRequestsCreate.mockReset();
    twilioSignature.twilioRequestIsValid.mockReset().mockReturnValue(true);
    rewards.ensureWelcomeReward.mockReset();
    callerid = require("./index");
  });

  describe("startVerification", () => {
    it("moves the account to pending once Twilio accepts the request", async () => {
      User.findOne.mockReturnValue({ select: () => ({ lean: async () => null }) });
      mockValidationRequestsCreate.mockResolvedValue({ validationCode: "123456" });
      User.findByIdAndUpdate.mockResolvedValue({});

      const res = mockRes();
      await callerid.startVerification({ user: { _id: "u1" }, body: { phoneNumber: "+15551234567" } }, res);

      expect(res.statusCode).toBe(200);
      expect(User.findByIdAndUpdate).toHaveBeenCalledWith("u1", { callerIdStatus: "pending" });
    });

    it("rejects a number already verified on another account", async () => {
      User.findOne.mockReturnValue({ select: () => ({ lean: async () => ({ _id: "otherUser" }) }) });

      const res = mockRes();
      await callerid.startVerification({ user: { _id: "u1" }, body: { phoneNumber: "+15551234567" } }, res);

      expect(res.statusCode).toBe(409);
      expect(mockValidationRequestsCreate).not.toHaveBeenCalled();
      expect(User.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it("rejects a non-E.164 number before ever contacting Twilio", async () => {
      const res = mockRes();
      await callerid.startVerification({ user: { _id: "u1" }, body: { phoneNumber: "555-1234" } }, res);

      expect(res.statusCode).toBe(400);
      expect(mockValidationRequestsCreate).not.toHaveBeenCalled();
    });
  });

  describe("getVerificationStatus", () => {
    it("reports the persisted status, not just whether verifiedCallerId is set", async () => {
      User.findById.mockReturnValue({ select: () => Promise.resolve({ verifiedCallerId: null, callerIdStatus: "pending" }) });
      const res = mockRes();
      await callerid.getVerificationStatus({ user: { _id: "u1" } }, res);
      expect(res.body).toEqual({ verifiedCallerId: null, callerIdStatus: "pending" });
    });

    it("falls back to unverified for a row with neither field set", async () => {
      User.findById.mockReturnValue({ select: () => Promise.resolve({ verifiedCallerId: null, callerIdStatus: undefined }) });
      const res = mockRes();
      await callerid.getVerificationStatus({ user: { _id: "u1" } }, res);
      expect(res.body).toEqual({ verifiedCallerId: null, callerIdStatus: "unverified" });
    });
  });

  describe("verificationCallback", () => {
    it("rejects a request whose Twilio signature doesn't validate", async () => {
      twilioSignature.twilioRequestIsValid.mockReturnValue(false);
      const res = mockRes();
      await callerid.verificationCallback({ query: { userId: "u1" }, body: { PhoneNumber: "+15551234567", VerificationStatus: "success" } }, res);
      expect(res.statusCode).toBe(403);
      expect(User.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it("marks the account verified and (re)evaluates the welcome reward on success", async () => {
      User.findByIdAndUpdate.mockResolvedValue({});
      const res = mockRes();
      await callerid.verificationCallback(
        { query: { userId: "u1" }, body: { PhoneNumber: "+15551234567", VerificationStatus: "success" } },
        res
      );
      expect(User.findByIdAndUpdate).toHaveBeenCalledWith("u1", { verifiedCallerId: "+15551234567", callerIdStatus: "verified" });
      expect(rewards.ensureWelcomeReward).toHaveBeenCalledWith("u1");
      expect(res.statusCode).toBe(200);
    });

    it("resets a failed/declined verification back to unverified, never verified", async () => {
      User.findByIdAndUpdate.mockResolvedValue({});
      const res = mockRes();
      await callerid.verificationCallback(
        { query: { userId: "u1" }, body: { PhoneNumber: "+15551234567", VerificationStatus: "failed" } },
        res
      );
      expect(User.findByIdAndUpdate).toHaveBeenCalledWith("u1", { callerIdStatus: "unverified" });
    });
  });
});
