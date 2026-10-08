import { useState } from "react";
import { ActivityIndicator, Alert, Image, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import Constants from "expo-constants";
import * as Updates from "expo-updates";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, CircleHelp, FileText, RefreshCw, ShieldCheck, Smartphone } from "lucide-react-native";
import { TAB_BAR_CLEARANCE } from "@/constants/layout";
import { themedStyles, themeColor, useThemeVersion } from "@/theme";
import { tr } from "@/utils/tr";

function Row({ icon: Icon, label, detail, onPress, busy }: { icon: any; label: string; detail?: string; onPress: () => void; busy?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} disabled={busy} style={s.row}>
      <View style={s.rowIcon}><Icon size={19} color={themeColor("#5147AF")} /></View>
      <View style={s.rowText}>
        <Text style={s.rowLabel}>{label}</Text>
        {detail ? <Text style={s.rowDetail}>{detail}</Text> : null}
      </View>
      {busy ? <ActivityIndicator color={themeColor("#5F56C6")} /> : <ChevronRight size={18} color={themeColor("#A09BAE")} />}
    </Pressable>
  );
}

export default function About() {
  useThemeVersion();
  const { t } = useTranslation();
  const [checking, setChecking] = useState(false);

  const config = Constants.expoConfig;
  const version = config?.version ?? "1.0.0";
  const build = Platform.OS === "ios" ? config?.ios?.buildNumber : config?.android?.versionCode;
  const updateId = Updates.updateId ? Updates.updateId.slice(0, 8) : null;

  const checkForUpdates = async () => {
    if (!Updates.isEnabled) {
      return Alert.alert(t("prefs.about.updatesTitle", "Updates"), t("prefs.about.updatesManaged", "This build is updated through the app store."));
    }
    setChecking(true);
    try {
      const result = await Updates.checkForUpdateAsync();
      if (!result.isAvailable) return Alert.alert(t("prefs.about.upToDate", "You're up to date"), t("prefs.about.upToDateBody", "You have the latest version of 9tel."));
      await Updates.fetchUpdateAsync();
      Alert.alert(t("prefs.about.updateReady", "Update ready"), t("prefs.about.updateReadyBody", "Restart 9tel to use the new version."), [
        { text: t("prefs.later", "Later"), style: "cancel" },
        { text: t("prefs.about.restart", "Restart"), onPress: () => Updates.reloadAsync().catch(() => undefined) },
      ]);
    } catch {
      Alert.alert(t("prefs.about.updateFailed", "Couldn't check for updates"), t("prefs.about.updateFailedBody", "Check your connection and try again."));
    } finally {
      setChecking(false);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <Pressable accessibilityLabel={t("prefs.back", "Go back")} onPress={() => router.back()} style={s.back}><ChevronLeft size={23} color={themeColor("#211B59")} /></Pressable>
        <Text style={s.title}>{t("prefs.about.title", "About")}</Text>
      </View>
      <ScrollView contentContainerStyle={s.page} showsVerticalScrollIndicator={false}>
        <View style={s.hero}>
          <Image source={require("../../../assets/icon.png")} style={s.logo} />
          <Text style={s.appName}>{tr("9tel")}</Text>
          <Text style={s.version}>{t("prefs.about.version", "Version")} {version}{build ? ` (${build})` : ""}</Text>
          {updateId ? <Text style={s.updateId}>{t("prefs.about.update", "Update")} {updateId}</Text> : null}
        </View>

        <View style={s.group}>
          <Row icon={RefreshCw} label={t("prefs.about.checkUpdates", "Check for updates")} onPress={checkForUpdates} busy={checking} />
          <Row icon={CircleHelp} label={t("prefs.about.help", "Help & support")} onPress={() => router.push("/(tabs)/(sub-tabs)/help-support")} />
        </View>

        <Text style={s.heading}>{t("prefs.about.legal", "LEGAL & PRIVACY")}</Text>
        <View style={s.group}>
          <Row icon={ShieldCheck} label={t("prefs.about.privacy", "Privacy notice")} onPress={() => router.push("/(tabs)/(sub-tabs)/privacy-policy")} />
          <Row icon={FileText} label={t("prefs.about.terms", "Terms of service")} onPress={() => router.push("/(tabs)/(sub-tabs)/terms")} />
          <Row icon={Smartphone} label={t("prefs.about.permissions", "App permissions")} detail={t("prefs.about.permissionsDetail", "Microphone, camera, contacts and notifications")} onPress={() => Linking.openSettings()} />
        </View>

        <Text style={s.footer}>© {new Date().getFullYear()} 9tel</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = themedStyles({
  safe: { flex: 1, backgroundColor: "#F8F8FD" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingTop: 6 },
  back: { height: 42, width: 42, alignItems: "center", justifyContent: "center" },
  title: { color: "#211B59", fontFamily: "Poppins-SemiBold", fontSize: 22, marginLeft: 4 },
  page: { padding: 20, paddingBottom: TAB_BAR_CLEARANCE },
  hero: { alignItems: "center", paddingVertical: 22 },
  logo: { height: 84, width: 84, borderRadius: 22 },
  appName: { color: "#211B59", fontFamily: "Poppins-Bold", fontSize: 26, marginTop: 12 },
  version: { color: "#85829B", fontFamily: "Poppins-Medium", fontSize: 12.5, marginTop: 2 },
  updateId: { color: "#9693A9", fontFamily: "Poppins-Regular", fontSize: 10.5, marginTop: 2 },
  heading: { color: "#908CA2", fontFamily: "Poppins-SemiBold", fontSize: 10, letterSpacing: 1, marginTop: 24, marginBottom: 10 },
  group: { backgroundColor: "#FFF", borderRadius: 20, overflow: "hidden", marginTop: 6 },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F1F0F6" },
  rowIcon: { height: 38, width: 38, borderRadius: 13, backgroundColor: "#EEECFF", alignItems: "center", justifyContent: "center" },
  rowText: { flex: 1, marginLeft: 12, marginRight: 8 },
  rowLabel: { color: "#211B59", fontFamily: "Poppins-Medium", fontSize: 14 },
  rowDetail: { color: "#9693A9", fontFamily: "Poppins-Regular", fontSize: 11, marginTop: 1 },
  footer: { color: "#9693A9", fontFamily: "Poppins-Regular", fontSize: 11, textAlign: "center", marginTop: 26 },
});
