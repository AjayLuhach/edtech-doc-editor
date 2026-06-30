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

// Send our state vector, receive exactly the updates we are missing (an empty diff if we are current).
export async function pullDiff(docId: string, stateVector: Uint8Array): Promise<Uint8Array> {
  const res = await fetch(`/api/docs/${docId}/pull`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sv: toBase64(stateVector) }),
  });
  if (!res.ok) throw new SyncError(res.status);
  const json = (await res.json()) as { diff: string };
  return fromBase64(json.diff);
}
