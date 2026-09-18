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

const app = express();

// Middleware
app.use(express.json());
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

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
