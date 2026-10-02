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
const credits = require("./src/routes/credits");
const rewards = require("./src/routes/rewards");

const app = express();

// Render (and most PaaS hosts) terminates TLS at a reverse proxy in front of
// this process, so every request Express actually sees arrives from that
// proxy's IP, with the real client IP only available via `X-Forwarded-For`.
// Without telling Express to trust that one hop, `req.ip` resolves to the
// proxy's own address for *every* request — collapsing the per-IP
// `/api/v1/numbers/available-countries` rate limiter (see routes/numbers.js)
// into a single shared bucket for the entire deployment instead of one per
// user, so the whole app's traffic could exhaust it and start getting 429s
// almost immediately. express-rate-limit also hard-warns
// (ERR_ERL_UNEXPECTED_X_FORWARDED_FOR) whenever it sees `X-Forwarded-For`
// with `trust proxy` left at its default `false`. `1` trusts exactly one
// hop — the platform's own proxy — without trusting arbitrary
// client-supplied `X-Forwarded-For` values (which `true` would).
app.set("trust proxy", 1);

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
app.use("/api/v1/credits", credits);
app.use("/api/v1/rewards", rewards);

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
