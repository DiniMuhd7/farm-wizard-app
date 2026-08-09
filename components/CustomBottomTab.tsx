import React from "react";
import { View, Pressable, Text } from "react-native";
import { router } from "expo-router";
import { playSound } from "@/utils/audio";

type TabItem = {
  label: string;
  emoji: string;
  path: string;
  accent: string;
};

const tabs: TabItem[] = [
  { label: "Farm", emoji: "🏡", path: "/(tabs)/home", accent: "#75D67A" },
  { label: "Grow", emoji: "🌱", path: "/(screens)/selectSeed", accent: "#F9D65C" },
  { label: "Stats", emoji: "📊", path: "/(tabs)/farmPerformance", accent: "#7DD3FC" },
  { label: "Rank", emoji: "🏆", path: "/(tabs)/leaderboard", accent: "#FBBF24" },
];

const tap = (path: string) => {
  router.push(path as any);
  playSound(require("@/assets/sounds/click.mp3"), 0.05);
};

export default function CustomBottomTab() {
  return (
    <View className="absolute bottom-3 left-4 right-4">
      <View className="bg-[#16351F]/95 border border-[#F7E7A1]/40 rounded-[32px] px-3 py-2 flex-row justify-between shadow-lg shadow-black">
        {tabs.map((tab, index) => {
          const featured = tab.label === "Grow";
          return (
            <Pressable
              key={tab.path}
              onPress={() => tap(tab.path)}
              className={`items-center justify-center rounded-3xl ${featured ? "-mt-7" : ""}`}
              style={{ minWidth: featured ? 74 : 62 }}
            >
              <View
                className={`${featured ? "w-16 h-16" : "w-12 h-12"} rounded-full items-center justify-center border-2`}
                style={{
                  backgroundColor: featured ? "#2F7D3D" : "rgba(255,255,255,0.10)",
                  borderColor: tab.accent,
                }}
              >
                <Text style={{ fontSize: featured ? 30 : 24 }}>{tab.emoji}</Text>
              </View>
              <Text
                className="text-white text-[11px] font-pbold mt-1"
                style={{ color: featured ? "#F9D65C" : "#FFFFFF" }}
              >
                {tab.label}
              </Text>
              {index === 1 && (
                <View className="w-8 h-1 rounded-full mt-1 bg-[#F9D65C]" />
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
