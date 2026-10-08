import { I18nManager } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Updates from "expo-updates";
import i18n from "@/utils/i18n";
import { languageMap } from "@/utils/languageMap";

export const LANGUAGE_KEY = "user-language";
const RTL_LANGUAGES = ["ar", "he"];

export type LanguageOption = { name: string; code: string; nativeName: string };

export const LANGUAGES: LanguageOption[] = Object.entries(languageMap).map(([name, v]) => ({
  name,
  code: v.code,
  nativeName: v.nativeName,
}));

export const baseLanguage = (code?: string | null) => (code || "en").split("-")[0];

export function languageLabel(code?: string | null): string {
  const base = baseLanguage(code);
  return LANGUAGES.find((l) => l.code === base)?.nativeName ?? "English";
}

// Saves the choice FIRST, then switches. (The old picker triggered an app reload
// before saving, so switching to or from an RTL language like Arabic was lost.)
// Right-to-left layout can only change after a restart, which the caller offers.
export async function applyLanguage(code: string): Promise<{ needsRestart: boolean }> {
  await AsyncStorage.setItem(LANGUAGE_KEY, code);
  await i18n.changeLanguage(code);
  const wantsRTL = RTL_LANGUAGES.includes(code);
  if (I18nManager.isRTL !== wantsRTL) {
    I18nManager.allowRTL(wantsRTL);
    I18nManager.forceRTL(wantsRTL);
    return { needsRestart: true };
  }
  return { needsRestart: false };
}

// Returns false when the runtime can't restart itself (e.g. a dev client); the
// caller then asks the person to reopen the app.
export async function restartApp(): Promise<boolean> {
  try {
    await Updates.reloadAsync();
    return true;
  } catch {
    return false;
  }
}
