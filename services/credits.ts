import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE } from "@/config/client";

async function authHeader() {
  const token = await AsyncStorage.getItem("token");
  if (!token) throw new Error("Sign in to manage your Pay As You Go balance.");
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
  if (!response.ok) throw new Error("Unable to check your Pay As You Go balance right now.");
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

async function createCreditsCheckoutSession(
  provider: "stripe" | "flutterwave",
  packId: string,
): Promise<{ orderId: string; url: string }> {
  const response = await fetch(`${API_BASE}/api/v1/payments/${provider}/create-credits-session`, {
    method: "POST",
    headers: { ...(await authHeader()), "Content-Type": "application/json" },
    body: JSON.stringify({ packId }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.message || "Unable to start payment right now.");
  return data;
}

export const createCreditsStripeCheckout = (packId: string) => createCreditsCheckoutSession("stripe", packId);
export const createCreditsFlutterwaveCheckout = (packId: string) => createCreditsCheckoutSession("flutterwave", packId);
