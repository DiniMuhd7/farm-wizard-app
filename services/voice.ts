import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE } from "@/config/client";

export type VoiceCall = { disconnect: () => Promise<void> | void };

export type IncomingCall = {
  from: string;
  accept: () => Promise<VoiceCall>;
  reject: () => void;
};

// `Voice` is a class, not a namespace of static functions — every official
// Twilio example (npm README, iOS/Android getting-started docs, changelog)
// instantiates it once with `new Voice()` and calls connect()/register() on
// that instance. Calling connect()/register() directly on the imported
// `Voice` class calls them on the constructor function itself, where they
// don't exist, and throws "voice.connect is not a function".
type CallInviteInstance = {
  accept(): Promise<VoiceCall>;
  reject(): void;
  from?: string;
  customParameters?: Map<string, string> | Record<string, string>;
};
type VoiceInstance = {
  connect(token: string, options: { params: { To: string } }): Promise<VoiceCall>;
  register(token: string): Promise<void>;
  on(eventName: string, handler: (...args: any[]) => void): void;
};
type VoiceClass = (new () => VoiceInstance) & { Event?: { CallInvite?: string } };
type VoiceSdkModule = { Voice?: VoiceClass };

let activeCall: VoiceCall | null = null;
let voice: VoiceInstance | null = null;

// Set by whichever screen is currently able to show an incoming-call UI
// (see context/VoiceCallProvider.tsx). Only one listener is supported at a
// time by design — this app has a single call UI, not a queue of them.
let incomingCallHandler: ((call: IncomingCall) => void) | null = null;

function callerIdFrom(callInvite: CallInviteInstance): string {
  if (callInvite.from) return callInvite.from;
  const params = callInvite.customParameters;
  if (params instanceof Map) return params.get("From") ?? "Unknown";
  return (params as Record<string, string> | undefined)?.From ?? "Unknown";
}

function getVoice(): VoiceInstance {
  if (voice) return voice;

  // Load the native module only when a user starts or registers a call. This
  // keeps application boot independent of the optional native Voice module and
  // lets the dialer show a useful error instead of crashing at startup.
  // The package still requires an Expo development/production build, not Expo Go.
  const sdk = require("@twilio/voice-react-native-sdk") as VoiceSdkModule;
  if (!sdk?.Voice) throw new Error("Voice calling is not included in this build.");
  voice = new sdk.Voice();

  // Attach the incoming-call listener once, at construction time, so an
  // invite arriving before a screen has subscribed (e.g. right after
  // register()) is still captured rather than silently dropped.
  const eventName = sdk.Voice.Event?.CallInvite ?? "callInvite";
  voice.on(eventName, (callInvite: CallInviteInstance) => {
    if (!incomingCallHandler) return; // no UI currently able to show it
    incomingCallHandler({
      from: callerIdFrom(callInvite),
      accept: async () => {
        activeCall = await callInvite.accept();
        return activeCall;
      },
      reject: () => callInvite.reject(),
    });
  });

  return voice;
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
  activeCall = await getVoice().connect(token, { params: { To: destination } });
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
  await getVoice().register(token);
}

// Subscribe to incoming-call invites. Call with `null` to unsubscribe (e.g.
// on sign-out, or when the overlay unmounts). Returns nothing — this is a
// single global slot, not an event emitter, because the app only ever shows
// one incoming-call UI at a time.
export function setIncomingCallHandler(handler: ((call: IncomingCall) => void) | null) {
  incomingCallHandler = handler;
}
