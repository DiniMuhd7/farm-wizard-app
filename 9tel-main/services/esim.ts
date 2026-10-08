import { authedJson } from "@/services/http";
import { createPaymentSessionRequest, type PaymentCurrency } from "@/services/payments";

export type EsimPlan = {
  id: string;
  countryCode: string;
  country: string;
  dataGB: number;
  validityDays: number;
  priceUsd: number;
};

export type EsimProfile = {
  id: string;
  planId: string;
  countryCode: string;
  country: string;
  dataGB: number;
  validityDays: number;
  iccid: string;
  smdpAddress: string | null;
  matchingId: string | null;
  activationCode: string; // "LPA:1$<smdp>$<matching id>"
  qrUrl: string | null;
  purchasedAt: string;
};

export async function getEsimPlans(): Promise<EsimPlan[]> {
  return (await authedJson<{ plans: EsimPlan[] }>("/api/v1/esim/plans")).plans ?? [];
}

export async function getMyEsims(): Promise<EsimProfile[]> {
  return (await authedJson<{ esims: EsimProfile[] }>("/api/v1/esim/mine")).esims ?? [];
}

export async function getEsim(id: string): Promise<EsimProfile> {
  return (await authedJson<{ esim: EsimProfile }>(`/api/v1/esim/${encodeURIComponent(id)}`)).esim;
}

export const createEsimCheckout = (planId: string, currency: PaymentCurrency) =>
  createPaymentSessionRequest("/api/v1/payments/flutterwave/create-esim-session", { planId, currency });

// iOS 17.4+ opens the system "Add eSIM" sheet straight from this universal link.
export const iosInstallUrl = (activationCode: string) =>
  `https://esimsetup.apple.com/esim_qrcode_provisioning?carddata=${encodeURIComponent(activationCode)}`;
