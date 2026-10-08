import { Pressable, StyleSheet } from "react-native";
import { Grid3x3 } from "lucide-react-native";
import { router } from "expo-router";
import { themedStyles, themeColor, useThemeVersion } from "@/theme";
import { tr } from "@/utils/tr";
import { useTranslation } from "react-i18next";

// Opens the keypad (the "dialer" tab, hidden from the tab bar). The Home tab
// is the landing screen; the keypad is always one tap away via this FAB.
export default function KeypadFab() {
  useTranslation();
  useThemeVersion();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={tr("Open keypad")}
      onPress={() => router.push("/(tabs)/dialer")}
      style={s.fab}
    >
      <Grid3x3 color={themeColor("#FFF")} size={24} />
    </Pressable>
  );
}

const s = themedStyles({
  fab: {
    position: "absolute",
    right: 20,
    bottom: 104,
    height: 58,
    width: 58,
    borderRadius: 21,
    backgroundColor: "#5F56C6",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#5147B6",
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
});
