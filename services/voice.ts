import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE } from "@/config/client";

// This package requires an Expo development build; it is not available in Expo Go.
import { Voice } from "@twilio/voice-react-native-sdk";

export type VoiceCall = { disconnect: () => Promise<void> | void };

let activeCall: VoiceCall | null = null;

async function accessToken() {
  const sessionToken = await AsyncStorage.getItem("token");
  if (!sessionToken) throw new Error("Sign in to place a call.");
  const response = await fetch(`${API_BASE}/api/v1/voice/token`, {
    headers: { Authorization: `Bearer ${sessionToken}` },
  });
  if (!response.ok) throw new Error("Voice calling is unavailable. Please try again later.");
  const data = await response.json();
  if (!data.token) throw new Error("The voice service did not return an access token.");
  return data.token as string;
}

export async function startVoiceCall(destination: string): Promise<VoiceCall> {
  const token = await accessToken();
  activeCall = await Voice.connect(token, { params: { To: destination } }) as VoiceCall;
  return activeCall;
}

export function getActiveVoiceCall() {
  return activeCall;
}

export async function endActiveVoiceCall() {
  try {
    await activeCall?.disconnect();
  } finally {
    activeCall = null;
  }
}

export async function registerForIncomingCalls() {
  const token = await accessToken();
  await Voice.register(token);
}
