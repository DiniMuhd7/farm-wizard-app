import { useEffect, useRef, useState } from "react";
import { router } from "expo-router";
import { ActivityIndicator, Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CheckCircle2, CircleAlert, PhoneCall, RefreshCcw, ShieldCheck, Sparkles } from "lucide-react-native";
import { CustomButton, FormField } from "../../components";
import { cancelCallerIdVerification, getCallerIdVerificationStatus, startCallerIdVerification } from "@/services/callerid";

const E164 = /^\+[1-9]\d{6,14}$/;
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 10 * 60 * 1000 + 5000;
const RESEND_COOLDOWN_SECONDS = 30;

const STEPS = [
  { id: "number", label: "Enter number" },
  { id: "call", label: "Answer call" },
  { id: "done", label: "Confirmed" },
];

export default function VerifyPhone() {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [verificationState, setVerificationState] = useState("entry");
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [verifiedNumber, setVerifiedNumber] = useState("");
  const [verificationMethod, setVerificationMethod] = useState("twilio");
  const [resendCooldown, setResendCooldown] = useState(0);
  const pollRef = useRef(null);
  const pollDeadlineRef = useRef(0);
  const redirectTimeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (redirectTimeoutRef.current) clearTimeout(redirectTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((current) => (current <= 1 ? 0 : current - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const resetToEntry = () => {
    stopPolling();
    if (redirectTimeoutRef.current) {
      clearTimeout(redirectTimeoutRef.current);
      redirectTimeoutRef.current = null;
    }
    setVerificationState("entry");
    setVerifiedNumber("");
    setStatusMessage("");
    setError("");
    setResendCooldown(0);
  };

  const startPolling = (expectedNumber) => {
    stopPolling();
    pollDeadlineRef.current = Date.now() + POLL_TIMEOUT_MS;
    pollRef.current = setInterval(async () => {
      if (Date.now() > pollDeadlineRef.current) {
        stopPolling();
        setVerificationState("failed");
        setError("This verification attempt expired. Request another call to try again.");
        setStatusMessage("Your number remains unverified until the server receives Twilio’s confirmation.");
        return;
      }
      try {
        const status = await getCallerIdVerificationStatus();
        if (status.callerIdStatus === "verified" && status.verifiedCallerId === expectedNumber) {
          stopPolling();
          setVerifiedNumber(status.verifiedCallerId);
          setVerificationMethod(status.method || "twilio");
          setVerificationState("success");
          setError("");
          setStatusMessage("Your verified caller ID is ready. Future outbound calls can show this number.");
          redirectTimeoutRef.current = setTimeout(() => {
            router.replace("/(tabs)/home");
          }, 2500);
        } else if (status.callerIdStatus === "failed" || status.callerIdStatus === "expired") {
          stopPolling();
          setVerificationState("failed");
          setError(status.callerIdStatus === "expired"
            ? "This verification attempt expired. Request another call to try again."
            : "The call did not confirm your number. Check that you entered the spoken code on the phone keypad, then retry.");
          setStatusMessage("Your caller ID is still unverified.");
        }
      } catch {
        // Transient status checks should not interrupt the in-progress state.
      }
    }, POLL_INTERVAL_MS);
  };

  useEffect(() => {
    let active = true;
    getCallerIdVerificationStatus()
      .then((status) => {
        if (!active) return;
        if (status.callerIdStatus === "pending" && status.phoneNumber) {
          setPhoneNumber(status.phoneNumber);
          setVerificationState("calling");
          setStatusMessage(`We’re calling ${status.phoneNumber}. Answer and enter the spoken code on your phone keypad.`);
          startPolling(status.phoneNumber);
        } else if (
          status.callerIdStatus === "verified" &&
          (status.verifiedCallerId || (status.method === "developer_test" && status.phoneNumber))
        ) {
          const verifiedNumber = status.verifiedCallerId || status.phoneNumber;
          setPhoneNumber(verifiedNumber);
          setVerifiedNumber(verifiedNumber);
          setVerificationMethod(status.method || "twilio");
          setVerificationState("success");
          setStatusMessage("Your verified caller ID is ready. Future outbound calls can show this number.");
        } else if (status.callerIdStatus === "failed" || status.callerIdStatus === "expired") {
          if (status.phoneNumber) setPhoneNumber(status.phoneNumber);
          setVerificationState("failed");
          setError(status.callerIdStatus === "expired"
            ? "This verification attempt expired. Request another call to try again."
            : "The call did not confirm your number. Check that you entered the spoken code on the phone keypad, then retry.");
          setStatusMessage("Your caller ID is still unverified.");
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const beginVerification = async (nextNumber = phoneNumber) => {
    const trimmed = nextNumber.trim();
    if (!E164.test(trimmed)) {
      setError("Enter your number in E.164 format, for example +2348012345678.");
      return;
    }

    setError("");
    setStatusMessage("");
    setSubmitting(true);
    try {
      const result = await startCallerIdVerification(trimmed);
      setPhoneNumber(trimmed);
      if (result.callerIdStatus === "verified") {
        setVerifiedNumber(trimmed);
        setVerificationMethod(result.method || "twilio");
        setVerificationState("success");
        setStatusMessage(result.message || "Developer test verification completed. No provider call was placed.");
      } else {
        setVerificationState("calling");
        setStatusMessage(result.message || `We’re calling ${trimmed}. Answer and enter the spoken code on your phone keypad.`);
        setResendCooldown(RESEND_COOLDOWN_SECONDS);
        startPolling(trimmed);
      }
    } catch (err) {
      const message = err?.message || "Unable to start verification right now.";
      setError(message);
      setVerificationState("entry");
    } finally {
      setSubmitting(false);
    }
  };

  const cancelAttempt = async () => {
    setSubmitting(true);
    setError("");
    try {
      await cancelCallerIdVerification();
      resetToEntry();
    } catch (err) {
      setError(err?.message || "Unable to cancel verification right now.");
    } finally {
      setSubmitting(false);
    }
  };

  const activeStep = verificationState === "success" ? 2 : verificationState === "calling" ? 1 : 0;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View
          style={styles.page}
        >
          <View style={styles.heroCard}>
            <View style={styles.heroBadge}>
              <Sparkles size={16} color="#DCD8FF" />
              <Text style={styles.heroBadgeText}>VERIFIED CALLER ID</Text>
            </View>
            <Text style={styles.title}>Verify your number</Text>
            <Text style={styles.subtitle}>
              Use your own number as caller ID on supported 9tel calls. Verification happens by automated voice call, never by a client-side-only confirmation.
            </Text>
          </View>

          <View style={styles.stepsCard}>
            {STEPS.map((step, index) => {
              const completed = index < activeStep;
              const active = index === activeStep;
              return (
                <View key={step.id} style={styles.stepItem}>
                  <View style={[styles.stepDot, completed && styles.stepDotDone, active && styles.stepDotActive]}>
                    {completed ? <CheckCircle2 size={14} color="#FFF" /> : <Text style={[styles.stepDotText, active && styles.stepDotTextActive]}>{index + 1}</Text>}
                  </View>
                  <Text style={[styles.stepLabel, active && styles.stepLabelActive]}>{step.label}</Text>
                </View>
              );
            })}
          </View>

          {verificationState === "entry" && (
            <View style={styles.contentCard}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionIcon}>
                  <PhoneCall size={18} color="#5147AF" />
                </View>
                <View style={styles.sectionCopy}>
                  <Text style={styles.sectionTitle}>Step 1 · Enter the number you want to show</Text>
                  <Text style={styles.sectionBody}>
                    Include the country code. Twilio will call this number. Answer and enter the spoken code using your phone keypad.
                  </Text>
                </View>
              </View>

              <FormField
                title="Phone number"
                value={phoneNumber}
                placeholder="+2348012345678"
                handleChangeText={(value) => {
                  setPhoneNumber(value);
                  if (error) setError("");
                }}
                otherStyles="mt-2"
                keyboardType="phone-pad"
                autoComplete="tel"
                textContentType="telephoneNumber"
                autoCorrect={false}
                autoCapitalize="none"
              />

              {!!error && (
                <View style={[styles.statusCard, styles.statusError]}>
                  <CircleAlert size={17} color="#B04545" />
                  <Text style={[styles.statusText, styles.statusTextError]}>{error}</Text>
                </View>
              )}

              <CustomButton
                title="Call me to verify"
                handlePress={() => beginVerification()}
                containerStyles="w-full mt-6"
                isLoading={submitting}
                disabled={submitting}
              />

              <Text style={styles.helpText}>
                We only mark your number verified after the server receives Twilio’s confirmation callback.
              </Text>

              <Pressable accessibilityRole="button" onPress={() => router.replace("/(tabs)/home")} style={styles.skipLink}>
                <Text style={styles.skipLinkText}>Skip for now</Text>
              </Pressable>
            </View>
          )}

          {verificationState === "calling" && (
            <View style={styles.contentCard}>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionIcon, styles.sectionIconActive]}>
                  <PhoneCall size={18} color="#FFF" />
                </View>
                <View style={styles.sectionCopy}>
                  <Text style={styles.sectionTitle}>Step 2 · Answer the call</Text>
                  <Text style={styles.sectionBody}>
                    Follow the spoken instructions and enter the code on your phone keypad. The app never displays or logs the code.
                  </Text>
                </View>
              </View>

              {!!statusMessage && (
                <View style={[styles.statusCard, styles.statusInfo]}>
                  <ActivityIndicator color="#5147AF" size="small" />
                  <Text style={styles.statusText}>{statusMessage}</Text>
                </View>
              )}

              {!!error && (
                <View style={[styles.statusCard, styles.statusError]}>
                  <CircleAlert size={17} color="#B04545" />
                  <Text style={[styles.statusText, styles.statusTextError]}>{error}</Text>
                </View>
              )}

              <View style={styles.actionRow}>
                <Pressable
                  accessibilityRole="button"
                  disabled={submitting || resendCooldown > 0}
                  onPress={() => beginVerification(phoneNumber)}
                  style={[styles.secondaryButton, (submitting || resendCooldown > 0) && styles.secondaryButtonDisabled]}
                >
                  <RefreshCcw size={16} color="#5147AF" />
                  <Text style={styles.secondaryButtonText}>
                    {resendCooldown > 0 ? `Call again in ${resendCooldown}s` : "Call again"}
                  </Text>
                </Pressable>

                <Pressable accessibilityRole="button" disabled={submitting} onPress={cancelAttempt} style={styles.ghostButton}>
                  <Text style={styles.ghostButtonText}>Cancel call</Text>
                </Pressable>
              </View>

              <Text style={styles.helpText}>
                Canceling invalidates this attempt; it cannot stop a provider call that has already started.
              </Text>
              <Pressable accessibilityRole="button" onPress={() => router.replace("/(tabs)/home")} style={styles.skipLink}>
                <Text style={styles.skipLinkText}>I&apos;ll verify later</Text>
              </Pressable>
            </View>
          )}

          {verificationState === "failed" && (
            <View style={styles.contentCard}>
              <View style={[styles.statusCard, styles.statusError]}>
                <CircleAlert size={17} color="#B04545" />
                <Text style={[styles.statusText, styles.statusTextError]}>{error}</Text>
              </View>
              <Text style={styles.sectionBody}>
                {statusMessage || "Your caller ID stays unverified until Twilio confirms the call. You can safely request a new call."}
              </Text>
              <CustomButton
                title="Try again"
                handlePress={() => beginVerification(phoneNumber)}
                containerStyles="w-full mt-6"
                isLoading={submitting}
                disabled={submitting || resendCooldown > 0}
              />
              <Pressable accessibilityRole="button" onPress={resetToEntry} style={styles.ghostButton}>
                <Text style={styles.ghostButtonText}>Change number</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => router.replace("/(tabs)/home")} style={styles.skipLink}>
                <Text style={styles.skipLinkText}>Verify later</Text>
              </Pressable>
            </View>
          )}

          {verificationState === "success" && (
            <View style={styles.contentCard}>
              <View style={styles.successIcon}>
                <ShieldCheck size={28} color="#1E7A4D" />
              </View>
              <Text style={styles.successTitle}>
                {verificationMethod === "developer_test" ? "Developer test complete" : "Number verified"}
              </Text>
              <Text style={styles.successBody}>
                {verificationMethod === "developer_test"
                  ? `${verifiedNumber || phoneNumber} is allowlisted for this local/test run. Outbound calls continue to use the configured Twilio caller ID.`
                  : `${verifiedNumber || phoneNumber} is now ready to use as your caller ID when supported by the service.`}
              </Text>

              <View style={[styles.statusCard, styles.statusSuccess]}>
                <CheckCircle2 size={17} color="#1E7A4D" />
                <Text style={[styles.statusText, styles.statusTextSuccess]}>{statusMessage}</Text>
              </View>

              <CustomButton
                title="Continue to 9tel"
                handlePress={() => router.replace("/(tabs)/home")}
                containerStyles="w-full mt-6"
              />

              <Pressable accessibilityRole="button" onPress={resetToEntry} style={styles.ghostButton}>
                <Text style={styles.ghostButtonText}>Verify a different number</Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F8F8FD" },
  scroll: { flexGrow: 1 },
  page: {
    minHeight: Dimensions.get("window").height - 48,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 36,
  },
  heroCard: {
    backgroundColor: "#211B59",
    borderRadius: 24,
    padding: 22,
  },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    alignSelf: "flex-start",
  },
  heroBadgeText: {
    color: "#DCD8FF",
    fontFamily: "Poppins-SemiBold",
    fontSize: 10,
    letterSpacing: 0.9,
  },
  title: {
    color: "#FFF",
    fontFamily: "Poppins-SemiBold",
    fontSize: 28,
    marginTop: 14,
  },
  subtitle: {
    color: "#D0CCFC",
    fontFamily: "Poppins-Regular",
    fontSize: 12,
    lineHeight: 19,
    marginTop: 8,
  },
  stepsCard: {
    backgroundColor: "#FFF",
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 12,
    marginTop: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  stepItem: {
    flex: 1,
    alignItems: "center",
    gap: 8,
  },
  stepDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#F1F0F6",
    alignItems: "center",
    justifyContent: "center",
  },
  stepDotActive: {
    backgroundColor: "#EEECFF",
    borderWidth: 1,
    borderColor: "#5147AF",
  },
  stepDotDone: {
    backgroundColor: "#3A9B70",
  },
  stepDotText: {
    color: "#85829B",
    fontFamily: "Poppins-SemiBold",
    fontSize: 12,
  },
  stepDotTextActive: {
    color: "#5147AF",
  },
  stepLabel: {
    color: "#85829B",
    fontFamily: "Poppins-Medium",
    fontSize: 11,
    textAlign: "center",
  },
  stepLabelActive: {
    color: "#211B59",
  },
  contentCard: {
    backgroundColor: "#FFF",
    borderRadius: 24,
    padding: 18,
    marginTop: 18,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  sectionIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: "#EEECFF",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionIconActive: {
    backgroundColor: "#5147AF",
  },
  sectionCopy: {
    flex: 1,
  },
  sectionTitle: {
    color: "#211B59",
    fontFamily: "Poppins-SemiBold",
    fontSize: 14,
  },
  sectionBody: {
    color: "#85829B",
    fontFamily: "Poppins-Regular",
    fontSize: 11,
    lineHeight: 17,
    marginTop: 4,
  },
  statusCard: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  statusInfo: {
    backgroundColor: "#F3F1FF",
  },
  statusError: {
    backgroundColor: "#FDECEC",
    borderWidth: 1,
    borderColor: "#F3C8C8",
  },
  statusSuccess: {
    backgroundColor: "#EAF8EF",
    borderWidth: 1,
    borderColor: "#CBE8D6",
  },
  statusText: {
    flex: 1,
    color: "#514D66",
    fontFamily: "Poppins-Medium",
    fontSize: 11.5,
    lineHeight: 17,
  },
  statusTextError: {
    color: "#8C2E2E",
  },
  statusTextSuccess: {
    color: "#22583D",
  },
  helpText: {
    color: "#85829B",
    fontFamily: "Poppins-Regular",
    fontSize: 10.5,
    lineHeight: 16,
    textAlign: "center",
    marginTop: 10,
  },
  skipLink: {
    alignItems: "center",
    marginTop: 18,
  },
  skipLinkText: {
    color: "#5147AF",
    fontFamily: "Poppins-Medium",
    fontSize: 12,
    textDecorationLine: "underline",
  },
  actionRow: {
    gap: 10,
    marginTop: 16,
  },
  secondaryButton: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: "#EEECFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 14,
  },
  secondaryButtonDisabled: {
    opacity: 0.6,
  },
  secondaryButtonText: {
    color: "#5147AF",
    fontFamily: "Poppins-SemiBold",
    fontSize: 12,
  },
  ghostButton: {
    minHeight: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E0DEED",
    paddingHorizontal: 14,
  },
  ghostButtonText: {
    color: "#514D66",
    fontFamily: "Poppins-SemiBold",
    fontSize: 12,
  },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: "#EAF8EF",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  successTitle: {
    color: "#211B59",
    fontFamily: "Poppins-SemiBold",
    fontSize: 20,
    textAlign: "center",
    marginTop: 16,
  },
  successBody: {
    color: "#85829B",
    fontFamily: "Poppins-Regular",
    fontSize: 11.5,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 8,
  },
});
