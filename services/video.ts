import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE } from "@/config/client";

export type VideoSession = { token: string; room: string };
export async function startVideoCall(to: string): Promise<VideoSession> {
  const token = await AsyncStorage.getItem("token");
  if (!token) throw new Error("Sign in to place a video call.");
  const response = await fetch(`${API_BASE}/api/v1/voice/video/token`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ to }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || typeof data.token !== "string" || typeof data.room !== "string") throw new Error(data.message || "Unable to start a video call.");
  return data;
}
