import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE } from "@/config/client";

async function authHeader() {
  const token = await AsyncStorage.getItem("token");
  if (!token) throw new Error("Sign in to continue.");
  return { Authorization: `Bearer ${token}` };
}

export type AvailabilityResult =
  | { alreadyProvisioned: true; phoneNumber: string }
  | { alreadyProvisioned: false; available: true; phoneNumber: string; countryCode: string }
  | { alreadyProvisioned: false; available: false; message: string };

// Lets callers (and tests) distinguish *why* loading countries failed —
// "the provider isn't configured in this deployment" vs. "a generic/
// transient provider error" vs. "network/timeout" — without resorting to
// matching on message text. The UI still just reads `.message`, but this
// keeps the door open for a different presentation per state later (e.g. a
// support link for `service_unavailable`) without another round of
// guesswork about what actually failed in production.
export type AvailableCountriesErrorCode = "service_unavailable" | "provider_error" | "network" | "malformed_response";

export class AvailableCountriesError extends Error {
  code: AvailableCountriesErrorCode;
  constructor(message: string, code: AvailableCountriesErrorCode) {
    super(message);
    this.name = "AvailableCountriesError";
    this.code = code;
  }
}

// 15s is generous for a request that fans out to ~195 per-country lookups
// on the backend (see listAvailableCountries), but still bounded — without
// this, a stalled connection left the picker's loading spinner spinning
// forever instead of surfacing a retryable error.
const AVAILABLE_COUNTRIES_TIMEOUT_MS = 15000;

export type PaymentInitErrorCode = "validation_error" | "config_error" | "provider_error" | "network_error" | "malformed_response";

export class PaymentInitError extends Error {
  code: PaymentInitErrorCode;
  retryable: boolean;
  constructor(message: string, code: PaymentInitErrorCode) {
    super(message);
    this.name = "PaymentInitError";
    this.code = code;
    this.retryable = code !== "config_error";
  }
}

function isPaymentInitErrorCode(code: unknown): code is PaymentInitErrorCode {
  return ["validation_error", "config_error", "provider_error", "network_error", "malformed_response"].includes(String(code));
}

function paymentInitMessage(code: PaymentInitErrorCode, fallback?: string): string {
  switch (code) {
    case "validation_error":
      return "That didn't go through — check your details and try again.";
    case "config_error":
      return "Payment setup isn't available right now — please try again in a few minutes.";
    case "network_error":
      return "We couldn't reach the payment provider — check your connection and try again.";
    case "provider_error":
      return fallback || "That didn't go through — please try again in a moment.";
    default:
      return fallback || "Unable to start payment right now.";
  }
}

export function toPaymentInitError(error: unknown): PaymentInitError {
  if (error instanceof PaymentInitError) return error;
  return new PaymentInitError((error as Error)?.message || "Unable to start payment right now.", "provider_error");
}

export async function createPaymentSessionRequest(
  path: string,
  body?: Record<string, string>,
): Promise<{ orderId: string; url: string }> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { ...(await authHeader()), "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new PaymentInitError(paymentInitMessage("network_error"), "network_error");
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const code = isPaymentInitErrorCode(data?.code) ? data.code : "provider_error";
    throw new PaymentInitError(paymentInitMessage(code, typeof data?.message === "string" ? data.message : undefined), code);
  }
  if (!data || typeof data.orderId !== "string" || typeof data.url !== "string") {
    throw new PaymentInitError(paymentInitMessage("malformed_response"), "malformed_response");
  }
  return data;
}

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
      throw new AvailableCountriesError("Loading available countries timed out. Please try again.", "network");
    }
    throw new AvailableCountriesError("Unable to reach 9tel right now. Check your connection and try again.", "network");
  } finally {
    clearTimeout(timeout);
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    // The backend tags configuration failures (e.g. Twilio credentials not
    // set in this deployment) with code "service_unavailable" so the app
    // can show that precise state instead of a misleading generic
    // "Unable to load available countries" — see
    // backend/src/controllers/numbers/index.js#listAvailableCountries.
    const code: AvailableCountriesErrorCode = data?.code === "service_unavailable" ? "service_unavailable" : "provider_error";
    const message = typeof data?.message === "string" ? data.message : "Unable to load available countries right now.";
    throw new AvailableCountriesError(message, code);
  }
  // The backend always returns { countryCodes: string[] } on success, but
  // guard against a malformed/unexpected payload shape (e.g. an upstream
  // proxy error page, a truncated response) instead of silently returning
  // `[]` disguised as "no countries available".
  if (!data || !Array.isArray(data.countryCodes)) {
    throw new AvailableCountriesError("Unable to load available countries right now.", "malformed_response");
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

// Flutterwave is the only payment provider. The person chooses the
// currency they pay in (USD or NGN) before checkout starts; the backend
// charges the matching price for the selected product.
export type PaymentCurrency = "USD" | "NGN";
export const PAYMENT_CURRENCIES: PaymentCurrency[] = ["USD", "NGN"];

export const createFlutterwaveCheckout = (countryCode: string, currency: PaymentCurrency) =>
  createPaymentSessionRequest("/api/v1/payments/flutterwave/create-session", { countryCode, currency });

// Airbundle — a selectable minute bundle with ad-free 9tel-to-9tel calling.
// The backend extends the user's existing ad-free period and adds the
// bundle's minutes (see backend/src/controllers/payments'
// fulfillAirbundleOrder), so buying early never discards already-paid-for
// time.
export const createAirbundleFlutterwaveCheckout = (bundleId: string, currency: PaymentCurrency) =>
  createPaymentSessionRequest("/api/v1/payments/flutterwave/create-airbundle-session", { bundleId, currency });

export type OrderStatus = {
  status: "pending" | "paid" | "paid_unfulfilled" | "refunded" | "failed" | "cancelled";
  kind?: "number" | "credits" | "airbundle" | "premium";
  phoneNumber: string | null;
  creditsCents?: number;
  airbundleMinutes?: number;
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

export type PaymentOutcome = "paid" | "failed" | "cancelled" | "refunded" | "pending";

// Polls an order after the Flutterwave checkout browser is dismissed.
// Purchases are only ever applied by the backend after Flutterwave verifies
// the payment, so "paid" here is authoritative; "pending" means we stopped
// waiting (not that it failed) — the app can tell the person to check back.
export async function waitForPaymentOutcome(orderId: string, timeoutMs = 2 * 60 * 1000, intervalMs = 3000): Promise<PaymentOutcome> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    const order = await getOrderStatus(orderId).catch(() => null);
    if (!order) continue;
    if (order.status === "paid") return "paid";
    if (order.status === "failed" || order.status === "cancelled" || order.status === "refunded") return order.status;
  }
  return "pending";
}
