import React, { useCallback, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import BackgroundImage from "@/components/BackgroundImage";
import HeaderNavigation from "@/components/HeaderNavigation";
import { icons, images } from "@/constants";
import { useLoginContext } from "@/context/LoginProvider";
import { getCosmetics, buyCosmetic } from "@/services/rewardsApi";

type Item = {
  id: string;
  type: string;
  name: string;
  price: number;
  emoji?: string;
  bonus?: string;
};

type Land = {
  id: string;
  name: string;
  emoji: string;
  price: number;
  bonus: string;
  description: string;
  bg: string;
};

const FARM_LAND_KEY = "selectedFarmLand";
const OWNED_FARM_LANDS_KEY = "ownedFarmLands";
const OWNED_FARM_DECORATIONS_KEY = "ownedFarmDecorations";

const farmLands: Land[] = [
  {
    id: "starter-bed",
    name: "Starter Backyard Bed",
    emoji: "🏡",
    price: 0,
    bonus: "Balanced care",
    description: "A simple home garden plot for daily crop practice.",
    bg: "bg-emerald-700/80",
  },
  {
    id: "sunny-acre",
    name: "Sunny Market Acre",
    emoji: "🌞",
    price: 650,
    bonus: "+5% growth points",
    description: "Open land with strong sun for fruit and maize sessions.",
    bg: "bg-yellow-700/80",
  },
  {
    id: "rain-barrel-plot",
    name: "Rain-Barrel Plot",
    emoji: "💧",
    price: 900,
    bonus: "Water risk buffer",
    description: "A water-smart plot that helps players plan through dry spells.",
    bg: "bg-sky-700/80",
  },
  {
    id: "orchard-terrace",
    name: "Orchard Terrace",
    emoji: "🌳",
    price: 1400,
    bonus: "Premium tree planning",
    description: "A larger terrace for long-cycle grocery garden strategy.",
    bg: "bg-lime-800/80",
  },
];

const Farm = () => {
  const { user, setUser } = useLoginContext();
  if (!user) {
    router.replace("/");
  }
  const [decorations, setDecorations] = useState<Item[]>([]);
  const [owned, setOwned] = useState<string[]>([]);
  const [ownedLands, setOwnedLands] = useState<string[]>(["starter-bed"]);
  const [selectedLand, setSelectedLand] = useState("starter-bed");
  const [balance, setBalance] = useState<number>(Number(user?.score) || 0);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const loadLocalLand = async () => {
    const [selected, ownedRaw] = await Promise.all([
      AsyncStorage.getItem(FARM_LAND_KEY),
      AsyncStorage.getItem(OWNED_FARM_LANDS_KEY),
    ]);
    const parsedOwned = ownedRaw ? JSON.parse(ownedRaw) : ["starter-bed"];
    setOwnedLands(Array.from(new Set(["starter-bed", ...parsedOwned])));
    if (selected) setSelectedLand(selected);
  };

  const load = async () => {
    await loadLocalLand();
    try {
      const data = await getCosmetics();
      if (data?.success) {
        setDecorations(
          (data.catalog || []).filter((c: Item) => c.type === "decoration")
        );
        setOwned(data.owned || []);
        setBalance(data.balance ?? (Number(user?.score) || 0));
        setFailed(false);
      } else {
        setFailed(true);
      }
    } catch (e) {
      setFailed(true);
    }
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const persistLand = async (landId: string, nextOwned = ownedLands) => {
    setSelectedLand(landId);
    await AsyncStorage.multiSet([
      [FARM_LAND_KEY, landId],
      [OWNED_FARM_LANDS_KEY, JSON.stringify(nextOwned)],
    ]);
  };

  const onAcquireLand = async (land: Land) => {
    if (busy) return;
    const alreadyOwned = ownedLands.includes(land.id);
    if (alreadyOwned) {
      await persistLand(land.id);
      Alert.alert("Farm land selected", `${land.emoji} ${land.name} will be used for gameplay sessions.`);
      return;
    }
    if (balance < land.price) {
      Alert.alert("Not enough WizPoints", "Keep harvesting to unlock this farm land.");
      return;
    }
    setBusy(land.id);
    try {
      const nextOwned = [...ownedLands, land.id];
      setOwnedLands(nextOwned);
      setBalance((prev) => prev - land.price);
      await persistLand(land.id, nextOwned);
      Alert.alert("Farm land acquired", `${land.emoji} ${land.name} is now selected for gameplay. Bonus active: ${land.bonus}.`);
    } finally {
      setBusy(null);
    }
  };

  const onBuy = async (item: Item) => {
    if (busy) return;
    if (balance < item.price) {
      Alert.alert("Not enough WizPoints", "Keep playing to earn more!");
      return;
    }
    setBusy(item.id);
    try {
      const res = await buyCosmetic(item.id);
      if (res?.success) {
        if (res.userDetails) setUser(res.userDetails);
        const ownedDecorationsRaw = await AsyncStorage.getItem(OWNED_FARM_DECORATIONS_KEY);
        const ownedDecorationIds = ownedDecorationsRaw ? JSON.parse(ownedDecorationsRaw) : [];
        await AsyncStorage.setItem(
          OWNED_FARM_DECORATIONS_KEY,
          JSON.stringify(Array.from(new Set([...ownedDecorationIds, item.id])))
        );
        await load();
        Alert.alert("Added to your farm", `${item.emoji || ""} ${item.name} now improves gameplay with a small farm morale bonus.`);
      } else {
        Alert.alert("Couldn't buy", res?.message || "Please try again.");
      }
    } catch (e: any) {
      Alert.alert("Couldn't buy", e?.message || "Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const ownedDecorations = decorations.filter((d) => owned.includes(d.id));
  const activeLand = farmLands.find((land) => land.id === selectedLand) || farmLands[0];

  return (
    <SafeAreaView className="flex-1 bg-green-200">
      <BackgroundImage
        source={images.background}
        style={{ width: "100%", height: "100%", position: "absolute" }}
      />
      <HeaderNavigation
        onLeftPress={() => router.back()}
        onRightPress={() => null}
        leftIcon={icons.back}
        rightIcon={icons.settings}
        showLeftButton={true}
        showRightButton={false}
      />
      <Text className="text-white text-2xl font-primary text-center mb-1">
        My Farm Market
      </Text>
      <Text className="text-yellow-300 font-secondary font-bold text-center mb-2">
        {balance.toLocaleString()} WizPoints
      </Text>

      <ScrollView
        className="px-4"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 36 }}
      >
        <View className="bg-green-950/70 rounded-3xl p-4 mb-4 border border-white/15">
          <Text className="text-white font-pbold text-lg">Selected gameplay land</Text>
          <View className={`rounded-3xl p-4 mt-3 ${activeLand.bg}`}>
            <Text className="text-5xl">{activeLand.emoji}</Text>
            <Text className="text-white font-pbold text-xl mt-2">{activeLand.name}</Text>
            <Text className="text-yellow-100 text-sm mt-1">{activeLand.bonus}</Text>
            <Text className="text-white/85 text-xs mt-1 leading-5">{activeLand.description}</Text>
          </View>
        </View>

        <Text className="text-white font-pbold text-base mb-2">
          Farm land market
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
          {farmLands.map((land) => {
            const isOwned = ownedLands.includes(land.id);
            const isSelected = selectedLand === land.id;
            return (
              <View key={land.id} className={`rounded-3xl p-4 mr-3 ${land.bg}`} style={{ width: 230 }}>
                <Text className="text-4xl">{land.emoji}</Text>
                <Text className="text-white font-pbold mt-2">{land.name}</Text>
                <Text className="text-yellow-100 text-xs mt-1">{land.bonus}</Text>
                <Text className="text-white/80 text-xs mt-1 leading-4">{land.description}</Text>
                <TouchableOpacity
                  onPress={() => onAcquireLand(land)}
                  disabled={busy === land.id || isSelected}
                  className={`rounded-full px-4 py-2 mt-3 ${isSelected ? "bg-green-500" : "bg-[#E0C145]"}`}
                >
                  <Text className="text-white text-center font-pbold text-xs">
                    {isSelected ? "Selected" : isOwned ? "Use this land" : `${land.price.toLocaleString()} WZP`}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </ScrollView>

        <View className="bg-[#6FAE5E] rounded-3xl p-4 mb-4 min-h-[180px] border-2 border-[#4C7C3F]">
          <Text className="text-white font-pbold mb-2">Farm background preview</Text>
          {ownedDecorations.length === 0 ? (
            <Text className="text-white/80 text-center my-10">
              Your land is ready. Buy decorations below to bring the farm to life!
            </Text>
          ) : (
            <View className="flex-row flex-wrap justify-center">
              {ownedDecorations.map((d) => (
                <View key={d.id} className="items-center m-2">
                  <Text style={{ fontSize: 44 }}>{d.emoji || "🌱"}</Text>
                  <Text className="text-white text-xs">{d.name}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <Text className="text-white font-pbold text-base mb-2">
          Decoration Shop
        </Text>
        {failed ? (
          <Text className="text-white/70 text-center mt-6">
            Couldn't load decorations. Farm land selection still works offline.
          </Text>
        ) : (
          <View className="flex-row flex-wrap justify-between">
            {decorations.map((item) => {
              const isOwned = owned.includes(item.id);
              return (
                <View
                  key={item.id}
                  className="bg-black/30 rounded-2xl p-3 mb-3 items-center"
                  style={{ width: "48%" }}
                >
                  <Text style={{ fontSize: 40 }}>{item.emoji || "🌱"}</Text>
                  <Text className="text-white font-psemibold text-sm mt-1">
                    {item.name}
                  </Text>
                  <Text className="text-yellow-100 text-[10px] text-center mt-1">
                    {item.bonus || "Farm morale bonus: small score and recovery boost"}
                  </Text>
                  {isOwned ? (
                    <View className="bg-green-600 px-4 py-1.5 rounded-full mt-2">
                      <Text className="text-white text-xs font-pbold">✓ Owned</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      onPress={() => onBuy(item)}
                      disabled={busy === item.id}
                      className="bg-[#E0C145B8] px-4 py-1.5 rounded-full mt-2"
                    >
                      <Text className="text-white text-xs font-pbold">
                        {busy === item.id ? "…" : `${item.price.toLocaleString()} WZP`}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default Farm;
