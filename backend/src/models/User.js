const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    // Guest accounts are identified by an app-generated installation id rather
    // than an email/password pair. `sparse` keeps this optional for members
    // who register with the normal sign-up flow.
    guestDeviceId: { type: String, unique: true, sparse: true },
    isGuest: { type: Boolean, default: false },
    password: {
      type: String,
      required: true,
    },
    score: { type: Number, default: 0 },
    usdBalance: { type: Number, default: 0 },
    profilePicture: String,
    avatar: Number,
    tokens: [{ type: Object }],
    notification_token: String,
    userType: {
      type: String,
      enum: ["admin", "user"],
      default: "user",
    },
    country: String,
    language: String,
    isPremium: { type: Boolean, default: false },
    premiumUntil: Date,
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    resetCode: String,
    resetCodeExpires: Date,
    lastLoginDate: {
      type: Date,
      default: null,
    },
    // Cosmetics (bought with WizPoints/score)
    ownedCosmetics: { type: [String], default: [] },
    equippedFrame: { type: String, default: null },
    equippedSkin: { type: String, default: null },
    // Referrals
    referralCode: { type: String, unique: true, sparse: true },
    referredBy: { type: String, default: null }, // referral code used at signup
    referralCount: { type: Number, default: 0 },
    // Anti-grind: how much WizPoints earned today (UTC)
    dailyEarned: {
      date: { type: String, default: null }, // YYYY-MM-DD
      amount: { type: Number, default: 0 },
    },
    // Idle/offline earning: last time the player collected idle WizPoints
    lastIdleCollected: { type: Date, default: null },
  },

  { timestamps: true }
);

// Hash password before saving user
userSchema.pre("save", async function () {
  if (this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, 8);
  }
});

userSchema.methods.comparePassword = async function (password) {
  if (!password) throw new Error("Password is missing, cannot compare");

  try {
    const result = await bcrypt.compare(password, this.password);
    return result;
  } catch (error) {
    console.log("Error while comparing password", error.message);
  }
};

userSchema.statics.isThisEmailInUse = async function (email) {
  if (!email) throw new Error("Invalid email");
  try {
    const user = await this.findOne({ email });
    if (user) return false;
    return true;
  } catch (error) {
    console.log("Eroor in side isthisemail", error.message);
    return false;
  }
};
/*const crypto = require("crypto");

userSchema.methods.generateResetToken = function () {
  const token = crypto.randomBytes(20).toString("hex");
  this.resetPasswordToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
  this.resetPasswordExpires = Date.now() + 3600000; // 1 hour
  return token;
};*/

const User = mongoose.model("User", userSchema);
module.exports = User;
