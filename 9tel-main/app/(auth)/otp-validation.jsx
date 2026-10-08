import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, MailCheck } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import OTPInput from "../../components/OTPInput";
import { verifyOTP } from "../../services/auth";

const OTPValidation = () => {
    const [isSubmitting, setSubmitting] = useState(false);
    const { email } = useLocalSearchParams();
    const address = Array.isArray(email) ? email[0] : email;

    useEffect(() => {
        if (!address) {
            Alert.alert('Error', 'Email Is missing');
            router.replace("/(auth)/sign-in");
        }
    }, [address]);

    if (!address) return null;

    const handleOTPSubmit = async (code) => {
        if (isSubmitting) return;
        setSubmitting(true);
        try {
            const res = await verifyOTP(address, code);
            if (res.data) {
                const result = res.data
                //const isValidOTP = code === "123456"; // Mock valid OTP

                // if (!isValidOTP) {
                if (result.isCodeValid !== true) {
                    Alert.alert('Error', 'Invalid OTP, please try again.');
                    //console.log("isValidOTP ", result)
                } else {
                    Alert.alert('Success', 'OTP verified successfully!');
                    router.replace({
                        pathname: "/(auth)/reset-password",
                        params: { code, email: address },
                    })
                }
            } else {
                Alert.alert('Error', 'Invalid OTP, please try again.');
            }

        } catch (error) {
            Alert.alert("Error", error.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <SafeAreaView style={styles.safe}>
            <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
                <Pressable accessibilityLabel="Back to forgot password" onPress={() => router.back()} style={styles.back}>
                    <ArrowLeft size={21} color="#211B59" />
                </Pressable>
                <Text style={styles.brand}>9tel</Text>
                <View style={styles.icon}><MailCheck size={28} color="#5147AF" /></View>
                <Text style={styles.title}>Verify your email</Text>
                <Text style={styles.copy}>Enter the 6-digit code we sent to</Text>
                <Text style={styles.email}>{address}</Text>
                <View style={styles.otpCard}>
                    <OTPInput onSubmit={handleOTPSubmit} email={address} />
                    {isSubmitting && <ActivityIndicator color="#5147AF" style={styles.loading} />}
                </View>
                <Text style={styles.help}>Check your inbox and spam folder if the code isn’t there.</Text>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: "#F8F8FD" },
    page: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 30 },
    back: { height: 44, width: 44, borderRadius: 15, backgroundColor: "#FFF", alignItems: "center", justifyContent: "center" },
    brand: { color: "#211B59", fontFamily: "Poppins-Bold", fontSize: 24, letterSpacing: -1, marginTop: 25 },
    icon: { height: 62, width: 62, borderRadius: 21, backgroundColor: "#EEECFF", alignItems: "center", justifyContent: "center", marginTop: 46 },
    title: { color: "#211B59", fontFamily: "Poppins-SemiBold", fontSize: 27, marginTop: 20 },
    copy: { color: "#85829B", fontFamily: "Poppins-Regular", fontSize: 13, marginTop: 8 },
    email: { color: "#5147AF", fontFamily: "Poppins-SemiBold", fontSize: 13, marginTop: 3 },
    otpCard: { minHeight: 160, backgroundColor: "#FFF", borderRadius: 22, marginTop: 30, padding: 14, justifyContent: "center", shadowColor: "#28205F", shadowOpacity: 0.05, shadowRadius: 12, elevation: 2 },
    loading: { position: "absolute", right: 18, bottom: 14 },
    help: { color: "#85829B", fontFamily: "Poppins-Regular", fontSize: 11, textAlign: "center", lineHeight: 18, marginTop: 20 },
});
export default OTPValidation;