const dotenv = require("dotenv");
dotenv.config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");

const db = require("./src/config/connection");

const auth = require("./src/routes/auth");
const user = require("./src/routes/user");
const externalAPIs = require("./src/routes/external-apis");
const voice = require("./src/routes/voice");
const numbers = require("./src/routes/numbers");
const calls = require("./src/routes/calls");
const callerid = require("./src/routes/callerid");
const payments = require("./src/routes/payments");
const { stripeWebhook } = require("./src/controllers/payments");

const app = express();

// Stripe's webhook signature is computed over the exact raw request bytes —
// if express.json() (below) parses and re-serializes the body first, the
// bytes stripe.webhooks.constructEvent() sees will never byte-for-byte
// match what Stripe actually signed, and verification will always fail.
// This route MUST be registered before the global express.json() call, with
// its own express.raw() middleware applying only to this one path — once a
// body stream is consumed by one parser, no later middleware can re-read
// the original raw bytes.
app.post(
  "/api/v1/payments/stripe/webhook",
  express.raw({ type: "application/json" }),
  stripeWebhook
);

// Middleware
app.use(express.json());
// Twilio's own webhook requests — the Voice URL fetch for /outgoing and
// /incoming, and both <Dial action> status callbacks — are always sent as
// application/x-www-form-urlencoded, never JSON. Without a parser for that
// content type, req.body was an empty object for every one of those
// requests: twilioRequestIsValid() could never compute a matching
// signature (it signs off req.body's params), so every Twilio webhook to
// this server was being rejected with a 403 before ever reading `To` or
// reaching the <Dial> verb.
app.use(express.urlencoded({ extended: false }));
app.use(cors());
app.use(bodyParser.json());

// Serve static files from expo-translations folder
app.use(
  "/translations",
  express.static(path.join(__dirname, "./src/translations"))
);
app.use(
  "/terms-and-conditions",
  express.static(path.join(__dirname, "./terms-and-conditions"))
);
app.get("/app-ads.txt", (req, res) => {
  res.sendFile(path.join(__dirname, "app-ads.txt"));
});
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});
// Routes
app.use("/api/v1/auth", auth);
app.use("/api/v1/user", user);
app.use("/api/v1/external-apis", externalAPIs);
app.use("/api/v1/voice", voice);
app.use("/api/v1/numbers", numbers);
app.use("/api/v1/calls", calls);
app.use("/api/v1/callerid", callerid);
app.use("/api/v1/payments", payments);

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
