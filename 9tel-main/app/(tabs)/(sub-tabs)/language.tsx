import { useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Check, ChevronLeft } from "lucide-react-native";
import { TAB_BAR_CLEARANCE } from "@/constants/layout";
import { applyLanguage, baseLanguage, LANGUAGES, restartApp } from "@/utils/language";
import { themedStyles, themeColor, useThemeVersion } from "@/theme";

export default function LanguageScreen() {
  useThemeVersion();
  const { t, i18n } = useTranslation();
  const current = baseLanguage(i18n.language);
  const [busy, setBusy] = useState<string | null>(null);

  const choose = async (code: string) => {
    if (code === current || busy) return;
    setBusy(code);
    try {
      const { needsRestart } = await applyLanguage(code);
      if (needsRestart) {
        Alert.alert(
          t("prefs.language.restartTitle", "Restart to finish"),
          t("prefs.language.restartBody", "This language reads in a different direction. Restart the app to switch the layout."),
          [
            { text: t("prefs.later", "Later"), style: "cancel" },
            {
              text: t("prefs.language.restartNow", "Restart now"),
              onPress: async () => {
                if (!(await restartApp())) Alert.alert(t("prefs.language.reopenTitle", "Reopen the app"), t("prefs.language.reopenBody", "Close and reopen 9tel to apply the new layout."));
              },
            },
          ]
        );
      }
    } catch (e) {
      Alert.alert(t("prefs.language.errorTitle", "Couldn't change language"), (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <Pressable accessibilityLabel={t("prefs.back", "Go back")} onPress={() => router.back()} style={s.back}><ChevronLeft size={23} color={themeColor("#211B59")} /></Pressable>
        <Text style={s.title}>{t("prefs.language.title", "Language")}</Text>
      </View>
      <FlatList
        data={LANGUAGES}
        keyExtractor={(l) => l.code}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={<Text style={s.intro}>{t("prefs.language.intro", "Choose the language used in the app.")}</Text>}
        ListFooterComponent={<Text style={s.note}>{t("prefs.language.note", "Not every screen is translated yet. Text without a translation appears in English.")}</Text>}
        renderItem={({ item }) => {
          const selected = item.code === current;
          return (
            <Pressable accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => choose(item.code)} style={[s.row, selected && s.rowActive]}>
              <View style={{ flex: 1 }}>
                <Text style={s.native}>{item.nativeName}</Text>
                {item.nativeName !== item.name ? <Text style={s.english}>{item.name}</Text> : null}
              </View>
              {busy === item.code ? <ActivityIndicator color={themeColor("#5F56C6")} /> : selected ? <Check size={20} color={themeColor("#5147AF")} /> : null}
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

const s = themedStyles({
  safe: { flex: 1, backgroundColor: "#F8F8FD" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingTop: 6 },
  back: { height: 42, width: 42, alignItems: "center", justifyContent: "center" },
  title: { color: "#211B59", fontFamily: "Poppins-SemiBold", fontSize: 22, marginLeft: 4 },
  list: { padding: 20, paddingBottom: TAB_BAR_CLEARANCE },
  intro: { color: "#85829B", fontFamily: "Poppins-Regular", fontSize: 12.5, marginBottom: 14 },
  row: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFF", borderRadius: 18, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 8, borderWidth: 1.5, borderColor: "#EDEBF6", minHeight: 62 },
  rowActive: { borderColor: "#5F56C6", backgroundColor: "#F6F5FF" },
  native: { color: "#211B59", fontFamily: "Poppins-SemiBold", fontSize: 15 },
  english: { color: "#85829B", fontFamily: "Poppins-Regular", fontSize: 11, marginTop: 1 },
  note: { color: "#9693A9", fontFamily: "Poppins-Regular", fontSize: 11, lineHeight: 17, marginTop: 10, textAlign: "center" },
});
