import React, { useEffect, useRef, useState } from "react";
import { StatusBar } from "expo-status-bar";
import {
  SplashScreen,
  Stack,
  useNavigationContainerRef,
  useRootNavigationState,
} from "expo-router";
import { useFonts } from "expo-font";
import mobileAds from "react-native-google-mobile-ads";
import LoginProvider from "@/context/LoginProvider";
import NetworkProvider from "@/context/NetworkProvider";
import VoiceCallProvider from "@/context/VoiceCallProvider";
import CutomSplashScreen from "@/components/CutomSplashScreen";
import NoNetworkModal from "@/components/NoNetworkModal";
import CheckUpdate from "@/components/CheckUpdate";
import "../global.css";
import AsyncStorage from "@react-native-async-storage/async-storage";
import i18n from "@/utils/i18n";
import { languageMap } from "@/utils/languageMap";
import {
  initNotifications,
} from "@/utils/notifications";
import { useKeepAwake } from "expo-keep-awake";
// import analytics from "@react-native-firebase/analytics";

// Keep the native splash (assets/splash.png) on screen until the JS splash
// (CutomSplashScreen, rendered below while !isAppReady) has actually
// committed its first frame. Without this, Expo's default behavior hides
// the native splash the moment the JS bundle starts executing — before
// React has painted anything — which can show one frame of blank/white
// screen between the native splash disappearing and the JS splash
// appearing. Both splash surfaces now share the same #211B59 background
// (see app.json), so any timing slop between them is invisible either way.
SplashScreen.preventAutoHideAsync().catch(() => undefined);
const LANGUAGE_KEY = "user-language";

const RootLayout = () => {
  useKeepAwake(); // This keeps the screen on while this component is mounted
  // const navigationRef = useNavigationContainerRef();
  // const routeNameRef = useRef<string | undefined>();
  // const rootNavigationState = useRootNavigationState();

  const [fontsLoaded, error] = useFonts({
    "BubblegumSans-Regular": require("../assets/fonts/BubblegumSans-Regular.ttf"),
    "NunitoSans-Regular": require("../assets/fonts/NunitoSans-Regular.ttf"),
    "Poppins-Black": require("../assets/fonts/Poppins-Black.ttf"),
    "Poppins-Bold": require("../assets/fonts/Poppins-Bold.ttf"),
    "Poppins-ExtraBold": require("../assets/fonts/Poppins-ExtraBold.ttf"),
    "Poppins-ExtraLight": require("../assets/fonts/Poppins-ExtraLight.ttf"),
    "Poppins-Light": require("../assets/fonts/Poppins-Light.ttf"),
    "Poppins-Medium": require("../assets/fonts/Poppins-Medium.ttf"),
    "Poppins-Regular": require("../assets/fonts/Poppins-Regular.ttf"),
    "Poppins-SemiBold": require("../assets/fonts/Poppins-SemiBold.ttf"),
    "Poppins-Thin": require("../assets/fonts/Poppins-Thin.ttf"),
  });
  const [isAppReady, setAppReady] = useState(false);

  useEffect(() => {
    // Runs after this component's first commit — i.e. once CutomSplashScreen
    // has actually painted — so the native splash only ever hides behind
    // something already showing the same #211B59 background, never behind
    // a not-yet-rendered blank frame.
    SplashScreen.hideAsync().catch(() => undefined);
  }, []);

  const loadSavedLanguage = async () => {
    const savedLangCode = await AsyncStorage.getItem(LANGUAGE_KEY);
    // Only apply a saved language if it is still offered in languageMap;
    // anything else (or nothing saved) falls back to English.
    const offeredCodes = Object.values(languageMap).map((l) => l.code);
    if (savedLangCode && offeredCodes.includes(savedLangCode)) {
      await i18n.changeLanguage(savedLangCode);
    } else {
      await i18n.changeLanguage("en");
    }
    //console.log("Language set to:", i18n.language);
  };

  // 🔄 Firebase Analytics: Auto screen tracking
  /*useEffect(() => {
    if (!rootNavigationState?.key) return;

    const currentRoute = navigationRef.getCurrentRoute();
    const currentRouteName = currentRoute?.name;

    if (routeNameRef.current === currentRouteName || !currentRouteName) return;

    const timeout = setTimeout(async () => {
      try {
        await analytics().logScreenView({
          screen_name: currentRouteName,
          screen_class: currentRouteName,
        });
        routeNameRef.current = currentRouteName;
      } catch (e) {
        console.warn("🔥 Firebase Analytics screen_view log failed:", e);
      }
    }, 250); // Debounce to avoid render loop

    return () => clearTimeout(timeout);
  }, [rootNavigationState?.key]);*/

  useEffect(() => {
    // Startup integrations must never block rendering the navigator. They are
    // best-effort services, while the app shell remains usable offline.
    loadSavedLanguage().catch(() => undefined);
    initNotifications().catch(() => undefined);
    mobileAds().initialize().catch(() => undefined);
  }, []);

  useEffect(() => {
    // A font failure must not leave users permanently on the splash screen.
    if (!fontsLoaded && !error) return;
    const timer = setTimeout(() => setAppReady(true), 250);
    return () => clearTimeout(timer);
  }, [fontsLoaded, error]);

  useEffect(() => {
    // Last-resort boot guard for a stalled native font loader.
    const timer = setTimeout(() => setAppReady(true), 4000);
    return () => clearTimeout(timer);
  }, []);

  if (!isAppReady) {
    return <CutomSplashScreen />;
  }

  return (
    <LoginProvider>
      <NetworkProvider>
        <VoiceCallProvider>
          <StatusBar style="light" hidden />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: "white" },
              animation: "slide_from_right",
              header: () => null,
              navigationBarHidden: true,
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="(screens)" />
          </Stack>
          <NoNetworkModal />
          <CheckUpdate />
          {/* <StatusBar backgroundColor="#161622" style="light" /> */}
        </VoiceCallProvider>
      </NetworkProvider>
    </LoginProvider>
  );
};

export default RootLayout;
