import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import HttpBackend from "i18next-http-backend";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE } from "@/config/client";
import en from "./translations/en.json";

// Map your translation base URL
const BASE_URL = `${API_BASE}/translations/`;
// const BASE_URL =
//   "https://raw.githubusercontent.com/your-username/expo-translations/main/";

i18n
  .use(HttpBackend)
  .use(initReactI18next)
  .init({
    fallbackLng: "en",
    supportedLngs: [
      "en",
      "fr",
      "de",
      "ar",
      "he",
      "es",
      "pt",
      "id",
      "zh",
      "hi",
      "ru",
      "ha",
      "yo",
      "ig",
      "sw",
    ],
    load: "languageOnly", // e.g. 'en-US' becomes 'en'
    lng: "en",
    // English ships with the app so the UI never shows raw keys,
    // even when the translations server is unreachable.
    resources: { en: { translation: en } },
    partialBundledLanguages: true,
    debug: false, // turn off logs
    missingKeyHandler: false, // disable missing key logs
    backend: {
      loadPath: `${BASE_URL}{{lng}}.json`,
    },

    interpolation: {
      escapeValue: false,
    },

    react: {
      useSuspense: false,
      // Re-render when a refreshed translation bundle is added in the background.
      bindI18nStore: "added",
    },

    // Custom caching logic
    // saveMissing: false,
    // initImmediate: false,
  });

// Custom caching manually using AsyncStorage.
//
// Stale-while-revalidate: a cached language file is used immediately (so the UI
// is instant and works offline), then re-fetched in the background. If the
// server has newer strings they are saved and swapped in live. Without this,
// the first copy of a language was cached forever, so strings added later never
// reached anyone who had already used that language.
const cacheKey = (language) => `translations-${language}`;

async function refreshTranslations(language, namespace, cachedJson) {
  try {
    const response = await fetch(`${BASE_URL}${language}.json`);
    if (!response.ok) return;
    const fresh = await response.text();
    if (fresh === cachedJson) return;
    const data = JSON.parse(fresh);
    await AsyncStorage.setItem(cacheKey(language), fresh);
    i18n.addResourceBundle(language, namespace || "translation", data, true, true);
  } catch {
    // offline or a bad response: keep what we have
  }
}

i18n.services.backendConnector.backend.read = async function (
  language,
  namespace,
  callback
) {
  try {
    const cached = await AsyncStorage.getItem(cacheKey(language));
    if (cached) {
      callback(null, JSON.parse(cached));
      refreshTranslations(language, namespace, cached);
      return;
    }

    const response = await fetch(`${BASE_URL}${language}.json`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    const data = JSON.parse(text);
    await AsyncStorage.setItem(cacheKey(language), text);
    callback(null, data);
  } catch (err) {
    // Server unreachable: fall back to the bundled English strings
    // rather than leaving the language empty (raw keys in the UI).
    callback(null, en);
  }
};

// tr()/keyFor() live in ./tr.js (dependency-light, safe in tests); re-exported here.
export { tr, keyFor } from "./tr";

export default i18n;
