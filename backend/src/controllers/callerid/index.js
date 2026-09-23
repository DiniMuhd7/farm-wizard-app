const User = require("../../models/User");
const { twilioRequestIsValid } = require("../../utils/twilioSignature");

const E164 = /^\+[1-9]\d{6,14}$/;

// IMPORTANT, read before changing this file: Twilio only allows a
// non-Twilio-owned number to be used as an outbound caller ID after it has
// gone through Twilio's OWN Outgoing Caller ID verification — and that
// verification is a PHONE CALL, not SMS. Twilio calls the number, reads a
// 6-digit code aloud, and the person enters it on their phone's keypad
// during that call. There is no way to satisfy Twilio's requirement with an
// app-typed SMS code instead — Twilio Verify (SMS OTP) is a different
// product that confirms phone ownership for login/2FA purposes, but does
// NOT register a number as a usable outbound caller ID. This file uses the
// call-based flow because it's the only one that actually results in a
// number 9tel can dial out from. See:
// https://www.twilio.com/docs/voice/api/outgoing-caller-ids
// https://www.twilio.com/docs/voice/api/verifying-caller-ids-scale

function twilioClient() {
  const required = ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "PUBLIC_BASE_URL"];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) throw new Error(`Caller ID verification is not configured: ${missing.join(", ")}`);
  const twilio = require("twilio");
  return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

// POST /api/v1/callerid/start  { phoneNumber }
// Triggers Twilio to call the given number and read a code aloud. Returns
// that same code for the app to display as a fallback/reference — the
// primary way the person gets it is hearing it on the call, but showing it
// too means a bad connection or a missed word doesn't strand them.
exports.startVerification = async (req, res) => {
  try {
    const phoneNumber = String(req.body?.phoneNumber || "").trim();
    if (!E164.test(phoneNumber)) {
      return res.status(400).json({ message: "Enter a valid phone number, including country code." });
    }

    const takenByOther = await User.findOne({ verifiedCallerId: phoneNumber, _id: { $ne: req.user._id } }).select("_id").lean();
    if (takenByOther) {
      return res.status(409).json({ message: "That number is already verified on another 9tel account." });
    }

    const client = twilioClient();
    const callbackUrl = `${process.env.PUBLIC_BASE_URL.replace(/\/$/, "")}/api/v1/callerid/callback?userId=${req.user._id.toString()}`;
    const validationRequest = await client.validationRequests.create({
      phoneNumber,
      friendlyName: `9tel user ${req.user._id}`,
      statusCallback: callbackUrl,
    });

    return res.status(200).json({
      phoneNumber,
      validationCode: validationRequest.validationCode,
    });
  } catch (error) {
    console.error("Unable to start caller ID verification:", error.message);
    return res.status(503).json({ message: "Unable to start verification right now. Please try again later." });
  }
};

// GET /api/v1/callerid/status
// The mobile app polls this while showing "we're calling you now" — there's
// no other way to know the outcome synchronously, since confirmation only
// arrives later via Twilio's own asynchronous callback below.
exports.getVerificationStatus = async (req, res) => {
  const user = await User.findById(req.user._id).select("verifiedCallerId");
  return res.status(200).json({ verifiedCallerId: user?.verifiedCallerId || null });
};

// POST /api/v1/callerid/callback — Twilio hits this once the verification
// call ends. Not authenticated by session (Twilio can't send a user's JWT);
// authenticated instead by Twilio's own request signature, same as the
// voice webhooks, plus the userId this request was addressed to (see
// startVerification's callbackUrl above).
exports.verificationCallback = async (req, res) => {
  if (!twilioRequestIsValid(req)) return res.status(403).type("text/plain").send("Invalid Twilio signature");
  const userId = String(req.query?.userId || "");
  const phoneNumber = String(req.body?.PhoneNumber || "").trim();
  const status = String(req.body?.VerificationStatus || "");

  if (userId && phoneNumber && status === "success") {
    try {
      await User.findByIdAndUpdate(userId, { verifiedCallerId: phoneNumber });
    } catch (error) {
      console.error("Unable to save verified caller ID:", error.message);
    }
  }
  return res.status(200).type("text/plain").send("OK");
};
