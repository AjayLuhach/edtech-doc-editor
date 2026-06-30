"use client";
import { useEffect, useRef, useState } from "react";
import type * as Y from "yjs";
import { ORIGIN_LOAD, ORIGIN_REMOTE } from "@/lib/crdt/origins";
import { SyncError } from "@/lib/sync/api";
import { syncDocument } from "@/lib/sync/engine";

export type SyncStatus = "syncing" | "synced" | "offline" | "error" | "forbidden";

const POLL_MS = 5000;
const DEBOUNCE_MS = 800;

// Drives reconcile cycles from edits, reconnects, and polling; coalesces overlaps so only one runs at a time.
export function useSync(docId: string, doc: Y.Doc | null, ready: boolean, title: string): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>("syncing");
  const titleRef = useRef(title);
  titleRef.current = title;

  useEffect(() => {
    if (!doc || !ready) return;
    let cancelled = false;
    let running = false;
    let queued = false;
    let debounce: ReturnType<typeof setTimeout> | undefined;

    async function run() {
      if (cancelled) return;
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setStatus("offline");
        return;
      }
      if (running) {
        queued = true; // collapse concurrent triggers into one follow-up run
        return;
      }
      running = true;
      setStatus("syncing");
      try {
        await syncDocument(docId, doc!, titleRef.current);
        if (!cancelled) setStatus("synced");
      } catch (err) {
        if (cancelled) return;
        if (err instanceof SyncError && err.status === 403) setStatus("forbidden");
        else if (typeof navigator !== "undefined" && !navigator.onLine) setStatus("offline");
        else setStatus("error");
      } finally {
        running = false;
        if (queued && !cancelled) {
          queued = false;
          void run();
        }
      }
    }

    const onUpdate = (_u: Uint8Array, origin: unknown) => {
      if (origin === ORIGIN_REMOTE || origin === ORIGIN_LOAD) return; // only local edits trigger a push
      clearTimeout(debounce);
      debounce = setTimeout(() => void run(), DEBOUNCE_MS);
    };
    const onOnline = () => void run();
    const onOffline = () => setStatus("offline");

    doc.on("update", onUpdate);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    const interval = setInterval(() => void run(), POLL_MS);
    void run();

    return () => {
      cancelled = true;
      doc.off("update", onUpdate);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      clearInterval(interval);
      clearTimeout(debounce);
    };
  }, [docId, doc, ready]);

  return status;
}
