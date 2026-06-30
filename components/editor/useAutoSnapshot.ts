"use client";
import { useEffect, useRef } from "react";
import type * as Y from "yjs";
import { ORIGIN_LOAD, ORIGIN_REMOTE } from "@/lib/crdt/origins";
import { getDocument } from "@/lib/local/repo";
import { createSnapshot } from "@/lib/versions/api";
import { snapshotState } from "@/lib/versions/snapshot";

const PERIODIC_MS = 120_000; // safety autosave during a long editing session
const MIN_GAP_MS = 30_000; // never autosave more often than this

// Auto-saves a version when the user leaves a document after editing it, plus a periodic safety save.
// Best-effort and rate-limited so the timeline doesn't fill with near-identical snapshots.
export function useAutoSnapshot(docId: string, doc: Y.Doc | null, ready: boolean, canEdit: boolean): void {
  const dirty = useRef(false);
  const lastAt = useRef(0);

  useEffect(() => {
    if (!doc || !ready || !canEdit) return;

    const online = () => typeof navigator === "undefined" || navigator.onLine;

    const onUpdate = (_u: Uint8Array, origin: unknown) => {
      if (origin !== ORIGIN_REMOTE && origin !== ORIGIN_LOAD) dirty.current = true;
    };
    doc.on("update", onUpdate);

    async function save(force: boolean) {
      if (!dirty.current || !online()) return;
      if (!force && Date.now() - lastAt.current < MIN_GAP_MS) return;
      dirty.current = false;
      lastAt.current = Date.now();
      try {
        const local = await getDocument(docId);
        await createSnapshot(docId, snapshotState(doc!), local?.lastServerSeq ?? 0, "Auto-saved");
      } catch {
        dirty.current = true; // failed (e.g. offline) — try again on the next trigger
      }
    }

    const interval = setInterval(() => void save(false), PERIODIC_MS);

    return () => {
      doc.off("update", onUpdate);
      clearInterval(interval);
      void save(true); // capture the latest edits when navigating away
    };
  }, [docId, doc, ready, canEdit]);
}
