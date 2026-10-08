import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowDownLeft, ArrowUpRight, Phone, PhoneMissed, Search } from "lucide-react-native";
import { router } from "expo-router";
import { getCallHistory, type CallRecord } from "@/services/calls";
import KeypadFab from "@/components/KeypadFab";
import { blockNumber } from "@/services/blocked";
import { E164 } from "@/services/messages";
import ContactFab from "@/components/ContactFab";
import { FAB_CLEARANCE, TAB_BAR_HEIGHT } from "@/constants/layout";
import { themedStyles, themeColor, useThemeVersion } from "@/theme";
import { tr } from "@/utils/tr";
import { useTranslation } from "react-i18next";

const AVATAR_COLORS = ["#F1B296", "#B8D8CB", "#CDD0F6", "#F8D09A"];

function displayNumber(counterparty: string): string {
  const clientMatch = counterparty.match(/^client:user-(.+)$/);
  return clientMatch ? tr("9tel user {{id}}", { id: clientMatch[1].slice(0, 6) }) : counterparty;
}

function relativeDay(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayDiff = Math.round((startOfToday.getTime() - startOfDate.getTime()) / 86400000);
  const time = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (dayDiff === 0) return tr("Today, {{time}}", { time });
  if (dayDiff === 1) return tr("Yesterday, {{time}}", { time });
  return `${date.toLocaleDateString([], { month: "short", day: "numeric" })}, ${time}`;
}

function isMissed(call: CallRecord): boolean {
  return call.direction === "inbound" && call.status !== "completed";
}

function subtitle(call: CallRecord): string {
  if (isMissed(call)) {
    return call.status === "no-answer" ? tr("Missed call") : call.status === "busy" ? tr("Missed (busy)") : tr("Missed call");
  }
  return relativeDay(call.at);
}

export default function Recent() {
  useTranslation();
  useThemeVersion();
  const [calls, setCalls] = useState<CallRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCallHistory()
      .then(setCalls)
      .catch((err) => setError(err.message));
  }, []);

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.page}>
        <Text style={s.title}>{tr("Recent calls")}</Text>
        <Text style={s.sub}>{tr("Stay connected with your people.")}</Text>
        <View style={s.search}>
          <Search size={19} color={themeColor("#9894A9")} />
          <Text style={s.searchText}>{tr("Search recent calls")}</Text>
        </View>
        <View style={s.heading}>
          <Text style={s.headingText}>{tr("LAST 50")}</Text>
        </View>

        {calls === null && !error && (
          <View style={s.centerState}>
            <ActivityIndicator color={themeColor("#5F56C6")} />
          </View>
        )}

        {error && (
          <View style={s.centerState}>
            <Text style={s.emptyText}>{error}</Text>
          </View>
        )}

        {calls && calls.length === 0 && (
          <View style={s.centerState}>
            <Text style={s.emptyText}>{tr("No calls yet — once you make or receive one, it'll show up here.")}</Text>
          </View>
        )}

        {calls && calls.length > 0 && (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.list}>
            {calls.map((call, i) => {
              const number = displayNumber(call.counterparty);
              const missed = isMissed(call);
              return (
                <Pressable
                  key={call.id}
                  style={s.call}
                  onPress={() => router.push({ pathname: "/(screens)/call", params: { number } })}
                  onLongPress={() => {
                    if (!E164.test(call.counterparty)) return;
                    Alert.alert(tr("Block {{number}}?", { number: call.counterparty }), tr("They won't be able to call or text you."), [
                      { text: tr("Cancel"), style: "cancel" },
                      {
                        text: tr("Block"),
                        style: "destructive",
                        onPress: () =>
                          blockNumber(call.counterparty)
                            .then(() => Alert.alert(tr("Blocked"), tr("{{number}} can no longer reach you. Manage this in Settings → Blocked numbers.", { number: call.counterparty })))
                            .catch((e) => Alert.alert(tr("Couldn't block number"), e.message)),
                      },
                    ]);
                  }}
                >
                  <View style={[s.avatar, { backgroundColor: AVATAR_COLORS[i % AVATAR_COLORS.length] }]}>
                    <Text style={s.initial}>{number.replace(/^\+/, "").slice(0, 1)}</Text>
                  </View>
                  <View style={s.callInfo}>
                    <Text style={s.name}>{number}</Text>
                    <View style={s.detail}>
                      <View style={[s.direction, { backgroundColor: missed ? "#FFE6E4" : "#E4F6EE" }]}>
                        {missed ? (
                          <PhoneMissed size={12} color={themeColor("#E66763")} />
                        ) : call.direction === "inbound" ? (
                          <ArrowDownLeft size={12} color={themeColor("#2EAF7D")} />
                        ) : (
                          <ArrowUpRight size={12} color={themeColor("#2EAF7D")} />
                        )}
                      </View>
                      <Text style={[s.callTime, missed && s.missed]}>{subtitle(call)}</Text>
                    </View>
                  </View>
                  <Pressable style={s.phone} onPress={() => router.push({ pathname: "/(screens)/call", params: { number } })}>
                    <Phone size={19} color={themeColor("#5F56C6")} />
                  </Pressable>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>
      <ContactFab />
      <KeypadFab />
    </SafeAreaView>
  );
}

const s = themedStyles({
  safe: { flex: 1, backgroundColor: "#F8F8FD" },
  page: { flex: 1, paddingHorizontal: 20, paddingTop: 11, paddingBottom: TAB_BAR_HEIGHT },
  title: { color: "#211B59", fontFamily: "Poppins-SemiBold", fontSize: 26 },
  sub: { color: "#85829B", fontFamily: "Poppins-Regular", fontSize: 12, marginTop: 1 },
  search: {
    height: 52,
    marginTop: 23,
    borderRadius: 17,
    backgroundColor: "#FFF",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    shadowColor: "#28205F",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  searchText: { color: "#9995A8", fontFamily: "Poppins-Regular", fontSize: 12, marginLeft: 10 },
  heading: { flexDirection: "row", justifyContent: "space-between", marginTop: 27, marginBottom: 10 },
  headingText: { color: "#908CA2", fontFamily: "Poppins-SemiBold", fontSize: 10, letterSpacing: 1 },
  list: { paddingBottom: FAB_CLEARANCE - TAB_BAR_HEIGHT + 30 },
  centerState: { paddingTop: 60, alignItems: "center", paddingHorizontal: 20 },
  emptyText: { color: "#9693A9", fontFamily: "Poppins-Regular", fontSize: 12.5, textAlign: "center" },
  call: { backgroundColor: "#FFF", borderRadius: 19, padding: 13, marginBottom: 10, flexDirection: "row", alignItems: "center" },
  avatar: { height: 48, width: 48, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  initial: { fontFamily: "Poppins-SemiBold", fontSize: 20, color: "#3B315F" },
  callInfo: { flex: 1, marginLeft: 12 },
  name: { color: "#302C4C", fontFamily: "Poppins-Medium", fontSize: 13.5 },
  detail: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  direction: { height: 18, width: 18, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  callTime: { color: "#9693A9", fontFamily: "Poppins-Regular", fontSize: 10.5, marginLeft: 5 },
  missed: { color: "#E66763" },
  phone: { height: 39, width: 39, borderRadius: 13, backgroundColor: "#EEECFF", alignItems: "center", justifyContent: "center" },
});
