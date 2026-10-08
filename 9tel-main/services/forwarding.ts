import { authedJson } from "@/services/http";

export type ForwardingMode = "always" | "no_answer";
export type Forwarding = { enabled: boolean; mode: ForwardingMode; number: string | null };

export async function getForwarding(): Promise<{ forwarding: Forwarding; hasNumber: boolean }> {
  return authedJson("/api/v1/forwarding");
}

export async function saveForwarding(input: Forwarding): Promise<Forwarding> {
  const data = await authedJson<{ forwarding: Forwarding }>("/api/v1/forwarding", { method: "PUT", body: input });
  return data.forwarding;
}
