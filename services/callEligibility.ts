import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE } from "@/config/client";
import type { CallDestinationKind, CallEligibility } from "@/types/callPlans";

async function authHeader() {
  const token = await AsyncStorage.getItem("token");
  if (!token) throw new Error("Sign in to place a call.");
  return { Authorization: `JWT ${token}` };
}

const E164 = /^\+[1-9]\d{1,14}$/;

// Direct app-to-app dial targets (see services/voice.ts / recent.tsx) are
// always 9tel-to-9tel — no network round trip needed to know that.
function isClientIdentity(destination: string): boolean {
  return destination.startsWith("client:");
}

// Classifies who a call is going to so the right plan (Free/Premium vs Pay
// As You Go) can be applied — see resolveCallPlan in types/callPlans.ts.
//
// This deliberately fails open to "unknown" rather than guessing, for two
// reasons documented in the problem this solves:
//   1. A destination that isn't a `client:` identity and isn't E.164 (e.g.
//      the known display-string bug in app/(tabs)/recent.tsx, which can
//      pass a human-readable string instead of a dialable number) should
//      never be misclassified as "carrier" and blocked behind a credits
//      check it can't actually satisfy.
//   2. If the backend lookup itself fails (offline, timeout, 5xx), we
//      should not block the call outright, nor pretend the ad gate or
//      credits check definitely does/doesn't apply — the call screen
//      treats "unknown" as unmetered (no ad gate, no credit check), which
//      mirrors today's behavior for every call before this feature existed.
export async function classifyDestination(destination: string): Promise<CallEligibility> {
  if (!destination) return { kind: "unknown" };
  if (isClientIdentity(destination)) return { kind: "9tel" };
  if (!E164.test(destination)) return { kind: "unknown" };

  try {
    const response = await fetch(`${API_BASE}/api/v1/numbers/lookup`, {
      method: "POST",
      headers: { ...(await authHeader()), "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumber: destination }),
    });
    if (!response.ok) return { kind: "unknown" };
    const data = await response.json().catch(() => null);
    if (typeof data?.is9telNumber !== "boolean") return { kind: "unknown" };
    const kind: CallDestinationKind = data.is9telNumber ? "9tel" : "carrier";
    return { kind };
  } catch {
    return { kind: "unknown" };
  }
}
