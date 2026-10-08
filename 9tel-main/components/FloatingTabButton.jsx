// components/FloatingTabButton.js
import React from "react";
import { TouchableOpacity, View, Image } from "react-native";

const FloatingTabButton = ({ icon, onPress, style }) => (
  <TouchableOpacity
    style={[
      {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: "#FFD84F",
        justifyContent: "center",
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 6,
      },
      style, // custom override
    ]}
    onPress={onPress}
  >
    <Image
      source={icon}
      style={{ width: 24, height: 24, tintColor: "#fff" }}
      resizeMode="contain"
    />
  </TouchableOpacity>
);

export default FloatingTabButton;
