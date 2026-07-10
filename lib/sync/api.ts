import type { ActionError } from "@/types/actions";
import { pullAction, pushAction } from "./actions";

// Carries an HTTP-like status so callers can distinguish 403 (no write access) from transient failures.
export class SyncError extends Error {
  constructor(public status: number) {
    super(`sync failed: ${status}`);
    this.name = "SyncError";
  }
}

const STATUS: Record<ActionError, number> = {
  unauthorized: 401,
  forbidden: 403,
  "not-found": 404,
  invalid: 400,
  server: 500,
};

export type PushResult = { seqs: number[]; latestSeq: number };

// Thin client adapter over the sync server actions; keeps the engine free of transport details.
export async function pushUpdates(docId: string, updates: Uint8Array[], title?: string): Promise<PushResult> {
  const res = await pushAction(docId, updates, title);
  if (!res.ok) throw new SyncError(STATUS[res.error]);
  return { seqs: res.seqs, latestSeq: res.latestSeq };
}

// Send our state vector, receive exactly the updates we are missing (an empty diff if we are current).
export async function pullDiff(docId: string, stateVector: Uint8Array): Promise<Uint8Array> {
  const res = await pullAction(docId, stateVector);
  if (!res.ok) throw new SyncError(STATUS[res.error]);
  return res.diff;
}
