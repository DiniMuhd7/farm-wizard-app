import { useState } from "react";
import { Link, router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, Mail, ShieldCheck } from "lucide-react-native";
import { View, Text, ScrollView, Alert, Pressable, StyleSheet } from "react-native";

import { CustomButton, FormField } from "../../components";

import { forgetPassword } from "../../services/auth";
import { useTranslation } from "react-i18next";

const ForgotPassword = () => {
    const [isSubmitting, setSubmitting] = useState(false);
    const [form, setForm] = useState({
        email: "",
    });

    const submit = async () => {
        if (form.email === "") {
            Alert.alert("Error", "Please fill in all fields");
            return;
        }
        setSubmitting(true);

        try {
            const result = await forgetPassword(form.email.toLowerCase());
            //console.log("result ", result)
            if (!result) {
                Alert.alert("Error", "User Not Found");
                return
            }
            if (result.data.success === false) {
                Alert.alert("Error", result.data.message)
                return;
            }

            Alert.alert("Success", "OTP Sent to your email");
            router.replace({
                pathname: "/(auth)/otp-validation",
                params: { email: form.email.toLowerCase() },
            })

        } catch (error) {
            Alert.alert("Error", error.message);
        } finally {
            setSubmitting(false);
        }
    };
    const { t } = useTranslation();
    return (
        <SafeAreaView style={styles.safe}>
            <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
                <Pressable accessibilityLabel="Back to sign in" onPress={() => router.back()} style={styles.back}>
                    <ArrowLeft size={21} color="#211B59" />
                </Pressable>
                <View style={styles.brand}><Text style={styles.brandText}>9tel</Text></View>
                <View style={styles.icon}><Mail size={27} color="#5147AF" /></View>
                <Text style={styles.title}>Forgot password?</Text>
                <Text style={styles.copy}>
                    Enter the email address linked to your account. We’ll send a verification code to help you reset your password.
                </Text>

                <View style={styles.form}>
                    <FormField
                        title={t("email")}
                        placeholder="you@example.com"
                        value={form.email}
                        handleChangeText={(e) => setForm({ ...form, email: e })}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        variant="auth"
                    />
                    <CustomButton
                        title={t("buttons.submit")}
                        handlePress={submit}
                        containerStyles="w-full"
                        isLoading={isSubmitting}
                    />
                </View>
                <View style={styles.security}>
                    <ShieldCheck size={17} color="#5147AF" />
                    <Text style={styles.securityText}>Your account details stay private and secure.</Text>
                </View>
                <View style={styles.footer}>
                    <Text style={styles.footerText}>Remember your password? </Text>
                    <Link href="/sign-in" style={styles.link}>Sign in</Link>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: "#F8F8FD" },
    page: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 30 },
    back: { height: 44, width: 44, borderRadius: 15, backgroundColor: "#FFF", alignItems: "center", justifyContent: "center" },
    brand: { marginTop: 25 },
    brandText: { color: "#211B59", fontFamily: "Poppins-Bold", fontSize: 24, letterSpacing: -1 },
    icon: { height: 62, width: 62, borderRadius: 21, backgroundColor: "#EEECFF", alignItems: "center", justifyContent: "center", marginTop: 46 },
    title: { color: "#211B59", fontFamily: "Poppins-SemiBold", fontSize: 27, marginTop: 20 },
    copy: { color: "#85829B", fontFamily: "Poppins-Regular", fontSize: 13, lineHeight: 21, marginTop: 8 },
    form: { marginTop: 32 },
    security: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 24 },
    securityText: { color: "#85829B", fontFamily: "Poppins-Regular", fontSize: 10.5 },
    footer: { flexDirection: "row", justifyContent: "center", marginTop: "auto", paddingTop: 40 },
    footerText: { color: "#85829B", fontFamily: "Poppins-Regular", fontSize: 12 },
    link: { color: "#5147AF", fontFamily: "Poppins-SemiBold", fontSize: 12 },
});

export default ForgotPassword;
