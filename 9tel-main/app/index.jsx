import { useCallback, useEffect, useRef, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { BackHandler, Dimensions, Platform, Text, ToastAndroid, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Redirect, useFocusEffect } from "expo-router";
import { ShieldCheck } from "lucide-react-native";

import CustomButton from "../components/CustomButton";

import { useLoginContext } from "../context/LoginProvider";
import { useTranslation } from "react-i18next";
import TermsContent from "../components/TermsContent";
const { height } = Dimensions.get("window");

export default function Index() {
  const { loading, isLogged, refreshSession } = useLoginContext();

  // Every hook below must run on EVERY render. Returning <Redirect /> before
  // them changes the hook count between renders, which React treats as a fatal
  // error ("Rendered fewer hooks than expected") — in a release build that
  // surfaces as a blank, frozen screen with no error message.
  const [backPressedOnce, setBackPressedOnce] = useState(false);
  const timeoutRef = useRef(null);
  const { t } = useTranslation();

  // "Agree & Continue" used to send straight to /sign-in unconditionally —
  // even though LoginProvider already starts an automatic guest session the
  // moment the app boots (see context/LoginProvider.js), before this screen
  // is even on screen. That meant tapping through the terms landed on a
  // manual login screen regardless of whether a guest session had already
  // signed the person in, defeating the whole point of signing guests in
  // automatically. isContinuing just tracks "they've tapped through terms
  // and we're waiting on that already-in-flight guest sign-in" — once
  // isLogged flips true, the <Redirect> below fires on its own; nothing
  // here navigates to /sign-in as the normal path anymore.
  const [isContinuing, setIsContinuing] = useState(false);
  const [continueError, setContinueError] = useState(false);

  useEffect(() => {
    if (isContinuing && !loading && !isLogged) {
      // Reaching this now means something deeper than "no internet" — a
      // poor or absent connection is handled gracefully already (see
      // context/LoginProvider.js's local-guest fallback, which lets the
      // person in immediately and reconciles with a real account once
      // connectivity returns). Landing here means even that local fallback
      // failed, which really only happens if on-device storage itself is
      // unavailable — rare, but offer a retry rather than leave the button
      // spinning forever, or send them to a manual login screen (the whole
      // point of auto-guest-sign-in is that one never needs to appear at
      // this stage).
      setContinueError(true);
    }
  }, [isContinuing, loading, isLogged]);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== "android") return;

      const onBackPress = () => {
        if (backPressedOnce) {
          BackHandler.exitApp();
          return true;
        }

        setBackPressedOnce(true);
        ToastAndroid.show("Press back again to exit", ToastAndroid.SHORT);

        timeoutRef.current = setTimeout(() => {
          setBackPressedOnce(false);
        }, 2000);

        return true;
      };

      const backHandler = BackHandler.addEventListener(
        "hardwareBackPress",
        onBackPress
      );

      return () => {
        backHandler.remove();
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
      };
    }, [backPressedOnce])
  );

  // Safe to branch now: all hooks have already run.
  if (!loading && isLogged) return <Redirect href={"/(tabs)/dialer"} />;

  return (
    <SafeAreaView
      className="bg-primary h-full"
      edges={["left", "right", "bottom"]}
      style={{ flex: 1, backgroundColor: "#211B59" }}
    >
      <View className="flex-1 w-full px-5 pt-8 pb-5">
        <View className="flex-row items-center mb-5">
          <View className="w-11 h-11 rounded-2xl bg-[#FCC200] items-center justify-center">
            <Text className="text-[#211B59] text-2xl font-pbold">9</Text>
          </View>
          <View className="ml-3 flex-1">
            <Text className="text-white text-lg font-pbold">9tel</Text>
            <Text className="text-[#9C97C4] text-[10px] font-pmedium tracking-[1.5px]">
              TERMS OF SERVICE
            </Text>
          </View>
          <View className="flex-row items-center rounded-full bg-white/10 px-3 py-2">
            <ShieldCheck size={14} color="#E1CE67" />
            <Text className="text-[#D8D5F0] text-[10px] font-pmedium ml-1.5">YOUR TRUST MATTERS</Text>
          </View>
        </View>

        <Text className="text-white text-[27px] leading-9 font-psemibold">
          A few things to know
        </Text>
        <Text className="text-[#CFCBFF] text-xs font-pregular mt-1 mb-4">
          Please review our terms before you start using 9tel.
        </Text>

        <View className="flex-1 w-full rounded-3xl overflow-hidden border border-white/10 mb-4">
          <TermsContent />
        </View>

        {continueError && (
          <Text
            style={{ color: "#F5B199", fontSize: 12, textAlign: "center", marginBottom: 10 }}
          >
            {t("errors.guest_signin_failed") ||
              "Something went wrong starting your session. Please try again."}
          </Text>
        )}

        <CustomButton
          title={t("buttons.agree_continue")}
          handlePress={() => {
            setContinueError(false);
            setIsContinuing(true);
          }}
          containerStyles="w-full"
          textStyles={"font-psemibold text-[#211B59]"}
          isLoading={isContinuing && !continueError}
        />

        {continueError && (
          <Text
            onPress={() => {
              setContinueError(false);
              setIsContinuing(true);
              refreshSession();
            }}
            style={{ color: "#CFCBFF", fontSize: 12, textAlign: "center", marginTop: 14, textDecorationLine: "underline" }}
          >
            Retry
          </Text>
        )}
      </View>

      <StatusBar backgroundColor="#161622" style="light" />
    </SafeAreaView>
  );
}
