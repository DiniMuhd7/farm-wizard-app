import { requireOptionalNativeModule } from "expo-modules-core";

type EsimSupportNative = { isSupported(): boolean };

// Optional on purpose: a dev build made before this module existed doesn't
// contain it, and the app should then say "unknown" instead of crashing.
const native = requireOptionalNativeModule<EsimSupportNative>("EsimSupport");

export type EsimSupport = "supported" | "unsupported" | "unknown";

export function getEsimSupport(): EsimSupport {
  if (!native) return "unknown";
  try {
    return native.isSupported() ? "supported" : "unsupported";
  } catch {
    return "unknown";
  }
}
