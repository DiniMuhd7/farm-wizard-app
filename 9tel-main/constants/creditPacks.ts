// Prepaid credit top-up packs — mirrors backend/src/controllers/payments
// CREDIT_PACKS exactly (same ids, same cents amounts) so the price shown
// before checkout always matches what's actually charged. If the backend
// pack config ever changes, update both sides together.
export type CreditPack = {
  id: "500" | "1000" | "2500" | "5000" | "10000";
  creditsCents: number;
  priceUsdCents: number;
  priceNgn: number;
};

export const CREDIT_PACKS: CreditPack[] = [
  { id: "500", creditsCents: 500, priceUsdCents: 500, priceNgn: 3000 },
  { id: "1000", creditsCents: 1000, priceUsdCents: 1000, priceNgn: 6000 },
  { id: "2500", creditsCents: 2500, priceUsdCents: 2500, priceNgn: 15000 },
  { id: "5000", creditsCents: 5000, priceUsdCents: 5000, priceNgn: 75000 },
  { id: "10000", creditsCents: 10000, priceUsdCents: 10000, priceNgn: 150000 },
];

export function formatCents(cents: number, currencySymbol = "$"): string {
  return `${currencySymbol}${(cents / 100).toFixed(2)}`;
}

export function formatCreditPackPrice(pack: CreditPack, currency: "USD" | "NGN"): string {
  return currency === "USD" ? formatCents(pack.priceUsdCents) : `₦${pack.priceNgn.toLocaleString("en-US")}`;
}
