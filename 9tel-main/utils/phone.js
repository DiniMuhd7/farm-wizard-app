// Shared phone-number helpers (used by the dialer and the contacts screen).

// Builds an E.164 destination. Typing a local number with a leading trunk "0"
// (e.g. "0801 234 5678") must not become "+2340801…", and a number already
// typed with "+" or the country code must not be double-prefixed.
export function normalizeDestination(rawInput, callingCode) {
  const trimmed = String(rawInput ?? "").trim();
  if (trimmed.startsWith("+")) return `+${trimmed.replace(/\D/g, "")}`;
  const digits = trimmed.replace(/\D/g, "");
  const callingDigits = String(callingCode ?? "").replace(/\D/g, "");
  if (callingDigits && digits.startsWith(callingDigits)) return `+${digits}`;
  const local = digits.replace(/^0+/, "");
  return `${callingCode}${local}`;
}

let cachedCallingCode = null;
export async function getDefaultCallingCode() {
  if (cachedCallingCode) return cachedCallingCode;
  try {
    const response = await fetch("https://ipapi.co/json/");
    if (response.ok) {
      const location = await response.json();
      if (location.country_calling_code) cachedCallingCode = location.country_calling_code;
    }
  } catch {
    // fall through to the default
  }
  return cachedCallingCode || "+234";
}
