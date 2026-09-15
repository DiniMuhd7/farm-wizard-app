import { useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Redirect, router } from "expo-router";
import { Bell, ChevronRight, CircleHelp, Gift, Send, Smartphone, Wallet } from "lucide-react-native";
import { useLoginContext } from "@/context/LoginProvider";

const quickActions = [
  { label: "Airtime", icon: Smartphone, color: "#E5E0FF", route: "/(screens)/inventory" },
  { label: "Data", icon: Send, color: "#CBF1E3", route: "/(screens)/selectSeed" },
  { label: "Transfer", icon: Wallet, color: "#FFE6C5", route: "/(tabs)/(sub-tabs)/withdrawalRequest" },
  { label: "More", icon: CircleHelp, color: "#DCEBFF", route: "/(screens)/shorts" },
];

export default function Home() {
  const { user } = useLoginContext();
  if (!user) return <Redirect href="/" />;
  const [balanceVisible, setBalanceVisible] = useState(true);
  const name = user?.fullName?.split(" ")[0] || "there";
  const points = Number(user?.score || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });

  const showNotice = (title) => Alert.alert(title, "This service will be available shortly.");

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topbar}>
          <View>
            <Text style={styles.greeting}>Good morning, {name}</Text>
            <Text style={styles.subtitle}>Here is your account overview</Text>
          </View>
          <TouchableOpacity accessibilityLabel="Notifications" style={styles.bell} onPress={() => showNotice("No new notifications")}>
            <Bell color="#171342" size={22} strokeWidth={2.4} />
            <View style={styles.dot} />
          </TouchableOpacity>
        </View>

        <View style={styles.balanceCard}>
          <View style={styles.cardGlowOne} />
          <View style={styles.cardGlowTwo} />
          <Text style={styles.balanceLabel}>AVAILABLE BALANCE</Text>
          <View style={styles.balanceRow}>
            <Text style={styles.balance}>{balanceVisible ? `₦${points}.00` : "₦ ••••••"}</Text>
            <TouchableOpacity onPress={() => setBalanceVisible((visible) => !visible)}>
              <Text style={styles.hide}>{balanceVisible ? "Hide" : "Show"}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.cardFooter}>
            <Text style={styles.cardFooterText}>9tel wallet</Text>
            <Text style={styles.cardMark}>9tel</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Quick actions</Text>
        <View style={styles.actionGrid}>
          {quickActions.map(({ label, icon: Icon, color, route }) => (
            <TouchableOpacity key={label} style={styles.action} onPress={() => router.push(route)} activeOpacity={0.78}>
              <View style={[styles.actionIcon, { backgroundColor: color }]}><Icon color="#211B59" size={23} strokeWidth={2.3} /></View>
              <Text style={styles.actionLabel}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.offer} activeOpacity={0.85} onPress={() => router.push("/(screens)/dailyChallenge")}>
          <View style={styles.offerIcon}><Gift color="#FFF" size={22} /></View>
          <View style={styles.offerText}>
            <Text style={styles.offerTitle}>Claim your welcome bonus</Text>
            <Text style={styles.offerCaption}>Enjoy exclusive rewards made for you.</Text>
          </View>
          <ChevronRight color="#FFF" size={21} />
        </TouchableOpacity>

        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Recent activity</Text>
          <TouchableOpacity onPress={() => router.push("/(tabs)/(sub-tabs)/userWithdrawals")}><Text style={styles.seeAll}>See all</Text></TouchableOpacity>
        </View>
        <View style={styles.activityCard}>
          <View style={styles.activityIcon}><Wallet color="#5952A7" size={22} /></View>
          <View style={styles.activityText}>
            <Text style={styles.activityTitle}>Your wallet is ready</Text>
            <Text style={styles.activityCaption}>Start by making your first transaction.</Text>
          </View>
          <ChevronRight color="#A5A2BA" size={20} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F8F8FD" }, content: { padding: 20, paddingBottom: 112 },
  topbar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 25 },
  greeting: { color: "#171342", fontSize: 21, fontFamily: "Poppins-SemiBold" }, subtitle: { color: "#85829B", fontSize: 12, marginTop: 3, fontFamily: "Poppins-Regular" },
  bell: { width: 46, height: 46, borderRadius: 16, backgroundColor: "#FFF", alignItems: "center", justifyContent: "center", shadowColor: "#28205F", shadowOpacity: 0.08, shadowRadius: 13, elevation: 3 }, dot: { position: "absolute", width: 8, height: 8, borderRadius: 4, backgroundColor: "#FF6B6B", top: 11, right: 12, borderWidth: 1.5, borderColor: "#FFF" },
  balanceCard: { minHeight: 190, borderRadius: 27, backgroundColor: "#211B59", padding: 25, overflow: "hidden", marginBottom: 27 }, cardGlowOne: { position: "absolute", backgroundColor: "#695DDA", opacity: 0.6, height: 200, width: 200, borderRadius: 100, right: -68, top: -70 }, cardGlowTwo: { position: "absolute", borderColor: "#9A91F7", borderWidth: 24, opacity: 0.22, height: 155, width: 155, borderRadius: 80, right: 50, bottom: -104 },
  balanceLabel: { color: "#D8D4FF", fontSize: 11, letterSpacing: 1.2, fontFamily: "Poppins-Medium" }, balanceRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 9 }, balance: { color: "#FFF", fontSize: 31, fontFamily: "Poppins-SemiBold" }, hide: { color: "#F0EFFF", fontSize: 12, fontFamily: "Poppins-Medium", padding: 8 }, cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 32 }, cardFooterText: { color: "#D8D4FF", fontSize: 12, fontFamily: "Poppins-Regular" }, cardMark: { color: "#FFF", fontSize: 20, fontFamily: "Poppins-Bold", letterSpacing: -1 },
  sectionTitle: { color: "#1F1B46", fontSize: 17, fontFamily: "Poppins-SemiBold" }, actionGrid: { flexDirection: "row", justifyContent: "space-between", marginTop: 17, marginBottom: 28 }, action: { alignItems: "center", width: "23%" }, actionIcon: { width: 57, height: 57, borderRadius: 20, alignItems: "center", justifyContent: "center" }, actionLabel: { color: "#393556", fontSize: 12, marginTop: 8, fontFamily: "Poppins-Medium" },
  offer: { borderRadius: 20, backgroundColor: "#F06E5D", padding: 17, flexDirection: "row", alignItems: "center", marginBottom: 30 }, offerIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.20)", alignItems: "center", justifyContent: "center" }, offerText: { flex: 1, marginLeft: 12 }, offerTitle: { color: "#FFF", fontSize: 14, fontFamily: "Poppins-SemiBold" }, offerCaption: { color: "#FFF4F2", fontSize: 10.5, marginTop: 2, fontFamily: "Poppins-Regular" },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }, seeAll: { color: "#625BC1", fontSize: 12, fontFamily: "Poppins-Medium" }, activityCard: { backgroundColor: "#FFF", borderRadius: 18, padding: 15, flexDirection: "row", alignItems: "center", shadowColor: "#28205F", shadowOpacity: 0.06, shadowRadius: 12, elevation: 2 }, activityIcon: { width: 43, height: 43, borderRadius: 15, backgroundColor: "#F0EFFF", alignItems: "center", justifyContent: "center" }, activityText: { flex: 1, marginLeft: 12 }, activityTitle: { color: "#302C4C", fontSize: 13, fontFamily: "Poppins-Medium" }, activityCaption: { color: "#9693A9", fontSize: 10.5, marginTop: 2, fontFamily: "Poppins-Regular" },
});
