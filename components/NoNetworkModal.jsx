import React, { useEffect, useState } from 'react';
import {
    Modal,
    View,
    Text,
    StyleSheet,
    ActivityIndicator,
    TouchableOpacity,
    TouchableWithoutFeedback,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { WifiOff } from 'lucide-react-native';
import { useNetwork } from '../context/NetworkProvider';
import CustomButton from './CustomButton';
import { BlurView } from 'expo-blur';

const NoNetworkModal = () => {
    const { isConnected, setIsConnectedManually } = useNetwork();
    const [isRetrying, setIsRetrying] = useState(false);

    // Auto-retry every 5 seconds
    useEffect(() => {
        let interval;

        if (!isConnected) {
            interval = setInterval(() => {
                checkConnection();
            }, 5000);
        }

        return () => clearInterval(interval);
    }, [isConnected]);

    const checkConnection = async () => {
        setIsRetrying(true);
        const state = await NetInfo.fetch();
        const online = state.isConnected && state.isInternetReachable;
        if (online) {
            setIsConnectedManually(true);
        }
        setIsRetrying(false);
    };

    return (
        /*<Modal visible={!isConnected} animationType="fade" transparent>
            <View style={styles.overlay}>
                <View style={styles.modal}>
                    <Text style={styles.title}>🚫 No Internet Connection</Text>
                    <Text style={styles.message}>
                        Please check your connection. Retrying automatically...
                    </Text>

                    {isRetrying && <ActivityIndicator size="large" color="#e53935" style={styles.spinner} />}

                    <TouchableOpacity style={styles.button} onPress={checkConnection}>
                        <Text style={styles.buttonText}>Retry Now</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>*/
        <Modal transparent visible={!isConnected} animationType="fade">
            <TouchableWithoutFeedback onPress={() => { }}>
                <BlurView
                    intensity={50}
                    tint="dark"
                    className="flex-1 items-center justify-center"
                >
                    <TouchableWithoutFeedback onPress={() => { }}>
                        <View className="flex-1 w-full bg-[#857f6e85] opacity-2 rounded-lg p-2 justify-center items-center">
                            <WifiOff color="#fff" size={72} />
                            <Text
                                className="text-center text-xl px-2 font-secondary my-10"
                                style={{
                                    color: "#fff",
                                    textAlign: "center",
                                    paddingHorizontal: 10,
                                }}
                            >
                                You're offline. 9tel needs a connection to place and receive calls.
                            </Text>
                            <Text className='text-white'>
                                Please check your connection. Retrying automatically...
                            </Text>

                            {isRetrying && <ActivityIndicator size="large" color="#e53935" style={styles.spinner} />}

                            <View className="flex-row w-full justify-center items-center gap-x-10">
                                <CustomButton
                                    title={'Ok'}
                                    handlePress={checkConnection}
                                    containerStyles="w-[150px] "
                                    textStyles="font-pbold text-white"
                                    isLoading={false}
                                />
                                {/* <CustomButton
                          title={'Home'}
                          handlePress={onCancelPress}
                          containerStyles="w-[150px] "
                          textStyles="font-pbold text-white"
                          isLoading={false}
                        /> */}
                            </View>
                        </View>
                    </TouchableWithoutFeedback>
                </BlurView>
            </TouchableWithoutFeedback>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modal: {
        width: '85%',
        backgroundColor: '#fff',
        padding: 25,
        borderRadius: 12,
        alignItems: 'center',
        elevation: 6,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#e53935',
        marginBottom: 10,
    },
    message: {
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 20,
    },
    spinner: {
        marginBottom: 15,
    },
    button: {
        backgroundColor: '#e53935',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
    },
    buttonText: {
        color: '#fff',
        fontWeight: '600',
    },
});

export default NoNetworkModal;
