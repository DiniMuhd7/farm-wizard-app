import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE } from "@/config/client";

async function authHeader() {
  const token = await AsyncStorage.getItem("token");
  if (!token) throw new Error("Sign in to verify a phone number.");
  return { Authorization: `Bearer ${token}` };
}

// Triggers Twilio to call the given E.164 number and read a 6-digit code
// aloud — this is a Twilio platform requirement (see the backend
// controller's own comment), not a design choice: a non-Twilio number can
// only become a legitimate outbound caller ID this way, not via SMS.
// Returns that code too, as a fallback reference in case the call is hard
// to hear.
export async function startCallerIdVerification(phoneNumber: string): Promise<{ validationCode: string }> {
  const response = await fetch(`${API_BASE}/api/v1/callerid/start`, {
    method: "POST",
    headers: { ...(await authHeader()), "Content-Type": "application/json" },
    body: JSON.stringify({ phoneNumber }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.message || "Unable to start verification right now.");
  return { validationCode: data.validationCode };
}

// There's no synchronous way to know the outcome — Twilio confirms it via
// an async callback to the backend once the call ends. Poll this while
// showing a "we're calling you now" state.
export async function getVerifiedCallerId(): Promise<string | null> {
  const response = await fetch(`${API_BASE}/api/v1/callerid/status`, {
    headers: await authHeader(),
  });
  if (!response.ok) throw new Error("Unable to check verification status.");
  const data = await response.json();
  return data.verifiedCallerId ?? null;
}
