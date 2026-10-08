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
