import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE } from "@/config/client";

export type CallerIdStatus = "unverified" | "pending" | "verified" | "failed" | "expired";

export type CallerIdVerificationStatus = {
  verifiedCallerId: string | null;
  callerIdStatus: CallerIdStatus;
  phoneNumber?: string;
  method?: "twilio" | "developer_test";
};

export type CallerIdVerificationStart = {
  phoneNumber: string;
  callerIdStatus: "pending" | "verified";
  method?: "developer_test";
  message?: string;
};

async function authHeader() {
  const token = await AsyncStorage.getItem("token");
  if (!token) throw new Error("Sign in to verify a phone number.");
  return { Authorization: `JWT ${token}` };
}

async function responseData(response: Response) {
  return response.json().catch(() => ({}));
}

export async function startCallerIdVerification(phoneNumber: string): Promise<CallerIdVerificationStart> {
  const response = await fetch(`${API_BASE}/api/v1/callerid/start`, {
    method: "POST",
    headers: { ...(await authHeader()), "Content-Type": "application/json" },
    body: JSON.stringify({ phoneNumber }),
  });
  const data = await responseData(response);
  if (!response.ok) {
    const error = new Error(data?.message || "Unable to start verification right now.") as Error & { code?: string; missing?: string[] };
    error.code = data?.code;
    error.missing = data?.missing;
    throw error;
  }
  return data as CallerIdVerificationStart;
}

export async function getCallerIdVerificationStatus(): Promise<CallerIdVerificationStatus> {
  const response = await fetch(`${API_BASE}/api/v1/callerid/status`, {
    headers: await authHeader(),
  });
  const data = await responseData(response);
  if (!response.ok) throw new Error(data?.message || "Unable to check verification status.");
  return data as CallerIdVerificationStatus;
}

export async function cancelCallerIdVerification(): Promise<void> {
  const response = await fetch(`${API_BASE}/api/v1/callerid/cancel`, {
    method: "POST",
    headers: await authHeader(),
  });
  const data = await responseData(response);
  if (!response.ok) throw new Error(data?.message || "Unable to cancel verification right now.");
}
