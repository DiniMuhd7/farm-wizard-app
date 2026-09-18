import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE } from "@/config/client";

export type CallRecord = {
  id: string;
  direction: "inbound" | "outbound";
  counterparty: string;
  status: "completed" | "no-answer" | "busy" | "failed" | "canceled";
  durationSeconds: number;
  at: string;
};

export type CallStats = {
  windowDays: number;
  totalCalls: number;
  totalSeconds: number;
  outgoing: number;
  incoming: number;
  missedCalls: number;
  avgSeconds: number;
  dailyCounts: number[]; // Mon..Sun
  busiestDayIndex: number | null;
  changeFromLastWeekPercent: number | null;
};

async function authHeader() {
  const token = await AsyncStorage.getItem("token");
  if (!token) throw new Error("Sign in to view call history.");
  return { Authorization: `Bearer ${token}` };
}

export async function getCallHistory(): Promise<CallRecord[]> {
  const response = await fetch(`${API_BASE}/api/v1/calls/mine`, { headers: await authHeader() });
  if (!response.ok) throw new Error("Unable to load call history.");
  const data = await response.json();
  return data.calls as CallRecord[];
}

export async function getCallStats(): Promise<CallStats> {
  const response = await fetch(`${API_BASE}/api/v1/calls/stats`, { headers: await authHeader() });
  if (!response.ok) throw new Error("Unable to load call stats.");
  return (await response.json()) as CallStats;
}
