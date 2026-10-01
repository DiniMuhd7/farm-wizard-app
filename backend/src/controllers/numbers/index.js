const User = require("../../models/User");

// Shared by twilioClient() and purchaseAndAssignNumber() below so both
// "missing config" errors stay in the same format instead of drifting apart.
// `code: "CONFIG_MISSING"` lets callers (see listAvailableCountries below)
// tell "the provider isn't configured in this environment" apart from "the
// provider was reachable but returned an error/no inventory" — these used
// to surface as the exact same generic 503, which made a genuinely missing
// TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN in production indistinguishable from
// a transient Twilio outage or simply no numbers being in stock right now.
function requireEnv(keys) {
  const missing = keys.filter((key) => !process.env[key]);
  if (missing.length) {
    const err = new Error(`Number provisioning is not configured: ${missing.join(", ")}`);
    err.code = "CONFIG_MISSING";
    err.missing = missing;
    throw err;
  }
}

// Lazily require the `twilio` REST client the same way services/voice.ts
// lazy-loads the native Voice SDK on the mobile side.
//
// Only TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN are needed to construct this
// client and look up number availability. PUBLIC_BASE_URL is unrelated to
// that — it's only needed later, to build the voice webhook URL at actual
// purchase time (see purchaseAndAssignNumber below). Previously it was
// required here too, so an environment with valid Twilio credentials but a
// missing/misconfigured PUBLIC_BASE_URL (e.g. the voice webhook base URL
// not yet set, or set under a different name, in a given deployment) made
// *every* availability lookup — and therefore the entire country picker —
// fail with "Number provisioning is not configured", surfaced to the app
// as the generic "Unable to load available countries" error, even though
// nothing about listing available numbers was actually broken.
function twilioClient() {
  requireEnv(["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"]);
  const twilio = require("twilio");
  return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

const COUNTRY_CODE = /^[A-Z]{2}$/;
const AVAILABLE_COUNTRY_CACHE_MS = 5 * 60 * 1000;
const availableCountryCache = new Map();

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
    if (error.code === "CONFIG_MISSING") {
      return res.status(503).json({ code: "service_unavailable", message: "9tel's number service isn't configured in this environment yet. Please try again later." });
    }
    return res.status(error.status || 503).json({ message: error.status ? error.message : "Unable to check availability right now. Please try again later." });
  }
};

exports.listAvailableCountries = async (req, res) => {
  const countryCodes = [...new Set(
    String(req.query?.countryCodes || "")
      .split(",")
      .map((code) => code.trim().toUpperCase())
      .filter(Boolean)
  )];

  if (!countryCodes.length || countryCodes.length > 250 || countryCodes.some((code) => !COUNTRY_CODE.test(code))) {
    return res.status(400).json({ message: "Provide between 1 and 250 valid ISO country codes." });
  }

  try {
    const client = twilioClient();
    const results = new Map();
    let nextIndex = 0;
    let firstError = null;
    let errorCount = 0;
    const checkNext = async () => {
      while (nextIndex < countryCodes.length) {
        const countryCode = countryCodes[nextIndex++];
        const cached = availableCountryCache.get(countryCode);
        if (cached && Date.now() - cached.checkedAt < AVAILABLE_COUNTRY_CACHE_MS) {
          results.set(countryCode, cached.available);
          continue;
        }
        try {
          const available = await client.availablePhoneNumbers(countryCode).local.list({
            voiceEnabled: true,
            limit: 1,
          });
          const hasNumbers = available.length > 0;
          availableCountryCache.set(countryCode, { available: hasNumbers, checkedAt: Date.now() });
          results.set(countryCode, hasNumbers);
        } catch (error) {
          errorCount += 1;
          firstError ||= error;
          if (error.status === 404 || error.code === 20404) {
            // Twilio simply doesn't sell numbers for this country — not a
            // failure, just "no" for this one code.
            availableCountryCache.set(countryCode, { available: false, checkedAt: Date.now() });
          }
          // Any other per-country error (rate limiting, a transient network
          // blip, an unsupported code, etc.) is treated the same way:
          // that single country is left out of the "available" list rather
          // than aborting the whole batch. Previously a single unexpected
          // error anywhere in ~195 lookups threw and made every country
          // fail to load — this is the bug being fixed here.
        }
      }
    };

    await Promise.all(Array.from({ length: Math.min(6, countryCodes.length) }, checkNext));

    // Only treat this as a hard failure if every single lookup errored out
    // (e.g. invalid/misconfigured Twilio credentials) — a partial failure
    // should still return whatever did succeed.
    if (firstError && errorCount === countryCodes.length) throw firstError;

    return res.status(200).json({
      countryCodes: countryCodes.filter((countryCode) => results.get(countryCode)),
    });
  } catch (error) {
    console.error("Unable to list countries with available numbers:", {
      code: error.code || null,
      status: error.status || null,
    });
    // Distinguish "the provider isn't configured in this environment" (e.g.
    // TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN missing from the deployment) from
    // a generic/transient provider error. Both used to collapse into the
    // same "Unable to load available countries" message, which made a
    // missing production config indistinguishable from "Twilio had a blip"
    // or "no countries currently have numbers" — this `code` lets the app
    // show a precise, non-misleading state instead of guessing.
    if (error.code === "CONFIG_MISSING") {
      return res.status(503).json({
        code: "service_unavailable",
        message: "9tel's number service isn't configured in this environment yet. Please try again later.",
      });
    }
    return res.status(503).json({ code: "provider_error", message: "Unable to load available countries right now. Please try again." });
  }
};

// GET /api/v1/numbers/provider-status  (admin only)
//
// Health-safe diagnostic so an admin can tell, without reading server logs
// or the deployment's environment variables directly, whether the number
// provider (Twilio) is actually configured in this environment — i.e.
// whether "Unable to load available countries" means "misconfigured
// deployment" or something else. Only ever returns booleans, never the
// credential values themselves.
exports.getProviderStatus = async (req, res) => {
  if (req.user?.userType !== "admin") {
    return res.status(403).json({ message: "Admins only" });
  }
  return res.status(200).json({
    numberProviderConfigured: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),
    purchaseWebhookConfigured: Boolean(process.env.PUBLIC_BASE_URL),
  });
};

// Actually buys a number and assigns it to a user — called only after a
// payment has been confirmed (see controllers/payments' webhook handlers).
// Not exposed as its own public route: reaching this without paying would
// defeat the entire point of the payment step in front of it.
exports.purchaseAndAssignNumber = async (userId, countryCode) => {
  // Only required here, where it's actually used (for the voice webhook
  // URL below) — not in twilioClient() itself, see the comment there.
  requireEnv(["PUBLIC_BASE_URL"]);

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

const E164 = /^\+[1-9]\d{6,14}$/;

// GET /api/v1/numbers/lookup?phoneNumber=+1555...
//
// Lets the app ask, before placing a call, "is this destination another
// 9tel user (free/premium, in-app) or a local carrier (pay-as-you-go
// credits)?" without duplicating the ownership lookup that
// controllers/voice's outgoingCallTwiML already performs server-side at
// dial time. This is the same `User.findOne({ phoneNumber })` check — kept
// here, rather than guessed client-side from number formatting, because
// phone number shape alone can't tell a 9tel-provisioned number apart from
// an ordinary carrier number in the same country.
exports.lookupNumber = async (req, res) => {
  // POST with the number in the body, not a GET query param — a phone
  // number is personal data that shouldn't end up in server/proxy access
  // logs or browser history the way a query string can.
  const phoneNumber = String(req.body?.phoneNumber || "").trim();
  if (!E164.test(phoneNumber)) {
    return res.status(400).json({ message: "phoneNumber must be a valid E.164 number, e.g. +15551234567." });
  }
  const owner = await User.findOne({ phoneNumber }).select("_id");
  return res.status(200).json({ phoneNumber, is9telNumber: Boolean(owner) });
};
