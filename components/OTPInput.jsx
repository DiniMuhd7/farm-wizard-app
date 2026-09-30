import React, { useRef, useState, useEffect } from 'react';
import {
    View,
    TextInput,
    StyleSheet,
    Alert,
    Keyboard,
    Text,
    TouchableOpacity,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { forgetPassword } from '../services/auth';

const OTP_LENGTH = 6; // 6-digit OTP
const OTP_EXPIRY_TIME = 60; // 60 seconds timer for Resend OTP

const OTPInput = ({ onSubmit, email }) => {
    const [otp, setOtp] = useState(new Array(OTP_LENGTH).fill(''));
    const [timer, setTimer] = useState(OTP_EXPIRY_TIME);
    const [resendEnabled, setResendEnabled] = useState(false);
    const inputs = useRef([]);
    const submittedOtp = useRef(null);

    // Timer countdown for Resend OTP
    useEffect(() => {
        if (timer === 0) {
            setResendEnabled(true);
        } else {
            const intervalId = setInterval(() => {
                setTimer(prev => prev - 1);
            }, 1000);

            return () => clearInterval(intervalId);
        }
    }, [timer]);

    const handleChange = (text, index) => {
        const newOtp = [...otp];

        const digits = text.replace(/\D/g, '');
        if (!digits) {
            newOtp[index] = '';
            submittedOtp.current = null;
            setOtp(newOtp);
            return;
        }

        if (digits.length > 1) {
            const pastedDigits = digits.slice(0, OTP_LENGTH).split('');
            setOtp([...pastedDigits, ...new Array(OTP_LENGTH - pastedDigits.length).fill('')]);
            if (pastedDigits.length === OTP_LENGTH) Keyboard.dismiss();
            else inputs.current[pastedDigits.length]?.focus();
            return;
        }

        newOtp[index] = digits;
        setOtp(newOtp);
        if (index < OTP_LENGTH - 1) {
            inputs.current[index + 1]?.focus();
        } else {
            Keyboard.dismiss();
        }
    };

    const handleKeyPress = (e, index) => {
        if (e.nativeEvent.key === 'Backspace') {
            if (otp[index]) {
                // If current field has a value, just clear it
                const newOtp = [...otp];
                newOtp[index] = '';
                submittedOtp.current = null;
                setOtp(newOtp);
            } else if (index > 0) {
                // If empty, move focus to previous and clear it
                inputs.current[index - 1]?.focus();
                const newOtp = [...otp];
                newOtp[index - 1] = '';
                submittedOtp.current = null;
                setOtp(newOtp);
            }
        }
    };


    // Check when all inputs are filled
    useEffect(() => {
        if (otp.every(val => val !== '')) {
            const code = otp.join('');
            if (/^\d{6}$/.test(code) && submittedOtp.current !== code) {
                submittedOtp.current = code;
                onSubmit(code);
            } else {
                if (!/^\d{6}$/.test(code)) Alert.alert('Invalid OTP', 'Please enter a valid 6-digit OTP.');
            }
        }
    }, [otp]);


    // Optional: Auto-fill from clipboard on focus
    const handlePasteFromClipboard = async () => {
        try {
            const clipboardContent = await Clipboard.getString();
            if (/^\d{6}$/.test(clipboardContent)) {
                setOtp(clipboardContent.split(''));
                Keyboard.dismiss();
            }
        } catch (error) {
            console.log('Clipboard error:', error);
        }
    };

    // Handle Resend OTP
    const handleResendOTP = async () => {
        setResendEnabled(false);
        setTimer(OTP_EXPIRY_TIME);
        setOtp(new Array(OTP_LENGTH).fill('')); // Reset OTP fields
        submittedOtp.current = null;
        inputs.current[0]?.focus(); // Focus on the first input
        Keyboard.dismiss();
        try {
            const result = await forgetPassword(email);
            if (!result) {
                Alert.alert("Error", "User Not Found");
                return
            }
            if (result.data.success === false) {
                Alert.alert("Error", result.data.message)
                return;
            }
            Alert.alert("Success", "OTP re-sent to your email");
        } catch (error) {
            console.log(' error file resending:', error);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.otpContainer}>
                {otp.map((digit, index) => (
                    <TextInput
                        key={index}
                        ref={el => (inputs.current[index] = el)}
                        accessibilityLabel={`Verification code digit ${index + 1}`}
                        style={[styles.input, digit && styles.inputFilled]}
                        keyboardType="number-pad"
                        maxLength={1}
                        value={digit}
                        onChangeText={text => handleChange(text, index)}
                        onKeyPress={e => handleKeyPress(e, index)}
                        onFocus={handlePasteFromClipboard}
                        selectionColor="#5147AF"
                        textContentType={index === 0 ? "oneTimeCode" : undefined}
                    />
                ))}
            </View>

            {timer > 0 ? (
                <Text style={styles.timerText}>Resend code in <Text style={styles.timerValue}>{timer}s</Text></Text>
            ) : (
                <TouchableOpacity
                    accessibilityRole="button"
                    onPress={handleResendOTP}
                    disabled={!resendEnabled}
                    style={[styles.resendButton, resendEnabled ? {} : styles.disabledButton]}
                >
                    <Text style={styles.resendButtonText}>Resend OTP</Text>
                </TouchableOpacity>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 14,
    },
    otpContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginBottom: 22,
    },
    input: {
        backgroundColor: '#F8F8FD',
        borderWidth: 1,
        borderColor: '#E6E4F0',
        borderRadius: 13,
        width: 39,
        height: 54,
        marginHorizontal: 4,
        textAlign: 'center',
        fontSize: 21,
        color: '#211B59',
        fontFamily: 'Poppins-SemiBold',
    },
    inputFilled: {
        borderColor: '#5147AF',
        backgroundColor: '#F0EEFF',
    },
    timerText: {
        fontSize: 12,
        color: '#85829B',
        fontFamily: 'Poppins-Regular',
    },
    timerValue: { color: '#5147AF', fontFamily: 'Poppins-SemiBold' },
    resendButton: {
        backgroundColor: '#EEECFF',
        paddingVertical: 11,
        paddingHorizontal: 18,
        borderRadius: 13,
    },
    resendButtonText: {
        color: '#5147AF',
        fontSize: 12,
        fontFamily: 'Poppins-SemiBold',
    },
    disabledButton: {
        opacity: 0.5,
    },
});

export default OTPInput;
