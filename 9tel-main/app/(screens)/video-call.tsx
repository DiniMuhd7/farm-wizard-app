import { useEffect, useRef, useState } from "react";
import { Alert, PermissionsAndroid, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Camera, CameraOff, Mic, MicOff, PhoneOff } from "lucide-react-native";
import { TwilioVideo, TwilioVideoLocalView, TwilioVideoParticipantView } from "react-native-twilio-video-webrtc";
import { startVideoCall } from "@/services/video";
import { themedStyles, themeColor, useThemeVersion } from "@/theme";
import { tr } from "@/utils/tr";
import { useTranslation } from "react-i18next";

async function ensureMediaPermissions(): Promise<boolean> {
  // The Twilio Video SDK cannot connect on Android without CAMERA and
  // RECORD_AUDIO granted at runtime (iOS prompts on first use via Info.plist).
  if (Platform.OS !== "android") return true;
  const result = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.CAMERA,
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
  ]);
  return Object.values(result).every((value) => value === PermissionsAndroid.RESULTS.GRANTED);
}

export default function VideoCallScreen() {
  useTranslation();
  useThemeVersion();
  const { number } = useLocalSearchParams<{ number: string }>();
  const video = useRef<any>(null);
  const failedRef = useRef(false);
  const [connected, setConnected] = useState(false);
  const [remoteSid, setRemoteSid] = useState<string | null>(null);
  const [remoteTrackSid, setRemoteTrackSid] = useState<string | undefined>(undefined);
  const [muted, setMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(true);

  const fail = (title: string, message: string) => {
    if (failedRef.current) return;
    failedRef.current = true;
    Alert.alert(title, message, [{ text: tr("OK"), onPress: () => router.back() }]);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!(await ensureMediaPermissions())) {
        return fail(tr("Camera and microphone needed"), tr("Allow camera and microphone access in your device settings to place video calls."));
      }
      const { token, room } = await startVideoCall(String(number));
      if (cancelled) return;
      video.current?.connect({ accessToken: token, roomName: room });
    })().catch((error) => !cancelled && fail(tr("Unable to start video call"), error.message));
    return () => {
      cancelled = true;
      video.current?.disconnect?.();
    };
  }, [number]);

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.page}>
        <TwilioVideo
          ref={video}
          onRoomDidConnect={() => setConnected(true)}
          onRoomDidDisconnect={() => { if (!failedRef.current) router.back(); }}
          onRoomDidFailToConnect={(event: any) => fail(tr("Unable to start video call"), event?.error || event?.reason || tr("Could not join the video room. Please try again."))}
          onParticipantAddedVideoTrack={({ participant, track }: any) => {
            setRemoteSid(participant.sid);
            setRemoteTrackSid(track?.trackSid);
          }}
          onParticipantRemovedVideoTrack={() => { setRemoteSid(null); setRemoteTrackSid(undefined); }}
          enableCamera={cameraOn}
          enableAudio={!muted}
        />
        {remoteSid ? (
          <TwilioVideoParticipantView style={s.remote} trackIdentifier={{ participantSid: remoteSid, videoTrackSid: remoteTrackSid }} />
        ) : (
          <View style={s.waiting}>
            <Text style={s.waitingText}>{connected ? tr("Waiting for the other 9tel user…") : tr("Connecting video call…")}</Text>
          </View>
        )}
        <TwilioVideoLocalView enabled={cameraOn} style={s.local} />
        <View style={s.controls}>
          <Pressable onPress={() => { video.current?.setLocalAudioEnabled?.(muted); setMuted(!muted); }} style={s.control}>
            {muted ? <MicOff color={themeColor("#FFF")} /> : <Mic color={themeColor("#FFF")} />}
          </Pressable>
          <Pressable onPress={() => { video.current?.setLocalVideoEnabled?.(!cameraOn); setCameraOn(!cameraOn); }} style={s.control}>
            {cameraOn ? <Camera color={themeColor("#FFF")} /> : <CameraOff color={themeColor("#FFF")} />}
          </Pressable>
          <Pressable onPress={() => { video.current?.disconnect?.(); router.back(); }} style={[s.control, s.hang]}>
            <PhoneOff color={themeColor("#FFF")} />
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const s = themedStyles({
  safe: { flex: 1, backgroundColor: "#100D2F" },
  page: { flex: 1 },
  remote: { ...StyleSheet.absoluteFillObject },
  waiting: { flex: 1, alignItems: "center", justifyContent: "center" },
  waitingText: { color: "#FFF", fontFamily: "Poppins-Regular" },
  local: { position: "absolute", right: 18, top: 20, width: 110, height: 160, borderRadius: 14, overflow: "hidden" },
  controls: { position: "absolute", bottom: 34, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 18 },
  control: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#4E4975", alignItems: "center", justifyContent: "center" },
  hang: { backgroundColor: "#D94B5A" },
});
