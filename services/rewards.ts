import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE } from "@/config/client";

export type WelcomeRewardStatus = {
  // available   -> one free carrier minute is waiting
  // verify_phone-> verify your phone number to unlock it
  // redeemed / unavailable -> nothing to offer
  status: "available" | "verify_phone" | "redeemed" | "unavailable";
  seconds: number;
};

// Display-only. The backend re-checks eligibility and enforces the time
// limit itself when the call is placed; nothing here grants anything.
export async function getWelcomeReward(): Promise<WelcomeRewardStatus> {
  const token = await AsyncStorage.getItem("token");
  if (!token) return { status: "unavailable", seconds: 0 };
  try {
    const response = await fetch(`${API_BASE}/api/v1/rewards/welcome`, {
      headers: { Authorization: `JWT ${token}` },
    });
    if (!response.ok) return { status: "unavailable", seconds: 0 };
    const data = await response.json();
    return { status: data.status, seconds: Number(data.seconds) || 0 };
  } catch {
    return { status: "unavailable", seconds: 0 };
  }
}
