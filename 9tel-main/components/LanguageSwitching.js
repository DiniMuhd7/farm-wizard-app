import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, Alert } from "react-native";
import { Picker } from "@react-native-picker/picker";
import "../utils/i18n";
import { useTranslation } from "react-i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { applyLanguage, restartApp } from "@/utils/language";
import { themeColor, useThemeVersion } from "@/theme";
import { languageMap } from "@/utils/languageMap";
import { API_BASE } from "@/config/client";
const LANGUAGE_KEY = "user-language";

export default function LanguageSwitching() {
  useThemeVersion();
  const { t, i18n } = useTranslation();
  const [languageLoaded, setLanguageLoaded] = useState(false);
  const [selectedLang, setSelectedLang] = useState("English");
  const [loading, setLoading] = useState(false);
  const rtlLanguages = ["ar", "he"]; // Add more RTL languages if needed

  // 🔁 Load saved language on mount
  useEffect(() => {
    const loadSavedLanguage = async () => {
      const savedLangCode = await AsyncStorage.getItem(LANGUAGE_KEY);
      const savedLangName = Object.keys(languageMap).find(
        (key) => languageMap[key].code === savedLangCode
      );
      if (savedLangCode && savedLangName) {
        await i18n.changeLanguage(savedLangCode);
        setSelectedLang(savedLangName);
      } else {
        setSelectedLang("English"); // default
        await i18n.changeLanguage("en");
      }
      setLanguageLoaded(true);
    };
    loadSavedLanguage();
  }, []);

  // 🌍 Load language list from API
  useEffect(() => {
    const extraAfricanLanguages = [
      "Hausa",
      "Igbo",
      "Yoruba",
      "Amharic",
      "Oromo",
      "Tigrinya",
      "Shona",
      "Zulu",
      "Xhosa",
      "Tswana",
      "Wolof",
      "Ewe",
      "Fula",
      "Berber",
      "Lingala",
      "Kinyarwanda",
      "Luganda",
    ];

    //  const res = await axios.get(
    //           `${API_BASE}/api/v1/external-apis/countries`
    //         );
    fetch(`${API_BASE}/api/v1/external-apis/languages`)
      .then((res) => res.json())
      .then((data) => {
        const langSet = new Set();

        // Extract from country languages
        data.forEach((country) => {
          if (country.languages) {
            Object.values(country.languages).forEach((lang) =>
              langSet.add(lang)
            );
          }
        });

        // Manually add African languages
        extraAfricanLanguages.forEach((lang) => langSet.add(lang));

        // Filter to only those available in languageMap
        const allLangs = Array.from(langSet);
        const filtered = allLangs.filter((lang) => languageMap[lang]);
        setLoading(false);
      });
  }, []);

  // 🌐 When language is changed by user

  const changeLanguage = async (langName) => {
    const code = languageMap[langName]?.code;
    if (!code) return;
    setLoading(true);
    try {
      // Saves the choice before anything can restart the app, so a switch to
      // or from an RTL language (Arabic) is no longer lost on reload.
      const { needsRestart } = await applyLanguage(code);
      setSelectedLang(langName);
      if (needsRestart) {
        Alert.alert(
          "Restart to finish",
          "This language reads in a different direction. Restart the app to switch the layout.",
          [
            { text: "Later", style: "cancel" },
            {
              text: "Restart now",
              onPress: async () => {
                if (!(await restartApp())) Alert.alert("Reopen the app", "Close and reopen 9tel to apply the new layout.");
              },
            },
          ]
        );
      }
    } catch (e) {
      Alert.alert("Couldn't change language", e?.message || "Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ padding: 20 }}>
      {loading ? (
        <ActivityIndicator size="large" />
      ) : (
        <>
          {/* <Text style={{ fontSize: 24 }}>{t("edit_profile")}</Text> */}
          {/* <Text style={{ fontSize: 18 }}>
            {t("hello_user", { name: "John" })}
          </Text> */}
          <View className="rounded-2xl w-full" style={{ backgroundColor: themeColor("#FFFFFF", "bg") }}>
            {languageLoaded && (
              <Picker
                style={{ color: themeColor("#211B59") }}
                dropdownIconColor={themeColor("#5147AF")}
                selectedValue={selectedLang}
                onValueChange={(value) => changeLanguage(value)}
              >
                {Object.keys(languageMap).map((lang, index) => (
                  <Picker.Item
                    key={index}
                    label={languageMap[lang].nativeName}
                    value={lang}
                  />
                ))}
              </Picker>
            )}
          </View>
        </>
      )}
    </View>
  );
}
