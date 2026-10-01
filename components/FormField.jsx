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
  // "light" renders the field for use on the app's light/white 9tel
  // surfaces (e.g. Edit Profile, Settings) using the same palette those
  // screens already use elsewhere (navy text, muted-purple label/
  // placeholder, soft card border) — "auth" is dark-surface-only (it was
  // designed for the navy sign-in/sign-up screens) and looked like a
  // mismatched floating dark box when reused on a white card.
  const isLight = variant === "light";

  return (
    <View className={`gap-y-2 ${otherStyles}`}>
      <Text
        className={`text-sm font-pmedium ${
          isAuth ? "text-[#D8D5F0]" : isLight ? "text-[#514D66]" : "text-gray-100"
        }`}
      >
        {title}
      </Text>

      <View
        className={`w-full h-14 px-4 rounded-xl flex flex-row items-center ${
          isAuth
            ? "bg-[#302A68] border border-white/15"
            : isLight
            ? "bg-[#FAFAFD] border border-[#F0EFF5]"
            : "h-16 rounded-2xl border-2 border-dotted border-secondary focus:border-secondary"
        }`}
      >
        <TextInput
          className={`flex-1 font-pmedium ${isAuth || isLight ? "text-[15px]" : "text-base"} ${
            isLight ? "text-[#211B59]" : "text-white"
          }`}
          value={value}
          placeholder={placeholder}
          placeholderTextColor={isAuth ? "#9C97C4" : isLight ? "#9894A9" : "#ffffff"}
          onChangeText={handleChangeText}
          secureTextEntry={secureTextEntry && !showPassword}
          {...props}
        />

        {secureTextEntry && (
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            {!showPassword ? (
              <Eye color={isAuth ? "#CFCBFF" : isLight ? "#5147AF" : "#ffffff"} size={22} />
            ) : (
              <EyeOff color={isAuth ? "#CFCBFF" : isLight ? "#5147AF" : "#ffffff"} size={22} />
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

export default FormField;
