import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { Eye, EyeOff } from "lucide-react-native";

const FormField = ({
  title,
  value,
  placeholder,
  handleChangeText,
  otherStyles,
  secureTextEntry = false,
  variant = "default",
  ...props
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const isAuth = variant === "auth";

  return (
    <View className={`gap-y-2 ${otherStyles}`}>
      <Text className={`text-sm font-pmedium ${isAuth ? "text-[#D8D5F0]" : "text-gray-100"}`}>{title}</Text>

      <View
        className={`w-full h-14 px-4 rounded-xl flex flex-row items-center ${
          isAuth
            ? "bg-[#302A68] border border-white/15"
            : "h-16 rounded-2xl border-2 border-dotted border-secondary focus:border-secondary"
        }`}
      >
        <TextInput
          className={`flex-1 text-white font-pmedium ${isAuth ? "text-[15px]" : "text-base"}`}
          value={value}
          placeholder={placeholder}
          placeholderTextColor={isAuth ? "#9C97C4" : "#ffffff"}
          onChangeText={handleChangeText}
          secureTextEntry={secureTextEntry && !showPassword}
          {...props}
        />

        {secureTextEntry && (
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            {!showPassword ? (
              <Eye color={isAuth ? "#CFCBFF" : "#ffffff"} size={22} />
            ) : (
              <EyeOff color={isAuth ? "#CFCBFF" : "#ffffff"} size={22} />
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

export default FormField;
