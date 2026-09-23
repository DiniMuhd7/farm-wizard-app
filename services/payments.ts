import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE } from "@/config/client";

async function authHeader() {
  const token = await AsyncStorage.getItem("token");
  if (!token) throw new Error("Sign in to get a number.");
  return { Authorization: `Bearer ${token}` };
}

export type AvailabilityResult =
  | { alreadyProvisioned: true; phoneNumber: string }
  | { alreadyProvisioned: false; available: true; phoneNumber: string; countryCode: string }
  | { alreadyProvisioned: false; available: false; message: string };

// A free preview of what number you'd get — nothing is purchased by
// calling this. Twilio doesn't let you reserve a specific number ahead of
// paying for it, so the exact number shown could in rare cases be taken by
// someone else by the time payment completes; the backend just looks up a
// fresh one at that point rather than failing.
export async function checkNumberAvailability(countryCode: string): Promise<AvailabilityResult> {
  const response = await fetch(`${API_BASE}/api/v1/numbers/available?countryCode=${encodeURIComponent(countryCode)}`, {
    headers: await authHeader(),
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 404) {
    return { alreadyProvisioned: false, available: false, message: data?.message || "No numbers available for that country." };
  }
  if (!response.ok) throw new Error(data?.message || "Unable to check availability right now.");
  return data;
}

async function createCheckoutSession(provider: "stripe" | "flutterwave", countryCode: string): Promise<{ orderId: string; url: string }> {
  const response = await fetch(`${API_BASE}/api/v1/payments/${provider}/create-session`, {
    method: "POST",
    headers: { ...(await authHeader()), "Content-Type": "application/json" },
    body: JSON.stringify({ countryCode }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.message || "Unable to start payment right now.");
  return data;
}

export const createStripeCheckout = (countryCode: string) => createCheckoutSession("stripe", countryCode);
export const createFlutterwaveCheckout = (countryCode: string) => createCheckoutSession("flutterwave", countryCode);

export type OrderStatus = {
  status: "pending" | "paid" | "paid_unfulfilled" | "refunded" | "failed";
  phoneNumber: string | null;
};

// Fulfillment happens asynchronously via a provider webhook, not
// synchronously when the checkout browser closes — poll this afterward
// while showing "processing your payment".
export async function getOrderStatus(orderId: string): Promise<OrderStatus> {
  const response = await fetch(`${API_BASE}/api/v1/payments/orders/${orderId}`, {
    headers: await authHeader(),
  });
  if (!response.ok) throw new Error("Unable to check payment status.");
  return response.json();
}
