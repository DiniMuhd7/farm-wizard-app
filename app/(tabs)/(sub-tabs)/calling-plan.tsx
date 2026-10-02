import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Check, ChevronLeft, Clock3, Gift, Globe2, PhoneCall, ShieldCheck, Sparkles, UserRoundCheck, Users } from "lucide-react-native";
import { router } from "expo-router";
import { useLoginContext } from "@/context/LoginProvider";
import CallingPlanTiers from "@/components/CallingPlanTiers";
import NineTelPlanCards from "@/components/NineTelPlanCards";
import PayAsYouGoCard from "@/components/PayAsYouGoCard";
import { getCallingPlansForCountry } from "@/constants/callingPlans";
import { getWelcomeReward, type WelcomeRewardStatus } from "@/services/rewards";

const benefits = [
  { title: "Choose your 9tel number", detail: "Pick from countries where numbers are currently available.", Icon: Globe2 },
  { title: "Call from one place", detail: "Place and receive calls using your 9tel account.", Icon: PhoneCall },
  { title: "Verified caller ID", detail: "Use a verified caller ID where supported.", Icon: UserRoundCheck },
  { title: "Keep track of calls", detail: "Review recent incoming, outgoing, and missed calls.", Icon: Clock3 },
];

const tabs = [
  { id: "free", label: "Free" },
  { id: "premium", label: "Premium" },
  { id: "payg", label: "Pay As You Go" },
] as const;

type PlanTab = typeof tabs[number]["id"];

export default function CallingPlan() {
  const { user, setUser } = useLoginContext();
  const regionalPlans = useMemo(() => getCallingPlansForCountry(user?.country), [user?.country]);
  const [welcome, setWelcome] = useState<WelcomeRewardStatus | null>(null);
  const [welcomeLoading, setWelcomeLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<PlanTab>(user?.isPremium ? "premium" : "free");
  const [selectedTierId, setSelectedTierId] = useState<string | null>(
    () => regionalPlans?.tiers.find((tier) => tier.popular)?.id ?? regionalPlans?.tiers[0]?.id ?? null,
  );

  useEffect(() => {
    setSelectedTierId(
      regionalPlans?.tiers.find((tier) => tier.popular)?.id ?? regionalPlans?.tiers[0]?.id ?? null,
    );
  }, [regionalPlans]);

  useEffect(() => {
    let cancelled = false;
    setWelcomeLoading(true);
    getWelcomeReward()
      .then((value) => {
        if (!cancelled) setWelcome(value);
      })
      .finally(() => {
        if (!cancelled) setWelcomeLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
          <Text style={s.plan}>Choose by destination, not guesswork</Text>
          <Text style={s.copy}>Free and Premium are for 9tel-to-9tel calls. Pay As You Go is only for local-carrier calls, and balances or upgrades never show as confirmed until the server says they are.</Text>
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

        {selectedTab === "free" && (
          <>
            <View style={s.summaryCard}>
              <View style={s.summaryIcon}><Users size={18} color="#5147AF" /></View>
              <View style={s.summaryCopy}>
                <Text style={s.summaryTitle}>Free plan eligibility</Text>
                <Text style={s.summaryText}>Applies only when both sides of the call are 9tel users. Rewarded ads play before and after each eligible call unless your account already has Premium.</Text>
              </View>
            </View>
            <NineTelPlanCards
              plan="free"
              isPremium={user?.isPremium === true}
              onUpgraded={() => setUser((current: any) => (current ? { ...current, isPremium: true } : current))}
            />
          </>
        )}

        {selectedTab === "premium" && (
          <>
            <View style={s.summaryCard}>
              <View style={s.summaryIcon}><ShieldCheck size={18} color="#5147AF" /></View>
              <View style={s.summaryCopy}>
                <Text style={s.summaryTitle}>Premium eligibility</Text>
                <Text style={s.summaryText}>Premium only affects 9tel-to-9tel calls. It removes the rewarded ads but does not add local-carrier minutes or credit by itself.</Text>
              </View>
            </View>
            <NineTelPlanCards
              plan="premium"
              isPremium={user?.isPremium === true}
              onUpgraded={() => setUser((current: any) => (current ? { ...current, isPremium: true } : current))}
            />

            {regionalPlans ? (
              <>
                <View style={s.inlineNote}>
                  <Globe2 size={18} color="#5147AF" />
                  <Text style={s.noteText}>
                    Regional monthly bundles shown below remain available for supported countries. They are separate from Free vs Premium and still apply when adding a 9tel number in {regionalPlans.countryName}.
                  </Text>
                </View>
                <CallingPlanTiers
                  plans={regionalPlans}
                  selectedTierId={selectedTierId}
                  onSelect={setSelectedTierId}
                />
              </>
            ) : (
              <View style={s.inlineNote}>
                <Globe2 size={18} color="#5147AF" />
                <Text style={s.noteText}>
                  Regional monthly bundles are currently listed only for users in the United States, United Kingdom, or Canada.
                </Text>
              </View>
            )}
          </>
        )}

        {selectedTab === "payg" && (
          <>
            <View style={s.summaryCard}>
              <View style={s.summaryIcon}><Gift size={18} color="#5147AF" /></View>
              <View style={s.summaryCopy}>
                <Text style={s.summaryTitle}>Pay As You Go eligibility</Text>
                <Text style={s.summaryText}>Use this only for calls from 9tel to local mobile carriers. New accounts may also have a one-minute welcome reward, depending on the verified-phone status the server reports.</Text>
              </View>
            </View>
            <PayAsYouGoCard
              welcomeReward={welcome}
              welcomeRewardLoading={welcomeLoading}
              onVerifyPhone={() => router.push("/verify-phone")}
            />
          </>
        )}

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
  summaryCard: { backgroundColor: "#FFF", borderRadius: 20, padding: 16, marginTop: 18, flexDirection: "row", alignItems: "flex-start", gap: 12 },
  summaryIcon: { width: 36, height: 36, borderRadius: 14, backgroundColor: "#EEECFF", alignItems: "center", justifyContent: "center" },
  summaryCopy: { flex: 1 },
  summaryTitle: { color: "#211B59", fontFamily: "Poppins-SemiBold", fontSize: 14 },
  summaryText: { color: "#5D5A76", fontFamily: "Poppins-Regular", fontSize: 11, lineHeight: 17, marginTop: 4 },
  inlineNote: { flexDirection: "row", gap: 11, backgroundColor: "#EAF2FF", borderRadius: 18, padding: 15, marginTop: 14 },
  noteText: { flex: 1, color: "#52617B", fontFamily: "Poppins-Regular", fontSize: 10.5, lineHeight: 16 },
  headingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 27, marginBottom: 10 },
  heading: { color: "#211B59", fontFamily: "Poppins-SemiBold", fontSize: 11, letterSpacing: 0.8 },
  count: { color: "#6B6880", fontFamily: "Poppins-Regular", fontSize: 11 },
  group: { backgroundColor: "#FFF", borderRadius: 20, paddingHorizontal: 14 },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderColor: "#F1F0F6" },
  lastRow: { borderBottomWidth: 0 },
  icon: { width: 34, height: 34, borderRadius: 12, backgroundColor: "#EEECFF", alignItems: "center", justifyContent: "center", marginRight: 11 },
  benefitCopy: { flex: 1, marginRight: 10 },
  rowTitle: { color: "#302C4C", fontFamily: "Poppins-Medium", fontSize: 11.5 },
  rowText: { color: "#85829B", fontFamily: "Poppins-Regular", fontSize: 10, lineHeight: 15, marginTop: 2 },
  primary: { backgroundColor: "#5147AF", minHeight: 52, borderRadius: 16, marginTop: 20, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  primaryText: { color: "#FFF", fontFamily: "Poppins-SemiBold", fontSize: 13 },
});
