import type * as Y from "yjs";
import { createDoc, getContent, getMeta, getTitle } from "@/lib/crdt/doc";
import { ORIGIN_RESTORE } from "@/lib/crdt/origins";
import { applyTextDiff } from "@/lib/crdt/text";
import { applyUpdate, encodeState } from "@/lib/crdt/updates";

export function snapshotState(doc: Y.Doc): Uint8Array {
  return encodeState(doc);
}

// Safe restore: never rewind CRDT history (that would corrupt collaborators). Instead make the
// live content equal the snapshot's via a forward diff, which merges and syncs like any other edit.
export function restoreInto(doc: Y.Doc, snapshotState: Uint8Array): void {
  const temp = createDoc();
  applyUpdate(temp, snapshotState);
  const targetText = getContent(temp).toString();
  const targetTitle = getTitle(temp);
  temp.destroy();

  doc.transact(() => {
    const content = getContent(doc);
    applyTextDiff(content, content.toString(), targetText);
    getMeta(doc).set("title", targetTitle);
  }, ORIGIN_RESTORE);
}
