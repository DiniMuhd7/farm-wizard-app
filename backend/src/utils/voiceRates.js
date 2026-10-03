const twilio = require("twilio");

// Pricing is returned in USD/minute by Twilio's account-specific Voice
// Pricing API. Cache it briefly: prices do not need a network request for
// every dial, while the cache is short enough to follow provider changes.
const CACHE_TTL_MS = 60 * 60 * 1000;
const FALLBACK_CARRIER_RATE_CENTS = Number(process.env.CARRIER_RATE_PER_MINUTE_CENTS || process.env.CREDITS_RATE_PER_MINUTE_CENTS || 9);
const APP_TO_APP_RATE_CENTS = Number(process.env.TWILIO_APP_TO_APP_RATE_PER_MINUTE_CENTS || 1);
const cache = new Map();

function wholeCents(usd) {
  const cents = Math.ceil(Number(usd) * 100);
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

async function carrierRateCents(destinationNumber, originationNumber) {
  const cached = cache.get(destinationNumber);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.cents;
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) return FALLBACK_CARRIER_RATE_CENTS;
  try {
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    const result = await client.pricing.v2.voice.numbers(destinationNumber).fetch({ originationNumber });
    const cents = wholeCents(result?.outboundCallPrices?.[0]?.currentPrice);
    if (cents) {
      cache.set(destinationNumber, { cents, fetchedAt: Date.now() });
      return cents;
    }
  } catch (error) {
    console.error("Unable to load Twilio carrier rate:", error.message);
  }
  return FALLBACK_CARRIER_RATE_CENTS;
}

function appToAppRateCents() {
  return Number.isSafeInteger(APP_TO_APP_RATE_CENTS) && APP_TO_APP_RATE_CENTS >= 0 ? APP_TO_APP_RATE_CENTS : 0;
}

function _resetForTests() { cache.clear(); }
module.exports = { carrierRateCents, appToAppRateCents, _resetForTests };
