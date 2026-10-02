const axios = require("axios");

// USD -> NGN conversion for Flutterwave checkout. The rate comes from the
// URL in FX_RATE_URL (e.g. https://open.er-api.com/v6/latest/USD, whose
// response carries `rates.NGN`) and is cached so checkout isn't slowed down
// by, or dependent on, a live lookup every time. If the URL isn't set, or
// the lookup fails and no earlier rate is cached, callers get null and
// fall back to their fixed NGN price — payments never break over FX.
const CACHE_TTL_MS = Number(process.env.FX_RATE_CACHE_TTL_MS || 60 * 60 * 1000);
const FETCH_TIMEOUT_MS = 5000;

let cached = null; // { rate, fetchedAt }

function parseRate(data) {
  const rate = Number(data?.rates?.NGN);
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

async function getUsdToNgnRate() {
  const url = process.env.FX_RATE_URL;
  if (!url) return null;
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.rate;
  try {
    const response = await axios.get(url, { timeout: FETCH_TIMEOUT_MS });
    const rate = parseRate(response.data);
    if (rate) {
      cached = { rate, fetchedAt: Date.now() };
      return rate;
    }
    console.error("FX rate response had no usable NGN rate.");
  } catch (error) {
    console.error("FX rate lookup failed:", error.message);
  }
  return cached ? cached.rate : null; // stale beats nothing
}

// Converts a USD amount to whole naira, rounded up to the next ₦10 so the
// charge never undershoots the rate. Returns `fallbackNgn` when no rate is
// available.
async function usdToNgn(usdAmount, fallbackNgn) {
  const rate = await getUsdToNgnRate();
  if (!rate) return fallbackNgn;
  return Math.ceil((usdAmount * rate) / 10) * 10;
}

function _resetForTests() {
  cached = null;
}

module.exports = { getUsdToNgnRate, usdToNgn, _resetForTests };
