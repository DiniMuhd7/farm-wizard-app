// Airbundle minute bundles — mirrors backend/src/controllers/payments
// AIRBUNDLES exactly (same ids, same prices) so the price shown before
// checkout always matches what's actually charged. If the backend config
// ever changes, update both sides together. Prices are the bundle price in
// each supported payment currency (see PaymentCurrency in services/payments).
export type AirbundleId = "500" | "1500" | "2500" | "3500" | "5000";

export type Airbundle = {
  id: AirbundleId;
  minutes: number;
  priceUsd: number;
  priceNgn: number;
  popular?: boolean;
};

export const AIRBUNDLES: Airbundle[] = [
  { id: "500", minutes: 500, priceUsd: 7.99, priceNgn: 12000 },
  { id: "1500", minutes: 1500, priceUsd: 19.99, priceNgn: 30000, popular: true },
  { id: "2500", minutes: 2500, priceUsd: 29.99, priceNgn: 45000 },
  { id: "3500", minutes: 3500, priceUsd: 39.99, priceNgn: 60000 },
  { id: "5000", minutes: 5000, priceUsd: 54.99, priceNgn: 82500 },
];

export function formatAirbundleMinutes(bundle: Airbundle): string {
  return `${bundle.minutes.toLocaleString("en-US")} minutes`;
}

export function formatAirbundlePrice(bundle: Airbundle, currency: "USD" | "NGN"): string {
  return currency === "USD"
    ? `$${bundle.priceUsd.toFixed(2)}`
    : `₦${bundle.priceNgn.toLocaleString("en-US")}`;
}
