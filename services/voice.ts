import AsyncStorage from "@react-native-async-storage/async-storage";
import { Audio } from "expo-av";
import { API_BASE } from "@/config/client";

// Real states a Call goes through, sourced from Twilio's own
// twilio-voice-react-native GitHub issues showing `Call.Event.Ringing`,
// `.Connected`, `.Disconnected`, `.ConnectFailure`, `.Reconnecting`,
// `.Reconnected` used against this exact package. There is no "dialing"
// state of our own — these are the SDK's real states, not UI labels.
export type CallStatus =
  | "connecting"
  | "ringing"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "failed";

export type VoiceCall = {
  disconnect: () => Promise<void> | void;
  // Every source describing this SDK's Call API (native Android/iOS
  // getting-started guides, the JS SDK it's modeled on) uses this same
  // mute(shouldMute) shape, but I could not confirm the exact RN-package
  // return type — treat the resolved value as informational, not load-bearing.
  mute?: (shouldMute: boolean) => Promise<unknown> | unknown;
  on(eventName: string, handler: (...args: any[]) => void): void;
  off?(eventName: string, handler: (...args: any[]) => void): void;
};

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
type AudioDevice = { type?: string; uuid?: string; name?: string; select(): Promise<unknown> };
type VoiceInstance = {
  connect(token: string, options: { params: { To: string } }): Promise<VoiceCall>;
  register(token: string): Promise<void>;
  on(eventName: string, handler: (...args: any[]) => void): void;
  // Undocumented in the parts of the SDK reference I could confirm — present
  // per a maintainer-reported GitHub issue (#482) against this exact package,
  // but the exact return shape isn't verified. Treated as best-effort below.
  getAudioDevices?: () => Promise<{ audioDevices: AudioDevice[]; selectedDevice?: AudioDevice }>;
};
type CallEventNames = {
  Connected?: string;
  Disconnected?: string;
  Ringing?: string;
  ConnectFailure?: string;
  Reconnecting?: string;
  Reconnected?: string;
};
type VoiceClass = (new () => VoiceInstance) & { Event?: { CallInvite?: string } };
type VoiceSdkModule = { Voice?: VoiceClass; Call?: { Event?: CallEventNames } };

let activeCall: VoiceCall | null = null;
let voice: VoiceInstance | null = null;
let callEventNames: Required<CallEventNames> = {
  Connected: "connected",
  Disconnected: "disconnected",
  Ringing: "ringing",
  ConnectFailure: "connectFailure",
  Reconnecting: "reconnecting",
  Reconnected: "reconnected",
};

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

// Android requires an explicit runtime grant before any audio session can
// use the mic — without one, nothing in this file's own code requests it,
// which means the very first call attempt is also the first time this gets
// tested. expo-av's Audio.requestPermissionsAsync() covers both platforms
// (it wraps AVAudioSession on iOS and RECORD_AUDIO on Android in one call),
// so it's used here instead of a second, Android-only permissions API for
// a permission this project already depends on expo-av to request.
async function ensureMicPermission(): Promise<void> {
  const { granted, canAskAgain } = await Audio.requestPermissionsAsync();
  if (granted) return;
  throw new Error(
    canAskAgain
      ? "Microphone access is required to make or receive calls."
      : "Microphone access is blocked. Enable it in your device's Settings to make or receive calls."
  );
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

  // Prefer the SDK's own event-name constants; fall back to the lowercase
  // string literals every prior-art example uses, in case this SDK version
  // doesn't expose `Call.Event` (mirrors the same fallback used below for
  // Voice.Event.CallInvite).
  if (sdk.Call?.Event) {
    callEventNames = {
      Connected: sdk.Call.Event.Connected ?? callEventNames.Connected,
      Disconnected: sdk.Call.Event.Disconnected ?? callEventNames.Disconnected,
      Ringing: sdk.Call.Event.Ringing ?? callEventNames.Ringing,
      ConnectFailure: sdk.Call.Event.ConnectFailure ?? callEventNames.ConnectFailure,
      Reconnecting: sdk.Call.Event.Reconnecting ?? callEventNames.Reconnecting,
      Reconnected: sdk.Call.Event.Reconnected ?? callEventNames.Reconnected,
    };
  }

  // Attach the incoming-call listener once, at construction time, so an
  // invite arriving before a screen has subscribed (e.g. right after
  // register()) is still captured rather than silently dropped.
  const inviteEventName = sdk.Voice.Event?.CallInvite ?? "callInvite";
  voice.on(inviteEventName, (callInvite: CallInviteInstance) => {
    if (!incomingCallHandler) return; // no UI currently able to show it
    incomingCallHandler({
      from: callerIdFrom(callInvite),
      accept: async () => {
        await ensureMicPermission();
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
  await ensureMicPermission();
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

// Drives a screen's UI off the call's real lifecycle instead of a fake timer.
// Returns an unsubscribe function; always call it on unmount, since the SDK
// otherwise keeps every listener alive for the life of the Call object.
export function subscribeToCallStatus(
  call: VoiceCall,
  onStatusChange: (status: CallStatus) => void
): () => void {
  // activeCall was previously only ever cleared by endActiveVoiceCall() —
  // the explicit "I tapped hang up" path. If the call instead ended on its
  // own (the far end hung up, or the far end never answered and Twilio's
  // <Dial> action returned the "unavailable" TwiML), activeCall stayed set
  // to this now-dead Call object. The next call attempt's call.tsx effect
  // would then see getActiveVoiceCall() return non-null, assume that dead
  // object was a real active call, attach to it instead of dialing fresh —
  // and since a dead Call object emits no further events, the screen was
  // stuck on "Connecting…" until the user manually ended and redialed.
  const clearIfCurrent = () => {
    if (activeCall === call) activeCall = null;
  };
  const bindings: Array<[string, (...args: any[]) => void]> = [
    [callEventNames.Ringing, () => onStatusChange("ringing")],
    [callEventNames.Connected, () => onStatusChange("connected")],
    [callEventNames.Reconnecting, () => onStatusChange("reconnecting")],
    [callEventNames.Reconnected, () => onStatusChange("connected")],
    [callEventNames.Disconnected, () => { clearIfCurrent(); onStatusChange("disconnected"); }],
    [callEventNames.ConnectFailure, () => { clearIfCurrent(); onStatusChange("failed"); }],
  ];
  bindings.forEach(([eventName, handler]) => call.on(eventName, handler));
  return () => bindings.forEach(([eventName, handler]) => call.off?.(eventName, handler));
}

// Mutes/unmutes the active call's outgoing audio. Returns whether it
// actually took effect — the caller should not flip its own mute icon on a
// `false` result, since that would show muted while the far end still hears
// everything.
export async function setCallMuted(call: VoiceCall, shouldMute: boolean): Promise<boolean> {
  if (typeof call.mute !== "function") return false;
  try {
    await call.mute(shouldMute);
    return true;
  } catch (error) {
    console.warn("Unable to change mute state:", (error as Error)?.message);
    return false;
  }
}

// Best-effort speaker/earpiece routing. This device-enumeration API is
// reported by SDK users (twilio/twilio-voice-react-native#482) against this
// exact package, but its selection method isn't documented anywhere I could
// verify — wrapped defensively so a shape mismatch degrades to "did nothing"
// rather than crashing the call.
export async function setSpeakerphoneEnabled(enabled: boolean): Promise<boolean> {
  const instance = voice;
  if (!instance?.getAudioDevices) return false;
  try {
    const { audioDevices } = await instance.getAudioDevices();
    const wantType = enabled ? "speaker" : "earpiece";
    const target = audioDevices?.find((device) =>
      (device.type ?? device.name ?? "").toLowerCase().includes(wantType)
    );
    if (!target) return false;
    await target.select();
    return true;
  } catch (error) {
    console.warn("Unable to change audio route:", (error as Error)?.message);
    return false;
  }
}
