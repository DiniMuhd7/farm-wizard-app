import { Pressable, StyleSheet } from "react-native";
import { Users } from "lucide-react-native";
import { router } from "expo-router";
import { themedStyles, themeColor, useThemeVersion } from "@/theme";
import { tr } from "@/utils/tr";
import { useTranslation } from "react-i18next";

// Small secondary FAB that sits just above the keypad FAB (see KeypadFab).
// Keypad: right 20, bottom 104, 58x58. This one is 44x44, centred over it.
export default function ContactFab() {
  useTranslation();
  useThemeVersion();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={tr("Open contacts")}
      onPress={() => router.push("/(screens)/contacts")}
      style={s.fab}
    >
      <Users color={themeColor("#5F56C6")} size={20} />
    </Pressable>
  );
}

const s = themedStyles({
  fab: {
    position: "absolute",
    right: 27,
    bottom: 174,
    height: 44,
    width: 44,
    borderRadius: 16,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#E4E1F8",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#5147B6",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
