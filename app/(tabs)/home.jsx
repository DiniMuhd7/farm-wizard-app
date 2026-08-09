import { useCallback, useEffect, useRef, useState } from "react";
import { View, Image, BackHandler, ToastAndroid, Platform, TouchableOpacity, Modal, Text, Dimensions, ScrollView, TouchableWithoutFeedback, Alert } from "react-native";
import { icons, images } from "../../constants";
import { router, useFocusEffect } from "expo-router";
import RewardModal from "@/components/RewardModal";
import { CustomButton } from "../../components";
import { useLoginContext } from "../../context/LoginProvider";
import { BlurView } from "expo-blur";
import RewardedAdComponent from '../../utils/RewardedAdComponent';
import { useFramedAvatarArray } from "../../hooks/useAvatarArray";
import { canShowRewardedAd, getRemainingAdViews } from "@/utils/adLimit";
import { useTranslation } from "react-i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { playSound } from "../../utils/audio";
import { Audio } from "expo-av";
import { API_BASE } from "@/config/client";
import { getUser } from "@/services/user";
import { notifyNewAppNotifications, registerPushToken } from "@/utils/notifications";
import { getIdle, collectIdle } from "@/services/rewardsApi";
const { height } = Dimensions.get("window");
import analytics from "@react-native-firebase/analytics";


const REWARD_ADS_VIEW_LIMIT = 3
export default Home = () => {
  const { user, setUser } = useLoginContext();
  if (!user) {
    router.replace('/');
  }
  const isPremiumUser = user?.isPremium === true;
  // const isPremiumUser = ['pro', 'vip'].includes(user?.subscriptionLevel);
  // const isPremiumUser = new Date(user?.premiumUntil) > new Date();
  // const [showAd, setShowAd] = useState(true);
  const [showAd, setShowAd] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [showNotifcation, setShowNotification] = useState(false);
  const [backPressedOnce, setBackPressedOnce] = useState(false);
  const [remainingViews, setRemainingViews] = useState(null);
  const [idlePending, setIdlePending] = useState(0);
  const [collectingIdle, setCollectingIdle] = useState(false);

  const timeoutRef = useRef(null);

  // Idle/offline earning: how much the farm earned while away
  const fetchIdle = async () => {
    try {
      const data = await getIdle();
      if (data?.success) setIdlePending(data.pending || 0);
    } catch (e) {
      // ignore (offline / not deployed yet)
    }
  };

  const handleCollectIdle = async () => {
    if (collectingIdle) return;
    setCollectingIdle(true);
    try {
      const res = await collectIdle();
      if (res?.success) {
        if (res.userDetails) setUser(res.userDetails);
        setIdlePending(0);
        if (res.granted > 0) {
          Alert.alert("Collected", `🌾 +${res.granted} WizPoints from your farm!`);
        } else if (res.message) {
          Alert.alert("Idle reward", res.message);
        }
      }
    } catch (e) {
      // ignore
    } finally {
      setCollectingIdle(false);
    }
  };

  const { t } = useTranslation();

  const fetchNotification = async () => {
    setLoading(true);
    const token = await AsyncStorage.getItem("token");

    if (token !== null) {
      setLoading(true);
      try {
        const res = await fetch(
          `${API_BASE}/api/v1/notification/all/`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              Authorization: `JWT ${token}`,
            },
          }
        );
        const json = await res.json();
        setNotifications(json.notifications);
        notifyNewAppNotifications(json.notifications);
      } catch (err) {
        console.error("notifcations fetch error:", err);
      } finally {
        setLoading(false);
      }
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchNotification();
      const logEvent = async () => {
        await analytics().logEvent("screen_view", {
          screen_name: "HomeScreen",
          screen_class: "HomeScreen",
        });
      };
      const stopAllSounds = async () => {
        try {
          await Audio.setIsEnabledAsync(false);  // Stops all playing sounds
          await Audio.setIsEnabledAsync(true);   // Re-enables audio after stop
        } catch (e) {
          console.warn("Failed to stop sounds:", e);
        }
      };
      logEvent();
      stopAllSounds();
      if (Platform.OS !== 'android') return;

      const onBackPress = () => {
        if (backPressedOnce) {
          BackHandler.exitApp();
          return true;
        }

        setBackPressedOnce(true);
        ToastAndroid.show('Press back again to exit', ToastAndroid.SHORT);

        timeoutRef.current = setTimeout(() => {
          setBackPressedOnce(false);
        }, 2000);

        return true;
      };

      const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);

      return () => {
        backHandler.remove();
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
      };
    }, [backPressedOnce])
  )
  const openModal = () => {
    setModalVisible(true);
    // Animated.timing(fadeAnim, {
    //   toValue: 1,
    //   duration: 300,
    //   useNativeDriver: true,
    // }).start();
  };
  const handlsShowNotifcation = () => {
    setShowNotification(!showNotifcation);
  };

  // Backend responses nest the user object differently across endpoints;
  // accept any of the known shapes so the credited score always reaches the UI.
  const extractUser = (json) =>
    json?.userDetails ||
    json?.data?.userDetails ||
    json?.data?.user ||
    json?.user;

  const handleUserRewardEarn = async () => {
    setLoading(true);
    const token = await AsyncStorage.getItem("token");

    if (token !== null) {
      setLoading(true);
      try {
        const res = await fetch(
          `${API_BASE}/api/v1/user/reward-earned`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `JWT ${token}`,
            },
            body: JSON.stringify({ amount: 50 }),
          }
        );
        const json = await res.json();
        if (!res.ok || json.success === false) {
          Alert.alert("Reward", json.message || "Could not credit the reward, please try again.");
          return;
        }
        const updated = extractUser(json);
        if (updated) {
          setUser(updated);
        } else {
          // Credited server-side but no user in the response — refresh it
          const fresh = await getUser(user._id || user.id);
          const freshUser = extractUser(fresh) || fresh;
          if (freshUser && (freshUser.score !== undefined || freshUser.email)) {
            setUser(freshUser);
          }
        }
        Alert.alert("Reward", "🎉 +50 points added to your score!");
      } catch (err) {
        console.error("reward earn fetch error:", err);
        Alert.alert("Reward", "Could not credit the reward, please check your connection.");
      } finally {
        setLoading(false);
      }
    }
  }
  const fetchRemainingViews = async () => {
    const remaining = await getRemainingAdViews(REWARD_ADS_VIEW_LIMIT);
    setRemainingViews(remaining);
  };
  const handleShowAd = async () => {
    const allowed = await canShowRewardedAd(REWARD_ADS_VIEW_LIMIT);
    if (allowed) {
      setShowAd(true);
    } else {
      Alert.alert("Limit reached", "You have reached the daily ad limit.");
    }
  };
  useEffect(() => {
    fetchRemainingViews();
  }, [showAd]);

  // Register this device for server-sent push notifications once signed in.
  useEffect(() => {
    registerPushToken();
    fetchIdle();
  }, []);

  return (
    <View className="flex-1 relative bg-green-200 items-center justify-start">

      {/* Background Image */}
      <Image
        source={images.background1}
        className="absolute w-full h-full"
        resizeMode="cover"
        blurRadius={0.5}
      />

      {/* Top bar */}
      <View className="w-full px-2 flex-row justify-between items-center mt-6">
        <View className="flex-row">
          <TouchableOpacity className="" onPress={() => router.push("/(tabs)/profile")}>
            <Image
              source={useFramedAvatarArray(user.avatar || 0)}
              className="w-16 h-16 rounded-full"
            />
          </TouchableOpacity>
          <View className="flex my-4">
            <Text className="text-white text-base">
              {t("hi_user", { name: `${user.fullName}` })}
            </Text>
            <Text className="text-white text-base">{Number(user.score).toFixed(2)}</Text>
          </View>
        </View>
        <TouchableOpacity
          className="bg-[#D5B85A] w-14 h-14 items-center justify-center rounded-full"
          onPress={handlsShowNotifcation}
        >
          <Image source={icons.bell} className="w-8 h-10" />
        </TouchableOpacity>
      </View>

      <View className="w-full px-5 flex-row justify-between items-center mt-10">
        <TouchableOpacity className="w-10 h-10 bg-white/30 rounded-full items-center justify-center"
          onPress={() => router.push("/(screens)/inventory")}
        >
          <Image source={images.inventory} className="w-20 h-20" />
        </TouchableOpacity>
        {/* Watch & Earn (short videos) */}
        <TouchableOpacity
          className="w-10 h-10 bg-white/30 rounded-full items-center justify-center"
          onPress={() => router.push("/(screens)/shorts")}
        >
          <Image source={images.adsBadge} className="w-20 h-20" />
        </TouchableOpacity>
      </View>

      {/* Daily quests & achievements entry */}
      <TouchableOpacity
        className="bg-[#E0C145B8] px-5 py-2 rounded-full flex-row items-center mt-4"
        onPress={() => router.push("/(screens)/questsAchievements")}
      >
        <Text className="text-white font-psemibold">🎯 Daily Quests & Badges</Text>
      </TouchableOpacity>

      {/* Watch & Earn is opened from the top-right icon */}

      {/* Idle/offline earning */}
      {idlePending > 0 && (
        <TouchableOpacity
          className="bg-green-700/80 px-5 py-2 rounded-full flex-row items-center mt-3"
          onPress={handleCollectIdle}
          disabled={collectingIdle}
        >
          <Text className="text-white font-psemibold">
            {collectingIdle
              ? "Collecting…"
              : `🌾 Collect ${idlePending} WZP from your farm`}
          </Text>
        </TouchableOpacity>
      )}

      <View className="flex-1 justify-center items-center">
        {/* Wizard Image */}
        <Image
          source={images.logoLg}
          resizeMode="contain"
          className="w-[250px] h-[250px]"
        />

        {/* Play Button */}

        <CustomButton
          title={t("buttons.play")}
          handlePress={() => { router.push('/(screens)/selectSeed'); playSound(require('@/assets/sounds/click.mp3'), 0.05) }}
          containerStyles="w-[200px]"
          textStyles={"font-pbold text-white"}
          isLoading={false}
        />
      </View>

      {showAd && !isPremiumUser &&
        <RewardedAdComponent
          onRewardEarned={(reward) => {
            //console.log('User earned:', reward);
            setShowAd(false);
            setModalVisible(false)
            // Unlock feature or give coins here
            handleUserRewardEarn()
          }}
          onClose={() => {
            //console.log('Ad closed');
          }}
        />
      }

      <RewardModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onShowAd={handleShowAd}
        remainingViews={remainingViews}
      />

      <Modal transparent visible={showNotifcation} animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-start' }}>
          {/* Modal Content */}
          <BlurView
            intensity={50}
            tint="dark"
            style={{
              alignSelf: 'flex-end',
              marginTop: 40,
              marginRight: 20,
              width: '80%',
              borderRadius: 20,
              overflow: 'hidden',
              maxHeight: height * 0.45,
            }}
          >
            <View
              style={{
                backgroundColor: 'rgba(0,0,0,0.1)',
                borderRadius: 16,
                padding: 16,
              }}
            >
              {/* Close Button */}
              <TouchableOpacity
                onPress={handlsShowNotifcation}
                style={{
                  position: 'absolute',
                  top: 10,
                  right: 10,
                  zIndex: 10,
                  padding: 4,
                }}
              >
                {/* If using icon library: <Icon name="close" size={24} color="#fff" /> */}
                <Text style={{ fontSize: 20, color: '#fff' }}>✕</Text>
              </TouchableOpacity>

              <ScrollView
                style={{ maxHeight: height * 0.45 }}
                contentContainerStyle={{ paddingTop: 30, paddingBottom: 16 }}
                showsVerticalScrollIndicator={true}
              >
                {notifications?.map((notification, index) => (
                  <View
                    key={index}
                    style={{
                      backgroundColor: '#7D6D3D',
                      borderRadius: 12,
                      paddingVertical: 8,
                      paddingHorizontal: 16,
                      marginBottom: 8,
                    }}
                  >
                    <Text style={{ color: '#fff' }}>
                      {notification.message}
                    </Text>
                    <Text style={{ color: '#FCD34D', fontWeight: '600', marginTop: 4 }}>
                      {new Date(notification.createdAt).toLocaleString()}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          </BlurView>
        </View>

      </Modal>

    </View>
  );
};

