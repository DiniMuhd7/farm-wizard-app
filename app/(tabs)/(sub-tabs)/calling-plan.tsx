import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft, PhoneCall, Sparkles } from "lucide-react-native";
import { router } from "expo-router";
import { useLoginContext } from "@/context/LoginProvider";
import AirbundleCards from "@/components/AirbundleCards";
import PrepaidCard from "@/components/PrepaidCard";
const tabs = [
  { id: "airbundle", label: "Airbundle" },
  { id: "prepaid", label: "Prepaid" },
] as const;

type PlanTab = typeof tabs[number]["id"];

export default function CallingPlan() {
  const { user, setUser } = useLoginContext();
  const [selectedTab, setSelectedTab] = useState<PlanTab>("airbundle");

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={s.page} showsVerticalScrollIndicator={false}>
        <Pressable accessibilityLabel="Go back" onPress={() => router.back()} style={s.back}>
          <ChevronLeft size={23} color="#211B59" />
        </Pressable>

        <Text style={s.eyebrow}>YOUR ACCOUNT</Text>
        <Text style={s.title}>Calling plan</Text>
        <Text style={s.sub}>Choose the calling experience that matches who you call, what you pay for, and what is already active on your account.</Text>

        <View style={s.heroCard} accessible accessibilityRole="summary">
          <View style={s.badge}><Sparkles size={17} color="#DCD8FF" /><Text style={s.badgeText}>9TEL CALLING</Text></View>
          <Text style={s.plan}>Every minute, more connection</Text>
          <Text style={s.copy}>Airbundle minutes work for calls to 9tel users and local mobile carriers. Prepaid is an additional carrier-call balance. Balances and bundles never show as confirmed until the server says they are.</Text>
        </View>

        <View style={s.segmentedWrap} accessibilityRole="tablist">
          {tabs.map((tab) => {
            const active = selectedTab === tab.id;
            return (
              <Pressable
                key={tab.id}
                accessibilityRole="tab"
                accessibilityLabel={tab.label}
                accessibilityState={{ selected: active }}
                onPress={() => setSelectedTab(tab.id)}
                style={[s.segmentedTab, active && s.segmentedTabActive]}
              >
                <Text style={[s.segmentedText, active && s.segmentedTextActive]}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {selectedTab === "airbundle" && (
          <AirbundleCards
            isActive={user?.isPremium === true}
            onPurchased={() => setUser((current: any) => (current ? { ...current, isPremium: true } : current))}
          />
        )}

        {selectedTab === "prepaid" && <PrepaidCard />}

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
  heroCard: { backgroundColor: "#211B59", borderRadius: 24, padding: 21, marginTop: 23 },
  badge: { flexDirection: "row", alignItems: "center", gap: 7 },
  badgeText: { color: "#DCD8FF", fontFamily: "Poppins-SemiBold", fontSize: 10, letterSpacing: 0.7 },
  plan: { color: "#FFF", fontFamily: "Poppins-SemiBold", fontSize: 21, marginTop: 15 },
  copy: { color: "#D0CCFC", fontFamily: "Poppins-Regular", fontSize: 11.5, lineHeight: 18, marginTop: 6 },
  segmentedWrap: { backgroundColor: "#EEEAFB", borderRadius: 18, padding: 5, marginTop: 20, flexDirection: "row", gap: 4 },
  segmentedTab: { flex: 1, minHeight: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
  segmentedTabActive: { backgroundColor: "#FFF" },
  segmentedText: { color: "#6D6890", fontFamily: "Poppins-Medium", fontSize: 11.5, textAlign: "center" },
  segmentedTextActive: { color: "#211B59", fontFamily: "Poppins-SemiBold" },
  primary: { backgroundColor: "#5147AF", minHeight: 52, borderRadius: 16, marginTop: 20, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  primaryText: { color: "#FFF", fontFamily: "Poppins-SemiBold", fontSize: 13 },
});
