import { useState } from "react";
import { Link, router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  View,
  Text,
  ScrollView,
  Dimensions,
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
    <SafeAreaView className="bg-[#171342] h-full">
      <ScrollView>
        <View
          className="w-full flex justify-center h-full px-4 my-6"
          style={{
            minHeight: Dimensions.get("window").height - 100,
          }}
        >
          <View className="mb-8 mt-4">
            <Text className="text-white text-[38px] font-pbold tracking-tight">9tel</Text>
            <Text className="text-[#CFCBFF] text-base font-pregular mt-1">Simple, secure and always connected.</Text>
          </View>

          <Text className="text-white text-2xl font-psemibold">Welcome back</Text>
          <Text className="text-[#CFCBFF] text-sm font-pregular mt-1">Sign in to manage your account.</Text>

          <FormField
            title={t("email")}
            value={form.email}
            placeholder="e.g. yourname@gmail.com"
            handleChangeText={(e) => setForm({ ...form, email: e })}
            otherStyles="mt-8"
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
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="password"
            maxLength={64}
          />

          <CustomButton
            title={t("buttons.sign_in")}
            handlePress={submit}
            containerStyles="w-full"
            isLoading={isSubmitting}
          />

          {/* Forgot password — directly under Sign In */}
          <View className="flex justify-end pt-3 flex-row">
            <Link
              href="/forgot-password"
              className="text-base text-gray-100 font-secondary"
            >
              Forgot password?
            </Link>
          </View>

          {/* Divider */}
          <View className="flex-row items-center my-4">
            <View className="flex-1 h-[1px] bg-white/30" />
            <Text className="text-white/70 mx-3 font-pregular">or</Text>
            <View className="flex-1 h-[1px] bg-white/30" />
          </View>

          {/* Guest sign-in — Google-style white button */}
          <TouchableOpacity
            onPress={submitAnonymous}
            disabled={isAnonSubmitting}
            activeOpacity={0.8}
            className={`w-full bg-white rounded-xl min-h-[52px] flex-row justify-center items-center shadow-lg shadow-black/40 ${
              isAnonSubmitting ? "opacity-60" : ""
            }`}
          >
            {isAnonSubmitting ? (
              <ActivityIndicator color="#3c4043" />
            ) : (
              <>
                <UserRound size={22} color="#4285F4" />
                <Text className="text-[#3c4043] font-psemibold text-base ml-3">
                  Continue as Guest
                </Text>
              </>
            )}
          </TouchableOpacity>

          <View className="flex justify-center pt-6 flex-row gap-2">
            <Text className="text-lg text-gray-100 font-pregular">
              Don't have an account?
            </Text>
            <Link
              href="/sign-up"
              className="text-lg font-secondary text-secondary"
            >
              Sign Up
            </Link>
          </View>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default SignIn;
