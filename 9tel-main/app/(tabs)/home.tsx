import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import { BarChart3, Crown, Hash, HelpCircle, Info, PhoneForwarded, SimCard, Wallet } from "lucide-react-native";
import { useLoginContext } from "@/context/LoginProvider";
import KeypadFab from "@/components/KeypadFab";
import { getCreditsBalance, type CreditsBalance } from "@/services/credits";
import { getMyNumber } from "@/services/numbers";
import { formatCents } from "@/constants/creditPacks";
import { FAB_CLEARANCE } from "@/constants/layout";
import { themedStyles, themeColor, useThemeVersion } from "@/theme";
import { tr } from "@/utils/tr";
import { useTranslation } from "react-i18next";

type Service = { label: string; icon: any; bg: string; fg: string; onPress: () => void };

export default function Home() {
  useTranslation();
  useThemeVersion();
  const { user } = useLoginContext();
  const [balance, setBalance] = useState<CreditsBalance | null>(null);
  const [balanceError, setBalanceError] = useState(false);
  const [myNumber, setMyNumber] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setBalanceError(false);
    const [balanceResult, numberResult] = await Promise.allSettled([getCreditsBalance(), getMyNumber()]);
    if (balanceResult.status === "fulfilled") setBalance(balanceResult.value);
    else setBalanceError(true);
    setMyNumber(numberResult.status === "fulfilled" ? numberResult.value : null);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const firstName = (user?.fullName || "there").split(" ")[0];
  const minutes = balance && balance.ratePerMinuteCents > 0 ? Math.floor(balance.balanceCents / balance.ratePerMinuteCents) : null;

  const services: Service[] = [
    { label: tr("Virtual Number"), icon: Hash, bg: "#E5E0FF", fg: "#5147AF", onPress: () => router.push("/(tabs)/(sub-tabs)/settings") },
    { label: tr("Calling Plans"), icon: Crown, bg: "#FFF0CC", fg: "#B8860B", onPress: () => router.push("/(tabs)/(sub-tabs)/calling-plan") },
    { label: tr("eSIM"), icon: SimCard, bg: "#DCEBFF", fg: "#2F6FD0", onPress: () => router.push("/(screens)/esim") },
    { label: tr("Top Up"), icon: Wallet, bg: "#DDF4EA", fg: "#2EAF7D", onPress: () => router.push("/(tabs)/(sub-tabs)/calling-plan") },
    { label: tr("Caller ID"), icon: PhoneForwarded, bg: "#FFE6E4", fg: "#D9534F", onPress: () => router.push("/(tabs)/(sub-tabs)/settings") },
    { label: tr("Call Stats"), icon: BarChart3, bg: "#EDE4FF", fg: "#7A55D6", onPress: () => router.push("/(tabs)/stats") },
    { label: tr("About"), icon: Info, bg: "#E1F1F7", fg: "#2A8CB0", onPress: () => router.push("/(tabs)/(sub-tabs)/about") },
    { label: tr("Help"), icon: HelpCircle, bg: "#FFE6C5", fg: "#D2822B", onPress: () => router.push("/(tabs)/(sub-tabs)/help-support") },
  ];

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={s.page}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={themeColor("#5F56C6")} />}
      >
        <View style={s.topbar}>
          <View>
            <Text style={s.hello}>{tr("Hello, {{name}} 👋", { name: firstName })}</Text>
            <Text style={s.sub}>{tr("Crystal-clear calling, wherever you are.")}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={tr("Open profile")} onPress={() => router.push("/(tabs)/profile")} style={s.avatar}>
            <Text style={s.avatarText}>{(user?.fullName || "G").charAt(0).toUpperCase()}</Text>
          </Pressable>
        </View>

        <LinearGradient colors={["#5F56C6", "#3B2F9E"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.card}>
          <View style={s.cardTop}>
            <Text style={s.cardLabel}>{tr("Available balance")}</Text>
            {user?.isPremium === true && (
              <View style={s.chip}><Crown size={11} color={themeColor("#FFE29A")} /><Text style={s.chipText}>{tr("Airbundle active")}</Text></View>
            )}
          </View>

          {balance ? (
            <>
              <Text style={s.amount}>{formatCents(balance.balanceCents)}</Text>
              <Text style={s.cardHint}>{minutes !== null ? tr("≈ {{minutes}} min to mobile networks", { minutes }) : tr("Prepaid credit")}</Text>
            </>
          ) : balanceError ? (
            <>
              <Text style={s.amount}>—</Text>
              <Pressable onPress={load}><Text style={s.retry}>{tr("Couldn't load balance · Tap to retry")}</Text></Pressable>
            </>
          ) : (
            <View style={s.loadingBalance}><ActivityIndicator color={themeColor("#FFF")} /></View>
          )}

          <View style={s.cardBottom}>
            <View style={s.numberBox}>
              <Text style={s.numberLabel}>{tr("Your 9tel number")}</Text>
              <Text style={s.numberValue} numberOfLines={1}>{myNumber ?? tr("Not set up yet")}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={tr("Top up balance")} onPress={() => router.push("/(tabs)/(sub-tabs)/calling-plan")} style={s.topUp}>
              <Text style={s.topUpText}>{tr("Top up")}</Text>
            </Pressable>
          </View>
        </LinearGradient>

        <Text style={s.heading}>{tr("Services")}</Text>
        <View style={s.grid}>
          {services.map(({ label, icon: Icon, bg, fg, onPress }) => (
            <Pressable key={label} accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={s.tile}>
              <View style={[s.tileIcon, { backgroundColor: bg }]}><Icon size={22} color={fg} /></View>
              <Text style={s.tileLabel} numberOfLines={2}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
      <KeypadFab />
    </SafeAreaView>
  );
}

const s = themedStyles({
  safe: { flex: 1, backgroundColor: "#F8F8FD" },
  page: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: FAB_CLEARANCE },
  topbar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  hello: { color: "#211B59", fontFamily: "Poppins-SemiBold", fontSize: 21 },
  sub: { color: "#85829B", fontFamily: "Poppins-Regular", fontSize: 11.5, marginTop: 1 },
  avatar: { height: 44, width: 44, borderRadius: 15, backgroundColor: "#E5E0FF", alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#5147AF", fontFamily: "Poppins-SemiBold", fontSize: 18 },
  card: { borderRadius: 26, padding: 20, shadowColor: "#3B2F9E", shadowOpacity: 0.3, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 8 },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardLabel: { color: "#D9D5FF", fontFamily: "Poppins-Medium", fontSize: 12 },
  chip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,255,255,0.16)", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  chipText: { color: "#FFF", fontFamily: "Poppins-Medium", fontSize: 10 },
  amount: { color: "#FFF", fontFamily: "Poppins-Bold", fontSize: 38, marginTop: 6, lineHeight: 48 },
  cardHint: { color: "#C9C4F5", fontFamily: "Poppins-Regular", fontSize: 11.5 },
  retry: { color: "#FFE29A", fontFamily: "Poppins-Medium", fontSize: 11.5 },
  loadingBalance: { height: 66, alignItems: "flex-start", justifyContent: "center" },
  cardBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 18, paddingTop: 14, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.16)" },
  numberBox: { flex: 1, marginRight: 12 },
  numberLabel: { color: "#C9C4F5", fontFamily: "Poppins-Regular", fontSize: 10 },
  numberValue: { color: "#FFF", fontFamily: "Poppins-SemiBold", fontSize: 14, marginTop: 1 },
  topUp: { backgroundColor: "#FFF", borderRadius: 14, paddingHorizontal: 18, paddingVertical: 10 },
  topUpText: { color: "#4B41B5", fontFamily: "Poppins-SemiBold", fontSize: 12.5 },
  heading: { color: "#908CA2", fontFamily: "Poppins-SemiBold", fontSize: 11, letterSpacing: 1, marginTop: 28, marginBottom: 12, textTransform: "uppercase" },
  grid: { flexDirection: "row", flexWrap: "wrap", rowGap: 18 },
  tile: { width: "25%", alignItems: "center", paddingHorizontal: 2 },
  tileIcon: { height: 56, width: 56, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  tileLabel: { color: "#302C4C", fontFamily: "Poppins-Medium", fontSize: 10.5, textAlign: "center", marginTop: 7 },
});
