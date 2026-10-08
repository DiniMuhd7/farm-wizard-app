// Languages offered to the user. Only entries that have a matching
// translation file served by the backend (/translations/<code>.json) are
// enabled; German/Hebrew etc. stay commented until their files exist.
// The sign-up and edit-profile dropdowns and the offline fallback list are
// all derived from this map.
export const languageMap = {
  English: { code: "en", nativeName: "English" },
  French: { code: "fr", nativeName: "Français" },
  // German: { code: "de", nativeName: "Deutsch" },
  Arabic: { code: "ar", nativeName: "العربية" },
  // Hebrew: { code: "he", nativeName: "עברית" },
  Spanish: { code: "es", nativeName: "Español" },
  Portuguese: { code: "pt", nativeName: "Português" },
  Indonesian: { code: "id", nativeName: "Bahasa Indonesia" },
  Chinese: { code: "zh", nativeName: "中文 (Mandarin)" },
  Hindi: { code: "hi", nativeName: "हिन्दी" },
  Russian: { code: "ru", nativeName: "Русский" },
  Hausa: { code: "ha", nativeName: "Hausa" },
  Yoruba: { code: "yo", nativeName: "Yorùbá" },
  Igbo: { code: "ig", nativeName: "Asụsụ Igbo" },
  Swahili: { code: "sw", nativeName: "Kiswahili" },
  // Amharic: { code: "am", nativeName: "አማርኛ" },
  // Oromo: { code: "om", nativeName: "Afaan Oromoo" },
  // Tigrinya: { code: "ti", nativeName: "ትግርኛ" },
  // Lingala: { code: "ln", nativeName: "Lingála" },
  // Kinyarwanda: { code: "rw", nativeName: "Kinyarwanda" },
  // Luganda: { code: "lg", nativeName: "Luganda" },
  // Shona: { code: "sn", nativeName: "ChiShona" },
  // Zulu: { code: "zu", nativeName: "isiZulu" },
  // Xhosa: { code: "xh", nativeName: "isiXhosa" },
  // Wolof: { code: "wo", nativeName: "Wolof" },
  // Ewe: { code: "ee", nativeName: "Eʋegbe" },
  // Fula: { code: "ff", nativeName: "Pulaar" },
  // Tswana: { code: "tn", nativeName: "Setswana" },
  // Berber: { code: "ber", nativeName: "Tamazight" },
};
