import React from "react";
import BackgroundImage from "@/components/BackgroundImage";
import { images } from "@/constants";
import { View, Text, Image, Dimensions } from "react-native";
import { CustomButton } from "../../components";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { playSound } from "@/utils/audio";

const { width, height } = Dimensions.get("window");

const SessionStarted = () => {
  const { name, names, offlineGardenData } = useLocalSearchParams();
  const router = useRouter();

  const { t } = useTranslation();
  return (
    <View className="flex-1 bg-green-200 items-center justify-start pt-20">
      {/* Background */}
      <BackgroundImage
        blurRadius={2}
        source={images.bgRainfall}
        style={{
          width: "100%",
          height: "100%",
          position: "absolute",
        }}
      />

      {/* Title */}
      <Text className="text-white text-3xl font-primary my-10">
        {t("menu.session_started")}
      </Text>

      <View className="items-center my-8 rounded-3xl p-6">
        <Image
          source={images.sessionStarted}
          style={{
            width: width * 0.5,
            height: width * 0.5,
          }}
          resizeMode="contain"
        />

        <Text
          className="text-center text-xl px-2 font-secondary"
          style={{
            color: "#fff",
            textAlign: "center",
            paddingHorizontal: 10,
          }}
        >
          {t("messages.session_started")}
        </Text>
      </View>

      <CustomButton
        title={t("buttons.ok")}
        handlePress={() => {
          router.replace({
            pathname: "/(screens)/plantScreen",
            params: { name, names, offlineGardenData },
          });
          playSound(require("@/assets/sounds/click.mp3"), 0.05);
        }}
        containerStyles="w-[200px] mb-1"
        textStyles={"font-pbold text-white"}
        isLoading={false}
      />
    </View>
  );
};

export default SessionStarted;
