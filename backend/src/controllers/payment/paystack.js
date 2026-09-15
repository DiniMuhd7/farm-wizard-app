const paystackSecretKey = process.env.PAYSTACK_SECRET; //"sk_test_xxxxxxxxxxxxxxxxx";

const initializeTransaction = async (req, res) => {
  try {
    const response = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email: req.body.email,
        amount: req.body.amount * 100, // amount in kobo
      },
      {
        headers: {
          Authorization: `Bearer ${paystackSecretKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    res.json(response.data);
  } catch (error) {
    res.status(400).json({ error: error.response?.data || error.message });
  }
};

module.exports = { initializeTransaction };
