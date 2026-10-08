import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Check, ChevronLeft } from "lucide-react-native";
import { TAB_BAR_CLEARANCE } from "@/constants/layout";
import { setThemePreference, themedStyles, themeColor, useTheme, type ThemePreference } from "@/theme";

// Fixed colours on purpose: the previews must always show what each option
// looks like, whichever theme the app is in right now.
const LIGHT = { page: "#F8F8FD", card: "#FFFFFF", line: "#DCD8F2", accent: "#5F56C6" };
const DARK = { page: "#0F0E1A", card: "#1B1A2D", line: "#3A3860", accent: "#8E86F0" };

function Mini({ palette }: { palette: typeof LIGHT }) {
  return (
    <View style={[mini.page, { backgroundColor: palette.page }]}>
      <View style={[mini.bar, { backgroundColor: palette.accent, width: "55%" }]} />
      <View style={[mini.card, { backgroundColor: palette.card }]}>
        <View style={[mini.line, { backgroundColor: palette.line, width: "80%" }]} />
        <View style={[mini.line, { backgroundColor: palette.line, width: "55%" }]} />
      </View>
    </View>
  );
}

function Preview({ mode }: { mode: ThemePreference }) {
  if (mode === "system") {
    // Left half light, right half dark.
    return (
      <View style={mini.split}>
        <View style={mini.half}><Mini palette={LIGHT} /></View>
        <View style={mini.half}><View style={{ marginLeft: -32 }}><Mini palette={DARK} /></View></View>
      </View>
    );
  }
  return <Mini palette={mode === "dark" ? DARK : LIGHT} />;
}

export default function AppearanceScreen() {
  const { t } = useTranslation();
  const { preference } = useTheme();

  const options: { id: ThemePreference; title: string; copy: string }[] = [
    { id: "system", title: t("prefs.appearance.system", "System default"), copy: t("prefs.appearance.systemCopy", "Match your phone's light or dark setting.") },
    { id: "light", title: t("prefs.appearance.light", "Light"), copy: t("prefs.appearance.lightCopy", "Always use the light theme.") },
    { id: "dark", title: t("prefs.appearance.dark", "Dark"), copy: t("prefs.appearance.darkCopy", "Easier on the eyes in low light.") },
  ];

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <Pressable accessibilityLabel={t("prefs.back", "Go back")} onPress={() => router.back()} style={s.back}><ChevronLeft size={23} color={themeColor("#211B59")} /></Pressable>
        <Text style={s.title}>{t("prefs.appearance.title", "Appearance")}</Text>
      </View>
      <ScrollView contentContainerStyle={s.page} showsVerticalScrollIndicator={false}>
        {options.map((o) => {
          const selected = preference === o.id;
          return (
            <Pressable key={o.id} accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => setThemePreference(o.id)} style={[s.card, selected && s.cardActive]}>
              <View style={s.preview}><Preview mode={o.id} /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle}>{o.title}</Text>
                <Text style={s.cardCopy}>{o.copy}</Text>
              </View>
              <View style={[s.radio, selected && s.radioActive]}>{selected ? <Check size={14} color="#FFF" strokeWidth={3} /> : null}</View>
            </Pressable>
          );
        })}
        <Text style={s.note}>{t("prefs.appearance.note", "Sign-in and call screens keep their dark navy design in both themes.")}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const mini = StyleSheet.create({
  page: { width: 64, height: 78, borderRadius: 10, padding: 7, borderWidth: 1, borderColor: "#8884B8" },
  bar: { height: 6, borderRadius: 3, marginBottom: 7 },
  card: { borderRadius: 6, padding: 6, gap: 5 },
  line: { height: 4, borderRadius: 2 },
  split: { flexDirection: "row", width: 64, height: 78, borderRadius: 10, overflow: "hidden" },
  half: { width: 32, height: 78, overflow: "hidden" },
});

const s = themedStyles({
  safe: { flex: 1, backgroundColor: "#F8F8FD" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingTop: 6 },
  back: { height: 42, width: 42, alignItems: "center", justifyContent: "center" },
  title: { color: "#211B59", fontFamily: "Poppins-SemiBold", fontSize: 22, marginLeft: 4 },
  page: { padding: 20, paddingBottom: TAB_BAR_CLEARANCE },
  card: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: "#FFF", borderRadius: 20, padding: 14, marginBottom: 10, borderWidth: 1.5, borderColor: "#EDEBF6" },
  cardActive: { borderColor: "#5F56C6", backgroundColor: "#F6F5FF" },
  preview: { width: 64, height: 78 },
  cardTitle: { color: "#211B59", fontFamily: "Poppins-SemiBold", fontSize: 15 },
  cardCopy: { color: "#85829B", fontFamily: "Poppins-Regular", fontSize: 11.5, marginTop: 2, lineHeight: 17 },
  radio: { height: 24, width: 24, borderRadius: 12, borderWidth: 2, borderColor: "#CFCBE6", alignItems: "center", justifyContent: "center" },
  radioActive: { borderColor: "#5F56C6", backgroundColor: "#5F56C6" },
  note: { color: "#9693A9", fontFamily: "Poppins-Regular", fontSize: 11, textAlign: "center", marginTop: 10, lineHeight: 17 },
});
