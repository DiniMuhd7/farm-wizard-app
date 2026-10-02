const mockGet = jest.fn();
jest.mock("axios", () => ({ get: mockGet }));

const ORIGINAL_ENV = process.env;

describe("USD to NGN exchange rate", () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...ORIGINAL_ENV,
      FX_RATE_URL: "https://fx.test/latest/USD",
      FX_RATE_CACHE_TTL_MS: "3600000",
    };
    mockGet.mockReset();
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("rounds USD conversions up to the next ₦10 and caches the fetched rate", async () => {
    mockGet.mockResolvedValue({ data: { rates: { NGN: 1501.2 } } });
    const { usdToNgn } = require("./fx");

    await expect(usdToNgn(7.99, 12000)).resolves.toBe(12000);
    await expect(usdToNgn(5, 3000)).resolves.toBe(7510);
    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenCalledWith("https://fx.test/latest/USD", { timeout: 5000 });
  });

  it("uses the fixed NGN fallback when the source is unset or unavailable", async () => {
    delete process.env.FX_RATE_URL;
    let fx = require("./fx");
    await expect(fx.usdToNgn(5, 3000)).resolves.toBe(3000);
    expect(mockGet).not.toHaveBeenCalled();

    jest.resetModules();
    mockGet.mockRejectedValue(new Error("offline"));
    fx = require("./fx");
    process.env.FX_RATE_URL = "https://fx.test/latest/USD";
    await expect(fx.usdToNgn(5, 3000)).resolves.toBe(3000);
  });
});
