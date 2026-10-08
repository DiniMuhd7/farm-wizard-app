import i18n from "i18next";

// tr("Top up") translates by English text: it looks the string up in the current
// language and falls back to the English text itself, so a missing translation can
// never show a raw key. The key is derived from the English text (the same function
// is mirrored in scripts/i18nkeys.py — the two MUST stay identical), so adding a
// translation never needs an edit in the screen.
//   tr("Hello, {{name}}", { name })   -> interpolation works as usual
//
// This module deliberately imports only the core i18next instance (not utils/i18n,
// which pulls in AsyncStorage and the network backend), and works before i18n has
// started — in tests and during startup it simply returns the English text.
const keyCache = new Map();

function fnv1a(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

export function keyFor(text) {
  let key = keyCache.get(text);
  if (!key) {
    const slug = text
      .toLowerCase()
      .replace(/\{\{[^}]*\}\}/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40);
    key = `ui.${slug}_${fnv1a(text)}`;
    keyCache.set(text, key);
  }
  return key;
}

export function tr(text, options) {
  if (i18n.isInitialized) {
    return i18n.t(keyFor(text), { defaultValue: text, ...options });
  }
  return text.replace(/\{\{(\w+)\}\}/g, (match, name) =>
    options && options[name] != null ? String(options[name]) : match
  );
}
