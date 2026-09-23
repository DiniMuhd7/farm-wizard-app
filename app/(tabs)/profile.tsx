import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Bell, ChevronRight, CreditCard, Crown, HelpCircle, PhoneCall, Settings, ShieldCheck, UserRound } from "lucide-react-native";
import { router } from "expo-router";
import { useLoginContext } from "@/context/LoginProvider";
import { getMyNumber } from "@/services/numbers";

const items = [
  { label: "Account details", detail: "Manage your personal information", icon: UserRound, color: "#E5E0FF", route: "/(tabs)/(sub-tabs)/editProfile" },
  { label: "Calling plan", detail: "9tel Plus · Active", icon: Crown, color: "#FFF0CC" },
  { label: "Payment methods", detail: "Add or update your payment method", icon: CreditCard, color: "#CBF1E3" },
  { label: "Privacy & security", detail: "Control your data and preferences", icon: ShieldCheck, color: "#DCEBFF" },
  { label: "Help & support", detail: "Get answers and contact us", icon: HelpCircle, color: "#FFE6C5" },
];

export default function Profile() {
  const { user } = useLoginContext();
  const name = user?.fullName || "Guest";
  const initials = name.split(" ").map((word: string) => word[0]).join("").slice(0, 2);

  // No fallback number here — this screen used to show a fixed
  // "+234 801 234 5678" and a permanent "Your number is active" banner for
  // every account, purchased or not. null means "we don't know yet / they
  // don't have one", not "show a placeholder".
  const [myNumber, setMyNumber] = useState<string | null>(null);

  useEffect(() => {
    getMyNumber()
      .then(setMyNumber)
      .catch(() => setMyNumber(null));
  }, []);

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={s.page}>
        <View style={s.top}>
          <View>
            <Text style={s.title}>Profile</Text>
            <Text style={s.sub}>Manage your 9tel account.</Text>
          </View>
          <Pressable onPress={() => router.push("/(tabs)/(sub-tabs)/settings")} style={s.settings}>
            <Settings size={21} color="#211B59" />
          </Pressable>
        </View>

        <View style={s.profileCard}>
          <View style={s.avatar}>
            <Text style={s.initials}>{initials}</Text>
          </View>
          <View style={s.profileText}>
            <Text style={s.name}>{name}</Text>
            {myNumber && <Text style={s.phone}>{myNumber}</Text>}
            {user?.isGuest && <Text style={s.guestTag}>Guest account</Text>}
          </View>
          <ChevronRight size={20} color="#A09BAE" />
        </View>

        {myNumber ? (
          <View style={s.status}>
            <View style={s.statusDot} />
            <View>
              <Text style={s.statusTitle}>Your number is active</Text>
              <Text style={s.statusCopy}>Calls and messages are ready to go.</Text>
            </View>
          </View>
        ) : (
          <Pressable style={s.statusPending} onPress={() => router.push("/(tabs)/(sub-tabs)/settings")}>
            <View style={s.statusPendingIcon}>
              <PhoneCall size={18} color="#C47C38" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.statusPendingTitle}>Get your 9tel number</Text>
              <Text style={s.statusPendingCopy}>So people can actually reach you.</Text>
            </View>
            <ChevronRight size={19} color="#C9A578" />
          </Pressable>
        )}

        <Text style={s.heading}>Account</Text>
        <View style={s.menu}>
          {items.map(({ label, detail, icon: Icon, color, route }) => (
            <Pressable
              key={label}
              style={s.item}
              onPress={() => (route ? router.push(route as any) : Alert.alert(label, "This section is ready for your account details."))}
            >
              <View style={[s.itemIcon, { backgroundColor: color }]}>
                <Icon size={20} color="#5147AF" />
              </View>
              <View style={s.itemText}>
                <Text style={s.itemTitle}>{label}</Text>
                <Text style={s.itemDetail}>{detail}</Text>
              </View>
              <ChevronRight size={19} color="#A09BAE" />
            </Pressable>
          ))}
        </View>

        <Pressable style={s.signOut} onPress={() => Alert.alert("Sign out", "Your account is safely saved.")}>
          <Text style={s.signOutText}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F8F8FD" },
  page: { padding: 20, paddingBottom: 100 },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { color: "#211B59", fontFamily: "Poppins-SemiBold", fontSize: 26 },
  sub: { color: "#85829B", fontFamily: "Poppins-Regular", fontSize: 12 },
  settings: { height: 45, width: 45, borderRadius: 15, backgroundColor: "#FFF", alignItems: "center", justifyContent: "center", shadowColor: "#28205F", shadowOpacity: 0.08, shadowRadius: 12, elevation: 3 },
  profileCard: { backgroundColor: "#FFF", borderRadius: 22, padding: 16, marginTop: 24, flexDirection: "row", alignItems: "center" },
  avatar: { width: 58, height: 58, borderRadius: 20, backgroundColor: "#E7B79E", alignItems: "center", justifyContent: "center" },
  initials: { color: "#673559", fontFamily: "Poppins-SemiBold", fontSize: 21 },
  profileText: { flex: 1, marginLeft: 13 },
  name: { color: "#302C4C", fontFamily: "Poppins-SemiBold", fontSize: 15 },
  phone: { color: "#918DA2", fontFamily: "Poppins-Regular", fontSize: 11, marginTop: 1 },
  guestTag: { color: "#B37424", fontFamily: "Poppins-Medium", fontSize: 10.5, marginTop: 5 },
  member: { flexDirection: "row", alignItems: "center", marginTop: 6, gap: 4 },
  memberText: { color: "#B37424", fontFamily: "Poppins-Medium", fontSize: 10.5 },
  status: { marginTop: 13, backgroundColor: "#EAF8F1", padding: 15, borderRadius: 18, flexDirection: "row", alignItems: "center" },
  statusDot: { height: 10, width: 10, borderRadius: 5, backgroundColor: "#43BE89", marginHorizontal: 5, marginRight: 12 },
  statusTitle: { color: "#276D51", fontFamily: "Poppins-Medium", fontSize: 12 },
  statusCopy: { color: "#61977F", fontFamily: "Poppins-Regular", fontSize: 10.5, marginTop: 2 },
  statusPending: { marginTop: 13, backgroundColor: "#FFF6E9", padding: 15, borderRadius: 18, flexDirection: "row", alignItems: "center" },
  statusPendingIcon: { height: 34, width: 34, borderRadius: 12, backgroundColor: "#FFE9C6", alignItems: "center", justifyContent: "center", marginRight: 12 },
  statusPendingTitle: { color: "#8A5A22", fontFamily: "Poppins-Medium", fontSize: 12 },
  statusPendingCopy: { color: "#B18452", fontFamily: "Poppins-Regular", fontSize: 10.5, marginTop: 2 },
  heading: { color: "#211B59", fontFamily: "Poppins-SemiBold", fontSize: 17, marginTop: 28, marginBottom: 12 },
  menu: { backgroundColor: "#FFF", borderRadius: 22, paddingHorizontal: 14 },
  item: { flexDirection: "row", alignItems: "center", paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: "#F1F0F6" },
  itemIcon: { height: 41, width: 41, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  itemText: { flex: 1, marginLeft: 12 },
  itemTitle: { color: "#383452", fontFamily: "Poppins-Medium", fontSize: 12.5 },
  itemDetail: { color: "#9693A7", fontFamily: "Poppins-Regular", fontSize: 9.5, marginTop: 1 },
  signOut: { marginTop: 20, alignItems: "center", padding: 13 },
  signOutText: { color: "#E36A65", fontFamily: "Poppins-SemiBold", fontSize: 12.5 },
});
