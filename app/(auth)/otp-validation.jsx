import { useEffect, useState } from "react";
import { Alert, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import OTPInput from "../../components/OTPInput";
import { verifyOTP } from "../../services/auth";

const OTPValidation = () => {
    const [isSubmitting, setSubmitting] = useState(false);
    const { email } = useLocalSearchParams();

    useEffect(() => {
        if (!email) {
            Alert.alert('Error', 'Email Is missing');
            router.replace("/(auth)/sign-in");
        }
    }, [email]);

    if (!email) return null;

    const handleOTPSubmit = async (code) => {
        try {
            const res = await verifyOTP(email, code);
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
                        params: { code, email },
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
        <View style={{ flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginVertical: 50 }}>
                Enter OTP
            </Text>
            <OTPInput onSubmit={handleOTPSubmit} email={email} />

        </View>
    );
};
export default OTPValidation;