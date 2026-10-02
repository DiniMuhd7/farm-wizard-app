const mockAxiosPost = jest.fn();
const mockAxiosGet = jest.fn();

jest.mock("axios", () => ({ post: mockAxiosPost, get: mockAxiosGet }));
jest.mock("../../models/Order", () => ({
  create: jest.fn(),
  findById: jest.fn(),
  findOne: jest.fn(),
  updateOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
}));
jest.mock("../numbers", () => ({ purchaseAndAssignNumber: jest.fn() }));
jest.mock("../../models/User", () => ({ findById: jest.fn(), findByIdAndUpdate: jest.fn() }));

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

function fakeOrder(overrides = {}) {
  return {
    _id: { toString: () => "order123" },
    providerReference: "pending",
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("payments controller — checkout session init", () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...ORIGINAL_ENV,
      FLW_SECRET_KEY: "flw_test_123",
      PUBLIC_BASE_URL: "https://api.9tel.test/",
    };
    mockAxiosPost.mockReset();
    mockAxiosGet.mockReset();
    const Order = require("../../models/Order");
    Order.create.mockReset();
    Order.findById.mockReset();
    Order.findOne.mockReset();
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("creates a Flutterwave number checkout session with a normalized redirect URL", async () => {
    const Order = require("../../models/Order");
    const order = fakeOrder({ providerReference: "9tel-ref-1" });
    Order.create.mockResolvedValue(order);
    mockAxiosPost.mockResolvedValue({ data: { status: "success", data: { link: "https://flutterwave.test/pay" } } });
    const { createFlutterwaveSession } = require("./index");

    const res = mockRes();
    await createFlutterwaveSession({ body: { countryCode: "us", currency: "NGN" }, user: { _id: "user1", email: "user@example.com", fullName: "Test User" } }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ orderId: order._id, url: "https://flutterwave.test/pay" });
    expect(mockAxiosPost).toHaveBeenCalledWith(
      "https://api.flutterwave.com/v3/payments",
      expect.objectContaining({ redirect_url: "https://api.9tel.test/api/v1/payments/return" }),
      expect.any(Object)
    );
  });

  it("creates a Flutterwave credits checkout session for a valid pack", async () => {
    const Order = require("../../models/Order");
    const order = fakeOrder({ providerReference: "9tel-ref-2" });
    Order.create.mockResolvedValue(order);
    mockAxiosPost.mockResolvedValue({ data: { status: "success", data: { link: "https://flutterwave.test/credits" } } });
    const { createCreditsFlutterwaveSession } = require("./index");

    const res = mockRes();
    await createCreditsFlutterwaveSession({ body: { packId: "1000", currency: "NGN" }, user: { _id: "user1" } }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.url).toBe("https://flutterwave.test/credits");
    expect(mockAxiosPost).toHaveBeenCalledWith(
      "https://api.flutterwave.com/v3/payments",
      expect.objectContaining({ amount: "6000", currency: "NGN" }),
      expect.any(Object)
    );
  });

  it("returns config_error when FLW_SECRET_KEY is missing", async () => {
    delete process.env.FLW_SECRET_KEY;
    const Order = require("../../models/Order");
    const { createFlutterwaveSession } = require("./index");

    const res = mockRes();
    await createFlutterwaveSession({ body: { countryCode: "US", currency: "NGN" }, user: { _id: "user1" } }, res);

    expect(res.statusCode).toBe(503);
    expect(res.body.code).toBe("config_error");
    expect(Order.create).not.toHaveBeenCalled();
  });

  it("returns config_error when PUBLIC_BASE_URL is missing", async () => {
    delete process.env.PUBLIC_BASE_URL;
    const Order = require("../../models/Order");
    const { createCreditsFlutterwaveSession } = require("./index");

    const res = mockRes();
    await createCreditsFlutterwaveSession({ body: { packId: "500", currency: "USD" }, user: { _id: "user1" } }, res);

    expect(res.statusCode).toBe(503);
    expect(res.body.code).toBe("config_error");
    expect(Order.create).not.toHaveBeenCalled();
  });

  it("returns validation_error for an invalid countryCode", async () => {
    const Order = require("../../models/Order");
    const { createFlutterwaveSession } = require("./index");

    const res = mockRes();
    await createFlutterwaveSession({ body: { countryCode: "USA", currency: "USD" }, user: { _id: "user1" } }, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ code: "validation_error", message: "countryCode must be a 2-letter ISO country code." });
    expect(Order.create).not.toHaveBeenCalled();
  });

  it("returns validation_error for an invalid credits pack", async () => {
    const Order = require("../../models/Order");
    const { createCreditsFlutterwaveSession } = require("./index");

    const res = mockRes();
    await createCreditsFlutterwaveSession({ body: { packId: "9999", currency: "USD" }, user: { _id: "user1" } }, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ code: "validation_error", message: "Choose a valid credits pack." });
    expect(Order.create).not.toHaveBeenCalled();
  });

  it("returns network_error when Flutterwave cannot be reached", async () => {
    const Order = require("../../models/Order");
    Order.create.mockResolvedValue(fakeOrder({ providerReference: "9tel-ref-3" }));
    mockAxiosPost.mockRejectedValue(Object.assign(new Error("connect ECONNRESET"), { isAxiosError: true, code: "ECONNRESET" }));
    const { createFlutterwaveSession } = require("./index");

    const res = mockRes();
    await createFlutterwaveSession({ body: { countryCode: "NG", currency: "NGN" }, user: { _id: "user1" } }, res);

    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({
      code: "network_error",
      message: "We couldn't reach the payment provider right now. Please try again.",
    });
  });

  it("charges a credits pack in USD when USD is selected", async () => {
    const Order = require("../../models/Order");
    Order.create.mockResolvedValue(fakeOrder({ providerReference: "9tel-ref-4" }));
    mockAxiosPost.mockResolvedValue({ data: { status: "success", data: { link: "https://flutterwave.test/usd" } } });
    const { createCreditsFlutterwaveSession } = require("./index");

    const res = mockRes();
    await createCreditsFlutterwaveSession({ body: { packId: "1000", currency: "USD" }, user: { _id: "user1" } }, res);

    expect(res.statusCode).toBe(200);
    expect(Order.create).toHaveBeenCalledWith(expect.objectContaining({ currency: "USD", amount: 10, kind: "credits" }));
    expect(mockAxiosPost).toHaveBeenCalledWith(
      "https://api.flutterwave.com/v3/payments",
      expect.objectContaining({ amount: "10", currency: "USD" }),
      expect.any(Object)
    );
  });

  it("creates an Airbundle checkout for each supported bundle in the selected currency", async () => {
    const Order = require("../../models/Order");
    const { createAirbundleFlutterwaveSession, _private } = require("./index");
    expect(Object.keys(_private.AIRBUNDLES)).toEqual(["500", "1500", "2500", "3500", "5000"]);

    Order.create.mockResolvedValue(fakeOrder({ providerReference: "9tel-ref-5" }));
    mockAxiosPost.mockResolvedValue({ data: { status: "success", data: { link: "https://flutterwave.test/airbundle" } } });

    const res = mockRes();
    await createAirbundleFlutterwaveSession({ body: { bundleId: "2500", currency: "USD" }, user: { _id: "user1" } }, res);

    expect(res.statusCode).toBe(200);
    expect(Order.create).toHaveBeenCalledWith(expect.objectContaining({
      kind: "airbundle",
      bundleMinutes: 2500,
      currency: "USD",
      amount: _private.AIRBUNDLES["2500"].priceUsd,
    }));

    const ngnRes = mockRes();
    await createAirbundleFlutterwaveSession({ body: { bundleId: "500", currency: "NGN" }, user: { _id: "user1" } }, ngnRes);
    expect(Order.create).toHaveBeenLastCalledWith(expect.objectContaining({
      currency: "NGN",
      amount: _private.AIRBUNDLES["500"].priceNgn,
    }));
  });

  it("rejects a missing or unsupported currency before creating an order", async () => {
    const Order = require("../../models/Order");
    const { createFlutterwaveSession, createAirbundleFlutterwaveSession } = require("./index");

    const res = mockRes();
    await createFlutterwaveSession({ body: { countryCode: "US" }, user: { _id: "user1" } }, res);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ code: "validation_error", message: "Choose USD or NGN to pay with." });

    const eurRes = mockRes();
    await createAirbundleFlutterwaveSession({ body: { bundleId: "500", currency: "EUR" }, user: { _id: "user1" } }, eurRes);
    expect(eurRes.statusCode).toBe(400);
    expect(Order.create).not.toHaveBeenCalled();
  });

  it("rejects an unknown Airbundle id (including the removed free/premium offers)", async () => {
    const Order = require("../../models/Order");
    const { createAirbundleFlutterwaveSession } = require("./index");

    const res = mockRes();
    await createAirbundleFlutterwaveSession({ body: { bundleId: "free", currency: "USD" }, user: { _id: "user1" } }, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ code: "validation_error", message: "Choose a valid Airbundle." });
    expect(Order.create).not.toHaveBeenCalled();
  });

  it("only fulfills from the return page after Flutterwave itself verifies the transaction", async () => {
    const Order = require("../../models/Order");
    const order = fakeOrder({ providerReference: "9tel-ref-6", amount: 6000, currency: "NGN", kind: "credits", creditsCents: 1000, status: "pending", user: "user1" });
    Order.findOne.mockResolvedValue(order);
    mockAxiosGet.mockResolvedValue({ data: { data: { status: "failed", amount: 6000, currency: "NGN", tx_ref: "9tel-ref-6" } } });
    const { paymentReturnPage } = require("./index");

    const res = { ...mockRes(), type() { return this; }, send(html) { this.html = html; return this; } };
    await paymentReturnPage({ query: { status: "successful", tx_ref: "9tel-ref-6", transaction_id: "42" } }, res);

    expect(order.status).toBe("failed");
    expect(res.html).toContain("Payment didn't go through");
  });

  it("marks a pending order cancelled when the person backs out of checkout", async () => {
    const Order = require("../../models/Order");
    Order.updateOne.mockResolvedValue({});
    const { paymentReturnPage } = require("./index");

    const res = { ...mockRes(), type() { return this; }, send(html) { this.html = html; return this; } };
    await paymentReturnPage({ query: { status: "cancelled", tx_ref: "9tel-ref-7" } }, res);

    expect(Order.updateOne).toHaveBeenCalledWith(
      { providerReference: "9tel-ref-7", provider: "flutterwave", status: "pending" },
      { status: "cancelled" }
    );
    expect(res.html).toContain("Payment cancelled");
  });

  describe("verified fulfillment (webhook)", () => {
    function webhookReq(overrides = {}) {
      return { headers: { "verif-hash": "hash123" }, body: { data: { tx_ref: "9tel-ref-8", id: 99 } }, ...overrides };
    }

    beforeEach(() => {
      process.env.FLW_SECRET_HASH = "hash123";
    });

    it("claims and fulfills the order only after Flutterwave verifies amount, currency and tx_ref", async () => {
      const Order = require("../../models/Order");
      const order = fakeOrder({ providerReference: "9tel-ref-8", amount: 12000, currency: "NGN", kind: "airbundle", bundleMinutes: 500, premiumDays: 30, status: "pending", user: "user1" });
      Order.findOne.mockResolvedValue(order);
      Order.findOneAndUpdate.mockResolvedValue(order);
      mockAxiosGet.mockResolvedValue({ data: { data: { status: "successful", amount: 12000, currency: "NGN", tx_ref: "9tel-ref-8" } } });
      const User = require("../../models/User");
      User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ premiumUntil: null }) });
      User.findByIdAndUpdate.mockResolvedValue({});
      const { flutterwaveWebhook } = require("./index");

      await flutterwaveWebhook(webhookReq(), mockRes());

      expect(mockAxiosGet).toHaveBeenCalledWith("https://api.flutterwave.com/v3/transactions/99/verify", expect.any(Object));
      expect(Order.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ _id: order._id }),
        { status: "processing", providerChargeId: "99" },
        { new: true }
      );
      expect(User.findByIdAndUpdate).toHaveBeenCalledWith("user1", expect.objectContaining({ $inc: { airbundleMinutes: 500 } }));
      expect(order.status).toBe("paid");
    });

    it("does not fulfill when another request already claimed the order", async () => {
      const Order = require("../../models/Order");
      Order.findOne.mockResolvedValue(fakeOrder({ providerReference: "9tel-ref-8", amount: 12000, currency: "NGN", status: "pending" }));
      Order.findOneAndUpdate.mockResolvedValue(null);
      mockAxiosGet.mockResolvedValue({ data: { data: { status: "successful", amount: 12000, currency: "NGN", tx_ref: "9tel-ref-8" } } });
      const User = require("../../models/User");
      User.findByIdAndUpdate.mockReset();
      const { flutterwaveWebhook } = require("./index");

      await flutterwaveWebhook(webhookReq(), mockRes());

      expect(User.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it("never fulfills on an amount or currency mismatch", async () => {
      const Order = require("../../models/Order");
      Order.findOne.mockResolvedValue(fakeOrder({ providerReference: "9tel-ref-8", amount: 12000, currency: "NGN", status: "pending" }));
      Order.findOneAndUpdate.mockReset();
      const { flutterwaveWebhook } = require("./index");

      mockAxiosGet.mockResolvedValue({ data: { data: { status: "successful", amount: 100, currency: "NGN", tx_ref: "9tel-ref-8" } } });
      await flutterwaveWebhook(webhookReq(), mockRes());
      mockAxiosGet.mockResolvedValue({ data: { data: { status: "successful", amount: 12000, currency: "USD", tx_ref: "9tel-ref-8" } } });
      await flutterwaveWebhook(webhookReq(), mockRes());

      expect(Order.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it("rejects a bad signature and ignores a non-numeric transaction id", async () => {
      const { flutterwaveWebhook } = require("./index");
      const Order = require("../../models/Order");
      Order.findOne.mockReset();

      const res = { ...mockRes(), send() { return this; } };
      await flutterwaveWebhook(webhookReq({ headers: { "verif-hash": "wrong" } }), res);
      expect(res.statusCode).toBe(401);

      await flutterwaveWebhook(webhookReq({ body: { data: { tx_ref: "9tel-ref-8", id: "../x" } } }), mockRes());
      expect(mockAxiosGet).not.toHaveBeenCalled();
    });
  });
});
