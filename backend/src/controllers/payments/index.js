const axios = require("axios");
const crypto = require("crypto");
const Order = require("../../models/Order");
const { purchaseAndAssignNumber } = require("../numbers");

const COUNTRY_CODE = /^[A-Z]{2}$/;
// Price in the smallest currency unit (cents), used for Stripe.
const NUMBER_PRICE_USD_CENTS = Number(process.env.NUMBER_PRICE_USD_CENTS || 500); // $5.00 default
// Price in the main currency unit (naira, not kobo — that's how Flutterwave's
// own Standard API expects it), used for Flutterwave.
const NUMBER_PRICE_NGN = Number(process.env.NUMBER_PRICE_NGN || 3000); // ₦3,000 default

// Credit packs offered for the Pay As You Go top-up flow. Keyed by a short
// id the mobile app selects from (see constants/creditPacks.ts, which
// mirrors these exact cents amounts so the price shown before checkout
// matches what's actually charged). `creditsCents` is how much balance is
// added; `priceUsdCents`/`priceNgn` is what's actually charged, intentionally
// equal to creditsCents today (no markup) but kept distinct from it so a
// promotional or region-specific price could diverge later without
// changing how much credit a pack grants.
const CREDIT_PACKS = {
  "500": { creditsCents: 500, priceUsdCents: 500, priceNgn: 3000 },
  "1000": { creditsCents: 1000, priceUsdCents: 1000, priceNgn: 6000 },
  "2500": { creditsCents: 2500, priceUsdCents: 2500, priceNgn: 15000 },
};

// Premium — ad-free 9tel-to-9tel calling. A single monthly period, billed
// as a one-off Checkout payment rather than Stripe/Flutterwave's own
// recurring-subscription primitives (no renewal reminders or recurring
// webhooks yet) — see constants/callingPlans.ts' PREMIUM_PLAN on the mobile
// side, which mirrors this exact price.
const PREMIUM_PRICE_USD_CENTS = Number(process.env.PREMIUM_PRICE_USD_CENTS || 499); // $4.99/mo default
const PREMIUM_PRICE_NGN = Number(process.env.PREMIUM_PRICE_NGN || 2500); // ₦2,500/mo default
const PREMIUM_PERIOD_DAYS = 30;

function stripeClient() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("Stripe is not configured.");
  const Stripe = require("stripe");
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

async function refundStripe(order) {
  const stripe = stripeClient();
  if (!order.providerChargeId) throw new Error("No PaymentIntent recorded for this order.");
  await stripe.refunds.create({ payment_intent: order.providerChargeId });
}

async function refundFlutterwave(order) {
  if (!order.providerChargeId) throw new Error("No transaction id recorded for this order.");
  await axios.post(
    `https://api.flutterwave.com/v3/transactions/${order.providerChargeId}/refund`,
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
  if (order.provider === "stripe") await refundStripe(order);
  else await refundFlutterwave(order);
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

// Runs after a kind: "premium" payment is confirmed — extends the user's
// premiumUntil by PREMIUM_PERIOD_DAYS from either now, or their current
// premiumUntil if they're already Premium and it hasn't lapsed yet (so
// renewing early doesn't lose the remaining days already paid for).
async function fulfillPremiumOrder(order) {
  if (order.status === "paid" && order.fulfilledPremiumDays) return order.fulfilledPremiumDays; // already done — webhook redelivery
  try {
    const User = require("../../models/User");
    const user = await User.findById(order.user).select("premiumUntil");
    const now = Date.now();
    const base = user?.premiumUntil && new Date(user.premiumUntil).getTime() > now ? new Date(user.premiumUntil).getTime() : now;
    const premiumUntil = new Date(base + order.premiumDays * 24 * 60 * 60 * 1000);
    await User.findByIdAndUpdate(order.user, { isPremium: true, premiumUntil });
    order.status = "paid";
    order.fulfilledPremiumDays = order.premiumDays;
    await order.save();
    return order.premiumDays;
  } catch (fulfillmentError) {
    console.error(`Premium fulfillment failed for order ${order._id} after payment succeeded:`, fulfillmentError.message);
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
  if (order.kind === "credits") return fulfillCreditsOrder(order);
  if (order.kind === "premium") return fulfillPremiumOrder(order);
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

// POST /api/v1/payments/stripe/create-session  { countryCode }
exports.createStripeSession = async (req, res) => {
  try {
    const countryCode = String(req.body?.countryCode || "").toUpperCase();
    if (!COUNTRY_CODE.test(countryCode)) {
      return res.status(400).json({ message: "countryCode must be a 2-letter ISO country code." });
    }

    const stripe = stripeClient();
    const order = await Order.create({
      user: req.user._id,
      provider: "stripe",
      countryCode,
      amount: NUMBER_PRICE_USD_CENTS,
      currency: "usd",
      providerReference: "pending", // replaced with the real session id right after
      status: "pending",
    });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: `9tel phone number (${countryCode})` },
            unit_amount: NUMBER_PRICE_USD_CENTS,
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.PUBLIC_BASE_URL.replace(/\/$/, "")}/api/v1/payments/return?status=success`,
      cancel_url: `${process.env.PUBLIC_BASE_URL.replace(/\/$/, "")}/api/v1/payments/return?status=cancelled`,
      client_reference_id: order._id.toString(),
      metadata: { orderId: order._id.toString() },
    });

    order.providerReference = session.id;
    await order.save();

    return res.status(200).json({ orderId: order._id, url: session.url });
  } catch (error) {
    console.error("Unable to create Stripe session:", error.message);
    return res.status(503).json({ message: "Unable to start payment right now. Please try again later." });
  }
};

function resolveCreditPack(packId) {
  const pack = CREDIT_PACKS[String(packId)];
  if (!pack) {
    const err = new Error("Choose a valid credits pack.");
    err.status = 400;
    throw err;
  }
  return pack;
}

// POST /api/v1/payments/stripe/create-credits-session  { packId }
// Pay As You Go top-up — mirrors createStripeSession above but for adding
// to creditsBalanceCents (see controllers/credits) instead of provisioning
// a number; the fulfillment branch for kind: "credits" is fulfillCreditsOrder.
exports.createCreditsStripeSession = async (req, res) => {
  try {
    const pack = resolveCreditPack(req.body?.packId);
    const stripe = stripeClient();
    const order = await Order.create({
      user: req.user._id,
      provider: "stripe",
      kind: "credits",
      creditsCents: pack.creditsCents,
      amount: pack.priceUsdCents,
      currency: "usd",
      providerReference: "pending", // replaced with the real session id right after
      status: "pending",
    });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: "9tel Pay As You Go credits" },
            unit_amount: pack.priceUsdCents,
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.PUBLIC_BASE_URL.replace(/\/$/, "")}/api/v1/payments/return?status=success`,
      cancel_url: `${process.env.PUBLIC_BASE_URL.replace(/\/$/, "")}/api/v1/payments/return?status=cancelled`,
      client_reference_id: order._id.toString(),
      metadata: { orderId: order._id.toString() },
    });

    order.providerReference = session.id;
    await order.save();

    return res.status(200).json({ orderId: order._id, url: session.url });
  } catch (error) {
    console.error("Unable to create Stripe credits session:", error.message);
    return res.status(error.status || 503).json({ message: error.status ? error.message : "Unable to start payment right now. Please try again later." });
  }
};

// POST /api/v1/payments/stripe/create-premium-session
// Premium — ad-free 9tel-to-9tel calling, one PREMIUM_PERIOD_DAYS period
// per order. The fulfillment branch for kind: "premium" is
// fulfillPremiumOrder, which extends premiumUntil rather than overwriting
// it, so renewing before the current period lapses doesn't lose days.
exports.createPremiumStripeSession = async (req, res) => {
  try {
    const stripe = stripeClient();
    const order = await Order.create({
      user: req.user._id,
      provider: "stripe",
      kind: "premium",
      premiumDays: PREMIUM_PERIOD_DAYS,
      amount: PREMIUM_PRICE_USD_CENTS,
      currency: "usd",
      providerReference: "pending", // replaced with the real session id right after
      status: "pending",
    });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: "9tel Premium (ad-free calling, 30 days)" },
            unit_amount: PREMIUM_PRICE_USD_CENTS,
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.PUBLIC_BASE_URL.replace(/\/$/, "")}/api/v1/payments/return?status=success`,
      cancel_url: `${process.env.PUBLIC_BASE_URL.replace(/\/$/, "")}/api/v1/payments/return?status=cancelled`,
      client_reference_id: order._id.toString(),
      metadata: { orderId: order._id.toString() },
    });

    order.providerReference = session.id;
    await order.save();

    return res.status(200).json({ orderId: order._id, url: session.url });
  } catch (error) {
    console.error("Unable to create Stripe premium session:", error.message);
    return res.status(503).json({ message: "Unable to start payment right now. Please try again later." });
  }
};

// POST /api/v1/payments/stripe/webhook — Twilio-style external
// authentication (Stripe's own signature, not a session token), so this
// must receive the RAW request body — see backend/index.js, where this
// route is registered with express.raw() ahead of the global express.json()
// parser. Stripe would otherwise have already had its body mutated/parsed
// by the time constructEvent() tries to verify it, and verification would
// always fail.
exports.stripeWebhook = async (req, res) => {
  try {
    const stripe = stripeClient();
    const signature = req.headers["stripe-signature"];
    const event = stripe.webhooks.constructEvent(req.body, signature, process.env.STRIPE_WEBHOOK_SECRET);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const orderId = session.metadata?.orderId;
      if (orderId) {
        const order = await Order.findById(orderId);
        if (order && order.provider === "stripe") {
          // Needed up front, not just on success — fulfillOrder's own
          // failure path issues a refund against this id if the Twilio
          // purchase fails after payment already succeeded.
          if (session.payment_intent) {
            order.providerChargeId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent.id;
            await order.save();
          }
          await fulfillOrder(order);
        }
      }
    }
    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("Stripe webhook rejected:", error.message);
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }
};

// POST /api/v1/payments/flutterwave/create-session  { countryCode }
exports.createFlutterwaveSession = async (req, res) => {
  try {
    if (!process.env.FLW_SECRET_KEY) throw new Error("Flutterwave is not configured.");
    const countryCode = String(req.body?.countryCode || "").toUpperCase();
    if (!COUNTRY_CODE.test(countryCode)) {
      return res.status(400).json({ message: "countryCode must be a 2-letter ISO country code." });
    }

    const order = await Order.create({
      user: req.user._id,
      provider: "flutterwave",
      countryCode,
      amount: NUMBER_PRICE_NGN,
      currency: "NGN",
      providerReference: `9tel-${crypto.randomUUID()}`,
      status: "pending",
    });

    const response = await axios.post(
      "https://api.flutterwave.com/v3/payments",
      {
        tx_ref: order.providerReference,
        amount: String(NUMBER_PRICE_NGN),
        currency: "NGN",
        redirect_url: `${process.env.PUBLIC_BASE_URL.replace(/\/$/, "")}/api/v1/payments/return`,
        customer: {
          email: req.user.email || `${req.user._id}@guest.9tel.app`,
          name: req.user.fullName || "9tel user",
        },
        customizations: { title: `9tel phone number (${countryCode})` },
        meta: { orderId: order._id.toString() },
      },
      { headers: { Authorization: `Bearer ${process.env.FLW_SECRET_KEY}` } }
    );

    if (response.data?.status !== "success" || !response.data?.data?.link) {
      throw new Error("Flutterwave did not return a payment link.");
    }

    return res.status(200).json({ orderId: order._id, url: response.data.data.link });
  } catch (error) {
    console.error("Unable to create Flutterwave session:", error.response?.data || error.message);
    return res.status(503).json({ message: "Unable to start payment right now. Please try again later." });
  }
};

// POST /api/v1/payments/flutterwave/create-credits-session  { packId }
// Pay As You Go top-up — mirrors createFlutterwaveSession above but for
// adding to creditsBalanceCents (see controllers/credits) instead of
// provisioning a number.
exports.createCreditsFlutterwaveSession = async (req, res) => {
  try {
    if (!process.env.FLW_SECRET_KEY) throw new Error("Flutterwave is not configured.");
    const pack = resolveCreditPack(req.body?.packId);

    const order = await Order.create({
      user: req.user._id,
      provider: "flutterwave",
      kind: "credits",
      creditsCents: pack.creditsCents,
      amount: pack.priceNgn,
      currency: "NGN",
      providerReference: `9tel-${crypto.randomUUID()}`,
      status: "pending",
    });

    const response = await axios.post(
      "https://api.flutterwave.com/v3/payments",
      {
        tx_ref: order.providerReference,
        amount: String(pack.priceNgn),
        currency: "NGN",
        redirect_url: `${process.env.PUBLIC_BASE_URL.replace(/\/$/, "")}/api/v1/payments/return`,
        customer: {
          email: req.user.email || `${req.user._id}@guest.9tel.app`,
          name: req.user.fullName || "9tel user",
        },
        customizations: { title: "9tel Pay As You Go credits" },
        meta: { orderId: order._id.toString() },
      },
      { headers: { Authorization: "Bearer " + process.env.FLW_SECRET_KEY } }
    );

    if (response.data?.status !== "success" || !response.data?.data?.link) {
      throw new Error("Flutterwave did not return a payment link.");
    }

    return res.status(200).json({ orderId: order._id, url: response.data.data.link });
  } catch (error) {
    console.error("Unable to create Flutterwave credits session:", error.response?.data || error.message);
    return res.status(error.status || 503).json({ message: error.status ? error.message : "Unable to start payment right now. Please try again later." });
  }
};

// POST /api/v1/payments/flutterwave/create-premium-session
// Premium — ad-free 9tel-to-9tel calling. Mirrors
// createPremiumStripeSession above; see its own comment for the
// fulfillment/renewal behavior.
exports.createPremiumFlutterwaveSession = async (req, res) => {
  try {
    if (!process.env.FLW_SECRET_KEY) throw new Error("Flutterwave is not configured.");

    const order = await Order.create({
      user: req.user._id,
      provider: "flutterwave",
      kind: "premium",
      premiumDays: PREMIUM_PERIOD_DAYS,
      amount: PREMIUM_PRICE_NGN,
      currency: "NGN",
      providerReference: `9tel-${crypto.randomUUID()}`,
      status: "pending",
    });

    const response = await axios.post(
      "https://api.flutterwave.com/v3/payments",
      {
        tx_ref: order.providerReference,
        amount: String(PREMIUM_PRICE_NGN),
        currency: "NGN",
        redirect_url: `${process.env.PUBLIC_BASE_URL.replace(/\/$/, "")}/api/v1/payments/return`,
        customer: {
          email: req.user.email || `${req.user._id}@guest.9tel.app`,
          name: req.user.fullName || "9tel user",
        },
        customizations: { title: "9tel Premium (ad-free calling, 30 days)" },
        meta: { orderId: order._id.toString() },
      },
      { headers: { Authorization: "Bearer " + process.env.FLW_SECRET_KEY } }
    );

    if (response.data?.status !== "success" || !response.data?.data?.link) {
      throw new Error("Flutterwave did not return a payment link.");
    }

    return res.status(200).json({ orderId: order._id, url: response.data.data.link });
  } catch (error) {
    console.error("Unable to create Flutterwave premium session:", error.response?.data || error.message);
    return res.status(503).json({ message: "Unable to start payment right now. Please try again later." });
  }
};

// POST /api/v1/payments/flutterwave/webhook
// Authenticated by the verif-hash header, a shared secret you set once in
// the Flutterwave dashboard — this is a plain string compare, not a
// cryptographic signature the way Stripe's or Twilio's is. Because of that
// (and because a webhook body can be forged by anyone who learns or guesses
// it), the amount/status in the webhook payload itself is never trusted —
// after passing the hash check, the transaction is independently
// re-verified with Flutterwave's own /verify endpoint before anything is
// fulfilled.
exports.flutterwaveWebhook = async (req, res) => {
  try {
    const receivedHash = req.headers["verif-hash"];
    if (!receivedHash || receivedHash !== process.env.FLW_SECRET_HASH) {
      return res.status(401).send("Invalid signature");
    }

    const txRef = req.body?.data?.tx_ref;
    const transactionId = req.body?.data?.id;
    if (!txRef || !transactionId) return res.status(200).json({ received: true }); // nothing we recognize — ack anyway so Flutterwave stops retrying

    const order = await Order.findOne({ providerReference: txRef, provider: "flutterwave" });
    if (!order) return res.status(200).json({ received: true });

    const verifyResponse = await axios.get(`https://api.flutterwave.com/v3/transactions/${transactionId}/verify`, {
      headers: { Authorization: `Bearer ${process.env.FLW_SECRET_KEY}` },
    });
    const verified = verifyResponse.data?.data;
    const amountMatches = verified && Number(verified.amount) >= order.amount && verified.currency === order.currency;
    const referenceMatches = verified && verified.tx_ref === order.providerReference;

    if (verified?.status === "successful" && amountMatches && referenceMatches) {
      // Needed up front — see the same note in the Stripe webhook above.
      order.providerChargeId = String(transactionId);
      await order.save();
      await fulfillOrder(order);
    } else {
      order.status = "failed";
      await order.save();
    }
    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("Flutterwave webhook error:", error.response?.data || error.message);
    return res.status(200).json({ received: true }); // ack regardless so Flutterwave doesn't hammer retries on our own bug
  }
};

// A plain page Stripe/Flutterwave redirect the browser to after checkout —
// this is NOT how fulfillment happens (that's the webhooks above, which are
// reliable even if the person closes the tab early); it's purely "you can
// go back to the app now." Differentiates cancelled from completed: the
// previous version showed the same "Thanks!" message either way, which is
// actively misleading on a cancellation — nothing was charged, and the copy
// shouldn't imply otherwise.
exports.paymentReturnPage = (req, res) => {
  const cancelled = req.query?.status === "cancelled";
  const heading = cancelled ? "Payment cancelled" : "Thanks!";
  const body = cancelled
    ? "Nothing was charged. You can return to the 9tel app and try again anytime."
    : "You can return to the 9tel app now.";
  res.status(200).type("html").send(`<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head>
    <body style="font-family: -apple-system, sans-serif; text-align:center; padding-top:80px; background:#211B59; color:#fff;">
      <h2>${heading}</h2>
      <p>${body}</p>
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
    premiumDays: order.fulfilledPremiumDays,
  });
};

exports._private = { fulfillOrder, fulfillCreditsOrder, fulfillPremiumOrder, CREDIT_PACKS };
