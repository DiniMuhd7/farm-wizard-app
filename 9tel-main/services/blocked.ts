import { authedJson } from "@/services/http";

export type BlockedNumber = { id: string; number: string; label: string; blockedAt: string };

export async function getBlockedNumbers(): Promise<BlockedNumber[]> {
  return (await authedJson<{ blocked: BlockedNumber[] }>("/api/v1/blocked")).blocked ?? [];
}

export async function blockNumber(number: string, label = ""): Promise<BlockedNumber> {
  const data = await authedJson<{ blocked: BlockedNumber }>("/api/v1/blocked", { method: "POST", body: { number, label } });
  return data.blocked;
}

export async function unblockNumber(id: string): Promise<void> {
  await authedJson(`/api/v1/blocked/${encodeURIComponent(id)}`, { method: "DELETE" });
}
