import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE } from "@/config/client";

async function authHeader() {
  const token = await AsyncStorage.getItem("token");
  if (!token) throw new Error("Sign in to manage your 9tel number.");
  return { Authorization: `Bearer ${token}` };
}

export async function getMyNumber(): Promise<string | null> {
  const response = await fetch(`${API_BASE}/api/v1/numbers/mine`, {
    headers: await authHeader(),
  });
  if (!response.ok) throw new Error("Unable to look up your number right now.");
  const data = await response.json();
  return data.phoneNumber ?? null;
}

// Provisioning spends real money the moment it succeeds (see the backend
// controller's own warning) — this isn't a free/instant local action, it's
// a real Twilio phone-number purchase. Only call this from an explicit,
// user-initiated action (a button tap), never automatically on screen load.
export async function provisionNumber(countryCode: string = "US"): Promise<string> {
  const response = await fetch(`${API_BASE}/api/v1/numbers/provision`, {
    method: "POST",
    headers: { ...(await authHeader()), "Content-Type": "application/json" },
    body: JSON.stringify({ countryCode }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.message || "Unable to assign a number right now.");
  return data.phoneNumber as string;
}
