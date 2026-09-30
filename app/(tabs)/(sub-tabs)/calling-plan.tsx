import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Check, ChevronLeft, Clock3, Globe2, PhoneCall, ShieldCheck, Sparkles, UserRoundCheck } from "lucide-react-native";
import { router } from "expo-router";
import { useLoginContext } from "@/context/LoginProvider";
import CallingPlanTiers from "@/components/CallingPlanTiers";
import { getCallingPlansForCountry } from "@/constants/callingPlans";

const benefits = [
  { title: "Choose your 9tel number", detail: "Pick from countries where numbers are currently available.", Icon: Globe2 },
  { title: "Call from one place", detail: "Place and receive calls using your 9tel account.", Icon: PhoneCall },
  { title: "Verified caller ID", detail: "Use a verified caller ID where supported.", Icon: UserRoundCheck },
  { title: "Keep track of calls", detail: "Review recent incoming, outgoing, and missed calls.", Icon: Clock3 },
];

export default function CallingPlan() {
  const { user } = useLoginContext();
  const regionalPlans = useMemo(() => getCallingPlansForCountry(user?.country), [user?.country]);
  const [selectedTierId, setSelectedTierId] = useState<string | null>(
    () => regionalPlans?.tiers.find((tier) => tier.popular)?.id ?? regionalPlans?.tiers[0]?.id ?? null,
  );

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={s.page} showsVerticalScrollIndicator={false}>
        <Pressable accessibilityLabel="Go back" onPress={() => router.back()} style={s.back}>
          <ChevronLeft size={23} color="#211B59" />
        </Pressable>
        <Text style={s.eyebrow}>YOUR ACCOUNT</Text>
        <Text style={s.title}>Calling plan</Text>
        <Text style={s.sub}>Everything you need to make 9tel calls work for you.</Text>

        <View style={s.card}>
          <View style={s.badge}><Sparkles size={17} color="#DCD8FF" /><Text style={s.badgeText}>9TEL CALLING</Text></View>
          <Text style={s.plan}>Your number. Your calls.</Text>
          <Text style={s.copy}>Set up a 9tel number to get started. Availability and pricing are shown before you confirm a purchase.</Text>
          <View style={s.status}><View style={s.dot} /><Text style={s.statusText}>Ready to set up</Text></View>
        </View>

        <View style={s.headingRow}>
          <Text style={s.heading}>PLAN BENEFITS</Text>
          <Text style={s.count}>{benefits.length} features</Text>
        </View>
        <View style={s.group}>
          {benefits.map(({ title, detail, Icon }, index) => (
            <View key={title} style={[s.row, index === benefits.length - 1 && s.lastRow]}>
              <View style={s.icon}><Icon size={17} color="#5147AF" /></View>
              <View style={s.benefitCopy}>
                <Text style={s.rowTitle}>{title}</Text>
                <Text style={s.rowText}>{detail}</Text>
              </View>
              <Check size={16} color="#3A9B70" />
            </View>
          ))}
        </View>
        <View style={s.note}>
          <ShieldCheck size={19} color="#5147AF" />
          <Text style={s.noteText}>You’ll see the number’s price and payment details before confirming. Card details are not stored in the app.</Text>
        </View>

        {regionalPlans && (
          <CallingPlanTiers
            plans={regionalPlans}
            selectedTierId={selectedTierId}
            onSelect={setSelectedTierId}
          />
        )}

        <Pressable style={s.primary} onPress={() => router.push("/(tabs)/(sub-tabs)/settings")}>
          <PhoneCall size={18} color="#FFF" /><Text style={s.primaryText}>Set up your number</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F8F8FD" },
  page: { padding: 20, paddingBottom: 48 },
  back: { width: 44, height: 44, borderRadius: 14, backgroundColor: "#FFF", alignItems: "center", justifyContent: "center" },
  eyebrow: { color: "#8D899F", fontFamily: "Poppins-SemiBold", fontSize: 10, letterSpacing: 1.1, marginTop: 23 },
  title: { marginTop: 3, color: "#211B59", fontFamily: "Poppins-SemiBold", fontSize: 27 },
  sub: { color: "#85829B", fontFamily: "Poppins-Regular", fontSize: 12, lineHeight: 18, marginTop: 3 },
  card: { backgroundColor: "#211B59", borderRadius: 24, padding: 21, marginTop: 23 },
  badge: { flexDirection: "row", alignItems: "center", gap: 7 },
  badgeText: { color: "#DCD8FF", fontFamily: "Poppins-SemiBold", fontSize: 10, letterSpacing: 0.7 },
  plan: { color: "#FFF", fontFamily: "Poppins-SemiBold", fontSize: 21, marginTop: 15 },
  copy: { color: "#D0CCFC", fontFamily: "Poppins-Regular", fontSize: 11.5, lineHeight: 18, marginTop: 6 },
  status: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,.12)", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 7, marginTop: 17 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#7BE4BB", marginRight: 6 },
  statusText: { color: "#E6FFF4", fontFamily: "Poppins-Medium", fontSize: 10.5 },
  headingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 27, marginBottom: 10 },
  heading: { color: "#211B59", fontFamily: "Poppins-SemiBold", fontSize: 11, letterSpacing: 0.8 },
  count: { color: "#8D899F", fontFamily: "Poppins-Regular", fontSize: 10 },
  group: { backgroundColor: "#FFF", borderRadius: 20, paddingHorizontal: 14 },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderColor: "#F1F0F6" },
  lastRow: { borderBottomWidth: 0 },
  icon: { width: 34, height: 34, borderRadius: 12, backgroundColor: "#EEECFF", alignItems: "center", justifyContent: "center", marginRight: 11 },
  benefitCopy: { flex: 1, marginRight: 10 },
  rowTitle: { color: "#302C4C", fontFamily: "Poppins-Medium", fontSize: 11.5 },
  rowText: { color: "#85829B", fontFamily: "Poppins-Regular", fontSize: 10, lineHeight: 15, marginTop: 2 },
  note: { flexDirection: "row", gap: 11, backgroundColor: "#EAF2FF", borderRadius: 18, padding: 15, marginTop: 17 },
  noteText: { flex: 1, color: "#52617B", fontFamily: "Poppins-Regular", fontSize: 10.5, lineHeight: 16 },
  primary: { backgroundColor: "#5147AF", height: 52, borderRadius: 16, marginTop: 20, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  primaryText: { color: "#FFF", fontFamily: "Poppins-SemiBold", fontSize: 13 },
});
