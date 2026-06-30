import type * as Y from "yjs";
import { ORIGIN_REMOTE } from "@/lib/crdt/origins";
import { applyUpdate, encodeStateVector } from "@/lib/crdt/updates";
import { markSynced, pendingUpdates, setLastServerSeq } from "@/lib/local/repo";
import { pullDiff, pushUpdates } from "./api";

// One reconcile cycle: push the offline queue, then pull missing ops via a state-vector diff.
// Push first so our work reaches the server before we ask for what we lack; the diff is gap-free.
export async function syncDocument(docId: string, doc: Y.Doc, title?: string): Promise<void> {
  const pending = await pendingUpdates(docId);
  if (pending.length > 0) {
    const { latestSeq } = await pushUpdates(docId, pending.map((p) => p.data), title);
    const ids = pending.map((p) => p.localSeq).filter((n): n is number => typeof n === "number");
    await markSynced(ids);
    if (latestSeq > 0) await setLastServerSeq(docId, latestSeq);
  }

  // The server returns exactly the ops missing from our state vector; applying our own is a no-op.
  const diff = await pullDiff(docId, encodeStateVector(doc));
  applyUpdate(doc, diff, ORIGIN_REMOTE);
}
