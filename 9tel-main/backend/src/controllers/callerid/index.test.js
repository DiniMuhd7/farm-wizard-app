const mockCallsCreate = jest.fn();
jest.mock("twilio", () => jest.fn(() => ({ calls: { create: mockCallsCreate } })));
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
    headers: {},
    set(name, value) {
      this.headers[name] = value;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    type() {
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

const selectable = (value) => ({ select: () => value });
const lean = (value) => selectable({ lean: async () => value });

describe("callerid controller (spoken code + app entry)", () => {
  const phoneNumber = "+15551234567";
  const userId = "507f1f77bcf86cd799439011";
  const owner = { _id: userId };
  let User, rewards, callerid, twilioSignature;

  // Starts a verification and returns the code Twilio was told to speak
  // (parsed from the TwiML — the only place the code ever appears) along
  // with the session fields the controller persisted.
  async function startAndCaptureCode() {
    User.findOneAndUpdate.mockResolvedValueOnce(null).mockResolvedValue({ _id: userId });
    mockCallsCreate.mockResolvedValueOnce({ sid: "CA123" });
    const res = mockRes();
    await callerid.startVerification({ user: owner, body: { phoneNumber } }, res);
    expect(res.statusCode).toBe(200);
    const update = User.findOneAndUpdate.mock.calls[1][1].$set;
    const twiml = mockCallsCreate.mock.calls[0][0].twiml;
    const code = twiml.match(/code is ((?:\d, ){5}\d)\./)[1].replace(/, /g, "");
    return { code, update, res };
  }

  function pendingUser(update, over = {}) {
    return {
      callerIdStatus: "pending",
      callerIdVerificationNumber: update.callerIdVerificationNumber,
      callerIdVerificationCodeHash: update.callerIdVerificationCodeHash,
      callerIdVerificationSessionId: update.callerIdVerificationSessionId,
      callerIdVerificationExpiresAt: update.callerIdVerificationExpiresAt,
      ...over,
    };
  }

  beforeEach(() => {
    jest.resetModules();
    process.env.NODE_ENV = "test";
    process.env.TWILIO_ACCOUNT_SID = "AC_test";
    process.env.TWILIO_AUTH_TOKEN = "token_test";
    process.env.PUBLIC_BASE_URL = "https://api.9tel.app";
    process.env.TWILIO_CALLER_ID = "+15550000000";
    process.env.JWT_SECRET = "jwt_test_secret";
    delete process.env.CALLER_ID_DEV_TEST_MODE;
    delete process.env.CALLER_ID_DEV_TEST_NUMBERS;
    User = require("../../models/User");
    twilioSignature = require("../../utils/twilioSignature");
    rewards = require("../rewards");
    User.findOne.mockReset().mockReturnValue(lean(null));
    User.findById.mockReset();
    User.findOneAndUpdate.mockReset();
    mockCallsCreate.mockReset();
    twilioSignature.twilioRequestIsValid.mockReset().mockReturnValue(true);
    rewards.ensureWelcomeReward.mockReset();
    jest.spyOn(console, "info").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
    callerid = require("./index");
  });

  afterEach(() => jest.restoreAllMocks());

  describe("startVerification", () => {
    it("requires an authenticated owner", async () => {
      const res = mockRes();
      await callerid.startVerification({ body: { phoneNumber } }, res);
      expect(res.statusCode).toBe(401);
      expect(mockCallsCreate).not.toHaveBeenCalled();
    });

    it("rejects non-E.164 input before contacting the provider", async () => {
      const res = mockRes();
      await callerid.startVerification({ user: owner, body: { phoneNumber: "0801 234 5678" } }, res);
      expect(res.statusCode).toBe(400);
      expect(res.body.code).toBe("invalid_phone_number");
      expect(mockCallsCreate).not.toHaveBeenCalled();
    });

    it("rejects a number already verified on another account", async () => {
      User.findOne.mockReturnValue(lean({ _id: "other" }));
      const res = mockRes();
      await callerid.startVerification({ user: owner, body: { phoneNumber } }, res);
      expect(res.statusCode).toBe(409);
      expect(res.body.code).toBe("caller_id_in_use");
      expect(mockCallsCreate).not.toHaveBeenCalled();
    });

    it("places a provider call that speaks the code, and never returns or stores the plaintext code", async () => {
      User.findOneAndUpdate.mockResolvedValueOnce(null).mockResolvedValueOnce({ _id: userId });
      // first call is expirePendingVerification, second is the pending session
      mockCallsCreate.mockResolvedValue({ sid: "CA123" });
      const res = mockRes();
      await callerid.startVerification({ user: owner, body: { phoneNumber } }, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toMatchObject({ phoneNumber, callerIdStatus: "pending" });
      expect(res.body.correlationId).toMatch(/^[a-f0-9]{24}$/);
      expect(res.headers["Cache-Control"]).toBe("no-store");
      expect(res.body).not.toHaveProperty("validationCode");
      expect(res.body).not.toHaveProperty("code");

      const callArgs = mockCallsCreate.mock.calls[0][0];
      expect(callArgs).toMatchObject({ to: phoneNumber, from: "+15550000000" });
      expect(callArgs.statusCallback).toContain("https://api.9tel.app/api/v1/callerid/call-status?session=");
      expect(callArgs.twiml).toMatch(/Your 9tel verification code is (\d, ){5}\d\./);
      expect((callArgs.twiml.match(/verification code is/g) || []).length).toBe(2);

      const code = callArgs.twiml.match(/code is ((?:\d, ){5}\d)\./)[1].replace(/, /g, "");
      const persisted = JSON.stringify(User.findOneAndUpdate.mock.calls);
      expect(persisted).not.toContain(code);
      expect(JSON.stringify(res.body)).not.toContain(code);
      for (const spy of [console.info, console.warn, console.error]) {
        expect(JSON.stringify(spy.mock.calls)).not.toContain(code);
      }
    });

    it("persists a pending, short-lived session with a hashed code", async () => {
      User.findOneAndUpdate.mockResolvedValueOnce(null).mockResolvedValueOnce({ _id: userId });
      mockCallsCreate.mockResolvedValue({ sid: "CA123" });
      const before = Date.now();
      await callerid.startVerification({ user: owner, body: { phoneNumber } }, mockRes());
      const update = User.findOneAndUpdate.mock.calls[1][1].$set;
      expect(update).toMatchObject({ callerIdStatus: "pending", callerIdVerificationNumber: phoneNumber, callerIdVerificationAttempts: 0 });
      expect(update.callerIdVerificationCodeHash).toMatch(/^[a-f0-9]{64}$/);
      const ttl = update.callerIdVerificationExpiresAt.getTime() - before;
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(callerid._private.VERIFICATION_TTL_MS + 1000);
    });

    it("enforces the resend cooldown server-side", async () => {
      User.findOneAndUpdate.mockResolvedValue(null);
      User.findById.mockReturnValue(lean({ callerIdStatus: "failed", callerIdLastRequestedAt: new Date() }));
      const res = mockRes();
      await callerid.startVerification({ user: owner, body: { phoneNumber } }, res);
      expect(res.statusCode).toBe(429);
      expect(res.body.code).toBe("resend_cooldown");
      expect(mockCallsCreate).not.toHaveBeenCalled();
    });

    it("refuses to start while another attempt is still pending", async () => {
      User.findOneAndUpdate.mockResolvedValue(null);
      User.findById.mockReturnValue(lean({ callerIdStatus: "pending" }));
      const res = mockRes();
      await callerid.startVerification({ user: owner, body: { phoneNumber } }, res);
      expect(res.statusCode).toBe(409);
      expect(res.body.code).toBe("verification_pending");
    });

    it("reports missing provider configuration without exposing secret values", async () => {
      process.env.TWILIO_AUTH_TOKEN = "";
      delete process.env.TWILIO_CALLER_ID;
      const res = mockRes();
      await callerid.startVerification({ user: owner, body: { phoneNumber } }, res);
      expect(res.statusCode).toBe(503);
      expect(res.body).toMatchObject({ code: "caller_id_configuration_error", missing: ["TWILIO_AUTH_TOKEN", "TWILIO_CALLER_ID"] });
      expect(JSON.stringify(res.body)).not.toContain("token_test");
      expect(mockCallsCreate).not.toHaveBeenCalled();
    });

    it("persists failure and returns a safe error when the provider cannot place the call", async () => {
      User.findOneAndUpdate.mockResolvedValue({ _id: userId });
      mockCallsCreate.mockRejectedValue(Object.assign(new Error("Twilio says secret-detail"), { code: 21211, status: 400 }));
      const res = mockRes();
      await callerid.startVerification({ user: owner, body: { phoneNumber } }, res);
      expect(res.statusCode).toBe(400);
      expect(res.body.code).toBe("invalid_phone_number");
      expect(JSON.stringify(res.body)).not.toContain("secret-detail");
      const failure = User.findOneAndUpdate.mock.calls.at(-1);
      expect(failure[0]).toMatchObject({ callerIdStatus: "pending" });
      expect(failure[1]).toMatchObject({ callerIdStatus: "failed", callerIdVerificationCodeHash: null });
    });

    it("maps an unknown provider outage to provider_unavailable (never a fabricated success)", async () => {
      User.findOneAndUpdate.mockResolvedValue({ _id: userId });
      mockCallsCreate.mockRejectedValue(new Error("boom"));
      const res = mockRes();
      await callerid.startVerification({ user: owner, body: { phoneNumber } }, res);
      expect(res.statusCode).toBe(503);
      expect(res.body.code).toBe("provider_unavailable");
      expect(res.body.callerIdStatus).toBeUndefined();
    });

    it("uses only the configured allowlist for explicit non-production developer tests", async () => {
      process.env.CALLER_ID_DEV_TEST_MODE = "true";
      process.env.CALLER_ID_DEV_TEST_NUMBERS = phoneNumber;
      process.env.TWILIO_ACCOUNT_SID = "";
      User.findOneAndUpdate.mockResolvedValue({ _id: userId });
      const res = mockRes();
      await callerid.startVerification({ user: owner, body: { phoneNumber } }, res);
      expect(res.body).toMatchObject({ callerIdStatus: "verified", method: "developer_test" });
      expect(mockCallsCreate).not.toHaveBeenCalled();
    });

    it("never enables the developer bypass in production", async () => {
      process.env.NODE_ENV = "production";
      process.env.CALLER_ID_DEV_TEST_MODE = "true";
      process.env.CALLER_ID_DEV_TEST_NUMBERS = phoneNumber;
      process.env.TWILIO_ACCOUNT_SID = "";
      const res = mockRes();
      await callerid.startVerification({ user: owner, body: { phoneNumber } }, res);
      expect(res.statusCode).toBe(503);
      expect(res.body.code).toBe("caller_id_configuration_error");
    });
  });

  describe("submitVerificationCode", () => {
    it("requires an authenticated owner", async () => {
      const res = mockRes();
      await callerid.submitVerificationCode({ body: { code: "123456" } }, res);
      expect(res.statusCode).toBe(401);
      expect(User.findById).not.toHaveBeenCalled();
    });

    it("rejects malformed codes without consuming an attempt", async () => {
      for (const code of ["", "12345", "1234567", "abcdef", undefined]) {
        const res = mockRes();
        await callerid.submitVerificationCode({ user: owner, body: { code } }, res);
        expect(res.statusCode).toBe(400);
        expect(res.body.code).toBe("invalid_code_format");
      }
      expect(User.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it("marks the caller ID verified exactly once with the correct spoken code", async () => {
      const { code, update } = await startAndCaptureCode();
      User.findOneAndUpdate.mockReset();
      User.findById.mockReturnValue(lean(pendingUser(update)));
      User.findOneAndUpdate
        .mockResolvedValueOnce({ callerIdVerificationAttempts: 1 })
        .mockResolvedValueOnce({ _id: userId, verifiedCallerId: phoneNumber });

      const res = mockRes();
      await callerid.submitVerificationCode({ user: owner, body: { code } }, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toMatchObject({ callerIdStatus: "verified", verifiedCallerId: phoneNumber, method: "spoken_code" });
      const [filter, change] = User.findOneAndUpdate.mock.calls[1];
      expect(filter).toMatchObject({
        _id: userId,
        callerIdStatus: "pending",
        callerIdVerificationSessionId: update.callerIdVerificationSessionId,
        callerIdVerificationNumber: phoneNumber,
      });
      expect(filter.callerIdVerificationExpiresAt.$gt).toBeInstanceOf(Date);
      expect(change).toMatchObject({ callerIdStatus: "verified", callerIdVerificationMethod: "spoken_code", callerIdVerificationCodeHash: null });
      expect(rewards.ensureWelcomeReward).toHaveBeenCalledTimes(1);
    });

    it("rejects a wrong code, counts the attempt and reports attempts remaining", async () => {
      const { code, update } = await startAndCaptureCode();
      const wrong = code === "000000" ? "000001" : "000000";
      User.findOneAndUpdate.mockReset().mockResolvedValueOnce({ callerIdVerificationAttempts: 1 });
      User.findById.mockReturnValue(lean(pendingUser(update)));

      const res = mockRes();
      await callerid.submitVerificationCode({ user: owner, body: { code: wrong } }, res);

      expect(res.statusCode).toBe(400);
      expect(res.body).toMatchObject({ code: "incorrect_code", attemptsRemaining: callerid._private.MAX_ATTEMPTS - 1 });
      expect(User.findOneAndUpdate).toHaveBeenCalledTimes(1);
      expect(User.findOneAndUpdate.mock.calls[0][1]).toEqual({ $inc: { callerIdVerificationAttempts: 1 } });
      expect(rewards.ensureWelcomeReward).not.toHaveBeenCalled();
      expect(JSON.stringify(console.info.mock.calls)).not.toContain(wrong);
    });

    it("fails the session once the final allowed attempt is wrong", async () => {
      const { code, update } = await startAndCaptureCode();
      const wrong = code === "000000" ? "000001" : "000000";
      User.findOneAndUpdate.mockReset()
        .mockResolvedValueOnce({ callerIdVerificationAttempts: callerid._private.MAX_ATTEMPTS })
        .mockResolvedValueOnce({ _id: userId });
      User.findById.mockReturnValue(lean(pendingUser(update)));
      const res = mockRes();
      await callerid.submitVerificationCode({ user: owner, body: { code: wrong } }, res);
      expect(res.statusCode).toBe(429);
      expect(res.body).toMatchObject({ code: "too_many_attempts", callerIdStatus: "failed" });
      expect(User.findOneAndUpdate.mock.calls[1][1]).toMatchObject({ callerIdStatus: "failed", callerIdVerificationCodeHash: null });
    });

    it("refuses further guesses after the attempt limit even for the right code", async () => {
      const { code, update } = await startAndCaptureCode();
      User.findOneAndUpdate.mockReset().mockResolvedValueOnce(null).mockResolvedValueOnce({ _id: userId });
      User.findById.mockReturnValue(lean(pendingUser(update, { callerIdVerificationAttempts: 5 })));
      const res = mockRes();
      await callerid.submitVerificationCode({ user: owner, body: { code } }, res);
      expect(res.statusCode).toBe(429);
      expect(res.body.code).toBe("too_many_attempts");
      expect(rewards.ensureWelcomeReward).not.toHaveBeenCalled();
    });

    it("reports no active verification when the session is consumed between the check and the count", async () => {
      const { code, update } = await startAndCaptureCode();
      User.findOneAndUpdate.mockReset().mockResolvedValueOnce(null);
      User.findById
        .mockReturnValueOnce(lean(pendingUser(update)))
        .mockReturnValueOnce(lean({ callerIdStatus: "verified", callerIdVerificationSessionId: null }));
      const res = mockRes();
      await callerid.submitVerificationCode({ user: owner, body: { code } }, res);
      expect(res.statusCode).toBe(409);
      expect(res.body.code).toBe("no_active_verification");
      expect(User.findOneAndUpdate).toHaveBeenCalledTimes(1);
    });

    it("reports expiry when the session expires between the check and the count", async () => {
      const { code, update } = await startAndCaptureCode();
      User.findOneAndUpdate.mockReset().mockResolvedValue({ _id: userId });
      User.findOneAndUpdate.mockResolvedValueOnce(null);
      User.findById
        .mockReturnValueOnce(lean(pendingUser(update)))
        .mockReturnValueOnce(lean(pendingUser(update, { callerIdVerificationExpiresAt: new Date(Date.now() - 1) })));
      const res = mockRes();
      await callerid.submitVerificationCode({ user: owner, body: { code } }, res);
      expect(res.statusCode).toBe(410);
      expect(res.body.callerIdStatus).toBe("expired");
    });

    it("rejects an expired session and persists the expiry", async () => {
      const { code, update } = await startAndCaptureCode();
      User.findOneAndUpdate.mockReset().mockResolvedValue({ _id: userId });
      User.findById.mockReturnValue(lean(pendingUser(update, { callerIdVerificationExpiresAt: new Date(Date.now() - 1000) })));
      const res = mockRes();
      await callerid.submitVerificationCode({ user: owner, body: { code } }, res);
      expect(res.statusCode).toBe(410);
      expect(res.body).toMatchObject({ code: "verification_expired", callerIdStatus: "expired" });
      expect(User.findOneAndUpdate.mock.calls[0][1]).toMatchObject({ callerIdStatus: "expired" });
      expect(rewards.ensureWelcomeReward).not.toHaveBeenCalled();
    });

    it("rejects a reused code after the session was consumed", async () => {
      User.findById.mockReturnValue(lean({ callerIdStatus: "verified", callerIdVerificationSessionId: null }));
      const res = mockRes();
      await callerid.submitVerificationCode({ user: owner, body: { code: "123456" } }, res);
      expect(res.statusCode).toBe(409);
      expect(res.body.code).toBe("no_active_verification");
      expect(User.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it("lets only one of two simultaneous correct submissions verify", async () => {
      const { code, update } = await startAndCaptureCode();
      User.findOneAndUpdate.mockReset();
      User.findById.mockReturnValue(lean(pendingUser(update)));
      let consumed = false;
      User.findOneAndUpdate.mockImplementation(async (filter, change) => {
        if (change.$inc) return { callerIdVerificationAttempts: 1 };
        if (consumed) return null; // compare-and-set on status/session fails for the loser
        consumed = true;
        return { _id: userId, verifiedCallerId: phoneNumber };
      });
      const [a, b] = [mockRes(), mockRes()];
      await Promise.all([
        callerid.submitVerificationCode({ user: owner, body: { code } }, a),
        callerid.submitVerificationCode({ user: owner, body: { code } }, b),
      ]);
      expect([a.statusCode, b.statusCode].sort()).toEqual([200, 409]);
      expect(rewards.ensureWelcomeReward).toHaveBeenCalledTimes(1);
    });

    it("never lets one account's session be completed by another's code hash", async () => {
      const { code, update } = await startAndCaptureCode();
      const otherHash = callerid._private.hashCode("someone-else", update.callerIdVerificationSessionId, phoneNumber, code);
      expect(otherHash).not.toBe(update.callerIdVerificationCodeHash);
    });

    it("reports an in-use number if another account verified it meanwhile", async () => {
      const { code, update } = await startAndCaptureCode();
      User.findOneAndUpdate.mockReset();
      User.findById.mockReturnValue(lean(pendingUser(update)));
      User.findOneAndUpdate
        .mockResolvedValueOnce({ callerIdVerificationAttempts: 1 })
        .mockRejectedValueOnce(Object.assign(new Error("dup"), { code: 11000 }))
        .mockResolvedValueOnce({ _id: userId });
      const res = mockRes();
      await callerid.submitVerificationCode({ user: owner, body: { code } }, res);
      expect(res.statusCode).toBe(409);
      expect(res.body.code).toBe("caller_id_in_use");
    });
  });

  describe("getVerificationStatus", () => {
    const statusUser = (over) => ({ callerIdStatus: "unverified", ...over });

    it("returns the owner's pending session without any code material", async () => {
      const expiresAt = new Date(Date.now() + 60_000);
      User.findById.mockReturnValue(selectable(statusUser({
        callerIdStatus: "pending",
        callerIdVerificationNumber: phoneNumber,
        callerIdVerificationSessionId: "a".repeat(24),
        callerIdVerificationAttempts: 2,
        callerIdVerificationExpiresAt: expiresAt,
        callerIdVerificationCodeHash: "hash",
      })));
      const res = mockRes();
      await callerid.getVerificationStatus({ user: owner }, res);
      expect(res.body).toMatchObject({ callerIdStatus: "pending", phoneNumber, attemptsRemaining: 3, correlationId: "a".repeat(24) });
      expect(JSON.stringify(res.body)).not.toContain("hash");
    });

    it("expires a timed-out pending attempt on the server", async () => {
      User.findById.mockReturnValue(selectable(statusUser({ callerIdStatus: "pending", callerIdVerificationExpiresAt: new Date(Date.now() - 1) })));
      User.findOneAndUpdate.mockResolvedValue({ callerIdLastAttemptedNumber: phoneNumber });
      const res = mockRes();
      await callerid.getVerificationStatus({ user: owner }, res);
      expect(res.body).toMatchObject({ callerIdStatus: "expired", verifiedCallerId: null, phoneNumber });
    });

    it("reflects verified state so the app can refresh", async () => {
      User.findById.mockReturnValue(selectable(statusUser({ callerIdStatus: "verified", verifiedCallerId: phoneNumber, callerIdVerificationMethod: "spoken_code" })));
      const res = mockRes();
      await callerid.getVerificationStatus({ user: owner }, res);
      expect(res.body).toMatchObject({ callerIdStatus: "verified", verifiedCallerId: phoneNumber, method: "spoken_code" });
    });

    it("rejects status checks without an authenticated owner", async () => {
      const res = mockRes();
      await callerid.getVerificationStatus({}, res);
      expect(res.statusCode).toBe(401);
    });

    it("does not recognize synthetic developer verification in production", async () => {
      process.env.NODE_ENV = "production";
      User.findById.mockReturnValue(selectable(statusUser({ callerIdStatus: "verified", verifiedCallerId: phoneNumber, callerIdVerificationMethod: "developer_test" })));
      const res = mockRes();
      await callerid.getVerificationStatus({ user: owner }, res);
      expect(res.body).toMatchObject({ callerIdStatus: "unverified", verifiedCallerId: null });
    });
  });

  describe("cancelVerification", () => {
    it("invalidates only the authenticated owner's pending attempt", async () => {
      User.findOneAndUpdate.mockResolvedValue({ _id: userId });
      const res = mockRes();
      await callerid.cancelVerification({ user: owner }, res);
      expect(res.body).toEqual({ callerIdStatus: "unverified" });
      expect(User.findOneAndUpdate.mock.calls[0][0]).toEqual({ _id: userId, callerIdStatus: "pending" });
      expect(User.findOneAndUpdate.mock.calls[0][1]).toMatchObject({ callerIdVerificationCodeHash: null, callerIdVerificationSessionId: null });
    });

    it("requires authentication", async () => {
      const res = mockRes();
      await callerid.cancelVerification({}, res);
      expect(res.statusCode).toBe(401);
    });
  });

  describe("callStatusCallback", () => {
    const session = "b".repeat(24);

    it("rejects a request whose Twilio signature does not validate", async () => {
      twilioSignature.twilioRequestIsValid.mockReturnValue(false);
      const res = mockRes();
      await callerid.callStatusCallback({ query: { session }, body: { CallStatus: "failed" } }, res);
      expect(res.statusCode).toBe(403);
      expect(User.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it("fails only the matching pending session when the call did not connect", async () => {
      User.findOneAndUpdate.mockResolvedValue({ _id: userId });
      for (const CallStatus of ["failed", "busy", "no-answer", "canceled"]) {
        User.findOneAndUpdate.mockClear();
        const res = mockRes();
        await callerid.callStatusCallback({ query: { session }, body: { CallStatus } }, res);
        expect(res.statusCode).toBe(200);
        expect(User.findOneAndUpdate.mock.calls[0][0]).toEqual({ callerIdStatus: "pending", callerIdVerificationSessionId: session });
        expect(User.findOneAndUpdate.mock.calls[0][1]).toMatchObject({ callerIdStatus: "failed" });
      }
    });

    it("never verifies anything and ignores a completed call", async () => {
      const res = mockRes();
      await callerid.callStatusCallback({ query: { session }, body: { CallStatus: "completed" } }, res);
      expect(res.statusCode).toBe(200);
      expect(User.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it("ignores malformed session ids", async () => {
      const res = mockRes();
      await callerid.callStatusCallback({ query: { session: "nope" }, body: { CallStatus: "failed" } }, res);
      expect(User.findOneAndUpdate).not.toHaveBeenCalled();
    });
  });
});
