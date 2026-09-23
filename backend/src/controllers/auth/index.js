const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../../models/User");
const { goodResponse, badResponse } = require("../../utils/response");

const getUserInfo = (user) => ({
  fullName: user.fullName,
  email: user.email,
  userType: user.userType,
  country: user.country,
  language: user.language,
  isPremium: user.isPremium,
  status: user.status,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
  avatar: user.avatar || "",
  notification_token: user.notification_token || "",
  isGuest: user.isGuest === true,
  phoneNumber: user.phoneNumber || null,
  verifiedCallerId: user.verifiedCallerId || null,
});

const issueGuestSession = async (req, res) => {
  const deviceId = String(req.body?.deviceId || "").trim();
  const deviceName = String(req.body?.deviceName || "Guest").trim();

  // Keep the id suitable for an indexed database field and generated email.
  if (!/^[a-zA-Z0-9-]{8,80}$/.test(deviceId)) {
    return badResponse(res, "A valid guest device id is required", {}, 400);
  }

  try {
    let user = await User.findOne({ guestDeviceId: deviceId });

    if (!user) {
      const safeName = deviceName.replace(/[^a-zA-Z0-9 ]/g, "").trim().slice(0, 24);
      try {
        user = await User.create({
          fullName: `${safeName || "Guest"} Guest`,
          email: `guest-${deviceId.toLowerCase()}@farmwizard.app`,
          // Guests never use password authentication; a random value satisfies
          // the existing model while avoiding a client-stored credential.
          password: crypto.randomBytes(32).toString("hex"),
          country: "ng",
          language: "english",
          avatar: 1,
          guestDeviceId: deviceId,
          isGuest: true,
        });
      } catch (error) {
        // A second request from the same device can race the create above.
        if (error?.code !== 11000) throw error;
        user = await User.findOne({ guestDeviceId: deviceId });
        if (!user) throw error;
      }
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1d" });
    await User.findByIdAndUpdate(user._id, {
      $push: { tokens: { token, signedAt: Date.now().toString() } },
    });
    return goodResponse(res, "Guest session started", { user: getUserInfo(user), token }, 200);
  } catch (error) {
    console.error("Unable to start guest session", error);
    return badResponse(res, "Unable to start a guest session", {}, 500);
  }
};

const registerUser = async (req, res) => {
  const fullName = String(req.body?.fullName || "").trim();
  const email = String(req.body?.email || "").trim();
  const password = String(req.body?.password || "");
  const { country, language, avatar } = req.body || {};

  if (!fullName || !email || !password) {
    return badResponse(res, "All fields are required", {}, 400);
  }

  const userExists = await User.findOne({ email });
  if (userExists) {
    // Never echo the submitted password back, even on a routine
    // "already registered" response — it's still the same HTTP response
    // body a proxy, log aggregator, or error tracker downstream of this
    // API could capture in plaintext.
    return badResponse(res, "User already exists", { email, fullName }, 200);
  }

  try {
    const user = await User.create({
      fullName,
      email,
      password,
      country,
      language,
      avatar,
    });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });
    // getUserInfo(), not the raw Mongoose document — the raw document
    // includes the bcrypt password hash and the tokens array, neither of
    // which this response should ever carry.
    return goodResponse(
      res,
      "User created successfully, Login to continue",
      { user: getUserInfo(user), token },
      200
    );
  } catch (error) {
    console.log("error", error);
    return badResponse(res, "Error occured", { error: error.message }, 500);
  }
};

const loginUser = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return goodResponse(res, "All fields are required", {}, 400);
  }
  const user = await User.findOne({ email });
  if (user && (await user.comparePassword(password))) {
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    let oldTokens = user.tokens || [];

    if (oldTokens.length) {
      oldTokens = oldTokens.filter((t) => {
        const timeDiff = (Date.now() - parseInt(t.signedAt)) / 1000;
        if (timeDiff < 86400) {
          return t;
        }
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lastLoginDate = user.lastLoginDate && new Date(user.lastLoginDate) >= today
      ? user.lastLoginDate
      : new Date();

    await User.findByIdAndUpdate(user._id, {
      tokens: [...oldTokens, { token, signedAt: Date.now().toString() }],
      lastLoginDate,
    });
    const userInfo = getUserInfo(user);
    return goodResponse(
      res,
      "Login successfully",
      { user: userInfo, token },
      200
    );
  } else {
    return badResponse(res, "Invalid credentials", {}, 200);
    // return goodResponse(res, "Invalid credentials", {}, 401);
  }
};

const signOut = async (req, res) => {
  if (req.headers && req.headers.authorization) {
    const token = req.headers.authorization.split(" ")[1];
    if (!token) {
      return badResponse(res, "Authorization fail!", {}, 401);
    }

    const tokens = req.user.tokens;

    const newTokens = tokens.filter((t) => t.token !== token);

    await User.findByIdAndUpdate(req.user._id, { tokens: newTokens });
    return goodResponse(res, "SIgn out successfully", {}, 200);
  }
};

const getTokens = async (req, res) => {
  const users = await User.find({});

  return res.json({
    usersList: users.map((user) => ({
      id: user._id,
      name: user.fullName,
      email: user.email,
      notification_token: user.notification_token,
    })),
    tokenList: users.map((user) => user.notification_token),
    success: true,
    message: "Users list generated successfully!!!",
  });
};

module.exports = { registerUser, loginUser, issueGuestSession, signOut, getTokens };
