import { useState } from "react";
import { Link, router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  View,
  Text,
  ScrollView,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { UserRound } from "lucide-react-native";

import { CustomButton, FormField } from "../../components";

import { useLoginContext } from "@/context/LoginProvider";
import { signInAsGuest, signInUser } from "../../services/auth";
import { useTranslation } from "react-i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import uuid from "react-native-uuid";

// Stored so the same device always signs back into the same guest account
const ANON_CREDENTIALS_KEY = "anonymous-credentials";
const GUEST_DEVICE_ID_KEY = "guest-device-id";


const SignIn = () => {
  const { setUser, setIsLogged } = useLoginContext();
  const [isSubmitting, setSubmitting] = useState(false);
  const [isAnonSubmitting, setAnonSubmitting] = useState(false);
  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  // The API owns guest-account creation and returns a session in one request.
  // This avoids a partially-created account being treated as a failed sign-up.
  const submitAnonymous = async () => {
    setAnonSubmitting(true);
    try {
      // Keep supporting a guest account created by older app versions.
      let legacyCredentials = null;
      const stored = await AsyncStorage.getItem(ANON_CREDENTIALS_KEY);
      if (stored) legacyCredentials = JSON.parse(stored);

      if (legacyCredentials) {
        const legacyResult = await signInUser(legacyCredentials.email, legacyCredentials.password);
        if (legacyResult?.data?.success) {
          setUser(legacyResult.data.data.user);
          setIsLogged(true);
          router.replace("/(tabs)/home");
          return;
        }
        await AsyncStorage.removeItem(ANON_CREDENTIALS_KEY);
      }

      let deviceId = await AsyncStorage.getItem(GUEST_DEVICE_ID_KEY);
      if (!deviceId) {
        deviceId = String(uuid.v4());
        await AsyncStorage.setItem(GUEST_DEVICE_ID_KEY, deviceId);
      }
      const deviceName = (Constants.deviceName || "9tel").slice(0, 24);
      const result = await signInAsGuest(deviceId, deviceName);
      if (!result?.data?.success || !result.data?.data?.user) {
        Alert.alert("Guest sign-in", result?.data?.message || "Unable to start a guest session. Please try again.");
        return;
      }
      setUser(result.data.data.user);
      setIsLogged(true);
      router.replace("/(tabs)/home");
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setAnonSubmitting(false);
    }
  };


  const submit = async () => {
    const email = form.email.trim().toLowerCase();
    if (email === "" || form.password === "") {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      Alert.alert("Error", "Please enter a valid email address");
      return;
    }
    if (form.password.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters");
      return;
    }
    setSubmitting(true);

    try {

      const result = await signInUser(email, form.password);
      if (result !== undefined) {
        if (result?.data.success === false) {
          Alert.alert("Error", result?.data.message)
          return;
        }
        setUser(result.data.data.user);

        setIsLogged(true);

        //Alert.alert("Success", "User signed in successfully");
        router.replace("/(tabs)/home");
      } else {
        Alert.alert("Error", "Server Down, please try again later")
      }
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setSubmitting(false);
    }
  };
  const { t } = useTranslation();

  return (
    <SafeAreaView className="flex-1 bg-[#171342]">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View className="flex-1 justify-center px-5 py-8">
          <View className="mb-9">
            <View className="flex-row items-center mb-8">
              <View className="w-12 h-12 rounded-2xl bg-[#FCC200] items-center justify-center">
                <Text className="text-[#211B59] text-2xl font-pbold">9</Text>
              </View>
              <View className="ml-3">
                <Text className="text-white text-2xl font-pbold tracking-tight">9tel</Text>
                <Text className="text-[#CFCBFF] text-xs font-pregular">SIMPLE. SECURE. CONNECTED.</Text>
              </View>
            </View>
            <Text className="text-white text-[30px] leading-9 font-psemibold">Welcome back</Text>
            <Text className="text-[#CFCBFF] text-sm font-pregular mt-2">
              Sign in to stay close to the people who matter.
            </Text>
          </View>

          <View className="rounded-3xl border border-white/10 bg-[#211B59] p-5">
            <FormField
              title={t("email")}
              value={form.email}
              placeholder="e.g. yourname@gmail.com"
              handleChangeText={(e) => setForm({ ...form, email: e })}
              otherStyles="mt-1"
              variant="auth"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              maxLength={60}
            />

            <FormField
              title={t("password")}
              placeholder="Password"
              value={form.password}
              handleChangeText={(e) => setForm({ ...form, password: e })}
              otherStyles="mt-5"
              variant="auth"
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="password"
              maxLength={64}
              secureTextEntry
            />

            <View className="flex-row justify-end mt-3">
              <Link href="/forgot-password" className="text-sm text-[#E1CE67] font-pmedium">
                Forgot password?
              </Link>
            </View>

            <CustomButton
              title={t("buttons.sign_in")}
              handlePress={submit}
              containerStyles="w-full"
              isLoading={isSubmitting}
            />

            <View className="flex-row items-center my-4">
              <View className="flex-1 h-[1px] bg-white/15" />
              <Text className="text-[#9C97C4] mx-3 font-pregular text-xs">OR</Text>
              <View className="flex-1 h-[1px] bg-white/15" />
            </View>

            <TouchableOpacity
              onPress={submitAnonymous}
              disabled={isAnonSubmitting}
              activeOpacity={0.8}
              className={`w-full bg-[#302A68] border border-white/15 rounded-xl min-h-[52px] flex-row justify-center items-center ${
                isAnonSubmitting ? "opacity-60" : ""
              }`}
            >
              {isAnonSubmitting ? (
                <ActivityIndicator color="#CFCBFF" />
              ) : (
                <>
                  <UserRound size={20} color="#E1CE67" />
                  <Text className="text-white font-pmedium text-sm ml-3">
                    Continue as Guest
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <View className="flex-row justify-center items-center pt-7 gap-2">
            <Text className="text-sm text-[#CFCBFF] font-pregular">New to 9tel?</Text>
            <Link href="/sign-up" className="text-sm font-psemibold text-[#E1CE67]">
              Create an account
            </Link>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default SignIn;
