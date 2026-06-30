import { fromBase64, toBase64 } from "./base64";

// Carries the HTTP status so callers can distinguish 403 (no write access) from transient failures.
export class SyncError extends Error {
  constructor(public status: number) {
    super(`sync failed: ${status}`);
    this.name = "SyncError";
  }
}

export type PushResult = { seqs: number[]; latestSeq: number };

export async function pushUpdates(docId: string, updates: Uint8Array[], title?: string): Promise<PushResult> {
  const res = await fetch(`/api/docs/${docId}/push`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title, updates: updates.map(toBase64) }),
  });
  if (!res.ok) throw new SyncError(res.status);
  return res.json();
}

export type PullResult = { updates: { seq: number; data: Uint8Array }[]; latestSeq: number };

export async function pullUpdates(docId: string, since: number): Promise<PullResult> {
  const res = await fetch(`/api/docs/${docId}/pull?since=${since}`, { method: "GET" });
  if (!res.ok) throw new SyncError(res.status);
  const json = (await res.json()) as { updates: { seq: number; data: string }[]; latestSeq: number };
  return {
    updates: json.updates.map((u) => ({ seq: u.seq, data: fromBase64(u.data) })),
    latestSeq: json.latestSeq,
  };
}
