import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE } from "@/config/client";

export type CallerIdStatus = "unverified" | "pending" | "verified" | "failed" | "expired";

export type CallerIdVerificationStatus = {
  verifiedCallerId: string | null;
  callerIdStatus: CallerIdStatus;
  phoneNumber?: string;
  method?: "twilio" | "spoken_code" | "developer_test";
  expiresAt?: string;
  attemptsRemaining?: number;
  correlationId?: string;
};

export type CallerIdVerificationStart = {
  phoneNumber: string;
  callerIdStatus: "pending" | "verified";
  method?: "developer_test";
  expiresAt?: string;
  correlationId?: string;
  message?: string;
};

export type CallerIdCodeResult = {
  callerIdStatus: "verified";
  verifiedCallerId: string;
  method: "spoken_code";
};

export class CallerIdError extends Error {
  code?: string;
  missing?: string[];
  attemptsRemaining?: number;
  callerIdStatus?: CallerIdStatus;
}

function toError(data: any, fallback: string) {
  const error = new CallerIdError(data?.message || fallback);
  error.code = data?.code;
  error.missing = data?.missing;
  error.attemptsRemaining = data?.attemptsRemaining;
  error.callerIdStatus = data?.callerIdStatus;
  return error;
}

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
  if (!response.ok) throw toError(data, "Unable to start verification right now.");
  return data as CallerIdVerificationStart;
}

// The code is the one spoken on the verification call. It is sent only to the
// authenticated backend, which is the sole authority on whether it is valid;
// it is never stored, logged, or sent to analytics here.
export async function submitCallerIdCode(code: string): Promise<CallerIdCodeResult> {
  const response = await fetch(`${API_BASE}/api/v1/callerid/verify`, {
    method: "POST",
    headers: { ...(await authHeader()), "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  const data = await responseData(response);
  if (!response.ok) throw toError(data, "Unable to verify that code right now.");
  return data as CallerIdCodeResult;
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
