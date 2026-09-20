import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowDownLeft, ArrowUpRight, Clock3, PhoneCall } from "lucide-react-native";
import { getCallStats, type CallStats } from "@/services/calls";
import KeypadFab from "@/components/KeypadFab";

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  const s = totalSeconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default function Stats() {
  const [stats, setStats] = useState<CallStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCallStats()
      .then(setStats)
      .catch((err) => setError(err.message));
  }, []);

  if (!stats && !error) {
    return (
      <SafeAreaView style={s.safe} edges={["top"]}>
        <View style={s.loading}>
          <ActivityIndicator color="#5F56C6" />
        </View>
        <KeypadFab />
      </SafeAreaView>
    );
  }

  if (error || !stats) {
    return (
      <SafeAreaView style={s.safe} edges={["top"]}>
        <View style={s.loading}>
          <Text style={s.emptyText}>{error}</Text>
        </View>
        <KeypadFab />
      </SafeAreaView>
    );
  }

  const maxDaily = Math.max(1, ...stats.dailyCounts);

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={s.page}>
        <Text style={s.title}>Call statistics</Text>
        <Text style={s.sub}>Your conversation at a glance.</Text>
        <View style={s.period}>
          <Text style={s.periodText}>This week</Text>
        </View>

        <View style={s.hero}>
          <View>
            <Text style={s.heroLabel}>TOTAL CALL TIME</Text>
            <Text style={s.heroValue}>{formatDuration(stats.totalSeconds)}</Text>
            {stats.changeFromLastWeekPercent !== null && (
              <Text style={s.heroFoot}>
                {stats.changeFromLastWeekPercent >= 0 ? "↑" : "↓"} {Math.abs(stats.changeFromLastWeekPercent)}% from last week
              </Text>
            )}
          </View>
          <View style={s.clock}>
            <Clock3 size={31} color="#FFF" />
          </View>
        </View>

        <View style={s.grid}>
          <Metric icon={PhoneCall} label="Total calls" value={String(stats.totalCalls)} color="#E5E0FF" />
          <Metric icon={ArrowUpRight} label="Outgoing" value={String(stats.outgoing)} color="#CBF1E3" />
          <Metric icon={ArrowDownLeft} label="Incoming" value={String(stats.incoming)} color="#FFE6C5" />
          <Metric icon={Clock3} label="Avg. duration" value={stats.avgSeconds ? formatDuration(stats.avgSeconds) : "—"} color="#DCEBFF" />
        </View>

        <Text style={s.section}>Call activity</Text>
        <View style={s.chart}>
          <View style={s.chartHead}>
            <Text style={s.chartTitle}>Calls this week</Text>
            <Text style={s.legend}>●  Total calls</Text>
          </View>
          <View style={s.barRow}>
            {stats.dailyCounts.map((count, index) => (
              <View key={index} style={s.barItem}>
                <View style={[s.bar, { height: `${Math.max(4, (count / maxDaily) * 100)}%` }]} />
                <Text style={s.day}>{DAY_LABELS[index]}</Text>
              </View>
            ))}
          </View>
        </View>

        {stats.busiestDayIndex !== null && (
          <View style={s.insight}>
            <Text style={s.insightLabel}>YOUR BUSIEST DAY</Text>
            <Text style={s.insightTitle}>
              {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][stats.busiestDayIndex]}
            </Text>
            <Text style={s.insightCopy}>Most of your calls this week landed on this day.</Text>
          </View>
        )}
      </ScrollView>
      <KeypadFab />
    </SafeAreaView>
  );
}

function Metric({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  return (
    <View style={s.metric}>
      <View style={[s.metricIcon, { backgroundColor: color }]}>
        <Icon size={19} color="#4F469C" />
      </View>
      <Text style={s.metricValue}>{value}</Text>
      <Text style={s.metricLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F8F8FD" },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 30 },
  emptyText: { color: "#9693A9", fontFamily: "Poppins-Regular", fontSize: 12.5, textAlign: "center" },
  page: { padding: 20, paddingBottom: 100 },
  title: { color: "#211B59", fontFamily: "Poppins-SemiBold", fontSize: 26 },
  sub: { color: "#85829B", fontFamily: "Poppins-Regular", fontSize: 12 },
  period: { alignSelf: "flex-start", marginTop: 19, paddingHorizontal: 13, paddingVertical: 8, backgroundColor: "#EEECFF", borderRadius: 12 },
  periodText: { fontFamily: "Poppins-Medium", fontSize: 11, color: "#5147AF" },
  hero: { borderRadius: 25, backgroundColor: "#211B59", marginTop: 16, padding: 23, flexDirection: "row", justifyContent: "space-between", overflow: "hidden" },
  heroLabel: { color: "#D8D4FF", fontFamily: "Poppins-Medium", fontSize: 10, letterSpacing: 1 },
  heroValue: { color: "#FFF", fontFamily: "Poppins-SemiBold", fontSize: 31, marginTop: 4 },
  heroFoot: { color: "#8FE5C1", fontFamily: "Poppins-Medium", fontSize: 10.5, marginTop: 5 },
  clock: { height: 64, width: 64, borderRadius: 24, backgroundColor: "#655CD0", alignItems: "center", justifyContent: "center", marginTop: 4 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginTop: 18, rowGap: 12 },
  metric: { width: "48.2%", backgroundColor: "#FFF", borderRadius: 19, padding: 14 },
  metricIcon: { height: 36, width: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  metricValue: { color: "#292448", fontFamily: "Poppins-SemiBold", fontSize: 21, marginTop: 11 },
  metricLabel: { color: "#9290A2", fontFamily: "Poppins-Regular", fontSize: 10.5 },
  section: { color: "#211B59", fontFamily: "Poppins-SemiBold", fontSize: 17, marginTop: 28, marginBottom: 13 },
  chart: { backgroundColor: "#FFF", borderRadius: 21, padding: 17 },
  chartHead: { flexDirection: "row", justifyContent: "space-between" },
  chartTitle: { color: "#393556", fontFamily: "Poppins-Medium", fontSize: 12.5 },
  legend: { color: "#79748E", fontFamily: "Poppins-Regular", fontSize: 9.5 },
  barRow: { height: 142, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-around", paddingTop: 16 },
  barItem: { height: "100%", width: 20, justifyContent: "flex-end", alignItems: "center" },
  bar: { backgroundColor: "#655CD0", width: 17, borderRadius: 8 },
  day: { color: "#8E8A9F", fontFamily: "Poppins-Medium", fontSize: 9, marginTop: 6 },
  insight: { marginTop: 17, borderRadius: 19, backgroundColor: "#FFF2E4", padding: 17 },
  insightLabel: { color: "#C47C38", fontFamily: "Poppins-SemiBold", fontSize: 9, letterSpacing: 1 },
  insightTitle: { color: "#49351F", fontFamily: "Poppins-SemiBold", fontSize: 15, marginTop: 5 },
  insightCopy: { color: "#8E795F", fontFamily: "Poppins-Regular", fontSize: 10.5, marginTop: 2 },
});
