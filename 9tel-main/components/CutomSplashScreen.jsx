import { View, Text, StyleSheet, Animated } from "react-native";
import { Phone } from "lucide-react-native";
import { useEffect, useRef } from "react";

export default function CutomSplashScreen() {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.5)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 1000,
                useNativeDriver: true,
            }),
            Animated.spring(scaleAnim, {
                toValue: 1,
                tension: 10,
                friction: 2,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    return (
        <View style={styles.container}>
            <Animated.View
                style={[
                    styles.iconContainer,
                    {
                        opacity: fadeAnim,
                        transform: [{ scale: scaleAnim }],
                    },
                ]}
            >
                <View style={styles.badge}>
                    <Phone size={56} color="#fff" />
                </View>
                <Text style={styles.appName}>9tel</Text>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#211B59",
        alignItems: "center",
        justifyContent: "center",
    },
    iconContainer: {
        alignItems: "center",
    },
    badge: {
        height: 96,
        width: 96,
        borderRadius: 32,
        backgroundColor: "#5147AF",
        alignItems: "center",
        justifyContent: "center",
    },
    appName: {
        color: "white",
        fontSize: 32,
        fontFamily: "Poppins-Bold",
        marginTop: 20,
        letterSpacing: -1,
    },
});
