const axios = require("axios");
const crypto = require("crypto");
const Order = require("../../models/Order");
const { purchaseAndAssignNumber } = require("../numbers");
const { usdToNgn, getUsdToNgnRate } = require("../../utils/fx");
const { ESIM_PLANS, getPlan: getEsimPlan } = require("../../utils/esimCatalog");
const { provisionEsim } = require("../../utils/esimProvider");

const COUNTRY_CODE = /^[A-Z]{2}$/;

// Flutterwave is the only payment provider. The person picks USD or NGN
// before paying; every product below is priced in both, in the main
// currency unit (dollars / naira — not cents / kobo — which is what
// Flutterwave's Standard API expects for `amount`).
const SUPPORTED_CURRENCIES = ["USD", "NGN"];
const NUMBER_PRICE = {
  USD: Number(process.env.NUMBER_PRICE_USD_CENTS || 500) / 100, // $5.00 default
  NGN: Number(process.env.NUMBER_PRICE_NGN || 3000), // ₦3,000 default
};

// NGN prices below are fallbacks: when FX_RATE_URL is configured, the NGN
// charge is the USD price converted at the current rate (see utils/fx.js),
// and these fixed amounts are used only if the rate is unavailable.

// Prepaid credit packs for the top-up flow. Keyed by a short id the mobile
// app selects from (see constants/creditPacks.ts, which mirrors these exact
// amounts so the price shown before checkout matches what's actually
// charged). `creditsCents` is how much balance is added; `priceUsdCents` /
// `priceNgn` is what's actually charged.
const CREDIT_PACKS = {
  "500": { creditsCents: 500, priceUsdCents: 500, priceNgn: 3000 },
  "1000": { creditsCents: 1000, priceUsdCents: 1000, priceNgn: 6000 },
  "2500": { creditsCents: 2500, priceUsdCents: 2500, priceNgn: 15000 },
  "5000": { creditsCents: 5000, priceUsdCents: 5000, priceNgn: 75000 },
  "10000": { creditsCents: 10000, priceUsdCents: 10000, priceNgn: 150000 },
};

// Airbundle — selectable minute bundles for ad-free 9tel-to-9tel calling.
// Billed as a one-off payment (no renewals). Keyed by bundle id; mirrored
// by constants/airbundles.ts on the mobile side so the price shown before
// checkout always matches what's charged.
const AIRBUNDLES = {
  "500": { minutes: 500, priceUsd: 7.99, priceNgn: 12000 },
  "1500": { minutes: 1500, priceUsd: 19.99, priceNgn: 30000 },
  "2500": { minutes: 2500, priceUsd: 29.99, priceNgn: 45000 },
  "3500": { minutes: 3500, priceUsd: 39.99, priceNgn: 60000 },
  "5000": { minutes: 5000, priceUsd: 54.99, priceNgn: 82500 },
};
const AIRBUNDLE_PERIOD_DAYS = 30;

function requireEnv(keys, context) {
  const missing = keys.filter((key) => !process.env[key]);
  if (missing.length) {
    const err = new Error(`${context} is not configured: ${missing.join(", ")}`);
    err.code = "CONFIG_MISSING";
    err.missing = missing;
    throw err;
  }
}

function validationError(message) {
  const err = new Error(message);
  err.status = 400;
  err.clientCode = "validation_error";
  return err;
}

function providerError(message) {
  const err = new Error(message);
  err.status = 502;
  err.clientCode = "provider_error";
  return err;
}

function requireCheckoutConfiguration() {
  requireEnv(["FLW_SECRET_KEY", "PUBLIC_BASE_URL"], "Flutterwave payments");
  return process.env.PUBLIC_BASE_URL.replace(/\/$/, "");
}

function buildReturnUrl(baseUrl, status) {
  return `${baseUrl}/api/v1/payments/return${status ? `?status=${status}` : ""}`;
}

function validHostedCheckoutUrl(value) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    // Flutterwave Standard returns an HTTPS-hosted link. Do not pass an
    // arbitrary value returned by an upstream response on to the app's
    // browser, where it could be opened as a deep link or local file.
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function sanitizeProviderMessage(message) {
  if (typeof message !== "string") return null;
  let sanitized = message.trim().replace(/\s+/g, " ");
  if (!sanitized) return null;
  const secrets = [
    process.env.FLW_SECRET_KEY,
    process.env.FLW_SECRET_HASH,
  ].filter(Boolean);
  for (const secret of secrets) sanitized = sanitized.split(secret).join("[redacted]");
  if (/Bearer\s+[A-Za-z0-9._-]+/i.test(sanitized)) return null;
  if (/(?:sk|pk)_(?:live|test)_[A-Za-z0-9]+/i.test(sanitized)) return null;
  return sanitized;
}

function extractProviderMessage(error) {
  const candidates = [
    error?.response?.data?.message,
    error?.response?.data?.error,
    error?.response?.data?.data?.processor_response,
    error?.message,
  ];
  for (const candidate of candidates) {
    const sanitized = sanitizeProviderMessage(candidate);
    if (sanitized) return sanitized;
  }
  return null;
}

function isNetworkProviderError(error) {
  return Boolean(
    error && !error.response && (
      error.isAxiosError
      || error.name === "AbortError"
      || ["ECONNABORTED", "ECONNRESET", "ENOTFOUND", "EAI_AGAIN", "ETIMEDOUT"].includes(error.code)
    )
  );
}

function normalizePaymentInitError(error) {
  if (error?.clientCode) {
    return {
      status: error.status || (error.clientCode === "validation_error" ? 400 : 502),
      code: error.clientCode,
      message: error.message,
    };
  }
  if (error?.code === "CONFIG_MISSING") {
    return {
      status: 503,
      code: "config_error",
      message: "Payment setup isn't available right now. Please try again in a few minutes.",
    };
  }
  if (isNetworkProviderError(error)) {
    return {
      status: 503,
      code: "network_error",
      message: "We couldn't reach the payment provider right now. Please try again.",
    };
  }
  return {
    status: error?.status || 502,
    code: "provider_error",
    message: extractProviderMessage(error) || "That didn't go through. Please try again.",
  };
}

function respondToPaymentInitError(res, label, error) {
  console.error(label, error?.response?.data || error);
  const normalized = normalizePaymentInitError(error);
  return res.status(normalized.status).json({ code: normalized.code, message: normalized.message });
}

async function refundFlutterwave(order) {
  const transactionId = Number(order.providerChargeId);
  if (!Number.isSafeInteger(transactionId) || transactionId <= 0) throw new Error("No transaction id recorded for this order.");
  await axios.post(
    `https://api.flutterwave.com/v3/transactions/${transactionId}/refund`,
    { comments: "9tel: number unavailable at fulfillment time" },
    { headers: { Authorization: `Bearer ${process.env.FLW_SECRET_KEY}` } }
  );
}

// Runs after a payment is confirmed. If the Twilio purchase itself then
// fails — a real, if rare, possibility: that country could run out of
// numbers in the gap between checkout and fulfillment, or Twilio could be
// briefly unreachable — the person has now paid for nothing unless this
// function does something about it. It does: automatically issues a refund
// through whichever provider was used, and marks the order in a state that
// makes that distinction ("paid_unfulfilled", not just "failed") visible to
// both the mobile app and to anyone looking at this data later. A refund
// call itself failing is logged loudly rather than swallowed — that
// scenario needs a human, and silently losing track of it would be worse
// than a noisy log line.
async function refundOrder(order) {
  if (order.provider === "stripe") throw new Error("Order was paid through Stripe, which is no longer supported — refund manually in the Stripe dashboard.");
  await refundFlutterwave(order);
}

// Runs after a kind: "credits" top-up payment is confirmed — adds the
// purchased balance to the user's creditsBalanceCents. This is a plain DB
// increment, not a third-party purchase, so failure is rare, but a paid
// order whose balance never got applied is still real money with nothing
// delivered — handled the same way as a failed number fulfillment: an
// automatic refund, with the same "needs a human" escalation if that also
// fails.
async function fulfillCreditsOrder(order) {
  if (order.status === "paid" && order.fulfilledCreditsCents) return order.fulfilledCreditsCents; // already done — webhook redelivery
  try {
    const User = require("../../models/User");
    await User.findByIdAndUpdate(order.user, { $inc: { creditsBalanceCents: order.creditsCents } });
    order.status = "paid";
    order.fulfilledCreditsCents = order.creditsCents;
    await order.save();
    return order.creditsCents;
  } catch (fulfillmentError) {
    console.error(`Credits fulfillment failed for order ${order._id} after payment succeeded:`, fulfillmentError.message);
    order.status = "paid_unfulfilled";
    await order.save();
    try {
      await refundOrder(order);
      order.status = "refunded";
      await order.save();
    } catch (refundError) {
      console.error(`AUTOMATIC REFUND FAILED for order ${order._id} — needs manual handling:`, refundError.response?.data || refundError.message);
    }
    return null;
  }
}

// Runs after a kind: "airbundle" payment is confirmed — adds the bundle's
// minutes to the user's airbundleMinutes and extends their ad-free
// entitlement (isPremium/premiumUntil — internal field names kept so
// existing accounts and clients keep working) by premiumDays from either
// now, or their current premiumUntil if it hasn't lapsed yet (so buying
// another bundle early doesn't lose the remaining days already paid for).
// Orders created before the Premium -> Airbundle rename (kind: "premium")
// carry no minutes and flow through here too.
async function fulfillAirbundleOrder(order) {
  if (order.status === "paid" && order.fulfilledPremiumDays) return order.fulfilledPremiumDays; // already done — webhook redelivery
  try {
    const User = require("../../models/User");
    const user = await User.findById(order.user).select("premiumUntil");
    const now = Date.now();
    const days = order.premiumDays || AIRBUNDLE_PERIOD_DAYS;
    const base = user?.premiumUntil && new Date(user.premiumUntil).getTime() > now ? new Date(user.premiumUntil).getTime() : now;
    const premiumUntil = new Date(base + days * 24 * 60 * 60 * 1000);
    await User.findByIdAndUpdate(order.user, {
      $set: { isPremium: true, premiumUntil },
      ...(order.bundleMinutes ? { $inc: { airbundleMinutes: order.bundleMinutes } } : {}),
    });
    order.status = "paid";
    order.fulfilledPremiumDays = days;
    await order.save();
    return days;
  } catch (fulfillmentError) {
    console.error(`Airbundle fulfillment failed for order ${order._id} after payment succeeded:`, fulfillmentError.message);
    order.status = "paid_unfulfilled";
    await order.save();
    try {
      await refundOrder(order);
      order.status = "refunded";
      await order.save();
    } catch (refundError) {
      console.error(`AUTOMATIC REFUND FAILED for order ${order._id} — needs manual handling:`, refundError.response?.data || refundError.message);
    }
    return null;
  }
}

// Runs after a kind: "esim" payment is confirmed — buys the profile from the
// eSIM provider and stores it for the user. Idempotent per order (ESim.order
// is unique), and a paid order whose profile could not be provisioned is
// refunded automatically, same as the other products.
async function fulfillEsimOrder(order) {
  const ESim = require("../../models/ESim");
  const existing = await ESim.findOne({ order: order._id }).select("_id");
  if (existing) {
    if (order.status !== "paid" || !order.fulfilledEsimId) {
      order.status = "paid";
      order.fulfilledEsimId = existing._id;
      await order.save();
    }
    return existing._id;
  }
  try {
    const plan = getEsimPlan(order.esimPlanId);
    if (!plan) throw new Error(`Unknown eSIM plan "${order.esimPlanId}".`);
    const profile = await provisionEsim(plan, order._id.toString());
    const esim = await ESim.create({
      user: order.user,
      order: order._id,
      planId: plan.id,
      countryCode: plan.countryCode,
      country: plan.country,
      dataGB: plan.dataGB,
      validityDays: plan.validityDays,
      ...profile,
    });
    order.status = "paid";
    order.fulfilledEsimId = esim._id;
    await order.save();
    return esim._id;
  } catch (fulfillmentError) {
    console.error(`eSIM fulfillment failed for order ${order._id} after payment succeeded:`, fulfillmentError.response?.data || fulfillmentError.message);
    order.status = "paid_unfulfilled";
    await order.save();
    try {
      await refundOrder(order);
      order.status = "refunded";
      await order.save();
    } catch (refundError) {
      console.error(`AUTOMATIC REFUND FAILED for order ${order._id} — needs manual handling:`, refundError.response?.data || refundError.message);
    }
    return null;
  }
}

async function fulfillOrder(order) {
  if (order.kind === "esim") return fulfillEsimOrder(order);
  if (order.kind === "credits") return fulfillCreditsOrder(order);
  if (order.kind === "airbundle" || order.kind === "premium") return fulfillAirbundleOrder(order);
  if (order.status === "paid" && order.fulfilledPhoneNumber) return order.fulfilledPhoneNumber; // already done — webhook redelivery
  try {
    const phoneNumber = await purchaseAndAssignNumber(order.user, order.countryCode);
    order.status = "paid";
    order.fulfilledPhoneNumber = phoneNumber;
    await order.save();
    return phoneNumber;
  } catch (fulfillmentError) {
    console.error(`Fulfillment failed for order ${order._id} after payment succeeded:`, fulfillmentError.message);
    order.status = "paid_unfulfilled";
    await order.save();
    try {
      await refundOrder(order);
      order.status = "refunded";
      await order.save();
    } catch (refundError) {
      // Genuinely needs a human now: charged, no number, and the automatic
      // refund itself didn't go through either. order.status stays
      // "paid_unfulfilled" so this is easy to find and act on manually.
      console.error(`AUTOMATIC REFUND FAILED for order ${order._id} — needs manual handling:`, refundError.response?.data || refundError.message);
    }
    return null;
  }
}

function assertValidCountryCode(countryCode) {
  if (!COUNTRY_CODE.test(countryCode)) throw validationError("countryCode must be a 2-letter ISO country code.");
}

function resolveCurrency(currency) {
  const normalized = String(currency || "").toUpperCase();
  if (!SUPPORTED_CURRENCIES.includes(normalized)) throw validationError("Choose USD or NGN to pay with.");
  return normalized;
}

// The amount to charge in `currency`: the USD price as-is, or the USD price
// converted to naira at the current FX rate (fixed NGN fallback if none).
async function priceIn(currency, usdAmount, fallbackNgn) {
  return currency === "USD" ? usdAmount : usdToNgn(usdAmount, fallbackNgn);
}

function resolveCreditPack(packId) {
  const pack = CREDIT_PACKS[String(packId)];
  if (!pack) throw validationError("Choose a valid credits pack.");
  return pack;
}

function resolveEsimPlan(planId) {
  const plan = getEsimPlan(planId);
  if (!plan) throw validationError("Choose a valid eSIM plan.");
  return plan;
}

function resolveAirbundle(bundleId) {
  const bundle = AIRBUNDLES[String(bundleId)];
  if (!bundle) throw validationError("Choose a valid Airbundle.");
  return bundle;
}

// Creates the pending Order and the Flutterwave hosted-checkout link for it.
// `build` validates the request and returns { title, currency, amount,
// fields }. Nothing is applied to the account here — that only happens once
// a verified successful payment is confirmed (see verifyAndFulfill).
async function createFlutterwaveCheckout(req, res, label, build) {
  try {
    const baseUrl = requireCheckoutConfiguration();
    const { title, currency, amount, fields } = await build();

    const order = await Order.create({
      user: req.user._id,
      provider: "flutterwave",
      amount,
      currency,
      providerReference: `9tel-${crypto.randomUUID()}`,
      status: "pending",
      ...fields,
    });

    const response = await axios.post(
      "https://api.flutterwave.com/v3/payments",
      {
        tx_ref: order.providerReference,
        amount: String(amount),
        currency,
        redirect_url: buildReturnUrl(baseUrl),
        customer: {
          email: req.user.email || `${req.user._id}@guest.9tel.app`,
          name: req.user.fullName || "9tel user",
        },
        customizations: { title },
        // Flutterwave Standard's checkout controls. These keep an abandoned
        // hosted link from being usable indefinitely while still allowing a
        // few legitimate card/OTP retries.
        configurations: { session_duration: 30, max_retry_attempt: 5 },
        meta: { orderId: order._id.toString() },
      },
      {
        timeout: 15000,
        headers: {
          Authorization: "Bearer " + process.env.FLW_SECRET_KEY,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      }
    );

    const paymentLink = validHostedCheckoutUrl(response.data?.data?.link);
    if (response.data?.status !== "success" || !paymentLink) {
      throw providerError(sanitizeProviderMessage(response.data?.message) || "Flutterwave didn't return a checkout link. Please try again.");
    }

    return res.status(200).json({ orderId: order._id, url: paymentLink });
  } catch (error) {
    return respondToPaymentInitError(res, label, error);
  }
}

// GET /api/v1/payments/prices — the NGN price of every product exactly as
// checkout would charge it right now, so the app displays the same amount
// that's actually charged. `rate` is null when FX isn't available and the
// fixed fallback prices are in effect.
exports.getPrices = async (req, res) => {
  const ngn = (usd, fallback) => usdToNgn(usd, fallback);
  const entries = async (table, usdOf, fallbackOf) =>
    Object.fromEntries(await Promise.all(Object.entries(table).map(async ([id, item]) => [id, await ngn(usdOf(item), fallbackOf(item))])));
  return res.status(200).json({
    rate: await getUsdToNgnRate(),
    ngn: {
      airbundles: await entries(AIRBUNDLES, (b) => b.priceUsd, (b) => b.priceNgn),
      creditPacks: await entries(CREDIT_PACKS, (p) => p.priceUsdCents / 100, (p) => p.priceNgn),
      number: await ngn(NUMBER_PRICE.USD, NUMBER_PRICE.NGN),
      esim: Object.fromEntries(await Promise.all(ESIM_PLANS.map(async (plan) => [plan.id, await ngn(plan.priceUsd, plan.priceNgnFallback)]))),
    },
  });
};

// POST /api/v1/payments/flutterwave/create-session  { countryCode, currency }
exports.createFlutterwaveSession = (req, res) =>
  createFlutterwaveCheckout(req, res, "Unable to create Flutterwave session:", async () => {
    const countryCode = String(req.body?.countryCode || "").toUpperCase();
    assertValidCountryCode(countryCode);
    const currency = resolveCurrency(req.body?.currency);
    return { title: `9tel phone number (${countryCode})`, currency, amount: await priceIn(currency, NUMBER_PRICE.USD, NUMBER_PRICE.NGN), fields: { countryCode } };
  });

// POST /api/v1/payments/flutterwave/create-credits-session  { packId, currency }
// Prepaid top-up — adds to creditsBalanceCents (see controllers/credits)
// instead of provisioning a number; fulfilled by fulfillCreditsOrder.
exports.createCreditsFlutterwaveSession = (req, res) =>
  createFlutterwaveCheckout(req, res, "Unable to create Flutterwave credits session:", async () => {
    const pack = resolveCreditPack(req.body?.packId);
    const currency = resolveCurrency(req.body?.currency);
    return {
      title: "9tel Prepaid credits",
      currency,
      amount: await priceIn(currency, pack.priceUsdCents / 100, pack.priceNgn),
      fields: { kind: "credits", creditsCents: pack.creditsCents },
    };
  });

// POST /api/v1/payments/flutterwave/create-airbundle-session  { bundleId, currency }
// Airbundle — a selectable minute bundle with ad-free 9tel-to-9tel calling;
// fulfilled by fulfillAirbundleOrder.
exports.createAirbundleFlutterwaveSession = (req, res) =>
  createFlutterwaveCheckout(req, res, "Unable to create Flutterwave Airbundle session:", async () => {
    const bundle = resolveAirbundle(req.body?.bundleId);
    const currency = resolveCurrency(req.body?.currency);
    return {
      title: `9tel Airbundle (${bundle.minutes.toLocaleString("en-US")} minutes)`,
      currency,
      amount: await priceIn(currency, bundle.priceUsd, bundle.priceNgn),
      fields: { kind: "airbundle", bundleMinutes: bundle.minutes, premiumDays: AIRBUNDLE_PERIOD_DAYS },
    };
  });

// POST /api/v1/payments/flutterwave/create-esim-session  { planId, currency }
// eSIM data plan — fulfilled by fulfillEsimOrder.
exports.createEsimFlutterwaveSession = (req, res) =>
  createFlutterwaveCheckout(req, res, "Unable to create Flutterwave eSIM session:", async () => {
    const plan = resolveEsimPlan(req.body?.planId);
    const currency = resolveCurrency(req.body?.currency);
    return {
      title: `9tel eSIM (${plan.country} ${plan.dataGB}GB, ${plan.validityDays} days)`,
      currency,
      amount: await priceIn(currency, plan.priceUsd, plan.priceNgnFallback),
      fields: { kind: "esim", esimPlanId: plan.id },
    };
  });

// Independently re-verifies a transaction with Flutterwave's own /verify
// endpoint — the amount/status in a webhook body or redirect query string
// is never trusted — and only fulfills the order if the verified
// transaction is successful, matches our tx_ref, and covers the order's
// amount in its currency. Idempotent: webhook redeliveries and the
// redirect-return both call this safely.
async function verifyAndFulfill(txRef, transactionId) {
  const numericTransactionId = Number(transactionId); // Flutterwave transaction ids are numeric
  if (!Number.isSafeInteger(numericTransactionId) || numericTransactionId <= 0) return null;
  const order = await Order.findOne({ providerReference: txRef, provider: "flutterwave" });
  if (!order) return null;

  const verifyResponse = await axios.get(`https://api.flutterwave.com/v3/transactions/${numericTransactionId}/verify`, {
    headers: { Authorization: "Bearer " + process.env.FLW_SECRET_KEY },
  });
  const verified = verifyResponse.data?.data;
  const amountMatches = verified && Number(verified.amount) >= order.amount && verified.currency === order.currency;
  const referenceMatches = verified && verified.tx_ref === order.providerReference;

  if (verified?.status === "successful" && amountMatches && referenceMatches) {
    // Atomically claim the order before fulfilling, so a webhook and the
    // return page verifying the same payment at the same moment can't both
    // fulfill it (double-crediting). The transaction id is recorded here
    // too — refunds need it.
    const claimed = await Order.findOneAndUpdate(
      { _id: order._id, status: { $in: ["pending", "cancelled", "failed"] } },
      { status: "processing", providerChargeId: String(numericTransactionId) },
      { new: true }
    );
    if (claimed) {
      try {
        await fulfillOrder(claimed);
      } catch (error) {
        // Unexpected failure (the fulfill helpers handle their own errors
        // and refunds) — release the claim so a webhook redelivery can
        // retry instead of leaving a paid order stuck in "processing".
        await Order.updateOne({ _id: claimed._id, status: "processing" }, { status: "pending" });
        throw error;
      }
    }
    return claimed || order;
  } else if (verified?.status === "failed" && (order.status === "pending" || order.status === "cancelled")) {
    // Only an explicit terminal failure from Flutterwave counts — a
    // transaction that is still processing stays pending so a later
    // successful webhook can still fulfill it.
    order.status = "failed";
    await order.save();
  }
  return order;
}

// POST /api/v1/payments/flutterwave/webhook
// Authenticated by the verif-hash header, a shared secret you set once in
// the Flutterwave dashboard — this is a plain string compare, not a
// cryptographic signature. Because of that (and because a webhook body can
// be forged by anyone who learns or guesses it), the payload is never
// trusted — see verifyAndFulfill.
exports.flutterwaveWebhook = async (req, res) => {
  try {
    const receivedHash = req.headers["verif-hash"];
    if (!receivedHash || receivedHash !== process.env.FLW_SECRET_HASH) {
      return res.status(401).send("Invalid signature");
    }

    const txRef = req.body?.data?.tx_ref;
    const transactionId = req.body?.data?.id;
    if (txRef && transactionId) await verifyAndFulfill(String(txRef), transactionId);
    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("Flutterwave webhook error:", error.response?.data || error.message);
    return res.status(200).json({ received: true }); // ack regardless so Flutterwave doesn't hammer retries on our own bug
  }
};

// The page Flutterwave redirects the browser to after checkout, with
// ?status=successful|completed|cancelled|failed&tx_ref=…&transaction_id=….
// Fulfillment normally happens via the webhook above (reliable even if the
// person closes the tab early); this page additionally records a
// cancellation, and re-verifies a reported success with Flutterwave itself
// so a delayed webhook doesn't leave the person waiting. The query string
// is only ever used to look things up — never trusted for amount/status.
exports.paymentReturnPage = async (req, res) => {
  const reported = String(req.query?.status || "");
  const txRef = typeof req.query?.tx_ref === "string" ? req.query.tx_ref : null;
  const transactionId = typeof req.query?.transaction_id === "string" ? req.query.transaction_id : null;
  let outcome = reported === "cancelled" ? "cancelled" : reported === "failed" ? "failed" : "completed";

  try {
    if (outcome === "cancelled" && txRef) {
      await Order.updateOne({ providerReference: txRef, provider: "flutterwave", status: "pending" }, { status: "cancelled" });
    } else if (outcome === "completed" && txRef && transactionId) {
      const order = await verifyAndFulfill(txRef, transactionId);
      if (order && order.status === "failed") outcome = "failed";
    }
  } catch (error) {
    console.error("Payment return handling error:", error.response?.data || error.message);
  }

  const copy = {
    cancelled: ["Payment cancelled", "Nothing was charged. You can return to the 9tel app and try again anytime."],
    failed: ["Payment didn't go through", "Nothing was charged. You can return to the 9tel app and try again."],
    completed: ["Thanks!", "You can return to the 9tel app now."],
  }[outcome];
  res.status(200).type("html").send(`<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head>
    <body style="font-family: -apple-system, sans-serif; text-align:center; padding-top:80px; background:#211B59; color:#fff;">
      <h2>${copy[0]}</h2>
      <p>${copy[1]}</p>
    </body></html>`);
};

// GET /api/v1/payments/orders/:id — the app polls this while showing
// "processing your payment", since fulfillment happens asynchronously via
// webhook, not synchronously in response to the checkout redirect.
exports.getOrderStatus = async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
  if (!order) return res.status(404).json({ message: "Order not found" });
  return res.status(200).json({
    status: order.status,
    kind: order.kind,
    phoneNumber: order.fulfilledPhoneNumber,
    creditsCents: order.fulfilledCreditsCents,
    esimId: order.fulfilledEsimId ? String(order.fulfilledEsimId) : undefined,
    premiumDays: order.fulfilledPremiumDays || undefined,
    airbundleMinutes: order.kind === "airbundle" && order.fulfilledPremiumDays ? order.bundleMinutes : undefined,
  });
};

exports._private = { fulfillOrder, fulfillCreditsOrder, fulfillAirbundleOrder, CREDIT_PACKS, AIRBUNDLES };
