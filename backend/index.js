const dotenv = require("dotenv");
dotenv.config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");

const db = require("./src/config/connection");

const auth = require("./src/routes/auth");
const user = require("./src/routes/user");
const userLevels = require("./src/routes/userPlantLevel");
const payment = require("./src/routes/payment");
const earning = require("./src/routes/earning");
const withdrawal = require("./src/routes/withdrawal");
const notification = require("./src/routes/notification");
const leaderboard = require("./src/routes/leaderboard");
const gameState = require("./src/routes/gameState");
const externalAPIs = require("./src/routes/external-apis");
const cosmetics = require("./src/routes/cosmetics");
const referral = require("./src/routes/referral");
const shorts = require("./src/routes/shorts");

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
// Routes
app.use("/api/v1/auth", auth);
app.use("/api/v1/user", user);
app.use("/api/v1/user-level", userLevels);
app.use("/api/v1/payment", payment);
app.use("/api/v1/earning", earning);
app.use("/api/v1/withdrawal", withdrawal);
app.use("/api/v1/notification", notification);
app.use("/api/v1/leaderboard", leaderboard);
app.use("/api/v1/game-state", gameState);
app.use("/api/v1/external-apis", externalAPIs);
app.use("/api/v1/cosmetics", cosmetics);
app.use("/api/v1/referral", referral);
app.use("/api/v1/shorts", shorts);

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
