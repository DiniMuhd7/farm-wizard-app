import { useState } from "react";
import { Link, router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { View, Text, Alert } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CustomButton, FormField } from "../../components";
import { signUpUser } from "@/services/auth";
import { CustomSelectField } from "../../components/SelectField";
import { validateForm } from "../../utils/validateForm";
import { useCountryData } from "../../hooks/useCountryData";
import { useLanguageData } from "../../hooks/useLanguageData";
import { useTranslation } from "react-i18next";
import { languageMap } from "@/utils/languageMap";
import { useLoginContext } from "@/context/LoginProvider";

const LANGUAGE_KEY = "user-language";

const SignUp = () => {
  const { setUser, setIsLogged } = useLoginContext();
  const [isSubmitting, setSubmitting] = useState(false);
  // Sensible defaults so the form can be submitted quickly; user can change them.
  const [selectedLanguage, setSelectedLanguage] = useState('english')
  const [selectedCountry, setSelectedCountry] = useState('ng')
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    cpassword: ""
  });
  const [errors, setErrors] = useState({});
  // The old avatar-picker UI is gone (it depended on avatar artwork that was
  // never committed to the repo); the account no longer carries an avatar,
  // so this is just a fixed placeholder for signUpUser's existing signature.
  const selectedIndex = 0;

  const { countries } = useCountryData();
  const { languages } = useLanguageData();

  function capitalizeFirstLetter(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  const submit = async () => {
    // if (form.fullName === "" || form.email === "" || form.password === "") {
    //   Alert.alert("Error", "Please fill in all fields");
    //   return;
    // }

    const { isValid, errors: validationErrors } = validateForm({
      ...form,
      selectedLanguage,
      selectedCountry,
    });

    if (isValid) {
      setSubmitting(true);
      try {
        const result = await signUpUser(form.fullName, (form.email).toLowerCase(), form.password, selectedLanguage, selectedCountry, selectedIndex);
        if (result.status !== 200 || result.data.success === false) {
          Alert.alert("Error", result.data.message)
          return;
        }
        // signUpUser already stored the real session token on success (see
        // its own fix), so the account is genuinely signed in at this point
        // — update context to reflect that instead of discarding the
        // response and forcing a redundant manual sign-in right after
        // someone just registered.
        const newUser = result.data?.data?.user;
        if (newUser) {
          setUser(newUser);
          setIsLogged(true);
        }
        await changeLanguage(capitalizeFirstLetter(selectedLanguage));
        router.replace("/verify-phone");

      } catch (error) {
        Alert.alert("Error occured", error.message);
      } finally {
        setSubmitting(false);
      }
    } else {
      setErrors(validationErrors); // display errors in UI
    }

  };

  const filteredLanguages = languages.filter(lang =>
    Object.keys(languageMap).some(
      key => key.toLowerCase() === lang.label.toLowerCase()
    )
  );
  const { t, i18n } = useTranslation();

  const changeLanguage = async (langName) => {
    const code = languageMap[langName].code;

    if (code) {
      await AsyncStorage.setItem(LANGUAGE_KEY, code); // persist
      await i18n.changeLanguage(code);
      setSelectedLanguage(langName);
    }
  };

  // Apply the chosen language immediately so the form previews in it,
  // while keeping the lowercase value the dropdown/validation expect.
  const handleLanguageSelect = async (val) => {
    setSelectedLanguage(val);
    const code = languageMap[capitalizeFirstLetter(val)]?.code;
    if (code) {
      await AsyncStorage.setItem(LANGUAGE_KEY, code);
      await i18n.changeLanguage(code);
    }
  };
  return (
    <SafeAreaView className="flex-1 bg-[#171342]" style={{ backgroundColor: "#171342" }}>
      <KeyboardAwareScrollView
        enableOnAndroid
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 28 }}
        style={{ flex: 1 }}
      >
        <View className="flex-1">
          <View className="flex-row items-center mb-7">
            <View className="w-12 h-12 rounded-2xl bg-[#FCC200] items-center justify-center">
              <Text className="text-[#211B59] text-2xl font-pbold">9</Text>
            </View>
            <View className="ml-3">
              <Text className="text-white text-2xl font-pbold tracking-tight">9tel</Text>
              <Text className="text-[#CFCBFF] text-xs font-pregular">SIMPLE. SECURE. CONNECTED.</Text>
            </View>
          </View>

          <Text className="text-white text-[30px] leading-9 font-psemibold">Create your account</Text>
          <Text className="text-[#CFCBFF] text-sm font-pregular mt-2 mb-6">
            A few details and you’ll be ready to connect.
          </Text>

          <View className="rounded-3xl border border-white/10 bg-[#211B59] p-5">
            <FormField
              title={t("fullname")}
              value={form.fullName}
              placeholder="e.g. John Doe"
              handleChangeText={(e) => setForm({ ...form, fullName: e })}
              otherStyles="mt-1"
              variant="auth"
            />
            {errors.fullName && <Text className="text-red-400 text-sm mt-1">{errors.fullName}</Text>}

            <FormField
              title={t("email")}
              value={form.email}
              placeholder="e.g. yourname@gmail.com"
              handleChangeText={(e) => setForm({ ...form, email: e })}
              otherStyles="mt-2"
              variant="auth"
              keyboardType="email-address"
            />
            {errors.email && <Text className="text-red-400 text-sm mt-1">{errors.email}</Text>}

            <FormField
              title={t("password")}
              placeholder="Password"
              value={form.password}
              handleChangeText={(e) => setForm({ ...form, password: e })}
              otherStyles="mt-2"
              variant="auth"
              secureTextEntry
            />
            {errors.password && <Text className="text-red-400 text-sm mt-1">{errors.password}</Text>}

            <FormField
              title={t("confirm_password")}
              placeholder="Confirm Password"
              value={form.cpassword}
              handleChangeText={(e) => setForm({ ...form, cpassword: e })}
              otherStyles="mt-2"
              variant="auth"
              secureTextEntry
            />
            {errors.cpassword && <Text className="text-red-400 text-sm mt-1">{errors.cpassword}</Text>}

            <CustomSelectField
              title={t("select_country")}
              selectedValue={selectedCountry}
              options={countries}
              handleValueChange={setSelectedCountry}
              otherStyles="mt-2"
              variant="auth"
            />
            {errors.country && <Text className="text-red-400 text-sm mt-1">{errors.country}</Text>}

            <CustomSelectField
              title={t("select_language")}
              selectedValue={selectedLanguage}
              options={filteredLanguages}
              handleValueChange={handleLanguageSelect}
              otherStyles="mt-2"
              variant="auth"
            />
            {errors.language && <Text className="text-red-400 text-sm mt-1">{errors.language}</Text>}

            <CustomButton
              title={t("buttons.sign_up")}
              handlePress={submit}
              containerStyles="w-full"
              isLoading={isSubmitting}
            />
          </View>

          <View className="flex-row justify-center items-center pt-6 gap-2">
            <Text className="text-sm text-[#CFCBFF] font-pregular">Already have an account?</Text>
            <Link href="/sign-in" className="text-sm font-psemibold text-[#E1CE67]">
              Sign in
            </Link>
          </View>
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
};

export default SignUp;
