import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowDownLeft, ArrowUpRight, Bell, Delete, Globe2, Phone, PhoneMissed, Search, Video, X } from "lucide-react-native";
import { router, useFocusEffect } from "expo-router";
import { Audio } from "expo-av";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getCallHistory } from "@/services/calls";

const CALLS_READ_AT_KEY = "home-call-notifications-read-at";

function isMissedCall(call) {
  return call.direction === "inbound" && call.status !== "completed";
}

function displayCallNumber(counterparty) {
  const number = String(counterparty ?? "");
  const clientMatch = number.match(/^client:user-(.+)$/);
  return clientMatch ? `9tel user ${clientMatch[1].slice(0, 6)}` : number;
}

const keys = [
  ["1", ""], ["2", "ABC"], ["3", "DEF"],
  ["4", "GHI"], ["5", "JKL"], ["6", "MNO"],
  ["7", "PQRS"], ["8", "TUV"], ["9", "WXYZ"],
  ["*", ""], ["0", "+"], ["#", ""],
];

// Building the E.164 destination used to just be `${country.code}${digits}`,
// which blindly prepends the country code no matter what the user typed.
// Typing a local number with a leading trunk "0" (e.g. "0801 234 5678", the
// normal way to dial locally in Nigeria/UK/much of the world) produced
// "+2340801234567" — a syntactically-valid-looking but real destination
// that Twilio dials and fails fast on, since the digit after the country
// code is wrong. Same problem if someone typed the number already including
// "+" or the country code: it got double-prefixed into garbage. This is the
// most likely explanation for a call ringing briefly then immediately
// hearing "unavailable" — Twilio was asked to dial a malformed number.
function normalizeDestination(rawInput, callingCode) {
  const trimmed = rawInput.trim();
  if (trimmed.startsWith("+")) {
    // Already a full international number — use exactly what was typed.
    return `+${trimmed.replace(/\D/g, "")}`;
  }
  const digits = trimmed.replace(/\D/g, "");
  const callingDigits = callingCode.replace(/\D/g, "");
  if (digits.startsWith(callingDigits)) {
    // Typed the country code digits without a leading "+".
    return `+${digits}`;
  }
  // Local format: drop a leading trunk "0" (if present) before prepending
  // the country code — the standard local-to-E.164 conversion.
  const local = digits.replace(/^0+/, "");
  return `${callingCode}${local}`;
}

// Real DTMF (dual-tone multi-frequency) tones — the actual sound a phone
// keypad makes — one per key. require() needs static string literals, so
// this can't be built from a loop; the filenames match assets/sounds/dtmf.
const DTMF_SOUNDS = {
  "1": require("../../assets/sounds/dtmf/1.wav"),
  "2": require("../../assets/sounds/dtmf/2.wav"),
  "3": require("../../assets/sounds/dtmf/3.wav"),
  "4": require("../../assets/sounds/dtmf/4.wav"),
  "5": require("../../assets/sounds/dtmf/5.wav"),
  "6": require("../../assets/sounds/dtmf/6.wav"),
  "7": require("../../assets/sounds/dtmf/7.wav"),
  "8": require("../../assets/sounds/dtmf/8.wav"),
  "9": require("../../assets/sounds/dtmf/9.wav"),
  "*": require("../../assets/sounds/dtmf/star.wav"),
  "0": require("../../assets/sounds/dtmf/0.wav"),
  "#": require("../../assets/sounds/dtmf/hash.wav"),
};

export default function DialPad() {
  const [country, setCountry] = useState({ name: "Nigeria", code: "+234" });
  const [number, setNumber] = useState("");
  const [callNotifications, setCallNotifications] = useState(null);
  const [notificationsVisible, setNotificationsVisible] = useState(false);
  const [unreadMissedCalls, setUnreadMissedCalls] = useState(0);
  const [notificationsFailed, setNotificationsFailed] = useState(false);
  const digits = useMemo(() => number.replace(/\D/g, ""), [number]);
  const soundsRef = useRef({});

  const loadCallNotifications = useCallback(async () => {
    try {
      const [records, lastReadAt] = await Promise.all([
        getCallHistory(),
        AsyncStorage.getItem(CALLS_READ_AT_KEY),
      ]);
      setCallNotifications(records.slice(0, 10));
      setNotificationsFailed(false);
      if (lastReadAt) {
        const readTimestamp = new Date(lastReadAt).getTime();
        setUnreadMissedCalls(records.filter(
          (call) => isMissedCall(call) && new Date(call.at).getTime() > readTimestamp
        ).length);
      } else {
        setUnreadMissedCalls(0);
      }
    } catch {
      setCallNotifications([]);
      setNotificationsFailed(true);
      setUnreadMissedCalls(0);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    loadCallNotifications();
  }, [loadCallNotifications]));

  useEffect(() => {
    // country_name and country_calling_code both come from the same ipapi
    // lookup, so they always describe the same country. The previous
    // version paired ipapi's real country_name with a code looked up from a
    // separate 7-country hardcoded table — for anyone outside those 7
    // countries, that produced mismatched pairs like "+234  France".
    fetch("https://ipapi.co/json/")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((location) =>
        setCountry({
          name: location.country_name || "Nigeria",
          code: location.country_calling_code || "+234",
        })
      )
      .catch(() => undefined);
  }, []);

  // Preload every DTMF tone once so playback on tap is instant rather than
  // decoding a file on every keypress.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Configure the audio session once, explicitly, rather than relying on
      // expo-av's defaults — without this, rapid repeated playback of short
      // SFX (a fast sequence of keypresses) can play back inconsistently on
      // some devices, which is consistent with "tone doesn't always match
      // the key" and "sometimes no sound at all".
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      }).catch(() => undefined);

      const entries = await Promise.all(
        Object.entries(DTMF_SOUNDS).map(async ([key, source]) => {
          try {
            const { sound } = await Audio.Sound.createAsync(source);
            return [key, sound];
          } catch {
            return [key, null];
          }
        })
      );
      if (cancelled) {
        entries.forEach(([, sound]) => sound?.unloadAsync());
        return;
      }
      soundsRef.current = Object.fromEntries(entries);
    })();
    return () => {
      cancelled = true;
      Object.values(soundsRef.current).forEach((sound) => sound?.unloadAsync());
    };
  }, []);

  const playDtmf = async (key) => {
    const sound = soundsRef.current[key];
    if (sound) {
      // Explicit stop + seek-to-0 + play, rather than replayAsync(). If a
      // key is tapped again before the previous tone finished, replayAsync()
      // racing against still-in-progress playback is what produced tones
      // that didn't match the key just pressed; this sequence is the more
      // defensive, well-documented way to force a clean restart.
      try {
        await sound.stopAsync();
        await sound.setPositionAsync(0);
        await sound.playAsync();
      } catch {
        // ignore — a missed tone isn't worth surfacing to the user
      }
      return;
    }
    // Preloading hadn't finished yet (e.g. a key tapped in the first instant
    // after this screen mounts) — load this one tone on demand so a press
    // never silently produces nothing, and cache it for next time.
    const source = DTMF_SOUNDS[key];
    if (!source) return;
    try {
      const { sound: freshSound } = await Audio.Sound.createAsync(source, { shouldPlay: true });
      soundsRef.current[key] = freshSound;
    } catch {
      // ignore
    }
  };

  const pressKey = (key) => {
    setNumber((value) => value + key);
    Haptics.selectionAsync().catch(() => undefined);
    playDtmf(key);
  };

  // Long-press "0" to insert "+" — the "+" shown under "0" was previously
  // just decorative text with nothing wired to it. This is the standard
  // phone-dialer convention (iOS and Android both do this), not a custom
  // gesture. zeroHeldRef suppresses the short-press "0" that would
  // otherwise also fire on release right after a long-press — Pressable
  // fires onPress on release regardless of whether onLongPress already
  // fired, so without this guard a long-press would insert "0+" instead of
  // just "+".
  const zeroHeldRef = useRef(false);
  const handleZeroPress = () => {
    if (zeroHeldRef.current) {
      zeroHeldRef.current = false;
      return;
    }
    pressKey("0");
  };
  const handleZeroLongPress = () => {
    zeroHeldRef.current = true;
    setNumber((value) => value + "+");
    Haptics.selectionAsync().catch(() => undefined);
    // "+" isn't a real DTMF tone (it's a dialing convention, not a signal
    // Twilio sends) — haptic-only feedback here is correct, not a gap.
  };

  // Navigate to the call screen immediately rather than waiting here for
  // startVoiceCall() to resolve — that call involves a mic-permission
  // prompt, a network round trip for the access token, and the SDK's own
  // connect() handshake, so awaiting it before navigating was the delay
  // between tapping call and anything appearing on screen. The call screen
  // already starts the call itself (see app/(screens)/call.tsx) and shows
  // "Connecting…" the moment it mounts, so nothing here needs to wait.
  const startCall = (video = false) => {
    if (!digits) return Alert.alert("Enter a number", "Choose a contact or enter the number you want to call.");
    const destination = normalizeDestination(number, country.code);
    router.push({ pathname: "/(screens)/call", params: { number: destination, video: video ? "true" : "false" } });
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.page}>
        <View style={styles.topbar}>
          <View>
            <Text style={styles.brand}>9tel</Text>
            <Text style={styles.welcome}>Crystal-clear calling, wherever you are.</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={unreadMissedCalls ? `${unreadMissedCalls} new missed calls` : "Call notifications"}
            onPress={async () => {
              setNotificationsVisible(true);
              setUnreadMissedCalls(0);
              await AsyncStorage.setItem(CALLS_READ_AT_KEY, new Date().toISOString()).catch(() => undefined);
              await loadCallNotifications();
            }}
            style={styles.iconButton}
          >
            <Bell color="#211B59" size={21} />
            {unreadMissedCalls > 0 && (
              <View style={styles.notice}>
                <Text style={styles.noticeText}>{unreadMissedCalls > 9 ? "9+" : unreadMissedCalls}</Text>
              </View>
            )}
          </Pressable>
        </View>

        <View style={styles.search}>
          <Search color="#9894A9" size={19} />
          <TextInput
            value={number}
            onChangeText={setNumber}
            placeholder="Search contacts or enter number"
            placeholderTextColor="#9995A8"
            keyboardType="phone-pad"
            style={styles.searchInput}
          />
        </View>

        <View style={styles.numberArea}>
          <Pressable style={styles.countryPill} onPress={() => Alert.alert("Country code", `Your calling code is set to ${country.code}.`)}>
            <Globe2 color="#625BC1" size={17} />
            <Text style={styles.countryText}>{country.code}</Text>
            <Text style={styles.countryName}>{country.name}</Text>
          </Pressable>
          <Text style={styles.number}>{number || "Enter phone number"}</Text>
        </View>

        <View style={styles.pad}>
          {keys.map(([key, letters]) => (
            <Pressable
              key={key}
              onPress={key === "0" ? handleZeroPress : () => pressKey(key)}
              onLongPress={key === "0" ? handleZeroLongPress : undefined}
              delayLongPress={350}
              style={styles.key}
            >
              <Text style={styles.keyNumber}>{key}</Text>
              <Text style={styles.letters}>{letters}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.callRow}>
          <Pressable accessibilityLabel="Video call" onPress={() => startCall(true)} style={styles.video}>
            <Video color="#625BC1" size={22} />
          </Pressable>
          <Pressable accessibilityLabel="Start call" onPress={() => startCall(false)} style={styles.call}>
            <Phone color="#FFF" size={26} fill="#FFF" />
          </Pressable>
          <Pressable accessibilityLabel="Delete number" onPress={() => setNumber((value) => value.slice(0, -1))} style={styles.video}>
            <Delete color="#625BC1" size={22} />
          </Pressable>
        </View>
      </View>
      <Modal
        visible={notificationsVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setNotificationsVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            accessibilityLabel="Close call notifications"
            onPress={() => setNotificationsVisible(false)}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.notificationSheet}>
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>Call activity</Text>
                <Text style={styles.sheetSubtitle}>Recent incoming, outgoing, and missed calls</Text>
              </View>
              <Pressable accessibilityLabel="Close" onPress={() => setNotificationsVisible(false)} style={styles.closeButton}>
                <X size={19} color="#5147AF" />
              </Pressable>
            </View>
            {callNotifications === null ? (
              <View style={styles.notificationState}><ActivityIndicator color="#5147AF" /></View>
            ) : notificationsFailed ? (
              <View style={styles.notificationState}>
                <Text style={styles.notificationEmpty}>Call activity is unavailable right now.</Text>
              </View>
            ) : callNotifications.length === 0 ? (
              <View style={styles.notificationState}>
                <Text style={styles.notificationEmpty}>Your call updates will appear here after your first call.</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.notificationList}>
                {callNotifications.map((call) => {
                  const missed = isMissedCall(call);
                  const callNumber = displayCallNumber(call.counterparty);
                  const canCallBack = /^\+?[0-9][0-9\s().-]{4,}$/.test(call.counterparty);
                  const label = missed ? "Missed call" : call.direction === "outbound" ? "Outgoing call" : "Incoming call";
                  return (
                    <Pressable
                      key={call.id}
                      disabled={!canCallBack}
                      onPress={() => {
                        setNotificationsVisible(false);
                        router.push({ pathname: "/(screens)/call", params: { number: call.counterparty } });
                      }}
                      style={styles.notificationRow}
                    >
                      <View style={[styles.callDirection, missed && styles.missedDirection]}>
                        {missed ? <PhoneMissed size={17} color="#E66763" /> : call.direction === "inbound" ? <ArrowDownLeft size={17} color="#2EAF7D" /> : <ArrowUpRight size={17} color="#2EAF7D" />}
                      </View>
                      <View style={styles.notificationCopy}>
                        <Text style={[styles.callLabel, missed && styles.missedText]}>{label}</Text>
                        <Text style={styles.callNumber} numberOfLines={1}>{callNumber}</Text>
                        <Text style={styles.callDate}>{new Date(call.at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</Text>
                      </View>
                      {canCallBack && <Phone size={18} color="#5147AF" />}
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F8F8FD" },
  page: { flex: 1, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 96 },
  topbar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  brand: { color: "#211B59", fontFamily: "Poppins-Bold", fontSize: 28, letterSpacing: -1.5 },
  welcome: { color: "#85829B", fontFamily: "Poppins-Regular", fontSize: 11.5, marginTop: -4 },
  iconButton: { height: 45, width: 45, borderRadius: 15, backgroundColor: "#FFF", alignItems: "center", justifyContent: "center", shadowColor: "#29205F", shadowOpacity: 0.09, shadowRadius: 12, elevation: 3 },
  notice: { minWidth: 17, height: 17, paddingHorizontal: 4, borderRadius: 9, backgroundColor: "#FF6D63", position: "absolute", top: 5, right: 5, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#FFF" },
  noticeText: { color: "#FFF", fontFamily: "Poppins-SemiBold", fontSize: 8 },
  search: { height: 54, borderRadius: 18, backgroundColor: "#FFF", flexDirection: "row", alignItems: "center", paddingHorizontal: 16, shadowColor: "#29205F", shadowOpacity: 0.05, shadowRadius: 11, elevation: 2 },
  searchInput: { flex: 1, marginLeft: 10, color: "#211B59", fontFamily: "Poppins-Regular", fontSize: 12 },
  numberArea: { alignItems: "center", paddingTop: 27, paddingBottom: 15 },
  countryPill: { flexDirection: "row", alignItems: "center", backgroundColor: "#EEECFF", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 13 },
  countryText: { color: "#5147AF", fontFamily: "Poppins-SemiBold", fontSize: 12, marginLeft: 6 },
  countryName: { color: "#7C7894", fontFamily: "Poppins-Regular", fontSize: 11, marginLeft: 7 },
  number: { color: "#211B59", fontFamily: "Poppins-SemiBold", fontSize: 27, marginTop: 13, minHeight: 39 },
  // Shifted down from the number display — was flush right underneath it.
  pad: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: 12, marginTop: 18 },
  key: { width: "33.33%", height: 59, alignItems: "center", justifyContent: "center" },
  keyNumber: { color: "#211B59", fontFamily: "Poppins-Medium", fontSize: 27, lineHeight: 29 },
  letters: { color: "#8F8BA3", fontFamily: "Poppins-Medium", fontSize: 8, letterSpacing: 1.5, height: 10 },
  callRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 27, marginTop: 10 },
  video: { height: 51, width: 51, borderRadius: 18, backgroundColor: "#EEECFF", alignItems: "center", justifyContent: "center" },
  call: { height: 68, width: 68, borderRadius: 25, backgroundColor: "#5F56C6", alignItems: "center", justifyContent: "center", shadowColor: "#5147B6", shadowOpacity: 0.35, shadowRadius: 15, elevation: 7 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(24,20,56,.38)", justifyContent: "flex-end" },
  notificationSheet: { maxHeight: "78%", minHeight: 250, backgroundColor: "#F8F8FD", borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 20, paddingTop: 22, paddingBottom: 28 },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 17 },
  sheetTitle: { color: "#211B59", fontFamily: "Poppins-SemiBold", fontSize: 20 },
  sheetSubtitle: { color: "#85829B", fontFamily: "Poppins-Regular", fontSize: 10.5, marginTop: 2 },
  closeButton: { height: 38, width: 38, borderRadius: 13, backgroundColor: "#EEECFF", alignItems: "center", justifyContent: "center" },
  notificationState: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  notificationEmpty: { color: "#85829B", fontFamily: "Poppins-Regular", fontSize: 12, textAlign: "center", lineHeight: 19 },
  notificationList: { paddingBottom: 12 },
  notificationRow: { backgroundColor: "#FFF", borderRadius: 17, minHeight: 76, paddingHorizontal: 13, paddingVertical: 11, flexDirection: "row", alignItems: "center", marginBottom: 9 },
  callDirection: { height: 37, width: 37, borderRadius: 13, backgroundColor: "#E4F6EE", alignItems: "center", justifyContent: "center", marginRight: 11 },
  missedDirection: { backgroundColor: "#FFE6E4" },
  notificationCopy: { flex: 1, marginRight: 8 },
  callLabel: { color: "#302C4C", fontFamily: "Poppins-Medium", fontSize: 11.5 },
  missedText: { color: "#E66763" },
  callNumber: { color: "#514D66", fontFamily: "Poppins-Regular", fontSize: 10.5, marginTop: 1 },
  callDate: { color: "#9693A9", fontFamily: "Poppins-Regular", fontSize: 9, marginTop: 2 },
});
