const crypto = require("crypto");

const mockValidationRequestsCreate = jest.fn();
jest.mock("twilio", () => jest.fn(() => ({
  validationRequests: { create: mockValidationRequestsCreate },
})));
jest.mock("../../models/User", () => ({
  findOne: jest.fn(),
  findById: jest.fn(),
  findOneAndUpdate: jest.fn(),
}));
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
  const phoneNumber = "+15551234567";
  let User, twilioSignature, rewards, callerid;

  beforeEach(() => {
    jest.resetModules();
    process.env.NODE_ENV = "test";
    process.env.TWILIO_ACCOUNT_SID = "AC_test";
    process.env.TWILIO_AUTH_TOKEN = "token_test";
    process.env.PUBLIC_BASE_URL = "https://api.9tel.app";
    delete process.env.CALLER_ID_DEV_TEST_MODE;
    delete process.env.CALLER_ID_DEV_TEST_NUMBERS;
    User = require("../../models/User");
    twilioSignature = require("../../utils/twilioSignature");
    rewards = require("../rewards");
    User.findOne.mockReset().mockReturnValue({ select: () => ({ lean: async () => null }) });
    User.findById.mockReset();
    User.findOneAndUpdate.mockReset().mockResolvedValue({ _id: "u1" });
    mockValidationRequestsCreate.mockReset().mockResolvedValue({});
    twilioSignature.twilioRequestIsValid.mockReset().mockReturnValue(true);
    rewards.ensureWelcomeReward.mockReset();
    callerid = require("./index");
  });

  describe("startVerification", () => {
    it("requires an authenticated owner", async () => {
      const res = mockRes();
      await callerid.startVerification({ body: { phoneNumber } }, res);
      expect(res.statusCode).toBe(401);
      expect(User.findOne).not.toHaveBeenCalled();
      expect(mockValidationRequestsCreate).not.toHaveBeenCalled();
    });

    it("starts an authoritative voice call without returning its verification code", async () => {
      const res = mockRes();
      await callerid.startVerification({ user: { _id: "u1" }, body: { phoneNumber } }, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toMatchObject({ phoneNumber, callerIdStatus: "pending" });
      expect(res.body.validationCode).toBeUndefined();
      expect(mockValidationRequestsCreate).toHaveBeenCalledWith(expect.objectContaining({
        phoneNumber,
        statusCallback: expect.stringMatching(/\/callback\?token=[a-f0-9]{64}$/),
      }));
      expect(User.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: "u1", callerIdStatus: { $ne: "pending" } },
        expect.objectContaining({
          callerIdStatus: "pending",
          callerIdVerificationNumber: phoneNumber,
          callerIdVerificationTokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        }),
        { new: true }
      );
    });

    it("rejects a number already verified on another account", async () => {
      User.findOne.mockReturnValue({ select: () => ({ lean: async () => ({ _id: "otherUser" }) }) });
      const res = mockRes();
      await callerid.startVerification({ user: { _id: "u1" }, body: { phoneNumber } }, res);

      expect(res.statusCode).toBe(409);
      expect(mockValidationRequestsCreate).not.toHaveBeenCalled();
      expect(User.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it("rejects non-E.164 input before contacting Twilio", async () => {
      const res = mockRes();
      await callerid.startVerification({ user: { _id: "u1" }, body: { phoneNumber: "555-1234" } }, res);

      expect(res.statusCode).toBe(400);
      expect(mockValidationRequestsCreate).not.toHaveBeenCalled();
    });

    it("returns missing provider configuration without exposing secret values", async () => {
      process.env.NODE_ENV = "production";
      process.env.TWILIO_AUTH_TOKEN = "";
      const res = mockRes();
      await callerid.startVerification({ user: { _id: "u1" }, body: { phoneNumber } }, res);

      expect(res.statusCode).toBe(503);
      expect(res.body).toMatchObject({
        code: "caller_id_configuration_error",
        missing: ["TWILIO_AUTH_TOKEN"],
      });
      expect(JSON.stringify(res.body)).not.toContain("token_test");
      expect(User.findOneAndUpdate).not.toHaveBeenCalled();
      expect(mockValidationRequestsCreate).not.toHaveBeenCalled();
    });

    it("uses only the configured allowlist for explicit non-production developer tests", async () => {
      process.env.CALLER_ID_DEV_TEST_MODE = "true";
      process.env.CALLER_ID_DEV_TEST_NUMBERS = phoneNumber;
      process.env.TWILIO_ACCOUNT_SID = "";
      const res = mockRes();
      await callerid.startVerification({ user: { _id: "u1" }, body: { phoneNumber } }, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toMatchObject({ callerIdStatus: "verified", method: "developer_test" });
      expect(mockValidationRequestsCreate).not.toHaveBeenCalled();
      expect(User.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: "u1", callerIdStatus: { $ne: "pending" } },
        expect.objectContaining({
          verifiedCallerId: phoneNumber,
          callerIdStatus: "verified",
          callerIdVerificationMethod: "developer_test",
        }),
        { new: true }
      );
    });

    it("never enables the developer bypass in production", async () => {
      process.env.NODE_ENV = "production";
      process.env.CALLER_ID_DEV_TEST_MODE = "true";
      process.env.CALLER_ID_DEV_TEST_NUMBERS = phoneNumber;
      const res = mockRes();
      await callerid.startVerification({ user: { _id: "u1" }, body: { phoneNumber } }, res);

      expect(res.body.callerIdStatus).toBe("pending");
      expect(res.body.method).toBeUndefined();
      expect(mockValidationRequestsCreate).toHaveBeenCalled();
    });
  });

  describe("getVerificationStatus", () => {
    it("returns only the owner's persisted status and hides a pending code", async () => {
      User.findById.mockReturnValue({
        select: () => Promise.resolve({
          verifiedCallerId: null,
          callerIdStatus: "pending",
          callerIdVerificationNumber: phoneNumber,
          callerIdVerificationExpiresAt: new Date(Date.now() + 60_000),
        }),
      });
      const res = mockRes();
      await callerid.getVerificationStatus({ user: { _id: "u1" } }, res);

      expect(res.body).toEqual({ verifiedCallerId: null, callerIdStatus: "pending", phoneNumber });
    });

    it("expires a timed-out pending attempt on the server", async () => {
      User.findById.mockReturnValue({
        select: () => Promise.resolve({
          verifiedCallerId: null,
          callerIdStatus: "pending",
          callerIdVerificationExpiresAt: new Date(Date.now() - 1),
        }),
      });
      const res = mockRes();
      await callerid.getVerificationStatus({ user: { _id: "u1" } }, res);
      expect(res.body).toEqual({ verifiedCallerId: null, callerIdStatus: "expired" });
      expect(User.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ _id: "u1", callerIdStatus: "pending" }),
        expect.objectContaining({ callerIdStatus: "expired" })
      );
    });

    it("rejects status checks without an authenticated owner", async () => {
      const res = mockRes();
      await callerid.getVerificationStatus({}, res);
      expect(res.statusCode).toBe(401);
      expect(User.findById).not.toHaveBeenCalled();
    });
  });

  describe("cancelVerification", () => {
    it("invalidates only the authenticated owner's pending attempt", async () => {
      const res = mockRes();
      await callerid.cancelVerification({ user: { _id: "u1" } }, res);
      expect(res.body).toEqual({ callerIdStatus: "unverified" });
      expect(User.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: "u1", callerIdStatus: "pending" },
        expect.objectContaining({ callerIdStatus: "unverified", callerIdVerificationTokenHash: null }),
        { new: true }
      );
    });
  });

  describe("verificationCallback", () => {
    it("rejects a request whose Twilio signature does not validate", async () => {
      twilioSignature.twilioRequestIsValid.mockReturnValue(false);
      const res = mockRes();
      await callerid.verificationCallback({ query: { token: "a".repeat(64) }, body: {} }, res);
      expect(res.statusCode).toBe(403);
      expect(User.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it("marks only the matching unexpired attempt verified on Twilio success", async () => {
      const token = "a".repeat(64);
      const res = mockRes();
      await callerid.verificationCallback(
        { query: { token }, body: { PhoneNumber: phoneNumber, VerificationStatus: "success" } },
        res
      );

      expect(User.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          callerIdStatus: "pending",
          callerIdVerificationTokenHash: crypto.createHash("sha256").update(token).digest("hex"),
          callerIdVerificationNumber: phoneNumber,
          callerIdVerificationExpiresAt: { $gt: expect.any(Date) },
        }),
        expect.objectContaining({
          verifiedCallerId: phoneNumber,
          callerIdStatus: "verified",
          callerIdVerificationMethod: "twilio",
        }),
        { new: true }
      );
      expect(rewards.ensureWelcomeReward).toHaveBeenCalledWith("u1");
      expect(res.statusCode).toBe(200);
    });

    it("persists failed provider outcomes and prevents callback replay", async () => {
      const token = "b".repeat(64);
      const res = mockRes();
      await callerid.verificationCallback(
        { query: { token }, body: { PhoneNumber: phoneNumber, VerificationStatus: "failed" } },
        res
      );

      expect(User.findOneAndUpdate).toHaveBeenCalledWith(
        { callerIdStatus: "pending", callerIdVerificationTokenHash: crypto.createHash("sha256").update(token).digest("hex") },
        expect.objectContaining({ callerIdStatus: "failed", callerIdVerificationTokenHash: null })
      );
      expect(res.statusCode).toBe(200);
    });
  });
});
