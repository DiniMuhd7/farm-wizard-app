import BackgroundImage from "@/components/BackgroundImage";
import { icons, images } from "@/constants";
import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Animated,
  Dimensions,
  TextInput,
  Switch,
} from "react-native";
import { CustomButton } from "../../components";
import { useRouter } from "expo-router";
import { usePlantGrowth as seeds } from "@/constants/plants";
import { useTranslation } from "react-i18next";
import { playSound } from "../../utils/audio";
import { useLoginContext } from "@/context/LoginProvider";
import BannerAdComponent from "@/utils/BannerAdComponent";
import { dailyCrop } from "@/utils/dailyChallenge";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width, height } = Dimensions.get("window");
const TODAY_CROP = dailyCrop();
const FARM_LAND_KEY = "selectedFarmLand";
const farmLandLabels: Record<string, string> = {
  "starter-bed": "🏡 Starter Backyard Bed",
  "sunny-acre": "🌞 Sunny Market Acre",
  "rain-barrel-plot": "💧 Rain-Barrel Plot",
  "orchard-terrace": "🌳 Orchard Terrace",
};

const SelectSeed = () => {
  const router = useRouter();

  const { user } = useLoginContext();
  if (!user) {
    router.replace("/");
  }
  const isPremiumUser = user?.isPremium === true;

  const [selectedIndex, setSelectedIndex] = useState(0); // Default: first unlocked starter seed
  const [selectedIndexes, setSelectedIndexes] = useState<number[]>([0]);
  const [includeOffline, setIncludeOffline] = useState(false);
  const [selectedFarmLand, setSelectedFarmLand] = useState("starter-bed");
  const [offlineForm, setOfflineForm] = useState({
    plantName: "",
    health: "80",
    growthStage: "1",
    daysGrowing: "14",
  });
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    AsyncStorage.getItem(FARM_LAND_KEY).then((land) => {
      if (land) setSelectedFarmLand(land);
    });
  }, []);

  const plantSeeds = seeds();
  const selectedSeed = plantSeeds[selectedIndex];
  const gardenPoints = Number(user?.score || 0);
  const farmerLevel = Math.max(1, Math.floor(gardenPoints / 500) + 1);
  const isSeedUnlocked = (seed: any) =>
    isPremiumUser ||
    (farmerLevel >= Number(seed.unlockLevel || 1) &&
      gardenPoints >= Number(seed.unlockPoints || 0));
  const selectedSeedUnlocked = isSeedUnlocked(selectedSeed);
  const unlockReason = selectedSeedUnlocked
    ? "Unlocked"
    : `Unlock at Farmer Lv.${selectedSeed.unlockLevel || 1} + ${Number(
        selectedSeed.unlockPoints || 0
      ).toLocaleString()} Garden Points`;

  const toggleSeedSelection = (index: number) => {
    setSelectedIndexes((current) => {
      if (current.includes(index)) {
        return current.length === 1 ? current : current.filter((item) => item !== index);
      }
      return [...current, index].slice(0, 4);
    });
  };

  const handleSeedChange = (index: number) => {
    // Animate fade-out → change → fade-in
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setSelectedIndex(index);
      if (isSeedUnlocked(plantSeeds[index])) {
        toggleSeedSelection(index);
      }
    });
  };

  const nextSeed = () =>
    handleSeedChange((selectedIndex + 1) % plantSeeds.length);

  const prevSeed = () =>
    handleSeedChange(
      (selectedIndex - 1 + plantSeeds.length) % plantSeeds.length
    );

  const { t } = useTranslation();
  return (
    //  <View
    //   style={{
    //     flex: 1,
    //     backgroundColor: "#A7D7A8",
    //     alignItems: "center",
    //     paddingTop: height * 0.1,
    //   }}
    // >
    <>
      <View className="flex-1 bg-green-200 items-center justify-start pt-20">
        {/* Background */}
        <BackgroundImage
          source={images.background}
          style={{ width: "100%", height: "100%", position: "absolute" }}
        />

        {/* Title */}
        {/* <Text className="text-white text-3xl font-primary my-6">Select Seed</Text> */}
        <Text
          style={{
            color: "white",
            fontSize: 24,
            fontFamily: "System",
            marginBottom: 20,
          }}
        >
          {t("buttons.select_seed")}
        </Text>

        {/* Scrollable Icons */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{
            backgroundColor: "#78693963",
            paddingHorizontal: 8,
            paddingVertical: 10,
            borderRadius: 20,
            maxHeight: height * 0.12,
            marginBottom: 20,
          }}
        >
          {plantSeeds.map((seed, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => handleSeedChange(index)}
              // className={`w-16 h-14  mx-2 items-center justify-center rounded-xl border-2 ${
              //   selectedIndex === index
              //     ? "border-yellow-400 bg-white"
              //     : "border-transparent bg-white/40"
              // } `}
              style={{
                width: width * 0.15,
                height: height * 0.07,
                marginHorizontal: 6,
                justifyContent: "center",
                alignItems: "center",
                borderRadius: 12,
                borderWidth: 2,
                borderColor:
                  selectedIndexes.includes(index) ? "#FCD34D" : "transparent",
                backgroundColor:
                  selectedIndexes.includes(index) ? "white" : "rgba(255,255,255,0.4)",
                opacity: isSeedUnlocked(seed) ? 1 : 0.55,
              }}
            >
              {seed.icon ? (
                <Image
                  source={seed.icon}
                  resizeMode="contain"
                  style={{ width: width * 0.14, height: width * 0.14 }}
                />
              ) : (
                <Text style={{ fontSize: width * 0.09 }}>{seed.emoji || "🌱"}</Text>
              )}
              {!isSeedUnlocked(seed) && (
                <Text style={{ position: "absolute", right: 3, top: 1, fontSize: 14 }}>🔒</Text>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Seed Info Card with Animation */}
        <Animated.View
          // className="w-[80%] bg-[#78693982] rounded-2xl border border-yellow-400 px-6 mb-8 items-center relative"
          // style={{ opacity: fadeAnim }}
          style={{
            width: "85%",
            backgroundColor: "#78693982",
            borderRadius: 20,
            borderColor: "#FCD34D",
            borderWidth: 1,
            padding: 20,
            alignItems: "center",
            opacity: fadeAnim,
            marginBottom: 10,
            position: "relative",
          }}
        >
          {/* Navigation Arrows */}
          <TouchableOpacity
            onPress={prevSeed}
            className="absolute left-[-4] top-1/2 -translate-y-1/2 z-10"
          >
            <View className="w-14 h-14 rounded-full bg-buttonColor justify-center items-center">
              <Image
                source={icons.leftChevron}
                className="w-18 h-14"
                resizeMode="contain"
              />
            </View>
          </TouchableOpacity>

          {/* Seed Name + Icon */}
          <View
            // className="items-center my-10 bg-white rounded-3xl p-6"
            style={{
              alignItems: "center",
              backgroundColor: "white",
              borderRadius: 24,
              padding: 16,
              marginVertical: 10,
              width: "100%",
            }}
          >
            <Text
              // className="text-[#DFC666] text-xl font-primary mb-10"
              style={{
                color: "#DFC666",
                fontSize: 18,
                fontWeight: "600",
                marginBottom: 10,
              }}
            >
              {selectedSeed.diplayName}
            </Text>
            <View className={selectedSeedUnlocked ? "bg-green-600 rounded-full px-3 py-1 mb-2" : "bg-black/50 rounded-full px-3 py-1 mb-2"}>
              <Text className="text-white text-xs font-pbold">
                {selectedSeedUnlocked ? "✅ Ready to plant" : "🔒 Locked seed"} • {selectedSeed.rarity || "Starter"}
              </Text>
            </View>
            <Text className={selectedSeedUnlocked ? "text-green-700 text-xs text-center mb-2" : "text-red-700 text-xs text-center mb-2"}>
              {unlockReason}
            </Text>
            {selectedSeed.name === TODAY_CROP && (
              <View className="bg-[#E0C145] rounded-full px-3 py-1 mb-2">
                <Text className="text-white text-xs font-pbold">
                  ⭐ Today's Challenge crop — play it for the daily leaderboard!
                </Text>
              </View>
            )}
            {selectedSeed.iconLg ? (
              <Image
                source={selectedSeed.iconLg}
                style={{
                  width: width * 0.5,
                  height: width * 0.5,
                  marginBottom: 10,
                }}
                resizeMode="contain"
              />
            ) : (
              <Text style={{ fontSize: width * 0.32, marginBottom: 10 }}>
                {selectedSeed.emoji || "🌱"}
              </Text>
            )}
            <Text
              //className="text-[#7B6C32] text-center px-2 mb-6"
              style={{
                color: "#7B6C32",
                textAlign: "center",
                paddingHorizontal: 10,
              }}
            >
              {selectedSeed.gardenType} • {selectedSeed.spacing}
            </Text>
          </View>

          {/* Levels (Dots) */}
          {/* <View className="flex-row justify-center mb-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <View
              key={i}
              className={`w-3 h-3 mx-1 rounded-full ${
                i < selectedSeed.levels ? "bg-yellow-400" : "bg-gray-300"
              }`}
            />
          ))}
        </View> */}

          <Text style={{ color: "#FDEFC0", textAlign: "center", fontSize: 12, marginTop: 4 }}>
            Farmer Lv.{farmerLevel} • {gardenPoints.toLocaleString()} Garden Points • {
              plantSeeds.filter(isSeedUnlocked).length
            }/{plantSeeds.length} seeds unlocked
          </Text>
          <View style={{ width: "100%", backgroundColor: "rgba(0,0,0,0.22)", borderRadius: 16, padding: 12, marginTop: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ color: "white", fontWeight: "700", flex: 1 }}>Compare with my offline garden</Text>
              <Switch value={includeOffline} onValueChange={setIncludeOffline} />
            </View>
            {includeOffline && (
              <View style={{ gap: 8, marginTop: 10 }}>
                <TextInput
                  placeholder="Offline plant name"
                  placeholderTextColor="#FDEFC0"
                  value={offlineForm.plantName}
                  onChangeText={(plantName) => setOfflineForm({ ...offlineForm, plantName })}
                  style={{ color: "white", borderBottomColor: "#FCD34D", borderBottomWidth: 1, paddingVertical: 4 }}
                />
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <TextInput
                    keyboardType="number-pad"
                    placeholder="Health %"
                    placeholderTextColor="#FDEFC0"
                    value={offlineForm.health}
                    onChangeText={(health) => setOfflineForm({ ...offlineForm, health })}
                    style={{ color: "white", flex: 1, borderBottomColor: "#FCD34D", borderBottomWidth: 1, paddingVertical: 4 }}
                  />
                  <TextInput
                    keyboardType="number-pad"
                    placeholder="Stage 0-3"
                    placeholderTextColor="#FDEFC0"
                    value={offlineForm.growthStage}
                    onChangeText={(growthStage) => setOfflineForm({ ...offlineForm, growthStage })}
                    style={{ color: "white", flex: 1, borderBottomColor: "#FCD34D", borderBottomWidth: 1, paddingVertical: 4 }}
                  />
                  <TextInput
                    keyboardType="number-pad"
                    placeholder="Days"
                    placeholderTextColor="#FDEFC0"
                    value={offlineForm.daysGrowing}
                    onChangeText={(daysGrowing) => setOfflineForm({ ...offlineForm, daysGrowing })}
                    style={{ color: "white", flex: 1, borderBottomColor: "#FCD34D", borderBottomWidth: 1, paddingVertical: 4 }}
                  />
                </View>
              </View>
            )}
          </View>

          {/* Planting Progress Bar */}
          {/* <View className="w-full h-3 bg-white/30 rounded-full mb-4 overflow-hidden">
          <View
            className="bg-yellow-400 h-3 rounded-full"
            style={{ width: `${selectedSeed.progress * 100}%` }}
          />
        </View> */}

          {/* Right Nav */}
          <TouchableOpacity
            onPress={nextSeed}
            className="absolute right-[-4] top-1/2 -translate-y-1/2 z-10"
          >
            <View className="w-14 h-14 rounded-full bg-buttonColor justify-center items-center">
              <Image
                source={icons.rightChevron}
                className="w-18 h-14"
                resizeMode="contain"
              />
            </View>
          </TouchableOpacity>
        </Animated.View>

        <CustomButton
          title={selectedSeedUnlocked ? t("buttons.select_seed") : "Seed Locked"}
          handlePress={() => {
            if (!selectedSeedUnlocked) return;
            const selectedPlants = selectedIndexes
              .map((i) => plantSeeds[i])
              .filter((seed) => seed && isSeedUnlocked(seed))
              .map((seed) => seed.name);
            router.push({
              pathname: "/(screens)/sessionStarted",
              params: {
                name: selectedSeed.name,
                names: selectedPlants.join(","),
                farmLand: selectedFarmLand,
                offlineGardenData: includeOffline
                  ? JSON.stringify({
                      plantName: offlineForm.plantName || selectedSeed.name,
                      health: Number(offlineForm.health) || 0,
                      growthStage: Number(offlineForm.growthStage) || 0,
                      daysGrowing: Number(offlineForm.daysGrowing) || 0,
                    })
                  : "",
              },
            });
            playSound(require("@/assets/sounds/click.mp3"), 0.05);
          }}
          containerStyles="w-[200px]"
          textStyles={"font-pbold text-white"}
          isLoading={false}
        />
      </View>
      {!isPremiumUser && <BannerAdComponent />}
    </>
  );
};

export default SelectSeed;
