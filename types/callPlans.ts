// Shared types for the two calling-plan tiers:
//   Airbundle — a purchased minute bundle for 9tel and carrier calls
//   Prepaid   — additional carrier-call balance once bundle minutes are used
//
// This file covers which *tier* applies to a given call based on who
// you're calling and your account's Airbundle status.

// Who you're calling. "unknown" is a deliberate, safe default — see
// services/callEligibility.ts's classifyDestination, which returns this
// whenever it can't positively confirm either case (e.g. backend
// unreachable) so the UI never has to guess and risk either blocking a
// legitimate 9tel call behind a gate or letting an unmetered carrier call
// through undetected.
export type CallDestinationKind = "9tel" | "carrier" | "unknown";

// Minimal, privacy-safe profile preview for a matched 9tel account — see
// backend lookupNumber. Never includes email, id, or country.
export type NineTelAccountPreview = {
  displayName: string;
  avatar: number | null;
  profilePicture: string | null;
};

export type CallEligibility = {
  kind: CallDestinationKind;
  account?: NineTelAccountPreview;
};

// The plan that actually governs a specific outgoing call, resolved from
// (destination kind) x (account Airbundle status):
//   - any known destination, Airbundle active -> "airbundle"
//   - destination "carrier" without Airbundle -> "prepaid" (credits-billed)
//   - anything else                        -> "unmetered" (fail open; no
//     credit check, since we can't tell which rule applies — see
//     classifyDestination's fail-open comment). This also covers a 9tel
//     destination without an Airbundle, now that the free plan is gone,
//     and keeps the call screen stable for legacy accounts.
// `isAirbundle` mirrors the account's `isPremium` flag, an internal field
// name kept for backward compatibility with existing accounts.
export type ResolvedCallPlan = "airbundle" | "prepaid" | "unmetered";

export function resolveCallPlan(destinationKind: CallDestinationKind, isAirbundle: boolean): ResolvedCallPlan {
  if ((destinationKind === "9tel" || destinationKind === "carrier") && isAirbundle) return "airbundle";
  if (destinationKind === "carrier") return "prepaid";
  return "unmetered";
}
