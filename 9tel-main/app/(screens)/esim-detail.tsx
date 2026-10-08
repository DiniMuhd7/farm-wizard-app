import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import Clipboard from "@react-native-clipboard/clipboard";
import QRCode from "react-native-qrcode-svg";
import { ChevronLeft, Copy, Smartphone } from "lucide-react-native";
import { getEsim, iosInstallUrl, type EsimProfile } from "@/services/esim";
import { themedStyles, themeColor, useThemeVersion } from "@/theme";
import { tr } from "@/utils/tr";
import { useTranslation } from "react-i18next";

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <View style={s.field}>
      <View style={{ flex: 1 }}>
        <Text style={s.fieldLabel}>{label}</Text>
        <Text style={s.fieldValue} selectable numberOfLines={2}>{value}</Text>
      </View>
      <Pressable accessibilityLabel={tr("Copy {{label}}", { label })} onPress={() => { Clipboard.setString(value); Alert.alert(tr("Copied"), tr("{{label}} copied to clipboard.", { label })); }} style={s.copy}>
        <Copy size={16} color={themeColor("#5147AF")} />
      </Pressable>
    </View>
  );
}

export default function EsimDetail() {
  useTranslation();
  useThemeVersion();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const [esim, setEsim] = useState<EsimProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return setError(tr("eSIM not found."));
    getEsim(id).then(setEsim).catch((e) => setError(e.message));
  }, [id]);

  const install = async () => {
    if (!esim) return;
    try {
      if (Platform.OS === "ios") await Linking.openURL(iosInstallUrl(esim.activationCode));
      else await Linking.sendIntent("android.settings.WIRELESS_SETTINGS");
    } catch {
      Alert.alert(tr("Couldn't open settings"), tr("Open Settings → Mobile network / SIMs → Add eSIM, then scan the QR code or enter the details manually."));
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      <View style={s.header}>
        <Pressable accessibilityLabel={tr("Go back")} onPress={() => router.back()} style={s.back}><ChevronLeft size={23} color={themeColor("#211B59")} /></Pressable>
        <Text style={s.title}>{tr("Install eSIM")}</Text>
      </View>
      {!esim ? (
        <View style={s.center}>{error ? <Text style={s.error}>{error}</Text> : <ActivityIndicator color={themeColor("#5F56C6")} />}</View>
      ) : (
        <ScrollView contentContainerStyle={s.page} showsVerticalScrollIndicator={false}>
          <Text style={s.plan}>{tr("{{country}} · {{gb}} GB · {{days}} days", { country: esim.country, gb: esim.dataGB, days: esim.validityDays })}</Text>
          <View style={s.qrBox}>
            <QRCode value={esim.activationCode} size={210} />
            <Text style={s.qrHint}>{tr("Scan this from another device, or use the buttons below to install on this phone.")}</Text>
          </View>

          <Pressable accessibilityRole="button" onPress={install} style={s.installBtn}>
            <Smartphone size={18} color={themeColor("#FFF")} />
            <Text style={s.installText}>{Platform.OS === "ios" ? tr("Install on this iPhone") : tr("Open mobile network settings")}</Text>
          </Pressable>

          <Text style={s.heading}>{tr("Manual details")}</Text>
          <Field label={tr("SM-DP+ address")} value={esim.smdpAddress} />
          <Field label={tr("Activation code")} value={esim.matchingId} />
          <Field label={tr("Full activation string")} value={esim.activationCode} />
          <Field label={tr("ICCID")} value={esim.iccid} />

          <Text style={s.heading}>{tr("How to install")}</Text>
          {(Platform.OS === "ios"
            ? [tr("Tap “Install on this iPhone” (iOS 17.4 or newer), or go to Settings → Mobile Service → Add eSIM."), tr("Scan the QR code from another screen, or choose “Enter Details Manually” and paste the details above."), tr("Turn on Data Roaming for the new line when you arrive.")]
            : [tr("Open Settings → Network & internet → SIMs → Add eSIM (wording varies by phone)."), tr("Scan the QR code from another screen, or choose to enter the code manually and paste the activation string above."), tr("Turn on Data Roaming for the new line when you arrive.")]
          ).map((step, i) => (
            <View key={i} style={s.step}><Text style={s.stepNum}>{i + 1}</Text><Text style={s.stepText}>{step}</Text></View>
          ))}
          <Text style={s.warn}>{tr("Keep this code private. Most eSIM profiles can only be installed once.")}</Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = themedStyles({
  safe: { flex: 1, backgroundColor: "#F8F8FD" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingTop: 6 },
  back: { height: 42, width: 42, alignItems: "center", justifyContent: "center" },
  title: { color: "#211B59", fontFamily: "Poppins-SemiBold", fontSize: 22, marginLeft: 4 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 30 },
  error: { color: "#B8403B", fontFamily: "Poppins-Regular", fontSize: 12.5, textAlign: "center" },
  page: { padding: 20, paddingBottom: 40 },
  plan: { color: "#5147AF", fontFamily: "Poppins-SemiBold", fontSize: 14, textAlign: "center" },
  qrBox: { alignItems: "center", backgroundColor: "#FFF", borderRadius: 24, padding: 22, marginTop: 14 },
  qrHint: { color: "#85829B", fontFamily: "Poppins-Regular", fontSize: 11, textAlign: "center", marginTop: 14 },
  installBtn: { flexDirection: "row", gap: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#5F56C6", borderRadius: 18, height: 54, marginTop: 16 },
  installText: { color: "#FFF", fontFamily: "Poppins-SemiBold", fontSize: 14 },
  heading: { color: "#908CA2", fontFamily: "Poppins-SemiBold", fontSize: 11, letterSpacing: 1, marginTop: 26, marginBottom: 10, textTransform: "uppercase" },
  field: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFF", borderRadius: 16, padding: 12, marginBottom: 8 },
  fieldLabel: { color: "#9693A9", fontFamily: "Poppins-Regular", fontSize: 10.5 },
  fieldValue: { color: "#211B59", fontFamily: "Poppins-Medium", fontSize: 12.5, marginTop: 1 },
  copy: { height: 38, width: 38, borderRadius: 13, backgroundColor: "#EEECFF", alignItems: "center", justifyContent: "center", marginLeft: 8 },
  step: { flexDirection: "row", gap: 12, marginBottom: 10 },
  stepNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#EEECFF", color: "#5147AF", fontFamily: "Poppins-SemiBold", fontSize: 12, textAlign: "center", lineHeight: 24, overflow: "hidden" },
  stepText: { flex: 1, color: "#514D66", fontFamily: "Poppins-Regular", fontSize: 12, lineHeight: 18 },
  warn: { color: "#B8403B", fontFamily: "Poppins-Regular", fontSize: 11, marginTop: 14 },
});
