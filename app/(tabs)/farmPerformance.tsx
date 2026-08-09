import React, { useCallback, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import BackgroundImage from "@/components/BackgroundImage";
import HeaderNavigation from "@/components/HeaderNavigation";
import { icons, images } from "@/constants";
import {
  FarmCycleRecord,
  getFarmCycleRecords,
  summarizeFarmCycleRecords,
} from "@/utils/farmDashboard";
import { householdGardenTrends } from "@/constants/gardenTrends";

const healthLabel = (health: number) => {
  if (health >= 90) return "Excellent";
  if (health >= 70) return "Healthy";
  if (health >= 45) return "Needs attention";
  return "High risk";
};

const PerformanceCard = ({ label, value, emoji }: { label: string; value: string; emoji: string }) => (
  <View className="bg-black/30 rounded-2xl p-3 mb-3" style={{ width: "48%" }}>
    <Text className="text-2xl">{emoji}</Text>
    <Text className="text-white/70 text-xs mt-1">{label}</Text>
    <Text className="text-white font-pbold text-lg mt-1">{value}</Text>
  </View>
);

export default function FarmPerformance() {
  const [records, setRecords] = useState<FarmCycleRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      const load = async () => {
        setLoading(true);
        try {
          const data = await getFarmCycleRecords();
          if (mounted) setRecords(data);
        } finally {
          if (mounted) setLoading(false);
        }
      };
      load();
      return () => {
        mounted = false;
      };
    }, [])
  );

  const summary = summarizeFarmCycleRecords(records);
  const best = records.reduce<FarmCycleRecord | null>(
    (top, item) => (!top || item.plantHealth > top.plantHealth ? item : top),
    null
  );
  const averageCycle = summary.harvests
    ? Math.round(summary.groceryDaysPlanned / summary.harvests)
    : 0;

  return (
    <SafeAreaView className="flex-1 bg-green-200">
      <BackgroundImage
        source={images.background}
        style={{ width: "100%", height: "100%", position: "absolute" }}
      />
      <HeaderNavigation
        onLeftPress={() => router.push("/(tabs)/home")}
        onRightPress={() => null}
        leftIcon={icons.back}
        rightIcon={icons.stats}
        showLeftButton={true}
        showRightButton={false}
      />

      <Text className="text-white text-2xl font-primary text-center mt-2">
        📊 Farm Performance
      </Text>
      <Text className="text-white/80 text-center px-6 mt-1">
        Review your household garden cycles, harvest health, and planning quality.
      </Text>

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#fff" />
        </View>
      ) : (
        <ScrollView
          className="px-4 mt-4"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
        >
          <View className="flex-row flex-wrap justify-between">
            <PerformanceCard label="Harvest sessions" value={`${summary.harvests}`} emoji="🌾" />
            <PerformanceCard label="Average health" value={`${summary.averageHealth}%`} emoji="💚" />
            <PerformanceCard label="Garden days planned" value={`${summary.groceryDaysPlanned}`} emoji="📅" />
            <PerformanceCard label="Average crop cycle" value={`${averageCycle}d`} emoji="🧭" />
            <PerformanceCard label="Plants simulated" value={`${summary.simultaneousPlantings}`} emoji="🪴" />
            <PerformanceCard label="Avg offline gap" value={`${summary.averageOfflineHealthGap >= 0 ? "+" : ""}${summary.averageOfflineHealthGap}%`} emoji="⚖️" />
          </View>

          <View className="bg-green-950/70 rounded-3xl p-4 mb-4 border border-white/10">
            <Text className="text-white font-pbold text-lg">🌻 Insight</Text>
            <Text className="text-white/85 mt-2 leading-5">
              {best
                ? `${best.emoji} ${best.displayName} is your strongest crop so far at ${best.plantHealth}% health. Repeat that watering and feeding rhythm for similar crops.`
                : "Complete a farming session to unlock crop-specific insights, harvest health trends, and garden planning guidance."}
            </Text>
          </View>

          <Text className="text-white font-pbold text-lg mb-2">Trending home-garden upgrades</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mb-4"
          >
            {householdGardenTrends.map((trend) => (
              <View
                key={trend.id}
                className="bg-black/30 rounded-2xl p-3 mr-3"
                style={{ width: 210 }}
              >
                <Text className="text-3xl">{trend.emoji}</Text>
                <Text className="text-white font-pbold mt-1">{trend.title}</Text>
                <Text className="text-white/75 text-xs mt-1 leading-4">
                  {trend.tip}
                </Text>
              </View>
            ))}
          </ScrollView>

          <Text className="text-white font-pbold text-lg mb-2">Recent cycle results</Text>
          {records.length === 0 ? (
            <View className="bg-black/25 rounded-3xl p-6 items-center">
              <Text className="text-5xl">🌱</Text>
              <Text className="text-white text-center mt-3">
                No harvests recorded yet. Plant a crop, finish the session, and your dashboard will fill in automatically.
              </Text>
            </View>
          ) : (
            records.map((item) => (
              <View key={item.id} className="bg-black/30 rounded-2xl p-4 mb-3">
                <View className="flex-row justify-between items-center">
                  <Text className="text-white font-pbold text-base">
                    {item.emoji} {item.displayName}
                  </Text>
                  <Text className="text-yellow-200 text-xs">
                    {new Date(item.completedAt).toLocaleDateString()}
                  </Text>
                </View>
                <View className="h-2 bg-white/20 rounded-full mt-3 overflow-hidden">
                  <View
                    className="h-2 bg-green-400 rounded-full"
                    style={{ width: `${Math.min(100, item.plantHealth)}%` }}
                  />
                </View>
                <Text className="text-white/85 text-sm mt-2">
                  {healthLabel(item.plantHealth)} • {item.plantHealth}% health • {item.cycleDays} real-life days • {item.stageName}
                </Text>
                {item.companionPlants && item.companionPlants.length > 0 && (
                  <Text className="text-yellow-100 text-xs mt-1">
                    Companion KPI bed: {item.companionPlants.join(", ")}
                  </Text>
                )}
                {item.offlineComparison && item.offlineGarden && (
                  <Text className="text-white/75 text-xs mt-1">
                    Offline comparison vs {item.offlineGarden.plantName}: {item.offlineComparison.healthGap >= 0 ? "+" : ""}{item.offlineComparison.healthGap}% health, stage gap {item.offlineComparison.stageGap}, day gap {item.offlineComparison.dayGap}.
                  </Text>
                )}
                <Text className="text-green-100 text-xs mt-1">
                  Nutrition: {item.nutritionStrength || "Garden freshness"} — {item.nutritionImpact || "Adds fresh produce variety to household meals."}
                </Text>
                <Text className="text-white/60 text-xs mt-1">
                  Garden Points earned: {item.score.toLocaleString()}
                </Text>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
