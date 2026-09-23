const User = require("../../models/User");

// Lazily require the `twilio` REST client the same way services/voice.ts
// lazy-loads the native Voice SDK on the mobile side.
function twilioClient() {
  const required = ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "PUBLIC_BASE_URL"];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) throw new Error(`Number provisioning is not configured: ${missing.join(", ")}`);
  const twilio = require("twilio");
  return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

const COUNTRY_CODE = /^[A-Z]{2}$/;

function assertValidCountryCode(countryCode) {
  if (!COUNTRY_CODE.test(countryCode)) {
    const err = new Error("countryCode must be a 2-letter ISO country code, e.g. US, NG, GB.");
    err.status = 400;
    throw err;
  }
}

// GET /api/v1/numbers/available?countryCode=NG
// Looks up a real available number WITHOUT purchasing it, so the person can
// see what they'd actually get before paying for it. Twilio does not let
// you reserve a specific number ahead of purchase, so this is a preview,
// not a hold — a small chance exists that this exact number is taken by
// someone else between checking and paying (Twilio's own inventory is
// shared across all customers), in which case purchaseAndAssignNumber below
// just looks up a fresh one at that point rather than failing.
exports.checkAvailability = async (req, res) => {
  try {
    const countryCode = String(req.query?.countryCode || "").toUpperCase();
    assertValidCountryCode(countryCode);

    const existing = await User.findById(req.user._id).select("phoneNumber");
    if (existing?.phoneNumber) {
      return res.status(200).json({ alreadyProvisioned: true, phoneNumber: existing.phoneNumber });
    }

    const client = twilioClient();
    const available = await client.availablePhoneNumbers(countryCode).local.list({ voiceEnabled: true, limit: 1 });
    if (!available.length) {
      return res.status(404).json({ available: false, message: `No numbers currently available for ${countryCode}. Try a different country.` });
    }

    return res.status(200).json({ available: true, phoneNumber: available[0].phoneNumber, countryCode });
  } catch (error) {
    console.error("Unable to check number availability:", error.message);
    return res.status(error.status || 503).json({ message: error.status ? error.message : "Unable to check availability right now. Please try again later." });
  }
};

// Actually buys a number and assigns it to a user — called only after a
// payment has been confirmed (see controllers/payments' webhook handlers).
// Not exposed as its own public route: reaching this without paying would
// defeat the entire point of the payment step in front of it.
exports.purchaseAndAssignNumber = async (userId, countryCode) => {
  const existing = await User.findById(userId).select("phoneNumber");
  if (existing?.phoneNumber) return existing.phoneNumber; // already has one — don't double-buy

  const client = twilioClient();
  const available = await client.availablePhoneNumbers(countryCode).local.list({ voiceEnabled: true, limit: 1 });
  if (!available.length) {
    throw new Error(`No numbers currently available for ${countryCode} at the time of purchase.`);
  }

  const voiceUrl = `${process.env.PUBLIC_BASE_URL.replace(/\/$/, "")}/api/v1/voice/incoming`;
  const purchased = await client.incomingPhoneNumbers.create({
    phoneNumber: available[0].phoneNumber,
    voiceUrl,
    voiceMethod: "POST",
    friendlyName: `9tel user ${userId}`,
  });

  // Race guard: the unique index on phoneNumber (sparse) rejects a second
  // concurrent assignment rather than silently double-assigning. The
  // now-purchased number would need manual cleanup in the Twilio console
  // in that rare case — there's no distributed lock here.
  const user = await User.findByIdAndUpdate(userId, { phoneNumber: purchased.phoneNumber }, { new: true }).select("phoneNumber");
  return user.phoneNumber;
};

exports.getMyNumber = async (req, res) => {
  const user = await User.findById(req.user._id).select("phoneNumber");
  return res.status(200).json({ phoneNumber: user?.phoneNumber || null });
};
