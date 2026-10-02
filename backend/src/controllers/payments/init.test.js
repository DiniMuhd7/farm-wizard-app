const mockStripeSessionCreate = jest.fn();
const mockAxiosPost = jest.fn();

jest.mock("stripe", () => jest.fn(() => ({
  checkout: { sessions: { create: mockStripeSessionCreate } },
  refunds: { create: jest.fn() },
  webhooks: { constructEvent: jest.fn() },
})));
jest.mock("axios", () => ({ post: mockAxiosPost, get: jest.fn() }));
jest.mock("../../models/Order", () => ({
  create: jest.fn(),
  findById: jest.fn(),
  findOne: jest.fn(),
}));
jest.mock("../numbers", () => ({ purchaseAndAssignNumber: jest.fn() }));

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
      STRIPE_SECRET_KEY: "sk_test_123",
      FLW_SECRET_KEY: "flw_test_123",
      PUBLIC_BASE_URL: "https://api.9tel.test/",
    };
    mockStripeSessionCreate.mockReset();
    mockAxiosPost.mockReset();
    const Order = require("../../models/Order");
    Order.create.mockReset();
    Order.findById.mockReset();
    Order.findOne.mockReset();
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("creates a Stripe number checkout session with normalized success/cancel URLs", async () => {
    const Order = require("../../models/Order");
    const order = fakeOrder();
    Order.create.mockResolvedValue(order);
    mockStripeSessionCreate.mockResolvedValue({ id: "cs_123", url: "https://checkout.stripe.test/session" });
    const { createStripeSession } = require("./index");

    const res = mockRes();
    await createStripeSession({ body: { countryCode: "ng" }, user: { _id: "user1" } }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ orderId: order._id, url: "https://checkout.stripe.test/session" });
    expect(mockStripeSessionCreate).toHaveBeenCalledWith(expect.objectContaining({
      success_url: "https://api.9tel.test/api/v1/payments/return?status=success",
      cancel_url: "https://api.9tel.test/api/v1/payments/return?status=cancelled",
    }));
  });

  it("creates a Stripe credits checkout session for a valid pack", async () => {
    const Order = require("../../models/Order");
    const order = fakeOrder();
    Order.create.mockResolvedValue(order);
    mockStripeSessionCreate.mockResolvedValue({ id: "cs_credits", url: "https://checkout.stripe.test/credits" });
    const { createCreditsStripeSession } = require("./index");

    const res = mockRes();
    await createCreditsStripeSession({ body: { packId: "500" }, user: { _id: "user1" } }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.url).toBe("https://checkout.stripe.test/credits");
    expect(mockStripeSessionCreate).toHaveBeenCalledWith(expect.objectContaining({
      line_items: [expect.objectContaining({
        price_data: expect.objectContaining({ unit_amount: 500 }),
      })],
    }));
  });

  it("creates a Flutterwave number checkout session with a normalized redirect URL", async () => {
    const Order = require("../../models/Order");
    const order = fakeOrder({ providerReference: "9tel-ref-1" });
    Order.create.mockResolvedValue(order);
    mockAxiosPost.mockResolvedValue({ data: { status: "success", data: { link: "https://flutterwave.test/pay" } } });
    const { createFlutterwaveSession } = require("./index");

    const res = mockRes();
    await createFlutterwaveSession({ body: { countryCode: "us" }, user: { _id: "user1", email: "user@example.com", fullName: "Test User" } }, res);

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
    await createCreditsFlutterwaveSession({ body: { packId: "1000" }, user: { _id: "user1" } }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.url).toBe("https://flutterwave.test/credits");
    expect(mockAxiosPost).toHaveBeenCalledWith(
      "https://api.flutterwave.com/v3/payments",
      expect.objectContaining({ amount: "6000" }),
      expect.any(Object)
    );
  });

  it("returns config_error when STRIPE_SECRET_KEY is missing", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    const Order = require("../../models/Order");
    const { createStripeSession } = require("./index");

    const res = mockRes();
    await createStripeSession({ body: { countryCode: "US" }, user: { _id: "user1" } }, res);

    expect(res.statusCode).toBe(503);
    expect(res.body.code).toBe("config_error");
    expect(Order.create).not.toHaveBeenCalled();
  });

  it("returns config_error when FLW_SECRET_KEY is missing", async () => {
    delete process.env.FLW_SECRET_KEY;
    const Order = require("../../models/Order");
    const { createFlutterwaveSession } = require("./index");

    const res = mockRes();
    await createFlutterwaveSession({ body: { countryCode: "US" }, user: { _id: "user1" } }, res);

    expect(res.statusCode).toBe(503);
    expect(res.body.code).toBe("config_error");
    expect(Order.create).not.toHaveBeenCalled();
  });

  it("returns config_error when PUBLIC_BASE_URL is missing", async () => {
    delete process.env.PUBLIC_BASE_URL;
    const Order = require("../../models/Order");
    const { createCreditsStripeSession } = require("./index");

    const res = mockRes();
    await createCreditsStripeSession({ body: { packId: "500" }, user: { _id: "user1" } }, res);

    expect(res.statusCode).toBe(503);
    expect(res.body.code).toBe("config_error");
    expect(Order.create).not.toHaveBeenCalled();
  });

  it("returns validation_error for an invalid countryCode", async () => {
    const Order = require("../../models/Order");
    const { createStripeSession } = require("./index");

    const res = mockRes();
    await createStripeSession({ body: { countryCode: "USA" }, user: { _id: "user1" } }, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ code: "validation_error", message: "countryCode must be a 2-letter ISO country code." });
    expect(Order.create).not.toHaveBeenCalled();
  });

  it("returns validation_error for an invalid credits pack", async () => {
    const Order = require("../../models/Order");
    const { createCreditsFlutterwaveSession } = require("./index");

    const res = mockRes();
    await createCreditsFlutterwaveSession({ body: { packId: "9999" }, user: { _id: "user1" } }, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ code: "validation_error", message: "Choose a valid credits pack." });
    expect(Order.create).not.toHaveBeenCalled();
  });

  it("returns provider_error with a safe provider reason when Stripe rejects session creation", async () => {
    const Order = require("../../models/Order");
    Order.create.mockResolvedValue(fakeOrder());
    mockStripeSessionCreate.mockRejectedValue({ raw: { message: "Your Stripe account cannot accept live charges yet." } });
    const { createStripeSession } = require("./index");

    const res = mockRes();
    await createStripeSession({ body: { countryCode: "US" }, user: { _id: "user1" } }, res);

    expect(res.statusCode).toBe(502);
    expect(res.body).toEqual({
      code: "provider_error",
      message: "Your Stripe account cannot accept live charges yet.",
    });
  });

  it("returns network_error when Flutterwave cannot be reached", async () => {
    const Order = require("../../models/Order");
    Order.create.mockResolvedValue(fakeOrder({ providerReference: "9tel-ref-3" }));
    mockAxiosPost.mockRejectedValue(Object.assign(new Error("connect ECONNRESET"), { isAxiosError: true, code: "ECONNRESET" }));
    const { createFlutterwaveSession } = require("./index");

    const res = mockRes();
    await createFlutterwaveSession({ body: { countryCode: "NG" }, user: { _id: "user1" } }, res);

    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({
      code: "network_error",
      message: "We couldn't reach the payment provider right now. Please try again.",
    });
  });
});
