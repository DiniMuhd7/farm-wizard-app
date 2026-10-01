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

// 15s is generous for a request that fans out to ~195 per-country lookups
// on the backend (see listAvailableCountries), but still bounded — without
// this, a stalled connection left the picker's loading spinner spinning
// forever instead of surfacing a retryable error.
const AVAILABLE_COUNTRIES_TIMEOUT_MS = 15000;

export async function getAvailableNumberCountries(countries: { value: string }[]): Promise<string[]> {
  const countryCodes = [...new Set(
    countries
      .map((country) => country.value.toUpperCase())
      .filter((code) => /^[A-Z]{2}$/.test(code)),
  )];
  if (!countryCodes.length) return [];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AVAILABLE_COUNTRIES_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(
      `${API_BASE}/api/v1/numbers/available-countries?countryCodes=${encodeURIComponent(countryCodes.join(","))}`,
      { headers: await authHeader(), signal: controller.signal },
    );
  } catch (error) {
    // AbortError (timeout) and generic network failures (offline, DNS,
    // TLS, etc.) both land here — surface one consistent, retryable
    // message rather than letting a raw TypeError reach the UI.
    if ((error as Error)?.name === "AbortError") {
      throw new Error("Loading available countries timed out. Please try again.");
    }
    throw new Error("Unable to reach 9tel right now. Check your connection and try again.");
  } finally {
    clearTimeout(timeout);
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = typeof data?.message === "string" ? data.message : "Unable to load available countries right now.";
    throw new Error(message);
  }
  // The backend always returns { countryCodes: string[] } on success, but
  // guard against a malformed/unexpected payload shape (e.g. an upstream
  // proxy error page, a truncated response) instead of silently returning
  // `[]` disguised as "no countries available".
  if (!data || !Array.isArray(data.countryCodes)) {
    throw new Error("Unable to load available countries right now.");
  }
  return data.countryCodes;
}

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
