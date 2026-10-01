import { useEffect, useState } from "react";
import { router } from "expo-router";
import { View, Text, ScrollView, Alert, Pressable, StyleSheet } from "react-native";
import { ArrowLeft, LockKeyhole, UserRound } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { useLoginContext } from "@/context/LoginProvider";
import { CustomButton, FormField } from "@/components";
import LanguageSwitching from "@/components/LanguageSwitching";
import { validateForm } from "../../../utils/validateForm";
import { updateUser } from "@/services/user";
import AsyncStorage from "@react-native-async-storage/async-storage";

const EditProfile = () => {
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
  interface FormErrors {
    fullName?: string;
    password?: string;
    cpassword?: string;
  }

  const [errors, setErrors] = useState<FormErrors>({});
  const selectedIndex = user?.avatar || 0;

  const [form, setForm] = useState({
    fullName: user?.fullName || "",
    password: "",
    cpassword: "",
  });
  const { t } = useTranslation();

  if (!user) return null; // the effect above is already sending us elsewhere

  const handleUpdate = async () => {
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
    if (isValid) {
      setSubmitting(true);
      const token = await AsyncStorage.getItem("token");
      if (token !== null) {
        try {
          const result = await updateUser(
            token,
            form.fullName,
            form.password,
            selectedIndex
          );
          Alert.alert("Success", result.message);
          setUser(result.userDetails);
          setForm((f) => ({ ...f, password: "", cpassword: "" }));
        } catch (error: any) {
          console.log("error ", error);
          Alert.alert("Error occured", error.message);
        } finally {
          setSubmitting(false);
        }
      }
    } else {
      setErrors(validationErrors);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.page}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="Back to settings" onPress={() => router.push("/(tabs)/(sub-tabs)/settings")} style={styles.back}>
            <ArrowLeft size={21} color="#211B59" />
          </Pressable>
          <Text style={styles.title}>{t("edit_profile")}</Text>
          <View style={styles.backPlaceholder} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.profileCard}>
            <View style={styles.avatar}><UserRound size={28} color="#5147AF" /></View>
            <Text style={styles.profileName}>{user.fullName}</Text>
            {!!user.email && <Text style={styles.email}>{user.email}</Text>}
            {user.isGuest && (
              <Text style={styles.guest}>Guest account · create an account to keep your number and call history.</Text>
            )}
          </View>

          <Text style={styles.sectionTitle}>PREFERENCES</Text>
          <View style={styles.languageCard}>
            <Text style={styles.fieldTitle}>App language</Text>
            <LanguageSwitching />
          </View>

          <Text style={styles.sectionTitle}>PERSONAL DETAILS</Text>
          <View style={styles.formCard}>
            <FormField
              title={t("fullname")}
              placeholder="Full name"
              value={form.fullName}
              handleChangeText={(e: any) => setForm({ ...form, fullName: e })}
              variant="light"
            />
            {errors.fullName && <Text style={styles.error}>{errors.fullName}</Text>}
          </View>

          <View style={styles.passwordHeading}>
            <View style={styles.passwordIcon}><LockKeyhole size={17} color="#5147AF" /></View>
            <View style={styles.passwordCopy}>
              <Text style={styles.passwordTitle}>Change password</Text>
              <Text style={styles.passwordHint}>Leave both fields blank to keep your current password.</Text>
            </View>
          </View>
          <View style={styles.formCard}>
            <FormField
              title={t("password")}
              placeholder="New password (optional)"
              value={form.password}
              handleChangeText={(e: any) => setForm({ ...form, password: e })}
              secureTextEntry
              variant="light"
            />
            {errors.password && <Text style={styles.error}>{errors.password}</Text>}
            <FormField
              title={t("confirm_password")}
              placeholder="Confirm new password"
              value={form.cpassword}
              handleChangeText={(e: any) => setForm({ ...form, cpassword: e })}
              otherStyles="mt-4"
              secureTextEntry
              variant="light"
            />
            {errors.cpassword && <Text style={styles.error}>{errors.cpassword}</Text>}
          </View>

          <CustomButton
            title={t("buttons.save")}
            handlePress={handleUpdate}
            containerStyles="w-full"
            textStyles="font-pbold text-white"
            isLoading={isSubmitting}
          />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F8F8FD" },
  page: { flex: 1, paddingHorizontal: 20 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10 },
  back: { height: 43, width: 43, borderRadius: 15, backgroundColor: "#FFF", alignItems: "center", justifyContent: "center" },
  backPlaceholder: { width: 43 },
  title: { color: "#211B59", fontFamily: "Poppins-SemiBold", fontSize: 18 },
  content: { paddingBottom: 36 },
  profileCard: { backgroundColor: "#211B59", borderRadius: 24, alignItems: "center", padding: 22, marginTop: 12 },
  avatar: { height: 58, width: 58, borderRadius: 20, backgroundColor: "#EEECFF", alignItems: "center", justifyContent: "center" },
  profileName: { color: "#FFF", fontFamily: "Poppins-SemiBold", fontSize: 18, marginTop: 11 },
  email: { color: "#CFCBFF", fontFamily: "Poppins-Regular", fontSize: 11, marginTop: 2 },
  guest: { color: "#F5D9A8", fontFamily: "Poppins-Regular", fontSize: 10.5, lineHeight: 16, textAlign: "center", marginTop: 10 },
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
});

export default EditProfile;
