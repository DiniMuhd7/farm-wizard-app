import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE } from "@/config/client";

export type VoiceCall = { disconnect: () => Promise<void> | void };
type VoiceSdk = {
  connect(token: string, options: { params: { To: string } }): Promise<VoiceCall>;
  register(token: string): Promise<void>;
};

let activeCall: VoiceCall | null = null;
let voiceSdk: VoiceSdk | null = null;

function getVoiceSdk(): VoiceSdk {
  if (voiceSdk) return voiceSdk;

  // Load the native module only when a user starts or registers a call. This
  // keeps application boot independent of the optional native Voice module and
  // lets the dialer show a useful error instead of crashing at startup.
  // The package still requires an Expo development/production build, not Expo Go.
  const sdk = require("@twilio/voice-react-native-sdk") as { Voice?: VoiceSdk };
  if (!sdk?.Voice) throw new Error("Voice calling is not included in this build.");
  voiceSdk = sdk.Voice;
  return sdk.Voice;
}

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
  activeCall = await getVoiceSdk().connect(token, { params: { To: destination } }) as VoiceCall;
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
  await getVoiceSdk().register(token);
}
