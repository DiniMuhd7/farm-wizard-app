import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Modal,
  Animated,
  ScrollView,
  Dimensions,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { BlurView } from "expo-blur";
import { icons, images } from "@/constants";
import BackgroundImage from "@/components/BackgroundImage";
import HeaderNavigation from "@/components/HeaderNavigation";
import { router } from "expo-router";
import { CustomButton, FormField } from "@/components";
import { submitWithdrawal as submitWithdrawalRequest } from "@/services/withdrawal";
import AsyncStorage from "@react-native-async-storage/async-storage";
const { height } = Dimensions.get("window");
import uuid from "react-native-uuid";
import { useLoginContext } from "@/context/LoginProvider";
import { useTranslation } from "react-i18next";
import { submitConversion } from "@/services/user";
import CountryPhoneInput from "@/components/CountryPhoneInput";

const tabs = ["Garden Grants"] as const;

type Provider = {
  name: string;
  icon?: any;
  emoji?: string;
  bg: string;
};

const providers = {
  "Garden Grants": [
    {
      name: "Crypto",
      icon: undefined,
      emoji: "₿",
      bg: "bg-emerald-700",
    },
    {
      name: "PayPal",
      icon: undefined,
      emoji: "💳",
      bg: "bg-blue-600",
    },
  ],
  Airtime: [
    {
      name: "MTN",
      icon: icons.mtn,
      bg: "bg-yellow-600",
    },
    {
      name: "Airtel",
      icon: icons.airtel,
      bg: "bg-red-500",
    },
    {
      name: "9Mobile",
      icon: icons.nineMobile,
      bg: "bg-red-500",
    },
    {
      name: "Glo",
      icon: icons.glo,
      bg: "bg-red-500",
    },
  ],
  "Data bundle": [
    {
      name: "MTN",
      icon: icons.mtn,
      bg: "bg-yellow-600",
    },
    {
      name: "Airtel",
      icon: icons.airtel,
      bg: "bg-red-500",
    },
    {
      name: "9Mobile",
      icon: icons.nineMobile,
      bg: "bg-red-500",
    },
    {
      name: "Glo",
      icon: icons.glo,
      bg: "bg-red-500",
    },
  ],
};

const airtimeAmount = [
  { id: 1, value: 100 },
  { id: 2, value: 200 },
  { id: 3, value: 500 },
  { id: 4, value: 1000 },
];
const dataBundle = [
  { id: 1, value: 1 },
  { id: 2, value: 2 },
  { id: 3, value: 3 },
  { id: 4, value: 4 },
];

const ClaimScreen = () => {
  const { user, setUser } = useLoginContext();
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState<keyof typeof providers>("Garden Grants");
  const [selectedProvider, setSelectedProvider] = useState<Provider>();
  const [modalVisible, setModalVisible] = useState(false);
  const [conversionModal, setConversionModal] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState("");
  const [selectedAmount, setSelectedAmount] = useState(0);
  const [isSubmitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    amount: user?.usdBalance ?? 0,
    phoneNo: "",
    data: "",
    network: "Seed preference",
  });
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  if (!user) {
    router.replace("/");
    return null;
  }

  const isAdmin = user.userType === "admin";

  const handleTabChange = (tab: "Garden Grants" | "Airtime" | "Data bundle") => {
    setActiveTab(tab);
    setForm({ ...form, phoneNo: "" });
  };

  const openModal = (provider: Provider) => {
    setSelectedProvider(provider);
    setModalVisible(true);
    setForm({ ...form, phoneNo: "" });
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const closeModal = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setModalVisible(false);
      setSelectedProvider(undefined);
    });
  };

  const openCoversionModal = () => {
    setConversionModal(true);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const handleAmountSelect = (amount: number) => {
    setSelectedAmount(amount);
    setForm({ ...form, amount: amount.toString() });
  };
  const handleNetworkSelect = (network: string) => {
    setSelectedNetwork(network);
    setForm({ ...form, phoneNo: "" });
  };

  const handleGardenProviderSelect = (provider: Provider) => {
    setSelectedProvider(provider);
    setForm({
      ...form,
      phoneNo: "",
      network: provider.name === "PayPal" ? "PayPal" : "",
    });
  };

  const submitWithdrawal = async () => {
    if (isSubmitting) {
      return;
    }

    if (!isEligible) {
      Alert.alert(
        t("messages.warning"),
        `You need at least ${MIN_WIZ.toLocaleString()} WizPoints ($${MIN_USD}) before submitting a claim.`
      );
      return;
    }
    // if (Number(user.usdBalance) < 0.005) {
    //   Alert.alert(t("messages.warning"), t("messages.withdrawal_warning"));
    //   return;
    // }

    const type = activeTab;
    const reference = `withdraw-${uuid.v4().split("-")[0]}`;
    const provider = selectedNetwork ? selectedNetwork : selectedProvider?.name;
    if (
      (type === "Garden Grants" || type === "Data bundle" || type === "Airtime") &&
      !form.phoneNo.trim()
    ) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }
    if (type === "Garden Grants" && provider === "PayPal" && !form.phoneNo.includes("@")) {
      Alert.alert("Error", "Please enter a valid PayPal email address");
      return;
    }
    if (type === "Garden Grants" && provider === "Crypto" && !form.network.trim()) {
      Alert.alert("Error", "Please enter the crypto network type");
      return;
    }

    /*if (type === "Airtime" && !form.amount) {
      Alert.alert("Error", "Please enter amount");
      return;
    }
    if (type === "Data bundle" && !form.amount) {
      Alert.alert("Error", "Please enter data balance");
      return;
    }*/
    if (!provider) {
      Alert.alert("Error", "Please select provider");
      return;
    }

    const token = await AsyncStorage.getItem("token");
    if (!token) {
      Alert.alert("Error", "Please sign in again before submitting a claim.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await submitWithdrawalRequest(
        // Number(form.amount),
        Number(user?.score),
        form.phoneNo.trim(),
        provider,
        type,
        reference,
        form.network.trim(),
        token
      );
      const withdrawal = result.data?.withdrawal;
      const updatedUser = result.data?.data?.userDetails ?? result.data?.userDetails;

      if (result.status < 200 || result.status >= 300 || result.data?.success === false) {
        Alert.alert(t("messages.warning"), result.data?.message ?? "Unable to submit claim");
        return;
      }

      Alert.alert("Success", result.data?.message ?? "Claim submitted successfully");
      if (updatedUser) {
        setUser(updatedUser);
      }

      setTimeout(() => {
        if (withdrawal) {
          router.push({
            pathname: "/(tabs)/(sub-tabs)/requestReceived",
            params: {
              createdAt: withdrawal.createdAt,
              amount: withdrawal.amount,
              reference: withdrawal.reference,
            },
          });
        } else {
          router.replace("/(screens)/transactionSuccess");
        }
      }, 2000);
    } catch (error: any) {
      Alert.alert(
        "Error occurred",
        error?.response?.data?.message ?? error?.message ?? "Unable to submit claim"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitConvertion = async () => {
    if (user.score <= 0) {
      Alert.alert(t("messages.warning"), t("messages.convert_warning"));
      return;
    }

    const token = await AsyncStorage.getItem("token");
    if (!token) {
      Alert.alert("Error", "Please sign in again before submitting a claim.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await submitConversion(token, Number(user.score));
      // console.log("result ", result.data.userDetails);
      if (result.status !== 200) {
        Alert.alert("Warning!", result.data.message);
        return;
      }

      Alert.alert("Success", result.data.message);
      setTimeout(() => {
        router.replace("/(screens)/transactionSuccess");
      }, 2000);
      setUser(result.data.userDetails);
    } catch (error: any) {
      Alert.alert("Error occured", error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdrawalHistory = () => {
    if (isAdmin) {
      router.push("/(tabs)/(sub-tabs)/withdrawalRequest");
    } else {
      router.push("/(tabs)/(sub-tabs)/userWithdrawals");
    }
  };
  // WizPoints -> USD: 1000 WZP = $0.01  (score * 0.01 / 1000)
  const wizPoints = Number(user?.score) || 0;
  const usdValue = (wizPoints * 0.01) / 1000;
  const MIN_USD = 1;
  const MIN_WIZ = Math.round((MIN_USD * 1000) / 0.01); // 100,000
  const isEligible = usdValue >= MIN_USD;
  const progressPct = Math.min(100, (usdValue / MIN_USD) * 100);

  const isCryptoProvider = selectedProvider?.name === "Crypto";
  const isPaypalProvider = selectedProvider?.name === "PayPal";
  const remainingWiz = Math.max(0, MIN_WIZ - wizPoints);
  const rewardStats = [
    { label: "Claim status", value: isEligible ? "Ready" : "Growing", emoji: isEligible ? "✅" : "🌱" },
    { label: "To unlock", value: `${remainingWiz.toLocaleString()} WZP`, emoji: "🎯" },
    { label: "Methods", value: "Crypto / PayPal", emoji: "💼" },
  ];

  return (
    <View className="flex-1 bg-green-200 items-center justify-start relative">
      <BackgroundImage
        source={images.background}
        style={{ width: "100%", height: "100%", position: "absolute" }}
      />

      {/* Header */}
      <HeaderNavigation
        onLeftPress={() => router.push("/(tabs)/profile")}
        onRightPress={() => handleWithdrawalHistory()}
        leftIcon={icons.back}
        rightIcon={images.requestPending}
        showLeftButton={true}
        showRightButton={true}
      />
      <Text className="text-white text-2xl font-primary">
        {t("menu.claim")}
      </Text>

      {/* Balance card */}
      <View className="w-[92%] bg-green-950/75 rounded-3xl p-4 mt-2 border border-yellow-200/30">
        <Text className="text-white/90 text-xs font-pmedium text-center">
          YOUR BALANCE
        </Text>
        <Text className="text-white text-3xl font-pbold text-center mt-1">
          {wizPoints.toFixed(0)}{" "}
          <Text className="text-base font-pmedium">WizPoints</Text>
        </Text>
        <Text className="text-white/90 text-sm text-center">
          ≈ ${usdValue.toFixed(4)} in garden grant
        </Text>

        <View className="h-2 bg-black/25 rounded-full mt-3 overflow-hidden">
          <View
            className={`h-2 rounded-full ${
              isEligible ? "bg-green-400" : "bg-white"
            }`}
            style={{ width: `${progressPct}%` }}
          />
        </View>
        <Text className="text-white/90 text-xs text-center mt-1">
          {isEligible
            ? "✅ You've reached the minimum to claim!"
            : `Minimum to claim: ${MIN_WIZ.toLocaleString()} WizPoints ($${MIN_USD})`}
        </Text>
      </View>

      <View className="w-[92%] flex-row justify-between mt-3">
        {rewardStats.map((stat) => (
          <View key={stat.label} className="bg-black/30 rounded-2xl p-3 items-center" style={{ width: "31%" }}>
            <Text className="text-2xl">{stat.emoji}</Text>
            <Text className="text-white font-pbold text-xs text-center mt-1">{stat.value}</Text>
            <Text className="text-white/65 text-[10px] text-center mt-1">{stat.label}</Text>
          </View>
        ))}
      </View>

      {activeTab === "Garden Grants" && (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1, width: "100%" }}
        >
          <ScrollView
            className="w-full px-4"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 16 }}
          >
            {/* How garden grant claims work */}
            <View className="bg-black/35 rounded-3xl p-4 my-3 border border-white/10">
              <Text className="text-[#F2DE9F] font-pbold text-base mb-1">
                Garden rewards roadmap
              </Text>
              <Text className="text-white/75 text-xs mb-3">
                Turn gameplay performance into verified garden support. Higher consistency keeps your account claim-ready.
              </Text>
              {[
                "Play games to earn WizPoints.",
                `Reach ${MIN_WIZ.toLocaleString()} WizPoints ($${MIN_USD}) to become eligible to claim.`,
                "Choose crypto or PayPal as your garden reward receive method.",
                "For crypto, enter your wallet address and network type; for PayPal, enter your email address.",
                "Submit your claim — our team verifies it, then prepares the garden support reward.",
              ].map((step, i) => (
                <View key={i} className="flex-row mb-1.5">
                  <View className="w-5 h-5 rounded-full bg-[#E0C145B8] items-center justify-center mr-2 mt-0.5">
                    <Text className="text-white text-xs font-pbold">
                      {i + 1}
                    </Text>
                  </View>
                  <Text className="text-white/90 text-sm flex-1 leading-5">
                    {step}
                  </Text>
                </View>
              ))}
              <Text className="text-white/60 text-xs mt-2 italic">
                Claims are subject to verification and may take time to process.
                Track your request using the icon at the top right.
              </Text>
            </View>

            {/* Step 1: choose provider */}
            <Text className="text-white font-pbold text-base mb-2">
              1. Choose where to receive your garden rewards
            </Text>
            <View className="flex-row flex-wrap justify-between mb-4">
              {providers[activeTab].map((provider, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => handleGardenProviderSelect(provider)}
                  style={{ width: "48%" }}
                  className={`items-center p-4 mb-3 rounded-2xl ${provider.bg} ${
                    selectedProvider?.name === provider.name
                      ? "border-2 border-white"
                      : "opacity-80"
                  }`}
                >
                  {provider.icon ? (
                    <Image
                      source={provider.icon}
                      className="w-8 h-8"
                      resizeMode="contain"
                    />
                  ) : (
                    <Text style={{ fontSize: 28 }}>{provider.emoji}</Text>
                  )}
                  <Text className="text-white font-psemibold text-sm mt-2">
                    {provider.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Step 2: payout details */}
            <Text className="text-white font-pbold text-base mb-1">
              2. Enter your {isPaypalProvider
                ? "PayPal email address"
                : "crypto wallet details"}
            </Text>
            <FormField
              type="text"
              placeholder={
                isPaypalProvider
                  ? "Enter your PayPal email address"
                  : "Paste your wallet address"
              }
              title={isPaypalProvider ? "PayPal email" : "Wallet address"}
              value={form.phoneNo}
              handleChangeText={(e: any) => setForm({ ...form, phoneNo: e })}
              otherStyles="my-2"
            />
            {isCryptoProvider && (
              <FormField
                type="text"
                placeholder="e.g. USDT TRC20, USDC ERC20, Bitcoin"
                title="Network type"
                value={form.network}
                handleChangeText={(e: any) => setForm({ ...form, network: e })}
                otherStyles="mb-2"
              />
            )}
          </ScrollView>
          <View className="w-full px-4 pt-2 pb-24 bg-transparent">
            <CustomButton
              title={isEligible ? "Claim my garden rewards" : "Keep playing to unlock"}
              handlePress={submitWithdrawal}
              containerStyles="w-full"
              textStyles={"font-pbold text-white"}
              isLoading={isSubmitting}
            />
          </View>
        </KeyboardAvoidingView>
      )}

      {(activeTab === "Airtime" || activeTab === "Data bundle") &&
        (user?.country === "ng" ? (
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"} // or 'position'
            style={{ flex: 1 }}
          >
            <ScrollView
              className="p-2"
              style={{ height: height * 0.5 }}
            >
              <View className="flex-row justify-around gap-4 my-6 ">
                {providers["Airtime"].map((provider, index) => (
                  <ProviderCard
                    key={provider.name || index}
                    provider={provider}
                    index={index}
                    selectedNetwork={selectedNetwork}
                    onNetworkSelect={handleNetworkSelect}
                  />
                ))}
              </View>

              <FormField
                type="text"
                placeholder="Enter phone number"
                title="Ebter Phone number"
                value={form.phoneNo}
                handleChangeText={(e: any) => setForm({ ...form, phoneNo: e })}
                otherStyles="my-4"
              />
              {/* <Text className="text-white text-base font-primary text-center m-2">
                Amount
              </Text>

              <View className="flex-row justify-around gap-x-6">
                {activeTab === "Airtime" ? (
                  <>
                    {airtimeAmount.map((amount, index) => (
                      <AmountCard
                        type="airtime"
                        key={amount.id || index}
                        amount={amount}
                        index={index}
                        selectedAmount={selectedAmount}
                        onAmountSelect={handleAmountSelect}
                      />
                    ))}
                  </>
                ) : (
                  <>
                    {dataBundle.map((amount, index) => (
                      <AmountCard
                        type="data"
                        key={amount.id || index}
                        amount={amount}
                        index={index}
                        selectedAmount={selectedAmount}
                        onAmountSelect={handleAmountSelect}
                      />
                    ))}
                  </>
                )}
              </View>
              <FormField
                type="text"
                placeholder="Enter amount"
                title=""
                value={form.amount}
                handleChangeText={(e: any) => setForm({ ...form, amount: e })}
                otherStyles=""
              /> */}
              <CustomButton
                title="Ready to claim "
                handlePress={submitWithdrawal}
                containerStyles="w-full"
                textStyles={"font-pbold text-white"}
                isLoading={isSubmitting}
              />
              {/* <Text className="text-base font-secondary text-white my-2">
                {t("messages.available")}
              </Text> */}
            </ScrollView>
          </KeyboardAvoidingView>
        ) : (
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"} // or 'position'
            style={{ flex: 1 }}
          >
            <ScrollView
              className="p-6 my-6"
              style={{ height: height * 0.5 }}
            >
              {/* <FormField
                type="text"
                placeholder="Enter phone number"
                title=""
                value={form.phoneNo}
                handleChangeText={(e: any) => setForm({ ...form, phoneNo: e })}
                otherStyles=""
              /> */}

              <CountryPhoneInput
                defaultCountryCode={user?.country || "ng"}
                onChangePhone={(number) =>
                  setForm({ ...form, phoneNo: number })
                }
              />

              {/* <FormField
                type="text"
                placeholder="Enter amount"
                title=""
                value={form.amount}
                handleChangeText={(e: any) => setForm({ ...form, amount: e })}
                otherStyles=""
              /> */}
              <CustomButton
                title="Ready to claim "
                handlePress={submitWithdrawal}
                containerStyles="w-full"
                textStyles={"font-pbold text-white"}
                isLoading={isSubmitting}
              />
              {/* <Text className="text-base font-secondary text-white my-2">
                {t("messages.available")}
              </Text> */}
            </ScrollView>
          </KeyboardAvoidingView>
          // <Text className="text-white text-base font-primary my-40 ">
          //   {t("messages.unavailable")}
          // </Text>
        ))}

      {/* Popup Modal */}
      <Modal transparent visible={modalVisible} animationType="fade">
        <BlurView
          intensity={50}
          tint="dark"
          className="flex-1 items-center justify-center"
        >
          <Animated.View
            style={{
              opacity: fadeAnim,
              transform: [
                {
                  translateY: fadeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [50, 0],
                  }),
                },
              ],
            }}
            className="bg-[#80784A] rounded-2xl w-[80%] p-6 items-center shadow-2xl"
          >
            <Image source={selectedProvider?.icon} className="w-12 h-12 mb-4" />
            <Text className="text-xl font-bold mb-2 text-center text-white">
              {selectedProvider?.name}
            </Text>
            <Text className="text-gray-200 text-center mb-6">
              {t("messages.confirm_claim")} {selectedProvider?.name}?
            </Text>
            <Text className="text-xl text-white font-bold mb-2 text-center">
              {t("comfirmation.token_address", {
                // amount: ` ${user.usdBalance} `,
                WZP: ` ${user?.score} `,
              })}{" "}
            </Text>
            <FormField
              type="text"
              placeholder="Enter mailing/contact details"
              title="Mailing/contact details"
              value={form.phoneNo}
              handleChangeText={(e: any) => setForm({ ...form, phoneNo: e })}
              otherStyles="my-2"
            />

            <FormField
              type="text"
              placeholder={t("netword_details")}
              title={t("netword_details")}
              value={form.network}
              handleChangeText={(e: any) => setForm({ ...form, network: e })}
              otherStyles=""
            />

            <View className="flex-row gap-x-4">
              <CustomButton
                title={t("buttons.submit")}
                handlePress={submitWithdrawal}
                containerStyles="w-[200px]"
                textStyles={"font-pbold text-white"}
                isLoading={isSubmitting}
              />
            </View>
            <View className="w-full items-end mt-4">
              <TouchableOpacity
                className="p-3 bg-gray-300 rounded"
                onPress={closeModal}
              >
                <Text className="text-black font-semibold">
                  {t("buttons.cancel")}
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </BlurView>
      </Modal>

      <Modal transparent visible={conversionModal} animationType="fade">
        <BlurView
          intensity={50}
          tint="dark"
          className="flex-1 items-center justify-center"
        >
          <Animated.View
            style={{
              opacity: fadeAnim,
              transform: [
                {
                  translateY: fadeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [50, 0],
                  }),
                },
              ],
            }}
            className="bg-black-200 rounded-2xl w-[80%] p-6 items-center shadow-2xl"
          >
            <Text className="text-xl text-white font-bold mb-2 text-center">
              {t("comfirmation.convert_to_usd")}
            </Text>
            <Text className="text-xl text-white font-bold mb-2 text-center">
              {user.score.toFixed(2)}
            </Text>

            {/* <FormField
              type="text"
              placeholder="Enter reward points"
              title="Wiz Points"
              value={token}
              handleChangeText={(e: any) => setForm({ ...form, data: e })}
              otherStyles=""
            /> */}

            <View className="flex-row gap-x-4">
              <CustomButton
                title={t("buttons.click_to_confirm")}
                handlePress={handleSubmitConvertion}
                containerStyles="w-[200px]"
                textStyles={"font-pbold text-white"}
                isLoading={isSubmitting}
              />
            </View>
            <View className="w-full items-end mt-4">
              <TouchableOpacity
                className="p-3 bg-gray-300 rounded"
                onPress={() => setConversionModal(false)}
              >
                <Text className="text-black font-semibold">
                  {t("buttons.cancel")}
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </BlurView>
      </Modal>
    </View>
  );
};

const ProviderCard = ({
  provider,
  index,
  selectedNetwork,
  onNetworkSelect,
}: {
  provider: any;
  index: number;
  selectedNetwork: string;
  onNetworkSelect: any;
}) => {
  return (
    <TouchableOpacity
      key={index}
      onPress={() => onNetworkSelect(provider.name)}
      className={`m-1 py-1 rounded-xl ${
        selectedNetwork === provider.name ? "border border-white" : ""
      }`}
    >
      <Image
        source={provider.icon}
        className="w-20 h-12"
        resizeMode="contain"
      />
    </TouchableOpacity>
  );
};

const AmountCard = ({
  amount,
  index,
  selectedAmount,
  onAmountSelect,
  type,
}: {
  amount: any;
  index: number;
  selectedAmount: number;
  onAmountSelect: any;
  type: string;
}) => {
  return (
    <TouchableOpacity
      key={index}
      onPress={() => onAmountSelect(amount.value)}
      className={`bg-black/20 m-1 rounded-lg ${
        selectedAmount === amount.value ? "border border-white" : ""
      }`}
    >
      <View className="m-1 p-4 bg-[#E0C145B8] rounded-xl">
        <Text className="text-white text-base font-bold font-secondary text-center">
          {type === "airtime" && "N"} {amount.value} {type === "data" && "GB"}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

export default ClaimScreen;
