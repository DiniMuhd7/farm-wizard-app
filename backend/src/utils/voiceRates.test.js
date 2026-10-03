const fetchPrice = jest.fn();
const mockTwilio = jest.fn(() => ({
  pricing: { v2: { voice: { numbers: jest.fn(() => ({ fetch: fetchPrice })) } } },
}));
jest.mock("twilio", () => mockTwilio);

const ORIGINAL_ENV = process.env;

describe("Twilio voice rates", () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...ORIGINAL_ENV,
      TWILIO_ACCOUNT_SID: "ACtest",
      TWILIO_AUTH_TOKEN: "token",
      CARRIER_RATE_PER_MINUTE_CENTS: "9",
      TWILIO_APP_TO_APP_RATE_PER_MINUTE_CENTS: "2",
    };
    mockTwilio.mockClear();
    fetchPrice.mockReset();
  });

  afterAll(() => { process.env = ORIGINAL_ENV; });

  it("uses and caches Twilio's per-destination current carrier price", async () => {
    fetchPrice.mockResolvedValue({ outboundCallPrices: [{ currentPrice: "0.013" }] });
    const { carrierRateCents } = require("./voiceRates");

    await expect(carrierRateCents("+15551234567", "+15557654321")).resolves.toBe(2);
    await expect(carrierRateCents("+15551234567", "+15557654321")).resolves.toBe(2);
    expect(fetchPrice).toHaveBeenCalledTimes(1);
    expect(fetchPrice).toHaveBeenCalledWith({ originationNumber: "+15557654321" });
  });

  it("falls back safely and reads the configured app-to-app rate", async () => {
    fetchPrice.mockRejectedValue(new Error("pricing offline"));
    const { appToAppRateCents, carrierRateCents } = require("./voiceRates");

    await expect(carrierRateCents("+2348012345678", "+15557654321")).resolves.toBe(9);
    expect(appToAppRateCents()).toBe(2);
  });
});
