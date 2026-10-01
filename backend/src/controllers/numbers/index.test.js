/**
 * Regression test for the "Unable to load available countries" bug.
 *
 * Root cause: twilioClient() (the shared factory used by every numbers
 * endpoint) required PUBLIC_BASE_URL — a config value that's only actually
 * needed later, when constructing the voice webhook URL at *purchase* time
 * — even though listAvailableCountries/checkAvailability never use it. In
 * any deployment where TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN were valid but
 * PUBLIC_BASE_URL was unset or misconfigured, every single availability
 * lookup failed before ever calling Twilio, and the whole country picker
 * surfaced the generic "Unable to load available countries" error — 100%
 * of the time, regardless of actual number availability.
 */

const mockAvailabilityList = jest.fn();
jest.mock("twilio", () => jest.fn(() => ({
  availablePhoneNumbers: () => ({ local: { list: mockAvailabilityList } }),
})));

jest.mock("../../models/User", () => ({ findById: jest.fn() }));

const ORIGINAL_ENV = process.env;

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

describe("numbers controller — Twilio configuration", () => {
  beforeEach(() => {
    jest.resetModules();
    mockAvailabilityList.mockReset();
    process.env = { ...ORIGINAL_ENV, TWILIO_ACCOUNT_SID: "AC_test", TWILIO_AUTH_TOKEN: "token_test" };
    delete process.env.PUBLIC_BASE_URL;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("listAvailableCountries succeeds without PUBLIC_BASE_URL as long as Twilio credentials are present", async () => {
    mockAvailabilityList.mockResolvedValue([{ phoneNumber: "+15555550123" }]);
    const { listAvailableCountries } = require("./index");

    const res = mockRes();
    await listAvailableCountries({ query: { countryCodes: "US,GB" } }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ countryCodes: ["US", "GB"] });
  });

  it("checkAvailability succeeds without PUBLIC_BASE_URL as long as Twilio credentials are present", async () => {
    mockAvailabilityList.mockResolvedValue([{ phoneNumber: "+15555550123" }]);
    const User = require("../../models/User");
    User.findById = jest.fn(() => ({ select: jest.fn().mockResolvedValue(null) }));
    const { checkAvailability } = require("./index");

    const res = mockRes();
    await checkAvailability({ query: { countryCode: "US" }, user: { _id: "u1" } }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ available: true, phoneNumber: "+15555550123", countryCode: "US" });
  });

  it("surfaces a distinct service_unavailable code when TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN are missing, instead of the generic provider-error message", async () => {
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    const { listAvailableCountries } = require("./index");

    const res = mockRes();
    await listAvailableCountries({ query: { countryCodes: "US" } }, res);

    // Previously this collapsed into the same generic "Unable to load
    // available countries right now" message as a transient Twilio error or
    // "no numbers in stock", making a missing production config
    // indistinguishable from either of those from the app's point of view.
    expect(res.statusCode).toBe(503);
    expect(res.body.code).toBe("service_unavailable");
    expect(res.body.message).toMatch(/isn't configured/i);
  });

  it("still returns the generic provider_error code for a non-config Twilio failure", async () => {
    mockAvailabilityList.mockRejectedValue(Object.assign(new Error("boom"), { status: 500 }));
    const { listAvailableCountries } = require("./index");

    const res = mockRes();
    await listAvailableCountries({ query: { countryCodes: "US" } }, res);

    expect(res.statusCode).toBe(503);
    expect(res.body.code).toBe("provider_error");
    expect(res.body.message).toMatch(/unable to load available countries/i);
  });

  it("purchaseAndAssignNumber still requires PUBLIC_BASE_URL, since it actually uses it", async () => {
    const User = require("../../models/User");
    User.findById = jest.fn(() => ({ select: jest.fn().mockResolvedValue(null) }));
    const { purchaseAndAssignNumber } = require("./index");

    await expect(purchaseAndAssignNumber("u1", "US")).rejects.toThrow(/PUBLIC_BASE_URL/);
  });

  describe("getProviderStatus", () => {
    it("rejects non-admin users", async () => {
      const { getProviderStatus } = require("./index");
      const res = mockRes();

      await getProviderStatus({ user: { userType: "user" } }, res);

      expect(res.statusCode).toBe(403);
    });

    it("reports whether the number provider is configured, without leaking credential values", async () => {
      const { getProviderStatus } = require("./index");
      const res = mockRes();

      await getProviderStatus({ user: { userType: "admin" } }, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ numberProviderConfigured: true, purchaseWebhookConfigured: false });
      expect(JSON.stringify(res.body)).not.toContain("token_test");
    });

    it("reports numberProviderConfigured: false when Twilio credentials are missing", async () => {
      delete process.env.TWILIO_ACCOUNT_SID;
      delete process.env.TWILIO_AUTH_TOKEN;
      const { getProviderStatus } = require("./index");
      const res = mockRes();

      await getProviderStatus({ user: { userType: "admin" } }, res);

      expect(res.body.numberProviderConfigured).toBe(false);
    });
  });
});
