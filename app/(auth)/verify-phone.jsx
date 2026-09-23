import { useEffect, useRef, useState } from "react";
import { router } from "expo-router";
import { View, Text, ScrollView, Dimensions, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PhoneCall } from "lucide-react-native";
import { CustomButton, FormField } from "../../components";
import { startCallerIdVerification, getVerifiedCallerId } from "@/services/callerid";

const E164 = /^\+[1-9]\d{6,14}$/;
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 2 * 60 * 1000; // Twilio's own validation window is generous; stop polling well before it matters, not while a real call could still be in progress.

export default function VerifyPhone() {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [calling, setCalling] = useState(false);
  const [validationCode, setValidationCode] = useState("");
  const pollRef = useRef(null);
  const pollDeadlineRef = useRef(0);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const startPolling = (expectedNumber) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollDeadlineRef.current = Date.now() + POLL_TIMEOUT_MS;
    pollRef.current = setInterval(async () => {
      if (Date.now() > pollDeadlineRef.current) {
        clearInterval(pollRef.current);
        return;
      }
      try {
        const verified = await getVerifiedCallerId();
        if (verified && verified === expectedNumber) {
          clearInterval(pollRef.current);
          router.replace("/(tabs)/home");
        }
      } catch {
        // transient — keep polling until the timeout
      }
    }, POLL_INTERVAL_MS);
  };

  const submit = async () => {
    const trimmed = phoneNumber.trim();
    if (!E164.test(trimmed)) {
      setError("Enter your number with country code, e.g. +2348012345678");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const { validationCode: code } = await startCallerIdVerification(trimmed);
      setValidationCode(code);
      setCalling(true);
      startPolling(trimmed);
    } catch (err) {
      Alert.alert("Unable to start verification", err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="bg-primary h-full" style={{ backgroundColor: "#211B59" }}>
      <ScrollView>
        <View
          className="w-full flex justify-center h-full px-4 my-6"
          style={{ minHeight: Dimensions.get("window").height - 100 }}
        >
          <Text className="text-white text-3xl font-primary text-center mb-2">
            Verify your number
          </Text>

          {!calling ? (
            <>
              <Text style={{ color: "#CFCBFF", fontSize: 13, textAlign: "center", marginTop: 8, marginBottom: 20 }}>
                Verifying your own phone number lets it show as your caller ID when you call
                people from 9tel, instead of the shared 9tel number. Twilio verifies it with a
                short automated phone call — not a text message — and reads you a code to enter
                on your keypad while you're on that call.
              </Text>

              <FormField
                title="Your phone number"
                value={phoneNumber}
                placeholder="+2348012345678"
                handleChangeText={setPhoneNumber}
                otherStyles="mt-2"
                keyboardType="phone-pad"
              />
              {!!error && <Text className="text-red-400 text-sm mt-1">{error}</Text>}

              <CustomButton
                title="Call me to verify"
                handlePress={submit}
                containerStyles="w-full mt-6"
                isLoading={submitting}
              />

              <Text
                onPress={() => router.replace("/(tabs)/home")}
                style={{ color: "#CFCBFF", fontSize: 12, textAlign: "center", marginTop: 18, textDecorationLine: "underline" }}
              >
                Skip for now
              </Text>
            </>
          ) : (
            <View style={{ alignItems: "center" }}>
              <View style={{ height: 68, width: 68, borderRadius: 24, backgroundColor: "#5147AF", alignItems: "center", justifyContent: "center", marginBottom: 18 }}>
                <PhoneCall size={30} color="#FFF" />
              </View>
              <Text style={{ color: "#FFF", fontFamily: "Poppins-Medium", fontSize: 15, textAlign: "center" }}>
                Calling {phoneNumber} now…
              </Text>
              <Text style={{ color: "#CFCBFF", fontSize: 12.5, textAlign: "center", marginTop: 10, lineHeight: 19 }}>
                Answer the call and enter this code on your keypad when prompted:
              </Text>
              <Text style={{ color: "#FFF", fontFamily: "Poppins-Bold", fontSize: 32, letterSpacing: 6, marginTop: 12 }}>
                {validationCode}
              </Text>
              <ActivityIndicator color="#CFCBFF" style={{ marginTop: 24 }} />
              <Text style={{ color: "#9C97C4", fontSize: 11, textAlign: "center", marginTop: 10 }}>
                Waiting for you to enter the code on the call…
              </Text>

              <Text
                onPress={() => router.replace("/(tabs)/home")}
                style={{ color: "#CFCBFF", fontSize: 12, textAlign: "center", marginTop: 26, textDecorationLine: "underline" }}
              >
                Skip for now — I'll verify later
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
