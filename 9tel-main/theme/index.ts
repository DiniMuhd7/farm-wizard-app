import { useSyncExternalStore } from "react";
import { Appearance, type ImageStyle, type TextStyle, type ViewStyle } from "react-native";

// App-wide light / dark theme.
//
// Every screen already builds its styles from one small palette of light-mode
// hex colours, so instead of rewriting each screen the dark theme is a
// *translation* of those colours, applied as styles are read:
//   - themedStyles({...})  replaces StyleSheet.create — same call shape, but the
//                          colours come out translated when the scheme is dark.
//   - themeColor("#hex")   does the same for colours passed as props (icons...).
//   - useThemeVersion()    makes a component re-render when the theme changes,
//                          so switching in Settings applies instantly (no restart).
// The translation is role-aware (background / border / text), see below.

export type ThemePreference = "system" | "light" | "dark";
export type Scheme = "light" | "dark";
export type ColorRole = "bg" | "border" | "text";

const STORAGE_KEY = "app-appearance";

let preference: ThemePreference = "system";
let scheme: Scheme = readSystemScheme();
let version = 0;
const listeners = new Set<() => void>();

function readSystemScheme(): Scheme {
  return Appearance.getColorScheme() === "dark" ? "dark" : "light";
}

function resolve(): Scheme {
  return preference === "system" ? readSystemScheme() : preference;
}

function notify() {
  version += 1;
  listeners.forEach((listener) => listener());
}

// Keep native UI (alerts, pickers, keyboard) in step with the choice. Passing
// null hands control back to the OS.
function syncNative() {
  try {
    Appearance.setColorScheme(preference === "system" ? null : preference);
  } catch {
    // older runtimes: the JS theme still works, native dialogs just follow the OS
  }
}

// Following the OS only matters in "system" mode.
Appearance.addChangeListener(() => {
  if (preference !== "system") return;
  const next = readSystemScheme();
  if (next !== scheme) {
    scheme = next;
    notify();
  }
});

export async function initTheme(): Promise<void> {
  try {
    const AsyncStorage = require("@react-native-async-storage/async-storage").default;
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark" || saved === "system") preference = saved;
  } catch {
    // keep the default
  }
  syncNative();
  scheme = resolve();
  notify();
}

export async function setThemePreference(next: ThemePreference): Promise<void> {
  preference = next;
  syncNative();
  scheme = resolve();
  notify();
  try {
    const AsyncStorage = require("@react-native-async-storage/async-storage").default;
    await AsyncStorage.setItem(STORAGE_KEY, next);
  } catch {
    // not fatal: the choice still applies for this session
  }
}

export const getThemePreference = () => preference;
export const getScheme = () => scheme;
export const isDark = () => scheme === "dark";

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

// Call at the top of any component that reads themed styles/colours and isn't
// re-rendered by a parent that does, so it updates when the theme changes.
export function useThemeVersion(): number {
  return useSyncExternalStore(subscribe, () => version);
}

export function useTheme() {
  useThemeVersion();
  return { preference, scheme, isDark: scheme === "dark" };
}

// ---- colour translation ------------------------------------------------------

const DARK_PAGE = "#0F0E1A"; // screen background
const DARK_CARD = "#1B1A2D"; // cards, sheets, the tab bar
const DARK_FILL = "#262440"; // tinted fills: chips, inputs, icon tiles, selected rows
const DARK_BORDER = "#2F2D4A"; // hairlines and card borders
const TEXT_STRONG = "#ECEBFA";
const TEXT_MEDIUM = "#C4C1DA";
const TEXT_MUTED = "#A19DBA";

type Hsl = { h: number; s: number; l: number; c: number };

function parseHex(value: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim());
  if (!m) return null; // rgba(), named colours, 8-digit hex: leave untouched
  let hex = m[1];
  if (hex.length === 3) hex = hex.split("").map((ch) => ch + ch).join("");
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
}

function toHsl([r, g, b]: [number, number, number]): Hsl {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const c = max - min;
  const l = (max + min) / 2;
  let h = 0;
  if (c !== 0) {
    if (max === r) h = ((g - b) / c) % 6;
    else if (max === g) h = (b - r) / c + 2;
    else h = (r - g) / c + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = c === 0 ? 0 : c / (1 - Math.abs(2 * l - 1));
  return { h, s, l, c };
}

function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return "#" + [r, g, b].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, "0")).join("");
}

// Light surfaces become dark ones; coloured/dark surfaces (purple buttons, the
// navy hero cards, pastel avatars) are already fine on a dark page and stay.
function darkBackground(value: string): string {
  const rgb = parseHex(value);
  if (!rgb) return value;
  const { h, l, c } = toHsl(rgb);
  if (l < 0.9) return value;
  if (l > 0.995 && c < 0.01) return DARK_CARD;
  if (c < 0.035) return l >= 0.975 ? DARK_PAGE : DARK_FILL;
  if (h >= 225 && h <= 285) return DARK_FILL; // pale lavender fills
  return hslToHex(h, 0.3, 0.2); // pale pink / mint / cream tints keep their hue
}

function darkBorder(value: string): string {
  const rgb = parseHex(value);
  if (!rgb) return value;
  return toHsl(rgb).l >= 0.6 ? DARK_BORDER : value;
}

// Text: dark navy/greys become light; accents (purple, red, green…) are lifted so
// they read on dark; already-light text (white on a button) is left alone.
function darkText(value: string): string {
  const rgb = parseHex(value);
  if (!rgb) return value;
  if (value.toLowerCase() === "#3b315f") return value; // initials on pastel avatars
  const { h, s, l } = toHsl(rgb);
  if (l >= 0.65) return value;
  if (l < 0.33) return TEXT_STRONG;
  if (s < 0.3) return l < 0.5 ? TEXT_MEDIUM : TEXT_MUTED;
  return hslToHex(h, Math.min(s, 0.85), 0.74);
}

export function themeColor(value: string, role: ColorRole = "text"): string {
  if (scheme === "light") return value;
  return role === "bg" ? darkBackground(value) : role === "border" ? darkBorder(value) : darkText(value);
}

type AnyStyle = ViewStyle & TextStyle & ImageStyle;

function translateStyle(style: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const key of Object.keys(style)) {
    const value = style[key];
    if (typeof value !== "string") {
      out[key] = value;
    } else if (key === "backgroundColor") {
      out[key] = darkBackground(value);
    } else if (/^border.*Color$/.test(key)) {
      out[key] = darkBorder(value);
    } else if (key === "color" || key === "tintColor" || key === "textDecorationColor") {
      out[key] = darkText(value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

// Drop-in replacement for StyleSheet.create.
export function themedStyles<T extends Record<string, AnyStyle>>(styles: T): T {
  const darkCache: Record<string, any> = {};
  return new Proxy(styles, {
    get(target, prop: string) {
      const raw = (target as any)[prop];
      if (scheme === "light" || raw == null || typeof raw !== "object") return raw;
      return (darkCache[prop] ??= translateStyle(raw));
    },
  });
}
