const User = require("../../models/User");

// Lazily require the `twilio` REST client the same way services/voice.ts
// lazy-loads the native Voice SDK on the mobile side: this controller is
// only hit by two endpoints, so there's no reason to load it at server boot.
function twilioClient() {
  const required = ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "PUBLIC_BASE_URL"];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) throw new Error(`Number provisioning is not configured: ${missing.join(", ")}`);
  const twilio = require("twilio");
  return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

const COUNTRY_CODE = /^[A-Z]{2}$/;

// NOTE: this endpoint spends real money the moment it succeeds — Twilio
// bills a recurring monthly fee per number the instant it's purchased via
// incomingPhoneNumbers.create(), regardless of whether the number is ever
// called. There is currently no quota, plan/tier check, or admin approval
// gate here: any authenticated user can call this once and provision a
// number against this Twilio account's balance. Add a limit before this
// goes further than internal testing.
exports.provisionNumber = async (req, res) => {
  try {
    const existing = await User.findById(req.user._id).select("phoneNumber");
    if (existing?.phoneNumber) {
      return res.status(200).json({ phoneNumber: existing.phoneNumber, alreadyProvisioned: true });
    }

    const countryCode = String(req.body?.countryCode || "US").toUpperCase();
    if (!COUNTRY_CODE.test(countryCode)) {
      return res.status(400).json({ message: "countryCode must be a 2-letter ISO country code, e.g. US, NG, GB." });
    }

    const client = twilioClient();
    const available = await client
      .availablePhoneNumbers(countryCode)
      .local.list({ voiceEnabled: true, limit: 1 });

    if (!available.length) {
      return res.status(404).json({ message: `No numbers currently available for ${countryCode}. Try a different country.` });
    }

    const voiceUrl = `${process.env.PUBLIC_BASE_URL.replace(/\/$/, "")}/api/v1/voice/incoming`;
    const purchased = await client.incomingPhoneNumbers.create({
      phoneNumber: available[0].phoneNumber,
      voiceUrl,
      voiceMethod: "POST",
      friendlyName: `9tel user ${req.user._id}`,
    });

    // Race guard: if two requests from the same user land concurrently,
    // the unique index on phoneNumber (sparse) rejects the second save
    // rather than silently double-assigning. The now-purchased second
    // number would need manual cleanup in the Twilio console in that case —
    // rare, but real, given there's no distributed lock here.
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { phoneNumber: purchased.phoneNumber },
      { new: true }
    ).select("phoneNumber");

    return res.status(201).json({ phoneNumber: user.phoneNumber, alreadyProvisioned: false });
  } catch (error) {
    console.error("Unable to provision number:", error.message);
    return res.status(503).json({ message: "Unable to assign a number right now. Please try again later." });
  }
};

exports.getMyNumber = async (req, res) => {
  const user = await User.findById(req.user._id).select("phoneNumber");
  return res.status(200).json({ phoneNumber: user?.phoneNumber || null });
};
