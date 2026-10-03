import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Mic, MicOff, PhoneOff, Speaker, UserPlus, Volume2 } from "lucide-react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useKeepAwake } from "expo-keep-awake";
import {
  endActiveVoiceCall,
  getActiveVoiceCall,
  setCallMuted,
  setSpeakerphoneEnabled,
  startVoiceCall,
  subscribeToCallStatus,
  type CallStatus,
  type VoiceCall,
} from "@/services/voice";
import { useLoginContext } from "@/context/LoginProvider";
import { classifyDestination } from "@/services/callEligibility";
import { getCreditsBalance, hasSufficientCreditsForOneMinute } from "@/services/credits";
import { getWelcomeReward } from "@/services/rewards";
import CallInterstitialSlot from "@/components/CallInterstitialSlot";
import { resolveCallPlan, type NineTelAccountPreview, type ResolvedCallPlan } from "@/types/callPlans";

const STATUS_LABEL: Record<CallStatus, string> = {
  connecting: "Connecting…",
  ringing: "Ringing…",
  connected: "Connected",
  reconnecting: "Reconnecting…",
  disconnected: "Call ended",
  failed: "Call failed",
};

// The call screen's life cycle, gated by which plan (see
// types/callPlans.ts) applies to this specific destination:
//   resolving-plan       -> figuring out destination + Airbundle status
//   insufficient-credits -> Prepaid only: balance can't cover even one
//                           billable minute — call is blocked with a top-up
//                           CTA
//   call                 -> the actual call UI
type Phase = "resolving-plan" | "insufficient-credits" | "call";

export default function CallScreen() {
  // Keeps the screen from auto-locking for as long as this screen is
  // mounted, i.e. for the whole call — a locked screen on some devices
  // suspends the app enough to interrupt the audio session before
  // `staysActiveInBackground` (services/voice.ts) can take over.
  useKeepAwake();

  const { user } = useLoginContext();
  const { number = "+234 801 234 5678", video } = useLocalSearchParams<{ number: string; video: string }>();
  const displayNumber = Array.isArray(number) ? number[0] : number;
  const [account, setAccount] = useState<NineTelAccountPreview | null>(null);
  const initial = (account?.displayName ?? displayNumber).replace(/[^a-z0-9]/gi, "").charAt(0).toUpperCase() || "?";
  const [status, setStatus] = useState<CallStatus>("connecting");
  const [muted, setMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const pulse = useRef(new Animated.Value(1)).current;
  const callRef = useRef<VoiceCall | null>(null);
  const leftRef = useRef(false); // guards against navigating back twice

  const [phase, setPhase] = useState<Phase>("resolving-plan");
  const [plan, setPlan] = useState<ResolvedCallPlan>("unmetered");

  const leaveScreen = () => {
    if (leftRef.current) return;
    leftRef.current = true;
    router.back();
  };

  // Resolve which plan governs this specific call before doing anything
  // else — Airbundle minutes cover 9tel and carrier calls; carrier calls
  // without an Airbundle use Prepaid (credits-gated); anything we
  // can't positively classify fails open to "unmetered" (today's
  // behavior) rather than guessing — see classifyDestination.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { kind, account: matched } = await classifyDestination(displayNumber);
      if (cancelled) return;
      setAccount(matched ?? null);
      const resolved = resolveCallPlan(kind, user?.isPremium === true);
      setPlan(resolved);

      if (resolved === "prepaid") {
        try {
          const balance = await getCreditsBalance();
          if (cancelled) return;
          // The one-time welcome minute counts as enough to place the call;
          // the backend is what actually enforces it and its 60s cap.
          const welcome = hasSufficientCreditsForOneMinute(balance) ? null : await getWelcomeReward();
          if (cancelled) return;
          if (!hasSufficientCreditsForOneMinute(balance) && welcome?.status !== "available") {
            setPhase("insufficient-credits");
            return;
          }
        } catch {
          // Can't confirm the balance right now — fail open rather than
          // blocking a call the person may well be able to pay for; the
          // authoritative check still happens backend-side when the call
          // actually completes (see backend's debitForCompletedCall).
        }
      }

      setPhase("call");
    })();

    return () => {
      cancelled = true;
    };
  }, [displayNumber, user?.isPremium]);

  // Attach to the real call — either one already active (this screen was
  // opened after accepting an incoming call) or a fresh outgoing one — and
  // drive `status` off the SDK's actual lifecycle instead of a fake timer.
  // Only starts once the plan/credits checks above have cleared.
  useEffect(() => {
    if (phase !== "call") return;
    let unsubscribe: (() => void) | null = null;
    let cancelled = false;

    const attach = (call: VoiceCall) => {
      if (cancelled) return;
      callRef.current = call;
      unsubscribe = subscribeToCallStatus(call, (next) => {
        setStatus(next);
        if (next === "disconnected" || next === "failed") leaveScreen();
      });
    };

    const existingCall = getActiveVoiceCall();
    if (existingCall) {
      attach(existingCall);
    } else {
      startVoiceCall(displayNumber)
        .then(attach)
        .catch((error) => {
          if (cancelled) return;
          Alert.alert("Unable to connect", error.message, [{ text: "OK", onPress: leaveScreen }]);
        });
    }

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [displayNumber, phase]);

  // Pulse animation runs the whole time the screen is open, independent of
  // call state — purely decorative.
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 1300, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1300, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // Only count while actually connected — not from the moment this screen
  // renders, which used to start the clock during the ringback tone.
  useEffect(() => {
    if (status !== "connected") return;
    const timer = setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [status]);

  const time = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  const endCall = async () => {
    try {
      await endActiveVoiceCall();
    } finally {
      leaveScreen();
    }
  };

  const toggleMute = async () => {
    const call = callRef.current;
    if (!call) return;
    const applied = await setCallMuted(call, !muted);
    // Only flip the icon if the SDK confirmed it took effect — an icon that
    // says "muted" while the far end still hears you is worse than no
    // feedback at all.
    if (applied) setMuted(!muted);
  };

  const toggleSpeaker = async () => {
    const applied = await setSpeakerphoneEnabled(!speakerOn);
    if (applied) setSpeakerOn(!speakerOn);
  };

  if (phase === "resolving-plan") {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.gatePage}>
          <ActivityIndicator color="#FFF" size="large" />
          <Text style={s.gateTitle}>Preparing your call…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (phase === "insufficient-credits") {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.gatePage}>
          <Text style={s.gateTitle}>Not enough Prepaid credit</Text>
          <Text style={s.gateCopy}>
            Calls to mobile numbers use your 9tel credits balance. Top up to continue this call.
          </Text>
          <View style={s.gateActions}>
            <Pressable
              style={s.gateBtn}
              onPress={() => {
                leftRef.current = true;
                router.replace("/(tabs)/(sub-tabs)/calling-plan");
              }}
            >
              <Text style={s.gateBtnText}>Top up credits</Text>
            </Pressable>
            <Pressable style={s.gateBtnAlt} onPress={leaveScreen}>
              <Text style={s.gateBtnAltText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.page}>
        <View style={s.top}>
          <Text style={s.brand}>9tel</Text>
          <Text style={s.secure}>Encrypted call</Text>
        </View>

        <View style={s.contact}>
          <Animated.View style={[s.ring, { transform: [{ scale: pulse }] }]} />
          <View style={s.avatar}>
            <Text style={s.initial}>{initial}</Text>
          </View>
          <Text style={s.name}>{account?.displayName ?? displayNumber}</Text>
          <Text style={s.number}>{account ? `${displayNumber} · 9tel account` : "Phone number"}</Text>
          <View style={s.status}>
            <View style={s.live} />
            <Text style={s.statusText}>
              {video === "true" && status === "connected" ? "Video call" : STATUS_LABEL[status]}
              {status === "connected" ? ` · ${time}` : ""}
            </Text>
          </View>
        </View>

        {plan !== "airbundle" && <CallInterstitialSlot />}

        <View style={s.quality}>
          <View>
            <Text style={s.qualityTitle}>
              {status === "connected" ? "Excellent connection" : STATUS_LABEL[status]}
            </Text>
            <Text style={s.qualityCopy}>Your call is protected by 9tel.</Text>
          </View>
          <View style={s.bars}>
            <View style={[s.bar, { height: 8 }]} />
            <View style={[s.bar, { height: 13 }]} />
            <View style={[s.bar, { height: 18 }]} />
            <View style={[s.bar, { height: 23 }]} />
          </View>
        </View>

        <View style={s.controls}>
          <Control icon={muted ? MicOff : Mic} label={muted ? "Unmute" : "Mute"} onPress={toggleMute} active={muted} />
          <Control
            icon={speakerOn ? Speaker : Volume2}
            label="Speaker"
            onPress={toggleSpeaker}
            active={speakerOn}
          />
          <Control
            icon={UserPlus}
            label="Add"
            onPress={() => Alert.alert("Add participant", "Invite a contact to this call.")}
          />
        </View>

        <Pressable style={s.end} onPress={endCall}>
          <PhoneOff color="#FFF" size={26} />
          <Text style={s.endText}>End call</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function Control({
  icon: Icon,
  label,
  onPress,
  active,
}: {
  icon: any;
  label: string;
  onPress: () => void;
  active?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={s.controlWrap}>
      <View style={[s.control, active && s.controlActive]}>
        <Icon color={active ? "#FFF" : "#5147AF"} size={22} />
      </View>
      <Text style={s.controlLabel}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#211B59" },
  page: { flex: 1, padding: 23 },
  gatePage: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 10 },
  gateTitle: { color: "#FFF", fontSize: 18, fontFamily: "Poppins-SemiBold", textAlign: "center", marginTop: 12 },
  gateCopy: { color: "#D0CCFC", fontSize: 13, fontFamily: "Poppins-Regular", textAlign: "center", lineHeight: 19 },
  gateActions: { marginTop: 18, width: "100%", gap: 10 },
  gateBtn: { backgroundColor: "#5147AF", height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  gateBtnText: { color: "#FFF", fontFamily: "Poppins-SemiBold", fontSize: 14 },
  gateBtnAlt: { backgroundColor: "rgba(255,255,255,.1)", height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  gateBtnAltText: { color: "#FFF", fontFamily: "Poppins-Medium", fontSize: 14 },
  top: { flexDirection: "row", justifyContent: "space-between" },
  brand: { color: "#FFF", fontSize: 27, fontFamily: "Poppins-Bold", letterSpacing: -1 },
  secure: { color: "#CFCBFF", fontSize: 11, fontFamily: "Poppins-Medium", marginTop: 9 },
  contact: { alignItems: "center", marginTop: 76 },
  ring: { position: "absolute", height: 196, width: 196, borderRadius: 98, backgroundColor: "#655CD0", opacity: 0.33 },
  avatar: {
    height: 148,
    width: 148,
    borderRadius: 74,
    backgroundColor: "#F1B296",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
    borderWidth: 7,
    borderColor: "rgba(255,255,255,.13)",
  },
  initial: { fontSize: 58, color: "#6A3156", fontFamily: "Poppins-SemiBold" },
  name: { color: "#FFF", fontSize: 27, fontFamily: "Poppins-SemiBold", marginTop: 24 },
  number: { color: "#D0CCFC", fontSize: 13, fontFamily: "Poppins-Regular", marginTop: 3 },
  status: { flexDirection: "row", alignItems: "center", marginTop: 13 },
  live: { height: 7, width: 7, borderRadius: 4, backgroundColor: "#7BE4BB", marginRight: 7 },
  statusText: { color: "#E6E3FF", fontFamily: "Poppins-Medium", fontSize: 12 },
  quality: {
    marginTop: 42,
    backgroundColor: "rgba(255,255,255,.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.08)",
    borderRadius: 19,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  qualityTitle: { color: "#FFF", fontFamily: "Poppins-Medium", fontSize: 13 },
  qualityCopy: { color: "#BBB6E6", fontFamily: "Poppins-Regular", fontSize: 10.5, marginTop: 2 },
  bars: { height: 26, flexDirection: "row", alignItems: "flex-end", gap: 3 },
  bar: { width: 4, backgroundColor: "#7BE4BB", borderRadius: 3 },
  controls: { flexDirection: "row", justifyContent: "space-around", marginTop: 43 },
  controlWrap: { alignItems: "center" },
  control: { height: 57, width: 57, borderRadius: 20, backgroundColor: "#EEECFF", alignItems: "center", justifyContent: "center" },
  controlActive: { backgroundColor: "#655CD0" },
  controlLabel: { color: "#D9D6FC", fontSize: 11, fontFamily: "Poppins-Medium", marginTop: 8 },
  end: {
    alignSelf: "center",
    marginTop: 29,
    height: 57,
    paddingHorizontal: 24,
    borderRadius: 20,
    backgroundColor: "#EF6C6B",
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  endText: { color: "#FFF", fontFamily: "Poppins-SemiBold", fontSize: 14 },
});

