import type * as Y from "yjs";
import { ORIGIN_REMOTE } from "@/lib/crdt/origins";
import { applyUpdate } from "@/lib/crdt/updates";
import { getDocument, markSynced, pendingUpdates, setLastServerSeq } from "@/lib/local/repo";
import { pullUpdates, pushUpdates } from "./api";

// One reconcile cycle: push the offline queue, then pull remote updates. Order matters — push first so
// our work reaches the server before we advance the cursor, and Yjs makes re-applying our own pushes a no-op.
export async function syncDocument(docId: string, doc: Y.Doc, title?: string): Promise<void> {
  const pending = await pendingUpdates(docId);
  if (pending.length > 0) {
    await pushUpdates(docId, pending.map((p) => p.data), title);
    const ids = pending.map((p) => p.localSeq).filter((n): n is number => typeof n === "number");
    await markSynced(ids);
  }

  const local = await getDocument(docId);
  const since = local?.lastServerSeq ?? 0;
  const { updates, latestSeq } = await pullUpdates(docId, since);
  // Apply as remote so the persistence layer records them as already-synced; Yjs dedupes our own.
  for (const u of updates) applyUpdate(doc, u.data, ORIGIN_REMOTE);
  if (latestSeq > since) await setLastServerSeq(docId, latestSeq);
}
