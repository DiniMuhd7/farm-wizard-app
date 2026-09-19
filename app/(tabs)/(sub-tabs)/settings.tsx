import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft, ChevronRight, Globe2, Moon, Phone, ShieldCheck, Smartphone, Volume2 } from "lucide-react-native";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { getMyNumber, provisionNumber } from "@/services/numbers";
import { useLoginContext } from "@/context/LoginProvider";

export default function Settings() {
  const { user } = useLoginContext();
  const [wifi, setWifi] = useState(true);
  const [alerts, setAlerts] = useState(true);

  const [myNumber, setMyNumber] = useState<string | null>(null);
  const [loadingNumber, setLoadingNumber] = useState(true);
  const [provisioning, setProvisioning] = useState(false);

  useEffect(() => {
    getMyNumber()
      .then(setMyNumber)
      .catch(() => setMyNumber(null))
      .finally(() => setLoadingNumber(false));
  }, []);

  const doProvision = async () => {
    setProvisioning(true);
    try {
      const number = await provisionNumber("US");
      setMyNumber(number);
    } catch (error) {
      Alert.alert("Unable to assign a number", (error as Error).message);
    } finally {
      setProvisioning(false);
    }
  };

  // Guests get the app instantly with no login screen (see
  // context/LoginProvider.js) — but a real, permanent number is exactly the
  // kind of thing a throwaway guest account shouldn't hold: uninstall the
  // app, clear storage, or lose the device, and a guest session is gone for
  // good along with whatever number was tied to it. This is the one place
  // sign-in is actually required, and only reached if someone tries to do
  // this specific thing.
  const handleGetNumber = () => {
    if (user?.isGuest) {
      Alert.alert(
        "Create a free account",
        "Getting a 9tel number ties it to your account, so create a free account first to make sure you don't lose access to it.",
        [
          { text: "Not now", style: "cancel" },
          { text: "Create account", onPress: () => router.push("/sign-up") },
        ]
      );
      return;
    }
    doProvision();
  };

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={s.page}>
        <View style={s.top}>
          <Pressable onPress={() => router.back()} style={s.back}>
            <ChevronLeft size={23} color="#211B59" />
          </Pressable>
          <Text style={s.title}>Settings</Text>
          <View style={s.back} />
        </View>
        <Text style={s.sub}>Personalize your calling experience.</Text>

        <Text style={s.heading}>YOUR 9TEL NUMBER</Text>
        <View style={s.group}>
          <View style={s.row}>
            <View style={s.rowIcon}>
              <Phone size={20} color="#5147AF" />
            </View>
            <View style={s.rowCopy}>
              {loadingNumber ? (
                <ActivityIndicator size="small" color="#5147AF" />
              ) : myNumber ? (
                <>
                  <Text style={s.rowLabel}>{myNumber}</Text>
                  <Text style={s.rowDetail}>People can reach you on this number</Text>
                </>
              ) : (
                <>
                  <Text style={s.rowLabel}>No number yet</Text>
                  <Text style={s.rowDetail}>Get a number so people can call you</Text>
                </>
              )}
            </View>
            {!loadingNumber && !myNumber && (
              <Pressable style={s.getNumberBtn} onPress={handleGetNumber} disabled={provisioning}>
                {provisioning ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={s.getNumberText}>Get number</Text>
                )}
              </Pressable>
            )}
          </View>
        </View>

        <Text style={s.heading}>CALL PREFERENCES</Text>
        <View style={s.group}>
          <Toggle icon={Volume2} label="Call sound" detail="Ringtone & vibration" value={alerts} onChange={setAlerts} />
          <Toggle icon={Smartphone} label="Wi-Fi calling" detail="Make calls over Wi-Fi" value={wifi} onChange={setWifi} />
          <Link icon={Phone} label="Blocked numbers" detail="Manage blocked contacts" />
        </View>

        <Text style={s.heading}>GENERAL</Text>
        <View style={s.group}>
          <Link icon={Globe2} label="Language" detail="English (Nigeria)" />
          <Link icon={Moon} label="Appearance" detail="System default" />
          <Link icon={ShieldCheck} label="Privacy & security" detail="Permissions and data" />
        </View>

        <View style={s.version}>
          <Text style={s.versionBrand}>9tel</Text>
          <Text style={s.versionCopy}>Version 1.0.0 · Built for connection</Text>
        </View>
        <Pressable onPress={() => Alert.alert("Account deletion", "Please contact support to complete this request.")}>
          <Text style={s.delete}>Delete account</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Toggle({ icon: Icon, label, detail, value, onChange }: { icon: any; label: string; detail: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={s.row}>
      <View style={s.rowIcon}>
        <Icon size={20} color="#5147AF" />
      </View>
      <View style={s.rowCopy}>
        <Text style={s.rowLabel}>{label}</Text>
        <Text style={s.rowDetail}>{detail}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ false: "#D9D6E6", true: "#9B95E7" }} thumbColor={value ? "#5F56C6" : "#FFF"} />
    </View>
  );
}

function Link({ icon: Icon, label, detail }: { icon: any; label: string; detail: string }) {
  return (
    <Pressable style={s.row} onPress={() => Alert.alert(label, detail)}>
      <View style={s.rowIcon}>
        <Icon size={20} color="#5147AF" />
      </View>
      <View style={s.rowCopy}>
        <Text style={s.rowLabel}>{label}</Text>
        <Text style={s.rowDetail}>{detail}</Text>
      </View>
      <ChevronRight size={19} color="#AAA6B7" />
    </Pressable>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F8F8FD" },
  page: { padding: 20, paddingBottom: 70 },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  back: { height: 43, width: 43, borderRadius: 15, backgroundColor: "#FFF", alignItems: "center", justifyContent: "center" },
  title: { color: "#211B59", fontFamily: "Poppins-SemiBold", fontSize: 21 },
  sub: { color: "#85829B", fontFamily: "Poppins-Regular", fontSize: 12, marginTop: 17 },
  heading: { color: "#908CA2", fontFamily: "Poppins-SemiBold", fontSize: 10, letterSpacing: 1, marginTop: 27, marginBottom: 9 },
  group: { backgroundColor: "#FFF", borderRadius: 20, paddingHorizontal: 14 },
  row: { minHeight: 68, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: "#F1F0F6" },
  rowIcon: { height: 40, width: 40, borderRadius: 14, backgroundColor: "#EEECFF", alignItems: "center", justifyContent: "center" },
  rowCopy: { flex: 1, marginLeft: 12 },
  rowLabel: { color: "#383452", fontFamily: "Poppins-Medium", fontSize: 12.5 },
  rowDetail: { color: "#9693A7", fontFamily: "Poppins-Regular", fontSize: 10, marginTop: 1 },
  getNumberBtn: { backgroundColor: "#5147AF", borderRadius: 14, paddingVertical: 9, paddingHorizontal: 14, minWidth: 92, alignItems: "center" },
  getNumberText: { color: "#FFF", fontFamily: "Poppins-SemiBold", fontSize: 11.5 },
  version: { alignItems: "center", marginTop: 33 },
  versionBrand: { color: "#211B59", fontFamily: "Poppins-Bold", fontSize: 23, letterSpacing: -1 },
  versionCopy: { color: "#A29EAF", fontFamily: "Poppins-Regular", fontSize: 10.5, marginTop: 2 },
  delete: { color: "#E36A65", fontFamily: "Poppins-Medium", fontSize: 12, textAlign: "center", marginTop: 24 },
});
