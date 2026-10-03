import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE } from "@/config/client";

export type Message = { _id: string; direction: "inbound" | "outbound"; from: string; to: string; body: string; mediaUrls: string[]; status: string; createdAt: string };

async function headers() {
  const token = await AsyncStorage.getItem("token");
  if (!token) throw new Error("Sign in to send messages.");
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

export async function getMessages(withNumber: string): Promise<Message[]> {
  const response = await fetch(`${API_BASE}/api/v1/messages?with=${encodeURIComponent(withNumber)}`, { headers: await headers() });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Unable to load messages.");
  return data.messages;
}

export async function sendMessage(to: string, body: string, mediaUrls: string[] = []): Promise<Message> {
  const response = await fetch(`${API_BASE}/api/v1/messages`, { method: "POST", headers: await headers(), body: JSON.stringify({ to, body, mediaUrls }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Unable to send message.");
  return data.message;
}
