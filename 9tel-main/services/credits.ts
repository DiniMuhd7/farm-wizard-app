import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE } from "@/config/client";
import { createPaymentSessionRequest, type PaymentCurrency } from "@/services/payments";

async function authHeader() {
  const token = await AsyncStorage.getItem("token");
  if (!token) throw new Error("Sign in to manage your Prepaid balance.");
  return { Authorization: `JWT ${token}` };
}

export type CreditsBalance = {
  balanceCents: number;
  currency: string;
  ratePerMinuteCents: number;
};

// Always a fresh read of the authoritative backend balance — never a
// client-computed running total — since the only thing that ever debits
// credits is the Twilio call-completion webhook (see
// backend/src/controllers/credits), not anything client-side.
export async function getCreditsBalance(): Promise<CreditsBalance> {
  const response = await fetch(`${API_BASE}/api/v1/credits/balance`, {
    headers: await authHeader(),
  });
  if (!response.ok) throw new Error("Unable to check your Prepaid balance right now.");
  return response.json();
}

// `costCents` is the price of the shortest billable unit (one minute) at
// the account's current rate — used for a soft pre-call check only
// ("do you have at least enough for one minute?"), never to predict or
// reserve the actual cost of the call that's about to happen, since the
// real cost depends on how long the call actually runs and is settled
// authoritatively after the fact by the backend webhook.
export function hasSufficientCreditsForOneMinute(balance: CreditsBalance): boolean {
  return balance.balanceCents >= balance.ratePerMinuteCents;
}

export const createCreditsFlutterwaveCheckout = (packId: string, currency: PaymentCurrency) =>
  createPaymentSessionRequest("/api/v1/payments/flutterwave/create-credits-session", { packId, currency });
