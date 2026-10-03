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
    // The user's assigned 9tel number (E.164). Populated by
    // POST /api/v1/numbers/provision. Unset until they claim one.
    phoneNumber: { type: String, unique: true, sparse: true },
    // Number access is a paid 30-day entitlement, renewed through Flutterwave.
    phoneNumberExpiresAt: { type: Date, default: null },
    // The user's own real phone number, used as their outbound caller ID
    // once verified. Distinct from phoneNumber above (that's a Twilio
    // number this system owns; this is a number they already had before
    // ever using 9tel) — see controllers/callerid.
    verifiedCallerId: { type: String, unique: true, sparse: true },
    // Caller-ID verification is changed only by controllers/callerid. A
    // pending attempt is a server-side, one-time session bound to its
    // requested number: a code spoken on the provider's possession call and
    // entered in the app. Only a salted HMAC of the code is stored, never the
    // code. Failed/expired attempts can be retried but never dial using the
    // unverified number.
    callerIdStatus: { type: String, enum: ["unverified", "pending", "verified", "failed", "expired"], default: "unverified" },
    callerIdVerificationMethod: { type: String, enum: ["twilio", "spoken_code", "developer_test"], default: null },
    callerIdVerificationNumber: { type: String, default: null },
    callerIdLastAttemptedNumber: { type: String, default: null },
    callerIdVerificationCodeHash: { type: String, default: null },
    // Random, non-secret id of the current session. Doubles as the
    // correlation id in logs, responses and the provider status callback.
    callerIdVerificationSessionId: { type: String, default: null },
    callerIdVerificationAttempts: { type: Number, default: 0 },
    callerIdVerificationCallSid: { type: String, default: null },
    callerIdLastRequestedAt: { type: Date, default: null },
    callerIdVerificationExpiresAt: { type: Date, default: null },
    isPremium: { type: Boolean, default: false },
    premiumUntil: Date,
    // Minutes purchased through Airbundle bundles (see controllers/payments).
    airbundleMinutes: { type: Number, default: 0 },
    // Prepaid balance, in whole US cents, for 9tel-to-carrier calls.
    // Only ever changed here (a) by creditsOrder fulfillment, once a
    // top-up payment is confirmed (see controllers/payments), and (b) by
    // controllers/voice's outgoing-call status webhook, which deducts the
    // authoritative, Twilio-reported duration of a completed carrier call.
    // The mobile app only ever reads this value — it must never derive or
    // apply its own deduction.
    creditsBalanceCents: { type: Number, default: 0 },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    resetCode: String,
    resetCodeExpires: Date,
    lastLoginDate: {
      type: Date,
      default: null,
    },
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
