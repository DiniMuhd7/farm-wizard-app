// Minutes-based calling plans, offered only to users whose account country
// is the United States, the United Kingdom, or Canada (see
// getCallingPlansForCountry / CALLING_PLAN_COUNTRIES below). Other regions
// keep the existing pay-as-you-go 9tel number flow in calling-plan.tsx.

export type CallingPlanTier = {
  id: string;
  minutes: number | "unlimited";
  price: number;
  currency: string;
  label: string;
  popular?: boolean;
};

export type CountryCallingPlans = {
  countryCode: string; // lowercase ISO 3166-1 alpha-2, matches User.country
  countryName: string;
  currencySymbol: string;
  tiers: CallingPlanTier[];
};

// Lowercase ISO codes — the same format used for User.country and the
// country pickers in hooks/useCountryData.js / constants/fallbackData.js.
export const CALLING_PLAN_COUNTRIES = ["us", "gb", "ca"] as const;

export const callingPlansByCountry: Record<string, CountryCallingPlans> = {
  us: {
    countryCode: "us",
    countryName: "United States",
    currencySymbol: "$",
    tiers: [
      { id: "us-500", minutes: 500, price: 9.99, currency: "USD", label: "Starter" },
      { id: "us-2000", minutes: 2000, price: 24.99, currency: "USD", label: "Most popular", popular: true },
      { id: "us-unlimited", minutes: "unlimited", price: 39.99, currency: "USD", label: "Unlimited" },
    ],
  },
  gb: {
    countryCode: "gb",
    countryName: "United Kingdom",
    currencySymbol: "£",
    tiers: [
      { id: "gb-500", minutes: 500, price: 7.99, currency: "GBP", label: "Starter" },
      { id: "gb-2000", minutes: 2000, price: 19.99, currency: "GBP", label: "Most popular", popular: true },
      { id: "gb-unlimited", minutes: "unlimited", price: 32.99, currency: "GBP", label: "Unlimited" },
    ],
  },
  ca: {
    countryCode: "ca",
    countryName: "Canada",
    currencySymbol: "$",
    tiers: [
      { id: "ca-500", minutes: 500, price: 12.99, currency: "CAD", label: "Starter" },
      { id: "ca-2000", minutes: 2000, price: 29.99, currency: "CAD", label: "Most popular", popular: true },
      { id: "ca-unlimited", minutes: "unlimited", price: 44.99, currency: "CAD", label: "Unlimited" },
    ],
  },
};

export function getCallingPlansForCountry(countryCode?: string | null): CountryCallingPlans | null {
  if (!countryCode) return null;
  return callingPlansByCountry[countryCode.toLowerCase()] ?? null;
}

export function formatTierMinutes(tier: CallingPlanTier): string {
  return tier.minutes === "unlimited" ? "Unlimited minutes" : `${tier.minutes.toLocaleString()} minutes`;
}

export function formatTierPrice(tier: CallingPlanTier, currencySymbol: string): string {
  return `${currencySymbol}${tier.price.toFixed(2)}/mo`;
}
