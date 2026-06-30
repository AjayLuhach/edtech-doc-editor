"use client";
import { useEffect, useState } from "react";
import type * as Y from "yjs";
import { createDoc } from "@/lib/crdt/doc";
import { ORIGIN_LOAD, ORIGIN_REMOTE } from "@/lib/crdt/origins";
import { applyUpdate, mergeUpdates } from "@/lib/crdt/updates";
import { appendUpdate, loadUpdates } from "@/lib/local/repo";

// Load a Y.Doc from the local store and persist every change back. Fully offline; nothing blocks the UI.
export function useYDoc(docId: string): { doc: Y.Doc | null; ready: boolean } {
  const [doc, setDoc] = useState<Y.Doc | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const ydoc = createDoc();
    let active = true;

    // Persist each change locally; remote-origin updates are already on the server (synced=1).
    const onUpdate = (update: Uint8Array, origin: unknown) => {
      if (origin === ORIGIN_LOAD) return;
      void appendUpdate(docId, update, origin === ORIGIN_REMOTE ? 1 : 0);
    };
    ydoc.on("update", onUpdate);
    setDoc(ydoc);

    void (async () => {
      const updates = await loadUpdates(docId);
      if (!active) return;
      if (updates.length > 0) applyUpdate(ydoc, mergeUpdates(updates), ORIGIN_LOAD);
      setReady(true);
    })();

    return () => {
      active = false;
      ydoc.off("update", onUpdate);
      ydoc.destroy();
      setDoc(null);
      setReady(false);
    };
  }, [docId]);

  return { doc, ready };
}
