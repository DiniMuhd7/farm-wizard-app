import { useEffect, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Camera, CameraOff, Mic, MicOff, PhoneOff } from "lucide-react-native";
import { TwilioVideo, TwilioVideoLocalView, TwilioVideoParticipantView } from "react-native-twilio-video-webrtc";
import { startVideoCall } from "@/services/video";

export default function VideoCallScreen() {
  const { number } = useLocalSearchParams<{ number: string }>();
  const video = useRef<any>(null);
  const [connected, setConnected] = useState(false);
  const [remoteSid, setRemoteSid] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(true);
  useEffect(() => { startVideoCall(String(number)).then(({ token, room }) => video.current?.connect({ accessToken: token, roomName: room })).catch((error) => Alert.alert("Unable to start video call", error.message, [{ text: "OK", onPress: () => router.back() }])); return () => video.current?.disconnect?.(); }, [number]);
  return <SafeAreaView style={s.safe}><View style={s.page}>
    <TwilioVideo ref={video} onRoomDidConnect={() => setConnected(true)} onRoomDidDisconnect={() => router.back()} onParticipantAddedVideoTrack={({ participant }: any) => setRemoteSid(participant.sid)} enableCamera={cameraOn} enableAudio={!muted} />
    {remoteSid ? <TwilioVideoParticipantView style={s.remote} trackIdentifier={{ participantSid: remoteSid, videoTrackSid: undefined }} /> : <View style={s.waiting}><Text style={s.waitingText}>{connected ? "Waiting for the other 9tel user…" : "Connecting video call…"}</Text></View>}
    <TwilioVideoLocalView enabled={cameraOn} style={s.local} />
    <View style={s.controls}><Pressable onPress={() => { video.current?.setLocalAudioEnabled?.(muted); setMuted(!muted); }} style={s.control}>{muted ? <MicOff color="#FFF"/> : <Mic color="#FFF"/>}</Pressable><Pressable onPress={() => { video.current?.setLocalVideoEnabled?.(!cameraOn); setCameraOn(!cameraOn); }} style={s.control}>{cameraOn ? <Camera color="#FFF"/> : <CameraOff color="#FFF"/>}</Pressable><Pressable onPress={() => video.current?.disconnect?.()} style={[s.control,s.hang]}><PhoneOff color="#FFF"/></Pressable></View>
  </View></SafeAreaView>;
}
const s=StyleSheet.create({safe:{flex:1,backgroundColor:"#100D2F"},page:{flex:1},remote:{...StyleSheet.absoluteFillObject},waiting:{flex:1,alignItems:"center",justifyContent:"center"},waitingText:{color:"#FFF",fontFamily:"Poppins-Regular"},local:{position:"absolute",right:18,top:20,width:110,height:160,borderRadius:14,overflow:"hidden"},controls:{position:"absolute",bottom:34,left:0,right:0,flexDirection:"row",justifyContent:"center",gap:18},control:{width:56,height:56,borderRadius:28,backgroundColor:"#4E4975",alignItems:"center",justifyContent:"center"},hang:{backgroundColor:"#D94B5A"}});
