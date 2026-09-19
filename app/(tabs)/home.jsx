import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Bell, Delete, Globe2, Phone, Search, Video } from "lucide-react-native";
import { router } from "expo-router";
import { Audio } from "expo-av";
import * as Haptics from "expo-haptics";

const keys = [
  ["1", ""], ["2", "ABC"], ["3", "DEF"],
  ["4", "GHI"], ["5", "JKL"], ["6", "MNO"],
  ["7", "PQRS"], ["8", "TUV"], ["9", "WXYZ"],
  ["*", ""], ["0", "+"], ["#", ""],
];

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
  const digits = useMemo(() => number.replace(/\D/g, ""), [number]);
  const soundsRef = useRef({});

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

  const pressKey = (key) => {
    setNumber((value) => value + key);
    Haptics.selectionAsync().catch(() => undefined);
    const sound = soundsRef.current[key];
    if (sound) {
      sound.replayAsync().catch(() => undefined);
    }
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
    const destination = `${country.code}${digits}`;
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
          <Pressable style={styles.iconButton}>
            <Bell color="#211B59" size={21} />
            <View style={styles.notice} />
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
            <Pressable key={key} onPress={() => pressKey(key)} style={styles.key}>
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
  notice: { height: 8, width: 8, borderRadius: 4, backgroundColor: "#FF6D63", position: "absolute", top: 10, right: 11, borderWidth: 1, borderColor: "#FFF" },
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
});
