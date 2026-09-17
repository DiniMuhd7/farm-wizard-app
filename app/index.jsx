import { useCallback, useRef, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { BackHandler, Dimensions, Platform, Text, ToastAndroid, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Redirect, router, useFocusEffect } from "expo-router";

import CustomButton from "../components/CustomButton";

import { useLoginContext } from "../context/LoginProvider";
import { useTranslation } from "react-i18next";
import TermsContent from "../components/TermsContent";
const { height } = Dimensions.get("window");

export default function Index() {
  const { loading, isLogged } = useLoginContext();

  // Every hook below must run on EVERY render. Returning <Redirect /> before
  // them changes the hook count between renders, which React treats as a fatal
  // error ("Rendered fewer hooks than expected") — in a release build that
  // surfaces as a blank, frozen screen with no error message.
  const [backPressedOnce, setBackPressedOnce] = useState(false);
  const timeoutRef = useRef(null);
  const { t } = useTranslation();

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
  if (!loading && isLogged) return <Redirect href={"/(tabs)/home"} />;

  return (
    <SafeAreaView
      className="bg-primary h-full"
      edges={["left", "right", "bottom"]}
      style={{ flex: 1, backgroundColor: "#211B59" }}
    >
      <View className="w-full flex justify-center items-center min-h-[95%] px-4">
        <View className="my-20 ">
          <Text className="text-3xl text-white font-primary text-center">
            {t("settings.terms_and_condition")}
          </Text>
        </View>
        <View
          style={{
            flex: 1,
            width: "100%",
            marginBottom: 16,
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          <TermsContent />
        </View>

        <CustomButton
          title={t("buttons.agree_continue")}
          handlePress={() => router.push("/sign-in")}
          containerStyles="w-full"
          textStyles={"font-pbold text-white"}
          isLoading={false}
        />
      </View>

      <StatusBar backgroundColor="#161622" style="light" />
    </SafeAreaView>
  );
}
