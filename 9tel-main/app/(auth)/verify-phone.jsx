import { useEffect, useRef, useState } from "react";
import { router } from "expo-router";
import { ActivityIndicator, Dimensions, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CheckCircle2, CircleAlert, PhoneCall, RefreshCcw, ShieldCheck, Sparkles } from "lucide-react-native";
import { CustomButton, FormField } from "../../components";
import { cancelCallerIdVerification, getCallerIdVerificationStatus, startCallerIdVerification, submitCallerIdCode } from "@/services/callerid";

const E164 = /^\+[1-9]\d{6,14}$/;
const POLL_INTERVAL_MS = 3000;
const CODE_LENGTH = 6;
const DEFAULT_TTL_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_SECONDS = 30;

const STEPS = [
  { id: "number", label: "Enter number" },
  { id: "call", label: "Listen & enter code" },
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
  // The code the person heard on the call. Held in component state only while
  // typing; never persisted, logged or sent anywhere but the verify request.
  const [enteredCode, setEnteredCode] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [attemptsRemaining, setAttemptsRemaining] = useState(null);
  const pollRef = useRef(null);
  const expiresAtRef = useRef(0);
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

  useEffect(() => {
    if (verificationState !== "calling") return;
    const tick = () => setSecondsLeft(Math.max(0, Math.ceil((expiresAtRef.current - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [verificationState]);

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
    setEnteredCode("");
    setAttemptsRemaining(null);
    setVerifiedNumber("");
    setStatusMessage("");
    setError("");
    setResendCooldown(0);
  };

  const showVerified = (number, method) => {
    stopPolling();
    setEnteredCode("");
    setVerifiedNumber(number);
    setVerificationMethod(method || "spoken_code");
    setVerificationState("success");
    setError("");
    setStatusMessage("Your number is verified.");
    redirectTimeoutRef.current = setTimeout(() => {
      router.replace("/(tabs)/dialer");
    }, 2500);
  };

  const showFailed = (callerIdStatus) => {
    stopPolling();
    setEnteredCode("");
    setVerificationState("failed");
    setError(
      callerIdStatus === "expired"
        ? "This code expired. Request a new call to get a new code."
        : "The verification could not be completed. Request a new call to try again."
    );
    setStatusMessage("Your caller ID is still unverified. You can still place calls.");
  };

  // The backend is the only authority on state. Polling picks up expiry,
  // provider call failures, and a verification completed elsewhere.
  const startPolling = (expectedNumber) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const status = await getCallerIdVerificationStatus();
        // Ignore a response that lands after polling was stopped (e.g. the
        // code was just accepted), so a stale poll cannot undo the result.
        if (!pollRef.current) return;
        if (status.callerIdStatus === "verified" && status.verifiedCallerId === expectedNumber) {
          showVerified(status.verifiedCallerId, status.method);
        } else if (status.callerIdStatus === "failed" || status.callerIdStatus === "expired") {
          showFailed(status.callerIdStatus);
        } else if (status.callerIdStatus === "pending" && typeof status.attemptsRemaining === "number") {
          setAttemptsRemaining(status.attemptsRemaining);
        } else if (status.callerIdStatus === "unverified") {
          resetToEntry();
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
          expiresAtRef.current = status.expiresAt ? new Date(status.expiresAt).getTime() : Date.now() + DEFAULT_TTL_MS;
          if (typeof status.attemptsRemaining === "number") setAttemptsRemaining(status.attemptsRemaining);
          setVerificationState("calling");
          setStatusMessage(`Enter the ${CODE_LENGTH}-digit code spoken on the call to ${status.phoneNumber}.`);
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
          setStatusMessage("Your number is verified.");
        } else if (status.callerIdStatus === "failed" || status.callerIdStatus === "expired") {
          if (status.phoneNumber) setPhoneNumber(status.phoneNumber);
          showFailed(status.callerIdStatus);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const beginVerification = async (nextNumber = phoneNumber, replacePending = false) => {
    const trimmed = nextNumber.trim();
    if (!E164.test(trimmed)) {
      setError("Enter your number in E.164 format, for example +2348012345678.");
      return;
    }

    setError("");
    setStatusMessage("");
    setSubmitting(true);
    try {
      if (replacePending) await cancelCallerIdVerification();
      const result = await startCallerIdVerification(trimmed);
      setPhoneNumber(trimmed);
      if (result.callerIdStatus === "verified") {
        setVerifiedNumber(trimmed);
        setVerificationMethod(result.method || "twilio");
        setVerificationState("success");
        setStatusMessage(result.message || "Developer test verification completed. No provider call was placed.");
      } else {
        expiresAtRef.current = result.expiresAt ? new Date(result.expiresAt).getTime() : Date.now() + DEFAULT_TTL_MS;
        setEnteredCode("");
        setAttemptsRemaining(null);
        setVerificationState("calling");
        setStatusMessage(result.message || `We’re calling ${trimmed}. Answer, listen for the code, then enter it here.`);
        setResendCooldown(RESEND_COOLDOWN_SECONDS);
        startPolling(trimmed);
      }
    } catch (err) {
      const message = err?.message || "Unable to start verification right now.";
      setError(message);
      if (err?.code === "resend_cooldown" || err?.code === "verification_pending") {
        setResendCooldown(RESEND_COOLDOWN_SECONDS);
      } else {
        setVerificationState("entry");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const submitCode = async () => {
    if (!new RegExp(`^\\d{${CODE_LENGTH}}$`).test(enteredCode) || submitting) {
      setError(`Enter the ${CODE_LENGTH}-digit code you heard on the call.`);
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const result = await submitCallerIdCode(enteredCode);
      // Refresh from the server so the UI reflects persisted state.
      const status = await getCallerIdVerificationStatus().catch(() => null);
      showVerified(status?.verifiedCallerId || result.verifiedCallerId || phoneNumber, status?.method || result.method);
    } catch (err) {
      setEnteredCode("");
      if (typeof err?.attemptsRemaining === "number") setAttemptsRemaining(err.attemptsRemaining);
      if (err?.code === "verification_expired") {
        showFailed("expired");
      } else if (err?.code === "too_many_attempts") {
        showFailed("failed");
        setError("Too many incorrect codes. Request a new call to get a new code.");
      } else if (err?.code === "no_active_verification") {
        // Another request may already have completed this session.
        const status = await getCallerIdVerificationStatus().catch(() => null);
        if (status?.callerIdStatus === "verified" && status.verifiedCallerId) {
          showVerified(status.verifiedCallerId, status.method);
        } else {
          showFailed("failed");
        }
      } else {
        setError(err?.message || "Unable to verify that code right now. Try again.");
      }
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
              Use your own number as caller ID on supported 9tel calls. We call your number and speak a one-time code; you enter it here. Only our server can confirm it.
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
                    Include the country code. We will call this number and speak a 6-digit code. Then enter that code here in the app.
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
                variant="light"
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
                Your number is only marked verified after our server checks the code you enter. Verification is optional; you can still place calls without it.
              </Text>

              <Pressable accessibilityRole="button" onPress={() => router.replace("/(tabs)/dialer")} style={styles.skipLink}>
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
                  <Text style={styles.sectionTitle}>Step 2 · Listen and enter the code</Text>
                  <Text style={styles.sectionBody}>
                    Answer the call and listen for the 6-digit code (it is repeated once). The code is never shown on screen.
                  </Text>
                </View>
              </View>

              <TextInput
                style={styles.codeInput}
                value={enteredCode}
                onChangeText={(value) => {
                  setEnteredCode(value.replace(/\D/g, "").slice(0, CODE_LENGTH));
                  if (error) setError("");
                }}
                placeholder="------"
                placeholderTextColor="#B9B6CF"
                keyboardType="number-pad"
                maxLength={CODE_LENGTH}
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                autoCorrect={false}
                secureTextEntry={false}
                editable={!submitting && secondsLeft > 0}
                accessibilityLabel="Verification code from the call"
                onSubmitEditing={submitCode}
              />
              <Text style={styles.codeHint}>
                {secondsLeft > 0
                  ? `Code expires in ${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}${
                      attemptsRemaining !== null ? ` · ${attemptsRemaining} ${attemptsRemaining === 1 ? "try" : "tries"} left` : ""
                    }`
                  : "This code has expired. Tap “Call again” for a new one."}
              </Text>

              <CustomButton
                title="Verify code"
                handlePress={submitCode}
                containerStyles="w-full mt-4"
                isLoading={submitting}
                disabled={submitting || enteredCode.length !== CODE_LENGTH || secondsLeft <= 0}
              />

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
                  onPress={() => beginVerification(phoneNumber, true)}
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
                Canceling invalidates this code; it cannot stop a call that has already started.
              </Text>
              <Pressable accessibilityRole="button" onPress={() => router.replace("/(tabs)/dialer")} style={styles.skipLink}>
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
                {statusMessage || "Your caller ID stays unverified until you enter a valid code. You can safely request a new call."}
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
              <Pressable accessibilityRole="button" onPress={() => router.replace("/(tabs)/dialer")} style={styles.skipLink}>
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
                  : `${verifiedNumber || phoneNumber} is verified as yours. Calls keep showing 9tel's shared number until the voice provider approves your number as an outbound caller ID.`}
              </Text>

              <View style={[styles.statusCard, styles.statusSuccess]}>
                <CheckCircle2 size={17} color="#1E7A4D" />
                <Text style={[styles.statusText, styles.statusTextSuccess]}>{statusMessage}</Text>
              </View>

              <CustomButton
                title="Continue to 9tel"
                handlePress={() => router.replace("/(tabs)/dialer")}
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
  codeInput: {
    backgroundColor: "#EFEDFF",
    borderRadius: 16,
    paddingVertical: 14,
    marginTop: 12,
    textAlign: "center",
    color: "#211B59",
    fontFamily: "Poppins-SemiBold",
    fontSize: 32,
    letterSpacing: 10,
  },
  codeHint: { color: "#6B6785", fontFamily: "Poppins-Regular", fontSize: 12, marginTop: 8, textAlign: "center" },
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
