// Shared types for the three calling-plan tiers:
//   Free    — 9tel-to-9tel, rewarded-ad supported (before and after the call)
//   Premium — 9tel-to-9tel, ad-free
//   PAYG    — 9tel-to-local-carrier, billed from a prepaid credits balance
//
// These are distinct from the region-specific minutes plans in
// constants/callingPlans.ts (US/UK/Canada monthly minute bundles for
// 9tel-number calling) — this file covers which *tier* applies to a given
// call based on who you're calling and your account's Premium status.

// Who you're calling. "unknown" is a deliberate, safe default — see
// services/callEligibility.ts's classifyDestination, which returns this
// whenever it can't positively confirm either case (e.g. backend
// unreachable) so the UI never has to guess and risk either blocking a
// legitimate 9tel call behind an ad gate or letting an unmetered carrier
// call through undetected.
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
// (destination kind) x (account Premium status):
//   - destination "9tel", isPremium true  -> "premium" (ad-free)
//   - destination "9tel", isPremium false -> "free" (rewarded-ad gated)
//   - destination "carrier"               -> "payg" (credits-billed)
//   - destination "unknown"               -> "unmetered" (fail open; no ad
//     gate and no credit check, since we can't tell which rule applies —
//     see classifyDestination's fail-open comment)
export type ResolvedCallPlan = "free" | "premium" | "payg" | "unmetered";

export function resolveCallPlan(destinationKind: CallDestinationKind, isPremium: boolean): ResolvedCallPlan {
  if (destinationKind === "9tel") return isPremium ? "premium" : "free";
  if (destinationKind === "carrier") return "payg";
  return "unmetered";
}
