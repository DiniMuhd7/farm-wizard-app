//usage   useConfirmExit('Are you sure you want to exit this form? Changes may not be saved.');

import { useFocusEffect, useNavigation } from "expo-router";
import { useCallback, useEffect } from "react";
import { Alert, BackHandler } from "react-native";

export function useConfirmExit(
  message = "Are you sure you want to leave this screen?"
) {
  const navigation = useNavigation();

  // Android hardware back button
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        Alert.alert("Hold on!", message, [
          { text: "Cancel", style: "cancel", onPress: () => null },
          {
            text: "Yes",
            onPress: () => navigation.goBack(),
          },
        ]);
        return true; // Prevent default
      };

      BackHandler.addEventListener("hardwareBackPress", onBackPress);
      return () =>
        BackHandler.removeEventListener("hardwareBackPress", onBackPress);
    }, [navigation, message])
  );

  // Header back button
  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (e) => {
      e.preventDefault(); // Stop default behavior

      Alert.alert("Hold on!", message, [
        { text: "Cancel", style: "cancel", onPress: () => {} },
        {
          text: "Yes",
          style: "destructive",
          onPress: () => navigation.dispatch(e.data.action),
        },
      ]);
    });

    return unsubscribe;
  }, [navigation, message]);
}
