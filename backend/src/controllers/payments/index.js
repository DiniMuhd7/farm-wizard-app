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
async function fulfillOrder(order) {
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
      if (order.provider === "stripe") await refundStripe(order);
      else await refundFlutterwave(order);
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
    phoneNumber: order.fulfilledPhoneNumber,
  });
};
