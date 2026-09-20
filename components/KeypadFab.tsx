import { Pressable, StyleSheet } from "react-native";
import { Grid3x3 } from "lucide-react-native";
import { router } from "expo-router";

// The dialer ("home") is deliberately hidden from the bottom tab bar (see
// app/(tabs)/_layout.jsx's tabBarButton: () => null on it) — it's the
// default landing screen, not meant to clutter the tab bar. But that also
// meant that once someone navigated to Recent, Stats, or Profile, there was
// no way back to it at all — no link anywhere in the app points at
// "/(tabs)/home". This floating button is that way back.
export default function KeypadFab() {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open keypad"
      onPress={() => router.push("/(tabs)/home")}
      style={s.fab}
    >
      <Grid3x3 color="#FFF" size={24} />
    </Pressable>
  );
}

const s = StyleSheet.create({
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
