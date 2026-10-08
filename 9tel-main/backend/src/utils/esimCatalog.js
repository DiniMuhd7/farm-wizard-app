// eSIM data plans offered in the app. IDs are stable (`<country>-<gb>gb-<days>d`)
// and are what the mobile app sends at checkout; the price is always looked up
// here server-side, never taken from the client.
//
// PRICES BELOW ARE PLACEHOLDERS — set them to your provider's wholesale cost
// plus your margin. Each plan must also be mapped to the provider's package id
// via the ESIM_PACKAGE_MAP environment variable (JSON), e.g.
//   ESIM_PACKAGE_MAP={"ng-1gb-7d":"<provider-package-id>", ...}
const COUNTRIES = {
  NG: { name: "Nigeria", multiplier: 1 },
  GH: { name: "Ghana", multiplier: 1 },
  KE: { name: "Kenya", multiplier: 1.1 },
  ZA: { name: "South Africa", multiplier: 1.1 },
  GB: { name: "United Kingdom", multiplier: 1.2 },
  US: { name: "United States", multiplier: 1.3 },
};

const TIERS = [
  { gb: 1, days: 7, usd: 4.5 },
  { gb: 3, days: 30, usd: 9 },
  { gb: 10, days: 30, usd: 22 },
];

const NGN_PER_USD_FALLBACK = 1500;

const ESIM_PLANS = Object.entries(COUNTRIES).flatMap(([countryCode, country]) =>
  TIERS.map((tier) => {
    const priceUsd = Math.round(tier.usd * country.multiplier * 100) / 100;
    return {
      id: `${countryCode.toLowerCase()}-${tier.gb}gb-${tier.days}d`,
      countryCode,
      country: country.name,
      dataGB: tier.gb,
      validityDays: tier.days,
      priceUsd,
      priceNgnFallback: Math.round(priceUsd * NGN_PER_USD_FALLBACK),
    };
  })
);

const getPlan = (id) => ESIM_PLANS.find((plan) => plan.id === String(id));

module.exports = { ESIM_PLANS, getPlan };
