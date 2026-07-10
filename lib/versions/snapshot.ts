import type * as Y from "yjs";
import { createDoc, getBody, getLegacyText, getMeta, getTitle } from "@/lib/crdt/doc";
import { ORIGIN_RESTORE } from "@/lib/crdt/origins";
import { cloneBodyNodes, fillBodyFromText } from "@/lib/crdt/richbody";
import { applyUpdate, encodeState } from "@/lib/crdt/updates";

export function snapshotState(doc: Y.Doc): Uint8Array {
  return encodeState(doc);
}

// Safe restore: never rewind CRDT history (that would corrupt collaborators). Instead overwrite the
// live body with the snapshot's nodes in one transaction, which merges and syncs like any other edit.
export function restoreInto(doc: Y.Doc, snapshotState: Uint8Array): void {
  const temp = createDoc();
  applyUpdate(temp, snapshotState);
  // Pre-Tiptap snapshots stored plain text only; lift it into paragraphs before reading nodes.
  const legacy = getLegacyText(temp).toString();
  if (getBody(temp).length === 0 && legacy.length > 0) fillBodyFromText(temp, legacy);
  const nodes = cloneBodyNodes(temp);
  const targetTitle = getTitle(temp);

  doc.transact(() => {
    const body = getBody(doc);
    if (body.length > 0) body.delete(0, body.length);
    body.insert(0, nodes);
    getMeta(doc).set("title", targetTitle);
  }, ORIGIN_RESTORE);
  temp.destroy();
}
