"use client";
import { useEffect, useState } from "react";
import { FiRotateCcw, FiSave, FiX } from "react-icons/fi";
import type * as Y from "yjs";
import { getDocument } from "@/lib/local/repo";
import { createSnapshot, getSnapshotState, listSnapshots } from "@/lib/versions/api";
import { restoreInto, snapshotState } from "@/lib/versions/snapshot";
import type { SnapshotMeta } from "@/types/versions";

export default function VersionHistory({
  docId,
  doc,
  onClose,
}: {
  docId: string;
  doc: Y.Doc;
  onClose: () => void;
}) {
  const [versions, setVersions] = useState<SnapshotMeta[] | null>(null);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      setVersions(await listSnapshots(docId));
    } catch {
      setError("Couldn't load versions.");
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId]);

  async function onSave() {
    setBusy(true);
    setError(null);
    try {
      const local = await getDocument(docId);
      await createSnapshot(docId, snapshotState(doc), local?.lastServerSeq ?? 0, label.trim() || undefined);
      setLabel("");
      await refresh();
    } catch {
      setError("Couldn't save this version — you may not have edit access.");
    } finally {
      setBusy(false);
    }
  }

  async function onRestore(id: string) {
    setBusy(true);
    setError(null);
    try {
      restoreInto(doc, await getSnapshotState(docId, id));
    } catch {
      setError("Couldn't restore this version.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-black/10 p-4 dark:border-white/10" aria-label="Version history">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Version history</h2>
        <button type="button" aria-label="Close version history" onClick={onClose} className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200">
          <FiX className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 flex gap-2">
        <input
          aria-label="Version label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label (optional)"
          className="flex-1 rounded-lg border border-black/15 bg-transparent px-3 py-1.5 text-sm outline-none focus:border-neutral-900 dark:border-white/15"
        />
        <button
          type="button"
          onClick={onSave}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-60 dark:bg-white dark:text-neutral-900"
        >
          <FiSave aria-hidden className="h-4 w-4" />
          Save version
        </button>
      </div>

      {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}

      <ul className="mt-3 flex flex-col divide-y divide-black/5 dark:divide-white/5">
        {versions === null ? (
          <li className="py-2 text-sm text-neutral-500">Loading…</li>
        ) : versions.length === 0 ? (
          <li className="py-2 text-sm text-neutral-500">No saved versions yet.</li>
        ) : (
          versions.map((v) => (
            <li key={v.id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{v.label || "Untitled version"}</p>
                <p className="text-xs text-neutral-500">
                  {new Date(v.createdAt).toLocaleString()}
                  {v.authorName ? ` · ${v.authorName}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onRestore(v.id)}
                disabled={busy}
                className="flex items-center gap-1.5 rounded-lg border border-black/15 px-2.5 py-1 text-xs hover:bg-black/5 disabled:opacity-60 dark:border-white/15 dark:hover:bg-white/10"
              >
                <FiRotateCcw aria-hidden className="h-3.5 w-3.5" />
                Restore
              </button>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
