import type * as Y from "yjs";
import { ORIGIN_LOAD } from "@/lib/crdt/origins";
import { migrateLegacyBody } from "@/lib/crdt/richbody";
import { applyUpdate, mergeUpdates } from "@/lib/crdt/updates";
import { loadUpdates } from "./repo";

// Cross-tab-safe legacy upgrade: serialize on a Web Lock and re-read the local store first, so a
// migration another tab already ran (and persisted) is applied here instead of being duplicated.
export async function migrateBodyOnce(docId: string, doc: Y.Doc): Promise<void> {
  const run = async () => {
    const updates = await loadUpdates(docId);
    if (updates.length > 0) applyUpdate(doc, mergeUpdates(updates), ORIGIN_LOAD);
    migrateLegacyBody(doc);
  };
  if (typeof navigator !== "undefined" && navigator.locks) {
    await navigator.locks.request(`doc-migrate:${docId}`, run);
  } else {
    await run();
  }
}
