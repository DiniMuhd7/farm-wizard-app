/**
 * Focused regression tests for the background-audio-session wiring added to
 * keep call audio alive once the app is backgrounded (see the
 * `ensureBackgroundAudioSession` helper in `./voice.ts`). Everything else in
 * this file depends on native modules this sandbox can't load, so these
 * tests mock just enough of `expo-av`, AsyncStorage, the Twilio SDK and
 * `@/config/client` to exercise the two real call paths: placing an outgoing
 * call and accepting an incoming one.
 */

const mockSetAudioModeAsync = jest.fn().mockResolvedValue(undefined);
const mockRequestPermissionsAsync = jest.fn().mockResolvedValue({ granted: true, canAskAgain: true });

jest.mock("expo-av", () => ({
  Audio: {
    setAudioModeAsync: (...args: unknown[]) => mockSetAudioModeAsync(...args),
    requestPermissionsAsync: (...args: unknown[]) => mockRequestPermissionsAsync(...args),
  },
  InterruptionModeIOS: { DoNotMix: 1 },
  InterruptionModeAndroid: { DoNotMix: 1 },
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn().mockResolvedValue("test-session-token"),
}));

jest.mock("@/config/client", () => ({
  API_BASE: "https://example.test",
  refreshGuestSession: jest.fn().mockResolvedValue(false),
}));

const mockConnect = jest.fn();
let mockInviteHandler: ((invite: unknown) => void) | null = null;

jest.mock(
  "@twilio/voice-react-native-sdk",
  () => ({
    Voice: class {
      connect = mockConnect;
      register = jest.fn();
      on(eventName: string, handler: (invite: unknown) => void) {
        if (eventName === "callInvite") mockInviteHandler = handler;
      }
    },
  }),
  { virtual: true }
);

global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  status: 200,
  json: async () => ({ token: "voice-access-token" }),
}) as unknown as typeof fetch;

describe("ensureBackgroundAudioSession wiring", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    mockRequestPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true });
    mockSetAudioModeAsync.mockResolvedValue(undefined);
    mockConnect.mockResolvedValue({ on: jest.fn(), off: jest.fn(), disconnect: jest.fn() });
    mockInviteHandler = null;
  });

  it("activates a background-capable audio session before placing an outgoing call", async () => {
    const { startVoiceCall } = require("./voice");
    await startVoiceCall("+15551234567");

    expect(mockSetAudioModeAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
      })
    );
    // The audio session must be configured before the call is actually
    // connected, not after — otherwise a background transition during the
    // brief window before this resolves would still drop the audio.
    const audioCallOrder = mockSetAudioModeAsync.mock.invocationCallOrder[0];
    const connectCallOrder = mockConnect.mock.invocationCallOrder[0];
    expect(audioCallOrder).toBeLessThan(connectCallOrder);
  });

  it("does not block placing a call when the audio session configuration rejects", async () => {
    const { startVoiceCall } = require("./voice");
    mockSetAudioModeAsync.mockRejectedValueOnce(new Error("Unsupported on this platform"));

    await expect(startVoiceCall("+15551234567")).resolves.toBeDefined();
    expect(mockConnect).toHaveBeenCalled();
  });

  it("activates the same background-capable audio session before accepting an incoming call", async () => {
    const { setIncomingCallHandler, startVoiceCall } = require("./voice");
    await startVoiceCall("+15551234567"); // constructs the Voice instance and attaches the invite listener
    mockSetAudioModeAsync.mockClear();

    let receivedIncomingCall: { accept: () => Promise<unknown> } | null = null;
    setIncomingCallHandler((incoming: { accept: () => Promise<unknown> }) => {
      receivedIncomingCall = incoming;
    });

    expect(mockInviteHandler).toBeInstanceOf(Function);
    const callInviteAccept = jest.fn().mockResolvedValue({ on: jest.fn(), off: jest.fn(), disconnect: jest.fn() });
    mockInviteHandler?.({ from: "+15557654321", accept: callInviteAccept, reject: jest.fn() });

    expect(receivedIncomingCall).not.toBeNull();
    await receivedIncomingCall!.accept();

    expect(mockSetAudioModeAsync).toHaveBeenCalledWith(
      expect.objectContaining({ staysActiveInBackground: true, playsInSilentModeIOS: true })
    );
    expect(callInviteAccept).toHaveBeenCalled();
  });
});
