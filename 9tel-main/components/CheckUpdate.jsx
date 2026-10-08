import React, { useEffect, useState } from 'react';
import { Alert, View, Text, Button } from 'react-native';
import * as Updates from 'expo-updates';

export default function CheckUpdate() {
    const [updateAvailable, setUpdateAvailable] = useState(false);

    useEffect(() => {
        const checkForUpdates = async () => {
            try {
                const update = await Updates.checkForUpdateAsync();
                if (update.isAvailable) {
                    // If an update is available, show a prompt to the user
                    setUpdateAvailable(true);
                }
            } catch (error) {
                console.error('Error checking for updates:', error);
            }
        };

        checkForUpdates();
    }, []);

    const handleUpdatePrompt = () => {
        Alert.alert(
            "New Version Available!",
            "A new version of this app is available. Would you like to update now?",
            [
                {
                    text: "Later",
                    style: "cancel"
                },
                {
                    text: "Update",
                    onPress: () => reloadApp(),
                },
            ],
            { cancelable: false }
        );
    };

    const reloadApp = async () => {
        try {
            // Apply the update and reload the app
            await Updates.reloadAsync();
        } catch (error) {
            console.error("Failed to reload app:", error);
            Alert.alert('Error', 'Something went wrong while updating the app.');
        }
    };

    return (
        <View>
            {/* <Text>Welcome to your Expo app!</Text> */}
            {updateAvailable && (
                <Button title="Update Now" onPress={handleUpdatePrompt} />
            )}
        </View>
    );
}
