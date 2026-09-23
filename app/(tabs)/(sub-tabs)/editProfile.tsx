import { useEffect, useState } from "react";
import { router } from "expo-router";
import { View, Text, ScrollView, Dimensions, Alert } from "react-native";
import { ArrowLeft, Settings } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { useLoginContext } from "@/context/LoginProvider";
import { CustomButton, FormField } from "@/components";
import HeaderNavigation from "@/components/HeaderNavigation";
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
    <View className="flex-1 items-center justify-start" style={{ backgroundColor: "#211B59" }}>
      <HeaderNavigation
        onLeftPress={() => router.push("/(tabs)/(sub-tabs)/settings")}
        onRightPress={() => null}
        LeftIcon={ArrowLeft}
        RightIcon={Settings}
        showLeftButton={true}
        showRightButton={false}
      />

      <Text className="text-white text-2xl font-primary font-bold">
        {t("edit_profile")}
      </Text>
      <View className="w-full flex justify-center h-full px-4">
        <Text className="text-white text-xl font-primary text-center font-bold">
          {user.fullName}
        </Text>
        {!!user.email && (
          <Text style={{ color: "#B9B4E8", fontSize: 12.5, textAlign: "center", marginTop: 4 }}>
            {user.email}
          </Text>
        )}
        {user.isGuest && (
          <Text style={{ color: "#E3B77A", fontSize: 11.5, textAlign: "center", marginTop: 4 }}>
            Guest account — create a full account to keep access to your number and history.
          </Text>
        )}

        <LanguageSwitching />

        <ScrollView showsVerticalScrollIndicator={false} style={{ height: 260 }}>
          <FormField
            title={t("fullname")}
            placeholder="Full name"
            value={form.fullName}
            handleChangeText={(e: any) => setForm({ ...form, fullName: e })}
            otherStyles="mt-4"
          />
          {errors.fullName && (
            <Text className="text-red-400 text-sm mt-1">{errors.fullName}</Text>
          )}

          <Text style={{ color: "#8B86B8", fontSize: 11, marginTop: 18 }}>
            Leave the fields below blank to keep your current password.
          </Text>

          <FormField
            title={t("password")}
            placeholder="New password (optional)"
            value={form.password}
            handleChangeText={(e: any) => setForm({ ...form, password: e })}
            otherStyles="mt-2"
          />
          {errors.password && (
            <Text className="text-red-400 text-sm mt-1">{errors.password}</Text>
          )}

          <FormField
            title={t("confirm_password")}
            placeholder="Confirm new password"
            value={form.cpassword}
            handleChangeText={(e: any) => setForm({ ...form, cpassword: e })}
            otherStyles="mt-4"
          />
          {errors.cpassword && (
            <Text className="text-red-400 text-sm mt-1">
              {errors.cpassword}
            </Text>
          )}

          <CustomButton
            title={t("buttons.save")}
            handlePress={handleUpdate}
            containerStyles="w-full"
            textStyles={"font-pbold text-white"}
            isLoading={isSubmitting}
          />
        </ScrollView>
      </View>
    </View>
  );
};

export default EditProfile;
