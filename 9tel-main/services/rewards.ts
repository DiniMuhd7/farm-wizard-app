import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE } from "@/config/client";

export type WelcomeRewardStatus = {
  // available   -> one free carrier minute is waiting
  // in_use      -> a call is currently using it
  // verify_phone-> verify your phone number to unlock it
  // redeemed / unavailable -> nothing to offer
  status: "available" | "in_use" | "verify_phone" | "redeemed" | "unavailable";
  seconds: number;
  grantedSeconds?: number;
  // Server-computed: what the account can dial right now. The reward is its
  // own entitlement and is never part of the purchased monetary balance.
  effectiveAvailability?: "free_minute" | "credits" | "none";
};

export type RewardDisplay = { title: string; detail: string; tone: "info" | "active" | "muted" };

// Pure mapping from the server's reward state to user-facing copy. Shows
// nothing about how eligibility is decided.
export function describeWelcomeReward(reward: WelcomeRewardStatus | null | undefined): RewardDisplay {
  const minutes = Math.max(1, Math.round((reward?.grantedSeconds || reward?.seconds || 60) / 60));
  switch (reward?.status) {
    case "available":
      return {
        title: `${minutes} free minute available`,
        detail: `Your first ${minutes} minute to a local mobile number is free. It applies automatically when you call.`,
        tone: "info",
      };
    case "in_use":
      return { title: "Free minute in use", detail: "Your free minute is being used on a call right now.", tone: "active" };
    case "redeemed":
      return { title: "Reward used", detail: "Your free introductory minute has been used.", tone: "muted" };
    case "verify_phone":
      return {
        title: "Verify your phone to unlock",
        detail: "Verify your own phone number to unlock the one-minute new-user reward for local-carrier calls.",
        tone: "info",
      };
    default:
      return { title: "No reward available", detail: "No free minute is attached to this account.", tone: "muted" };
  }
}

export function describeEffectiveAvailability(reward: WelcomeRewardStatus | null | undefined, hasPurchasedCredit: boolean): string {
  // Prefer the server-computed value; derive locally only if it is absent.
  const effective =
    reward?.effectiveAvailability ??
    (hasPurchasedCredit ? "credits" : reward?.status === "available" || reward?.status === "in_use" ? "free_minute" : "none");
  if (effective === "free_minute") return "You can call local mobile numbers now using your free minute.";
  if (effective === "credits") return "You can call local mobile numbers using your purchased credit.";
  return "Top up to call local mobile numbers.";
}

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
    return {
      status: data.status,
      seconds: Number(data.seconds) || 0,
      grantedSeconds: Number(data.grantedSeconds) || undefined,
      effectiveAvailability: data.effectiveAvailability,
    };
  } catch {
    return { status: "unavailable", seconds: 0 };
  }
}
