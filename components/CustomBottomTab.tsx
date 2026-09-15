import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router, usePathname } from "expo-router";
import { Home, ReceiptText, Send, UserRound } from "lucide-react-native";

const tabs = [
  { label: "Home", icon: Home, path: "/(tabs)/home" },
  { label: "Services", icon: Send, path: "/(screens)/selectSeed" },
  { label: "Activity", icon: ReceiptText, path: "/(tabs)/(sub-tabs)/userWithdrawals" },
  { label: "Profile", icon: UserRound, path: "/(tabs)/profile" },
];

export default function CustomBottomTab() {
  const pathname = usePathname();
  return <View style={styles.wrap}><View style={styles.bar}>{tabs.map(({ label, icon: Icon, path }) => {
    const active = label === "Home" ? pathname.endsWith("/home") : pathname.includes(label === "Profile" ? "/profile" : label === "Activity" ? "userWithdrawals" : "selectSeed");
    return <Pressable key={label} accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={() => router.push(path as any)} style={styles.tab}>
      <Icon size={21} color={active ? "#5B53BE" : "#9A97AE"} strokeWidth={active ? 2.6 : 2} />
      <Text style={[styles.label, active && styles.activeLabel]}>{label}</Text>
    </Pressable>;
  })}</View></View>;
}

const styles = StyleSheet.create({ wrap: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#FFF", borderTopWidth: 1, borderTopColor: "#F0EFF5", paddingTop: 10, paddingBottom: 22 }, bar: { flexDirection: "row", justifyContent: "space-around" }, tab: { alignItems: "center", minWidth: 65, gap: 5 }, label: { fontFamily: "Poppins-Regular", fontSize: 10.5, color: "#9A97AE" }, activeLabel: { color: "#5B53BE", fontFamily: "Poppins-SemiBold" } });
