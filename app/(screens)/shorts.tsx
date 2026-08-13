import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Dimensions,
} from "react-native";
import { WebView } from "react-native-webview";
import { router, useFocusEffect } from "expo-router";
import { icons } from "@/constants";
import { useLoginContext } from "@/context/LoginProvider";
import { getShorts } from "@/services/rewardsApi";
import { creditReward } from "@/utils/engagement";
import InterstitialAdComponent from "@/utils/InterstitialAdComponent";
import {
  canShowInterstitial,
  markInterstitialShown,
} from "@/utils/adFrequency";

const REWARD = 25; // WizPoints per short watched
const WATCH_SECONDS = 15; // must watch this long before claiming
// Ad-frequency cap (AdMob policy): show an interstitial at most every Nth
// short AND no more than once per the app-wide minimum interval.
const AD_EVERY = 3;
const YOUTUBE_EMBED_ORIGIN = "https://farmwizard.app";
const YOUTUBE_PLAYER_REFERER = `${YOUTUBE_EMBED_ORIGIN}/`;

type Short = {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  subscribers: number;
};

const buildYouTubeEmbedUrl = (videoId: string, isActive: boolean) => {
  const params = new URLSearchParams({
    playsinline: "1",
    rel: "0",
    modestbranding: "1",
    autoplay: isActive ? "1" : "0",
    mute: "1",
    enablejsapi: "1",
    origin: YOUTUBE_EMBED_ORIGIN,
  });

  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
};

const Shorts = () => {
  const { user, setUser } = useLoginContext();
  if (!user) {
    router.replace("/");
  }
  const isPremiumUser = user?.isPremium === true;

  const [videos, setVideos] = useState<Short[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(WATCH_SECONDS);
  const [rewarded, setRewarded] = useState<string[]>([]);
  const [claiming, setClaiming] = useState(false);
  const [itemHeight, setItemHeight] = useState(Dimensions.get("window").height);
  const [showInterstitial, setShowInterstitial] = useState(false);
  const [adKey, setAdKey] = useState(0);

  const timerRef = useRef<any>(null);
  const videosRef = useRef<Short[]>([]);
  const rewardedRef = useRef<string[]>([]);
  const adShownRef = useRef<string[]>([]); // videos that already showed an ad
  const viewedCountRef = useRef(0); // how many shorts viewed (for the cap)

  useEffect(() => {
    videosRef.current = videos;
  }, [videos]);
  useEffect(() => {
    rewardedRef.current = rewarded;
  }, [rewarded]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getShorts();
      if (data?.success && Array.isArray(data.videos) && data.videos.length) {
        setVideos(data.videos);
        setFailed(false);
      } else {
        setFailed(true);
      }
    } catch (e) {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      load();
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }, [])
  );

  const activeVideo = videos[activeIndex];

  // Start the watch countdown for a video (skips if already rewarded).
  const startCountdown = (videoId?: string) => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!videoId || rewardedRef.current.includes(videoId)) {
      setSecondsLeft(0);
      return;
    }
    setSecondsLeft(WATCH_SECONDS);
    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  };

  // Called when a new short scrolls into view: show an interstitial at the
  // start of each short (once per video, non-premium), then run the
  // watch-countdown after the ad is dismissed.
  const activate = (idx: number) => {
    setActiveIndex(idx);
    if (timerRef.current) clearInterval(timerRef.current);
    const vid = videosRef.current[idx]?.videoId;
    if (!vid) return;
    viewedCountRef.current += 1;

    const maybeShowAd = async () => {
      const eligible =
        !isPremiumUser &&
        !adShownRef.current.includes(vid) &&
        viewedCountRef.current % AD_EVERY === 0 &&
        (await canShowInterstitial());
      if (eligible) {
        adShownRef.current = [...adShownRef.current, vid];
        await markInterstitialShown();
        setSecondsLeft(WATCH_SECONDS);
        setAdKey((k) => k + 1);
        setShowInterstitial(true); // countdown begins on ad close
      } else {
        startCountdown(vid);
      }
    };
    maybeShowAd();
  };

  // Stable callback for FlatList; reads current values via refs.
  const onViewable = useRef(({ viewableItems }: any) => {
    if (viewableItems && viewableItems.length > 0) {
      const idx = viewableItems[0].index ?? 0;
      activate(idx);
    }
  }).current;

  const onClaim = async () => {
    if (claiming || !activeVideo) return;
    setClaiming(true);
    try {
      const updated = await creditReward(REWARD);
      if (updated) {
        setUser(updated);
        setRewarded((r) => [...r, activeVideo.videoId]);
        Alert.alert("Earned", `🎬 +${REWARD} WizPoints for watching!`);
      } else {
        Alert.alert("Couldn't claim", "Please check your connection.");
      }
    } finally {
      setClaiming(false);
    }
  };

  const renderItem = ({ item, index }: { item: Short; index: number }) => {
    const isActive = index === activeIndex;
    const near = Math.abs(index - activeIndex) <= 1;
    const isRewarded = rewarded.includes(item.videoId);

    return (
      <View style={{ height: itemHeight, backgroundColor: "#000" }}>
        {near ? (
          <WebView
            source={{
              uri: buildYouTubeEmbedUrl(item.videoId, isActive),
              headers: {
                Referer: YOUTUBE_PLAYER_REFERER,
                Origin: YOUTUBE_EMBED_ORIGIN,
              },
            }}
            userAgent="Mozilla/5.0 (Linux; Android 10; FarmWizard) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
            style={{ flex: 1, backgroundColor: "#000" }}
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            javaScriptEnabled
            domStorageEnabled
          />
        ) : (
          <Image
            source={{ uri: item.thumbnail }}
            style={{ flex: 1 }}
            resizeMode="cover"
          />
        )}

        {/* Bottom overlay */}
        <View className="absolute bottom-0 left-0 right-0 p-4 bg-black/40">
          <Text className="text-white font-pbold text-sm" numberOfLines={2}>
            {item.title}
          </Text>
          <Text className="text-white/70 text-xs mt-0.5">
            {item.channelTitle}
          </Text>

          {isActive && (
            <View className="mt-3">
              {isRewarded ? (
                <View className="bg-green-600 self-start px-4 py-2 rounded-full">
                  <Text className="text-white font-pbold text-sm">
                    ✓ Earned +{REWARD}
                  </Text>
                </View>
              ) : secondsLeft > 0 ? (
                <View className="bg-white/20 self-start px-4 py-2 rounded-full">
                  <Text className="text-white font-psemibold text-sm">
                    Watch {secondsLeft}s to earn +{REWARD} WZP
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={onClaim}
                  disabled={claiming}
                  className="bg-[#E0C145] self-start px-5 py-2 rounded-full"
                >
                  <Text className="text-white font-pbold text-sm">
                    {claiming ? "Claiming…" : `🎬 Claim +${REWARD} WZP`}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View
      className="flex-1 bg-black"
      onLayout={(e) => setItemHeight(e.nativeEvent.layout.height)}
    >
      {/* Interstitial at the start of each short */}
      {showInterstitial && !isPremiumUser && (
        <InterstitialAdComponent
          key={adKey}
          onClose={() => {
            setShowInterstitial(false);
            startCountdown(videos[activeIndex]?.videoId);
          }}
        />
      )}

      {/* Back button */}
      <TouchableOpacity
        onPress={() => router.back()}
        className="absolute top-12 left-4 z-10 w-10 h-10 rounded-full bg-black/40 items-center justify-center"
      >
        <Image
          source={icons.back}
          className="w-6 h-6"
          style={{ tintColor: "#fff" }}
        />
      </TouchableOpacity>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#fff" />
          <Text className="text-white/70 mt-3">Loading videos…</Text>
        </View>
      ) : failed ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-white/80 text-center">
            Couldn't load videos right now. Please try again later.
          </Text>
          <TouchableOpacity
            onPress={load}
            className="bg-[#E0C145] px-5 py-2 rounded-full mt-4"
          >
            <Text className="text-white font-pbold">Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={videos}
          keyExtractor={(it) => it.videoId}
          renderItem={renderItem}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          snapToInterval={itemHeight}
          snapToAlignment="start"
          decelerationRate="fast"
          getItemLayout={(_, index) => ({
            length: itemHeight,
            offset: itemHeight * index,
            index,
          })}
          onViewableItemsChanged={onViewable}
          viewabilityConfig={{ itemVisiblePercentThreshold: 80 }}
          windowSize={3}
          initialNumToRender={1}
          maxToRenderPerBatch={2}
          removeClippedSubviews
        />
      )}
    </View>
  );
};

export default Shorts;
