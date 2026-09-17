import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { Eye, EyeOff } from "lucide-react-native";

const FormField = ({
  title,
  value,
  placeholder,
  handleChangeText,
  otherStyles,
  ...props
}) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <View className={`gap-y-2 ${otherStyles}`}>
      <Text className="text-base text-gray-100 font-pmedium">{title}</Text>

      <View className="w-full h-16 px-4 rounded-2xl border-2 border-dotted border-secondary focus:border-secondary flex flex-row items-center">
        <TextInput
          className="flex-1 text-white font-psemibold text-base"
          value={value}
          placeholder={placeholder}
          placeholderTextColor="#ffffff"
          onChangeText={handleChangeText}
          secureTextEntry={(placeholder === "Password" || placeholder === "Confirm Password") && !showPassword}
          {...props}
        />

        {(placeholder === "Password" || placeholder === "Confirm Password") && (
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            {!showPassword ? (
              <Eye color="#ffffff" size={22} />
            ) : (
              <EyeOff color="#ffffff" size={22} />
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

export default FormField;
