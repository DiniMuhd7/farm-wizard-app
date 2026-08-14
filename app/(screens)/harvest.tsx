import React, { useCallback, useEffect, useState } from "react";
import BackgroundImage from "@/components/BackgroundImage";
import { images } from "@/constants";
import { View, Text, Image, Dimensions, Alert } from "react-native";
import { CustomButton } from "../../components";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { usePlantGrowth } from "@/constants/plants";
import { updatePlantLevels } from "@/services/user";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLoginContext } from "@/context/LoginProvider";
import { useTranslation } from "react-i18next";
import { Audio } from "expo-av";
import { API_BASE } from "@/config/client";
import RewardedAdComponent from "@/utils/RewardedAdComponent";
import { canShowRewardedAd } from "@/utils/adLimit";
import {
  cancelPausedSessionReminder,
  notifySessionComplete,
} from "@/utils/notifications";
import { recordEvent } from "@/utils/engagement";
import { submitDailyScore } from "@/services/rewardsApi";
import { dailyCrop } from "@/utils/dailyChallenge";
import { saveFarmCycleRecord } from "@/utils/farmDashboard";

const REWARD_ADS_VIEW_LIMIT = 3;
const AD_BONUS_POINTS = 50;

const { width, height } = Dimensions.get("window");

const Harvest = () => {
  const { user, setUser } = useLoginContext();
  if (!user) {
    router.replace("/");
  }
  const [isSubmitting, setSubmitting] = useState(false);
  const [showRewardAd, setShowRewardAd] = useState(false);
  const [bonusEarned, setBonusEarned] = useState(false);
  const isPremiumUser = user?.isPremium === true;
  const {
    name,
    userLevel,
    score,
    plantHealth,
    companionNames,
    offlineGardenData,
    simulationDays,
  } = useLocalSearchParams();
  // const plant = plantGrowth.filter((plant) => plant.name === name)[0];
  const plants = usePlantGrowth();
  const plant = plants.find((plant) => plant.name === name);
  const params = useLocalSearchParams();
  const plantName = Array.isArray(params.name) ? params.name[0] : params.name;
  const companions = String(companionNames || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const offlineGarden = (() => {
    try {
      return offlineGardenData ? JSON.parse(String(offlineGardenData)) : null;
    } catch {
      return null;
    }
  })();
  const offlineComparison = offlineGarden
    ? {
        healthGap: Math.round(Number(plantHealth) - Number(offlineGarden.health || 0)),
        stageGap: 3 - Number(offlineGarden.growthStage || 0),
        dayGap: Number(simulationDays || 0) - Number(offlineGarden.daysGrowing || 0),
      }
    : undefined;
  if (!plant) {
    router.replace("/(screens)/selectSeed");
    return null;
  }

  let level = parseInt(userLevel as string) + 1; // next level
  // bonus must stay numeric — it was a string (.toFixed) which forced the
  // whole total into string concatenation, garbling/inflating payouts.
  const bonus = Number(plantHealth) / 100;
  // Harvest level bonus reduced (was 500/level) to keep Garden Point earning
  // useful for planning without making rewards the primary gameplay loop.
  const totalSocre =
    Number(score) + bonus + 100 * Number(userLevel);

  const updateLevel = async () => {
    if (!plant || !level || !score) {
      Alert.alert("Error", "Some error occurs");
      return;
    }

    setSubmitting(true);
    const token = await AsyncStorage.getItem("token");
    if (token !== null) {
      try {
        const result = await updatePlantLevels(
          token,
          plant.name,
          level,
          Number(totalSocre)
        );

        if (result.data.success === false) {
          Alert.alert("Error", result.data.message);
          return;
        }
        // Alert.alert(
        //   "Success",
        //   "Session completed & level upgraded successfully"
        // );
        setUser(result.data.updateUser);
        // setTimeout(() => {
        //   router.replace({
        //     pathname: "/(screens)/profile",
        //     params: { name },
        //   });
        // }, 3000);
      } catch (error: any) {
        Alert.alert("Error", error.message);
      } finally {
        setSubmitting(false);
      }
    }
  };

  // Credits the watch-ad bonus through the same backend endpoint the
  // home screen uses for rewarded ads.
  const handleAdBonusEarned = async () => {
    const token = await AsyncStorage.getItem("token");
    if (token === null) return;
    try {
      const res = await fetch(`${API_BASE}/api/v1/user/reward-earned`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `JWT ${token}`,
        },
        body: JSON.stringify({ amount: AD_BONUS_POINTS }),
      });
      const json = await res.json();
      if (json.userDetails) setUser(json.userDetails);
      setBonusEarned(true);
    } catch (err) {
      console.warn("reward earn fetch error:", err);
    }
  };

  const handleWatchAdPress = async () => {
    const allowed = await canShowRewardedAd(REWARD_ADS_VIEW_LIMIT);
    if (allowed) {
      setShowRewardAd(true);
    } else {
      Alert.alert("Limit reached", "You have reached the daily ad limit.");
    }
  };

  useFocusEffect(
    useCallback(() => {
      const stopAndPlayNewSound = async () => {
        try {
          // 1. Stop all previously playing sounds
          await Audio.setIsEnabledAsync(false);
          await Audio.setIsEnabledAsync(true);

          // 2. Load and play a new sound
          const { sound } = await Audio.Sound.createAsync(
            require("@/assets/sounds/level-up.wav"),
            {
              volume: 0.01,
              isLooping: false,
            }
          );

          await sound.playAsync();

          // Optional: unload the sound after it's done playing
          sound.setOnPlaybackStatusUpdate((status) => {
            if (status.isLoaded && status.didJustFinish) {
              sound.unloadAsync();
            }
          });
        } catch (e) {
          console.warn("Error managing sound:", e);
        }
      };
      const clearGame = async () => {
        const raw = await AsyncStorage.getItem("gameStates");
        const all = raw ? JSON.parse(raw) : {};

        delete all[plantName];
        await AsyncStorage.setItem("gameStates", JSON.stringify(all));

        const token = await AsyncStorage.getItem("token");
        if (!token) return;
        await fetch(`${API_BASE}/api/v1/game-state/clear/${plantName}`, {
          method: "DELETE",
          headers: { Authorization: `JWT ${token}` },
        });

        // console.log(`Cleared local save for ${plantName}`);
      };
      updateLevel();
      stopAndPlayNewSound();
      clearGame();
      // Session is done: clear the paused-session reminder and celebrate
      cancelPausedSessionReminder();
      notifySessionComplete(Number(Number(totalSocre).toFixed(2)));

      // Engagement tracking: quests & achievements
      recordEvent("session_played");
      recordEvent("harvest");
      recordEvent("level_up");
      if (Number(plantHealth) >= 90) recordEvent("perfect_harvest");

      saveFarmCycleRecord({
        plantName: plant.name,
        displayName: plant.diplayName || plant.name,
        emoji: plant.emoji || "🌱",
        cycleDays: plant.cycleDays || 0,
        stageName: plant.stages?.[3]?.name || "Harvest",
        stageIndex: 3,
        score: Number(Number(totalSocre).toFixed(2)),
        plantHealth: Number(plantHealth),
        companionPlants: companions,
        simulationDays: Number(simulationDays || 0),
        nutritionStrength: plant.nutrition?.strength || "Garden freshness",
        nutritionImpact: plant.nutrition?.impact || "Adds fresh produce variety to household meals.",
        offlineGarden: offlineGarden || undefined,
        offlineComparison,
      }, user).catch(() => {});

      // Daily challenge: if you played today's featured crop, submit the
      // score to the daily leaderboard (best score per day is kept).
      if (plantName === dailyCrop()) {
        submitDailyScore(Number(Number(totalSocre).toFixed(2))).catch(() => {});
      }
    }, [])
  );

  const { t } = useTranslation();

  return (
    <View className="flex-1 bg-green-200 items-center justify-start pt-20">
      {/* Background */}
      <BackgroundImage
        source={images.bgRainfall}
        style={{ width: "100%", height: "100%", position: "absolute" }}
      />

      {/* Title */}

      <View className="items-center justify-center my-14">
        <Text className="text-white text-3xl font-primary">
          {" "}
          {t("menu.session")}
        </Text>
        <Text className="text-white text-3xl font-primary">
          {t("menu.completed")}
        </Text>

        <Image
          source={images.sessionComplete}
          style={{
            width: width * 0.5,
            height: width * 0.5,
            marginBottom: 10,
          }}
          resizeMode="contain"
        />

        <Text className="text-center text-xl p-4 my-2 text-white">
          {t("game.total_points")}
        </Text>

        <Text className="text-center text-5xl font-bold font-secondary p-4 text-[#FEDA42]">
          {Number(totalSocre).toFixed(2)}
          {/* {score} */}
        </Text>
        <Text className="text-center text-xl p-4 my-2 text-white">
          {t("messages.harvest")}
        </Text>
        <View className="bg-black/25 rounded-2xl px-4 py-3 w-[88%]">
          <Text className="text-white text-center font-pbold">
            {plant.emoji || "🌱"} Nutrition strength: {plant.nutrition?.strength || "Fresh produce"}
          </Text>
          <Text className="text-yellow-100 text-center text-xs mt-1">
            {plant.nutrition?.impact || "Adds fresh garden variety to household meals."}
          </Text>
          {companions.length > 0 && (
            <Text className="text-white/80 text-center text-xs mt-1">
              Companion harvest tracked: {companions.join(", ")}
            </Text>
          )}
          {offlineComparison && (
            <Text className="text-white/80 text-center text-xs mt-1">
              Offline comparison: {offlineComparison.healthGap >= 0 ? "+" : ""}{offlineComparison.healthGap}% health vs {offlineGarden.plantName}.
            </Text>
          )}
        </View>

        {!isPremiumUser && !bonusEarned && (
          <CustomButton
            title={`🎁 Watch Ad to Earn +${AD_BONUS_POINTS}`}
            handlePress={handleWatchAdPress}
            containerStyles="w-[310px] m-1"
            textStyles={"font-pbold text-white"}
            isLoading={showRewardAd}
          />
        )}
        {bonusEarned && (
          <Text className="text-center text-xl text-[#FEDA42] font-pbold">
            +{AD_BONUS_POINTS} bonus points added!
          </Text>
        )}

        <View className="flex-row justify-between gap-4 m-3">
          <CustomButton
            title={t("buttons.keep_going")}
            handlePress={() => router.replace("/(screens)/selectSeed")}
            containerStyles="w-[150px]"
            textStyles={"font-pbold text-white"}
            isLoading={isSubmitting}
          />
          <CustomButton
            title={t("buttons.exit_to_menu")}
            handlePress={() => router.replace("/(tabs)/home")}
            containerStyles="w-[150px]"
            textStyles={"font-pbold text-white"}
            isLoading={isSubmitting}
          />
        </View>

        {/* <CustomButton
          title="Harvest"
          handlePress={updateLevel}
          containerStyles="w-[200px] mb-1"
          textStyles={"font-pbold text-white"}
          isLoading={isSubmitting}
        /> */}
      </View>

      {showRewardAd && (
        <RewardedAdComponent
          onRewardEarned={() => {
            handleAdBonusEarned();
          }}
          onClose={() => {
            setShowRewardAd(false);
          }}
        />
      )}
    </View>
  );
};

export default Harvest;
