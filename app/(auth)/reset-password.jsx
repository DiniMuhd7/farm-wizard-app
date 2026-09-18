import { useState } from "react";
import { Link, router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { View, Text, ScrollView, Dimensions, Alert } from "react-native";

import { CustomButton, FormField } from "../../components";
import { resetPassword } from "../../services/auth";
import { useTranslation } from "react-i18next";
import { validateForm } from "../../utils/validateForm";

const ResetPassword = () => {
    const [isSubmitting, setSubmitting] = useState(false);
    const [form, setForm] = useState({
        password: "",
        cpassword: ""
    });
    const [errors, setErrors] = useState({});
    const { email, code } = useLocalSearchParams();
    if (!email || !code) {
        Alert.alert('Error', 'Email or code Is missing')
        router.replace("/(auth)/sign-in")
    }

    const submit = async () => {
        const { isValid, errors: validationErrors } = validateForm({
            ...form,
            email: 'resetpassword@norreplay.com',
            fullName: 'reset-password',
            selectedCountry: "reset-password",
            selectedLanguage: "reset-password",
        });
        if (isValid) {
            setSubmitting(true);
            try {
                const result = await resetPassword(email, code, form.password);

                if (result.status !== 200) {
                    Alert.alert("Error result", result.message)
                    return;
                }
                Alert.alert("Success", "Password Reset sucessfully, Sign in to continue");
                router.replace("/(auth)/sign-in");
            } catch (error) {
                Alert.alert("Error0", error.message);
            } finally {
                setSubmitting(false);
            }
        } else {

            setErrors(validationErrors); // display errors in UI
        }
    };

    const { t } = useTranslation();
    return (
        <SafeAreaView className="bg-primary h-full" style={{ backgroundColor: "#211B59" }}>
            <ScrollView>
                <View
                    className="w-full flex justify-center h-full px-4 my-6"
                    style={{
                        minHeight: Dimensions.get("window").height - 100,
                    }}
                >
                    <Text className="text-white text-3xl font-primary text-center mb-2">
                        9tel
                    </Text>

                    <Text className="text-[18px] text-center font-semibold text-white mt-10 font-secondary">
                        Enter new password to reset your account password
                    </Text>

                    <FormField
                        title={t("password")}
                        placeholder="Password"
                        value={form.password}
                        handleChangeText={(e) => setForm({ ...form, password: e })}
                        otherStyles="mt-2"
                    />
                    {errors.password && <Text className="text-red-400 text-sm mt-1">{errors.password}</Text>}

                    <FormField
                        title={t("confirm_password")}
                        placeholder="Confirm Password"
                        value={form.cpassword}
                        handleChangeText={(e) => setForm({ ...form, cpassword: e })}
                        otherStyles="mt-2"
                    />
                    {errors.cpassword && <Text className="text-red-400 text-sm mt-1">{errors.cpassword}</Text>}

                    <CustomButton
                        title={t("buttons.submit")}
                        handlePress={submit}
                        containerStyles="w-full"
                        isLoading={isSubmitting}
                    />

                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

export default ResetPassword;
