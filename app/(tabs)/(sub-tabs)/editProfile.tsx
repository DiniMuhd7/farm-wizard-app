import { useState } from "react";
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
  const { user, setUser, setIsLogged } = useLoginContext();
  if (!user) {
    router.replace("/");
  }

  const [isSubmitting, setSubmitting] = useState(false);
  interface FormErrors {
    fullName?: string;
    password?: string;
    cpassword?: string;
  }

  const [errors, setErrors] = useState<FormErrors>({});
  // The old avatar-picker UI is gone (it depended on avatar artwork that was
  // never committed to the repo); keep the field so updateUser's existing
  // signature doesn't need to change.
  const selectedIndex = user?.avatar || 0;

  const [form, setForm] = useState({
    fullName: user.fullName,
    password: "",
    cpassword: "",
  });
  const { t } = useTranslation();

  const handleUpdate = async () => {
    const { isValid, errors: validationErrors } = validateForm({
      ...form,
      email: user.email,
      selectedCountry: "update",
      selectedLanguage: "update",
    });
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
          // if (result.status !== 200 || result.success === false) {
          //   Alert.alert("Error", result.message);
          //   return;
          // }

          Alert.alert("Success", result.message);
          setUser(result.userDetails);
        } catch (error: any) {
          console.log("error ", error);
          Alert.alert("Error occured", error.message);
        } finally {
          setSubmitting(false);
        }
      }
    } else {
      setErrors(validationErrors); // display errors in UI
    }
  };

  return (
    <View className="flex-1 items-center justify-start" style={{ backgroundColor: "#211B59" }}>
      {/* Back Button */}
      <HeaderNavigation
        onLeftPress={() => router.push("/(tabs)/(sub-tabs)/settings")}
        onRightPress={() => null}
        LeftIcon={ArrowLeft}
        RightIcon={Settings}
        showLeftButton={true}
        showRightButton={false}
      />

      {/* Title */}
      <Text className="text-white text-2xl font-primary font-bold">
        {t("edit_profile")}
      </Text>
      <View className="w-full flex justify-center h-full px-4">
        <Text className="text-white text-xl font-primary text-center font-bold">
          {user.fullName}
        </Text>

        <LanguageSwitching />

        <ScrollView
          showsVerticalScrollIndicator={false}
          style={{ height: 200 }}
          //   className="max-h-10 p-2 border-r-4 border-r-[#E1CE67] mb-3"
        >
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

          <FormField
            title={t("password")}
            placeholder="Password"
            value={form.password}
            handleChangeText={(e: any) => setForm({ ...form, password: e })}
            otherStyles="mt-4"
          />
          {errors.password && (
            <Text className="text-red-400 text-sm mt-1">{errors.password}</Text>
          )}

          <FormField
            title={t("confirm_password")}
            placeholder="Confirm Password"
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
