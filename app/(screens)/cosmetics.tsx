import React, { useCallback, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Alert } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import BackgroundImage from "@/components/BackgroundImage";
import HeaderNavigation from "@/components/HeaderNavigation";
import { icons, images } from "@/constants";
import { useLoginContext } from "@/context/LoginProvider";
import {
  getCosmetics,
  buyCosmetic,
  equipCosmetic,
} from "@/services/rewardsApi";

type Item = { id: string; type: string; name: string; price: number; bonus?: string };

const Cosmetics = () => {
  const { user, setUser } = useLoginContext();
  if (!user) {
    router.replace("/");
  }
  const [catalog, setCatalog] = useState<Item[]>([]);
  const [owned, setOwned] = useState<string[]>([]);
  const [equipped, setEquipped] = useState<{ frame?: string; skin?: string }>(
    {}
  );
  const [balance, setBalance] = useState<number>(Number(user?.score) || 0);
  const [busy, setBusy] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  const load = async () => {
    try {
      const data = await getCosmetics();
      if (data?.success) {
        setCatalog(data.catalog || []);
        setOwned(data.owned || []);
        setEquipped(data.equipped || {});
        setBalance(data.balance ?? (Number(user?.score) || 0));
        setLoadFailed(false);
      } else {
        setLoadFailed(true);
      }
    } catch (e) {
      setLoadFailed(true);
    }
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

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
        await load();
        Alert.alert("Unlocked", res.message || `${item.name} unlocked with a gameplay bonus!`);
      } else {
        Alert.alert("Couldn't buy", res?.message || "Please try again.");
      }
    } catch (e: any) {
      Alert.alert("Couldn't buy", e?.message || "Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const onEquip = async (item: Item) => {
    if (busy) return;
    setBusy(item.id);
    try {
      const res = await equipCosmetic(item.id);
      if (res?.success) {
        if (res.userDetails) setUser(res.userDetails);
        await load();
      } else {
        Alert.alert("Couldn't equip", res?.message || "Please try again.");
      }
    } catch (e: any) {
      Alert.alert("Couldn't equip", e?.message || "Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const renderSection = (type: "frame" | "skin", label: string) => {
    const items = catalog.filter((c) => c.type === type);
    if (!items.length) return null;
    const equippedId = type === "frame" ? equipped.frame : equipped.skin;
    return (
      <>
        <Text className="text-white font-pbold text-base mt-4 mb-2">
          {label}
        </Text>
        {items.map((item) => {
          const isOwned = owned.includes(item.id);
          const isEquipped = equippedId === item.id;
          return (
            <View key={item.id} className="bg-black/30 rounded-2xl p-4 mb-3">
              <View className="flex-row justify-between items-center">
                <View className="flex-1">
                  <Text className="text-white font-psemibold text-base">
                    {item.name}
                  </Text>
                  <Text className="text-yellow-100 text-xs mt-0.5">
                    {item.bonus || (type === "frame" ? "Equipped frame bonus: better scoring or recovery" : "Equipped skin bonus: steadier care efficiency")}
                  </Text>
                  {!isOwned && (
                    <Text className="text-white/70 text-xs mt-0.5">
                      {item.price.toLocaleString()} WizPoints
                    </Text>
                  )}
                </View>
                {isOwned ? (
                  <TouchableOpacity
                    onPress={() => onEquip(item)}
                    disabled={isEquipped || busy === item.id}
                    className={`px-4 py-1.5 rounded-full ${
                      isEquipped ? "bg-green-500" : "bg-[#E0C145B8]"
                    }`}
                  >
                    <Text className="text-white font-pbold text-xs">
                      {isEquipped ? "✓ Equipped" : "Equip"}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    onPress={() => onBuy(item)}
                    disabled={busy === item.id}
                    className="bg-[#E0C145B8] px-4 py-1.5 rounded-full"
                  >
                    <Text className="text-white font-pbold text-xs">
                      {busy === item.id ? "…" : "Buy"}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}
      </>
    );
  };

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
        Customize
      </Text>
      <Text className="text-yellow-300 font-secondary font-bold text-center mb-2">
        {balance.toLocaleString()} WizPoints
      </Text>

      <ScrollView
        className="px-4"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        {loadFailed ? (
          <Text className="text-white/70 text-center mt-10">
            Couldn't load the shop. Please check your connection and try again.
          </Text>
        ) : (
          <>
            {renderSection("frame", "Avatar Frames")}
            {renderSection("skin", "Farm Skins")}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default Cosmetics;
