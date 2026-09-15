const { default: axios } = require("axios");

// Get Access Token
async function generateAccessToken() {
  const response = await axios({
    url: `${process.env.PAYPAL_API}/v1/oauth2/token`,
    method: "post",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    auth: {
      username: process.env.PAYPAL_CLIENT_ID,
      password: process.env.PAYPAL_SECRET,
    },
    data: "grant_type=client_credentials",
  });

  return response.data.access_token;
}

// Create Order
const createOrder =
  ("/create-order",
  async (req, res) => {
    const { amount } = req.body;

    if (!amount || isNaN(amount)) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    const accessToken = await generateAccessToken();

    const order = {
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: "USD",
            value: amount.toFixed(2),
          },
        },
      ],
      application_context: {
        return_url: "https://abbas.com/return",
        cancel_url: "https://abassani.com/cancel",
      },
    };

    try {
      const response = await axios.post(
        `${process.env.PAYPAL_API}/v2/checkout/orders`,
        order,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const approvalUrl = response.data.links.find(
        (link) => link.rel === "approve"
      )?.href;
      res.json({ id: response.data.id, approvalUrl });
    } catch (err) {
      console.error("PayPal error:", err.response?.data || err.message);
      res.status(500).json({ error: "Failed to create PayPal order" });
    }
  });

const captureOrder = async (req, res) => {
  // "/capture-order/:orderId",
  const { orderId } = req.params;
  const accessToken = await generateAccessToken();

  try {
    const captureRes = await axios.post(
      `${process.env.PAYPAL_API}/v2/checkout/orders/${orderId}/capture`,
      {},
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const status = captureRes.data.status;

    if (status === "COMPLETED") {
      // 💰 Success — do post-payment logic here (e.g. send email, unlock product)
      res.json({ success: true, capture: captureRes.data });
    } else {
      res
        .status(400)
        .json({ success: false, message: "Payment not completed" });
    }
  } catch (err) {
    console.error("Capture error:", err.response?.data || err.message);
    res.status(500).json({ error: "Failed to capture payment" });
  }
};

module.exports = { createOrder, captureOrder };
