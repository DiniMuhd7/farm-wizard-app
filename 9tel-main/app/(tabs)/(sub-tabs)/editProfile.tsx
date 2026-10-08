import { useEffect, useState } from "react";
import { router } from "expo-router";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { ArrowLeft, CircleAlert, CircleCheckBig, LockKeyhole, UserRound } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { useLoginContext } from "@/context/LoginProvider";
import { CustomButton, FormField } from "@/components";
import LanguageSwitching from "@/components/LanguageSwitching";
import { validateForm } from "../../../utils/validateForm";
import { updateUser } from "@/services/user";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { TAB_BAR_CLEARANCE } from "@/constants/layout";
import { themedStyles, themeColor, useThemeVersion } from "@/theme";
import { tr } from "@/utils/tr";

type FormErrors = {
  fullName?: string;
  password?: string;
  cpassword?: string;
};

type FeedbackState =
  | { type: "success"; message: string }
  | { type: "validation"; message: string }
  | { type: "error"; message: string }
  | null;

const EditProfile = () => {
  useThemeVersion();
  const { user, setUser } = useLoginContext();

  // Navigating away must happen in an effect, never directly during render.
  // The previous version called router.replace("/") inline in the
  // component body — on a render where `user` happened to be falsy (e.g.
  // the brief moment right after sign-out, before the redirect elsewhere
  // takes effect), that fires a navigation on every single render pass:
  // navigate away -> re-render -> still no user yet -> navigate away again
  // -> ... an unbounded loop that presents as a frozen, blank screen. This
  // exact bug was already found and fixed at the very start of this app's
  // cleanup (see app/index.jsx and app/(tabs)/_layout.jsx) — it just never
  // fired here specifically because nothing in the app linked to this
  // screen until now.
  useEffect(() => {
    if (!user) router.replace("/");
  }, [user]);

  const [isSubmitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const selectedIndex = user?.avatar || 0;

  const [form, setForm] = useState({
    fullName: user?.fullName || "",
    password: "",
    cpassword: "",
  });
  const { t } = useTranslation();

  if (!user) return null; // the effect above is already sending us elsewhere

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    if (feedback) setFeedback(null);
  };

  const handleUpdate = async () => {
    setFeedback(null);
    const { isValid, errors: validationErrors } = validateForm(
      {
        ...form,
        email: user.email || "placeholder@example.com", // guests have no email; not being edited here, so any valid-looking value satisfies the shared validator
        selectedCountry: "update",
        selectedLanguage: "update",
      },
      // Password fields are optional here — this is an edit, not
      // registration. Leaving them blank means "keep my current password",
      // not a validation error. If something WAS typed, it still has to
      // meet the normal password rules (validateForm handles that).
      { requirePassword: false }
    );
    if (!isValid) {
      setErrors(validationErrors);
      setFeedback({
        type: "validation",
        message: tr("Please fix the highlighted fields before saving your profile."),
      });
      return;
    }

    setErrors({});
    setSubmitting(true);
    const token = await AsyncStorage.getItem("token");
    if (token === null) {
      setFeedback({
        type: "error",
        message: tr("Your session expired. Please sign in again before saving changes."),
      });
      setSubmitting(false);
      return;
    }

    try {
      const result = await updateUser(
        token,
        form.fullName.trim(),
        form.password,
        selectedIndex
      );
      setUser(result.userDetails);
      setForm((f) => ({ ...f, fullName: result.userDetails?.fullName ?? f.fullName, password: "", cpassword: "" }));
      setFeedback({
        type: "success",
        message: result.message || tr("Your profile details were saved successfully."),
      });
    } catch (error: any) {
      console.log("error ", error);
      const serverMessage = error?.response?.data?.message;
      const message = serverMessage
        ? serverMessage
        : error?.request
          ? tr("We couldn't reach 9tel right now. Check your connection and try again.")
          : error?.message || tr("We couldn't save your profile right now.");
      setFeedback({
        type: "error",
        message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.page}>
        <View style={styles.header}>
          <Pressable accessibilityLabel={tr("Back to settings")} onPress={() => router.push("/(tabs)/(sub-tabs)/settings")} style={styles.back}>
            <ArrowLeft size={21} color={themeColor("#211B59")} />
          </Pressable>
          <Text style={styles.title}>{t("edit_profile")}</Text>
          <View style={styles.backPlaceholder} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.profileCard}>
            <Text style={styles.profileEyebrow}>{tr("9TEL ACCOUNT")}</Text>
            <View style={styles.avatar}><UserRound size={28} color={themeColor("#5147AF")} /></View>
            <Text style={styles.profileName}>{user.fullName}</Text>
            {!!user.email && <Text style={styles.email}>{user.email}</Text>}
            {user.isGuest && (
              <Text style={styles.guest}>{tr("Guest account · create an account to keep your number and call history.")}</Text>
            )}
          </View>

          {feedback && (
            <View
              style={[
                styles.feedbackCard,
                feedback.type === "success" && styles.feedbackSuccess,
                feedback.type === "validation" && styles.feedbackValidation,
                feedback.type === "error" && styles.feedbackError,
              ]}
            >
              {feedback.type === "success" ? (
                <CircleCheckBig size={18} color={themeColor("#1E7A4D")} />
              ) : (
                <CircleAlert size={18} color={feedback.type === "validation" ? "#8A5B00" : "#B04545"} />
              )}
              <Text
                style={[
                  styles.feedbackText,
                  feedback.type === "success" && styles.feedbackTextSuccess,
                  feedback.type === "validation" && styles.feedbackTextValidation,
                  feedback.type === "error" && styles.feedbackTextError,
                ]}
              >
                {feedback.message}
              </Text>
            </View>
          )}

          <Text style={styles.sectionTitle}>{tr("PREFERENCES")}</Text>
          <View style={styles.languageCard}>
            <Text style={styles.fieldTitle}>{tr("App language")}</Text>
            <LanguageSwitching />
          </View>

          <Text style={styles.sectionTitle}>{tr("PERSONAL DETAILS")}</Text>
          <View style={styles.formCard}>
            <FormField
              title={t("fullname")}
              placeholder={tr("Full name")}
              value={form.fullName}
              handleChangeText={(value) => updateField("fullName", value)}
              variant="light"
              autoCapitalize="words"
              autoCorrect={false}
              textContentType="name"
            />
            {errors.fullName && <Text style={styles.error}>{errors.fullName}</Text>}
          </View>

          <View style={styles.passwordHeading}>
            <View style={styles.passwordIcon}><LockKeyhole size={17} color={themeColor("#5147AF")} /></View>
            <View style={styles.passwordCopy}>
              <Text style={styles.passwordTitle}>{tr("Change password")}</Text>
              <Text style={styles.passwordHint}>{tr("Leave both fields blank to keep your current password.")}</Text>
            </View>
          </View>
          <View style={styles.formCard}>
            <FormField
              title={t("password")}
              placeholder={tr("New password (optional)")}
              value={form.password}
              handleChangeText={(value) => updateField("password", value)}
              secureTextEntry
              variant="light"
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="newPassword"
            />
            {errors.password && <Text style={styles.error}>{errors.password}</Text>}
            <FormField
              title={t("confirm_password")}
              placeholder={tr("Confirm new password")}
              value={form.cpassword}
              handleChangeText={(value) => updateField("cpassword", value)}
              otherStyles="mt-4"
              secureTextEntry
              variant="light"
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="password"
            />
            {errors.cpassword && <Text style={styles.error}>{errors.cpassword}</Text>}
          </View>

          <CustomButton
            title={t("buttons.save")}
            handlePress={handleUpdate}
            containerStyles="w-full"
            textStyles="font-pbold text-white"
            isLoading={isSubmitting}
            disabled={isSubmitting}
          />
          <Text style={styles.saveHint}>
            {isSubmitting
              ? tr("Saving your changes securely…")
              : tr("Your profile only updates after 9tel confirms the change.")}
          </Text>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const styles = themedStyles({
  safe: { flex: 1, backgroundColor: "#F8F8FD" },
  page: { flex: 1, paddingHorizontal: 20 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10 },
  back: { height: 43, width: 43, borderRadius: 15, backgroundColor: "#FFF", alignItems: "center", justifyContent: "center" },
  backPlaceholder: { width: 43 },
  title: { color: "#211B59", fontFamily: "Poppins-SemiBold", fontSize: 18 },
  content: { paddingBottom: TAB_BAR_CLEARANCE },
  profileCard: { backgroundColor: "#211B59", borderRadius: 24, alignItems: "center", padding: 22, marginTop: 12 },
  profileEyebrow: { color: "#DCD8FF", fontFamily: "Poppins-SemiBold", fontSize: 10, letterSpacing: 1, marginBottom: 14 },
  avatar: { height: 58, width: 58, borderRadius: 20, backgroundColor: "#EEECFF", alignItems: "center", justifyContent: "center" },
  profileName: { color: "#FFF", fontFamily: "Poppins-SemiBold", fontSize: 18, marginTop: 11 },
  email: { color: "#CFCBFF", fontFamily: "Poppins-Regular", fontSize: 11, marginTop: 2 },
  guest: { color: "#F5D9A8", fontFamily: "Poppins-Regular", fontSize: 10.5, lineHeight: 16, textAlign: "center", marginTop: 10 },
  feedbackCard: { flexDirection: "row", alignItems: "flex-start", gap: 10, borderRadius: 18, paddingHorizontal: 15, paddingVertical: 14, marginTop: 16, borderWidth: 1 },
  feedbackSuccess: { backgroundColor: "#EAF8EF", borderColor: "#CBE8D6" },
  feedbackValidation: { backgroundColor: "#FFF6DA", borderColor: "#F4D58B" },
  feedbackError: { backgroundColor: "#FDECEC", borderColor: "#F3C8C8" },
  feedbackText: { flex: 1, fontFamily: "Poppins-Medium", fontSize: 11.5, lineHeight: 17 },
  feedbackTextSuccess: { color: "#22583D" },
  feedbackTextValidation: { color: "#7A5608" },
  feedbackTextError: { color: "#8C2E2E" },
  sectionTitle: { color: "#8D899F", fontFamily: "Poppins-SemiBold", fontSize: 10, letterSpacing: 1, marginTop: 23, marginBottom: 8 },
  languageCard: { backgroundColor: "#FFF", borderRadius: 19, paddingHorizontal: 15, paddingTop: 14, overflow: "hidden" },
  fieldTitle: { color: "#514D66", fontFamily: "Poppins-Medium", fontSize: 12, paddingHorizontal: 5 },
  formCard: { backgroundColor: "#FFF", borderRadius: 19, padding: 15 },
  // Matches the error-text token used elsewhere (e.g. the number-purchase
  // flow in settings.tsx) rather than a one-off red.
  error: { color: "#D9534F", fontFamily: "Poppins-Regular", fontSize: 11, marginTop: 5 },
  passwordHeading: { flexDirection: "row", alignItems: "center", marginTop: 23, marginBottom: 10 },
  passwordIcon: { height: 34, width: 34, borderRadius: 12, backgroundColor: "#EEECFF", alignItems: "center", justifyContent: "center", marginRight: 10 },
  passwordCopy: { flex: 1 },
  passwordTitle: { color: "#211B59", fontFamily: "Poppins-SemiBold", fontSize: 13 },
  passwordHint: { color: "#85829B", fontFamily: "Poppins-Regular", fontSize: 10, marginTop: 2 },
  saveHint: { color: "#85829B", fontFamily: "Poppins-Regular", fontSize: 10.5, lineHeight: 16, textAlign: "center", marginTop: 10, marginHorizontal: 12 },
});

export default EditProfile;
