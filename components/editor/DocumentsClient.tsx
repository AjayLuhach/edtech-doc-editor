"use client";
import { useLiveQuery } from "dexie-react-hooks";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { FiFileText, FiPlus, FiTrash2 } from "react-icons/fi";
import { deleteServerDoc, listServerDocs } from "@/lib/docs/api";
import { createLocalDocument } from "@/lib/local/create-document";
import { deleteDocument, listDocuments } from "@/lib/local/repo";
import type { Role } from "@/types/auth";
import type { ServerDoc } from "@/types/docs";

type Row = { id: string; title: string; role: Role };

export default function DocumentsClient({ userId }: { userId: string }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [serverDocs, setServerDocs] = useState<ServerDoc[]>([]);
  const localDocs = useLiveQuery(() => listDocuments(userId), [userId], undefined);

  // Shared documents live only on the server until opened; merge them with the local list.
  useEffect(() => {
    void listServerDocs().then(setServerDocs);
  }, []);

  const rows = useMemo<Row[] | undefined>(() => {
    if (localDocs === undefined) return undefined;
    const map = new Map<string, Row>();
    for (const d of localDocs) map.set(d.id, { id: d.id, title: d.title || "Untitled", role: "owner" });
    for (const s of serverDocs) {
      const existing = map.get(s.id);
      if (existing) existing.role = s.role; // server knows the authoritative role for shared docs
      else map.set(s.id, { id: s.id, title: s.title || "Untitled", role: s.role });
    }
    return [...map.values()];
  }, [localDocs, serverDocs]);

  async function onCreate() {
    setCreating(true);
    try {
      const id = await createLocalDocument(userId, "Untitled");
      router.push(`/documents/${id}` as Route);
    } finally {
      setCreating(false);
    }
  }

  // Remove the local copy and delete on the server, and drop it from the merged list immediately.
  async function onDelete(id: string) {
    setServerDocs((prev) => prev.filter((d) => d.id !== id));
    await deleteDocument(id);
    try {
      await deleteServerDoc(id);
    } catch {
      // offline: the local copy is gone; the server delete retries are out of scope
    }
  }

  return (
    <div className="mt-6 flex flex-col gap-4">
      <button
        type="button"
        onClick={onCreate}
        disabled={creating}
        className="flex w-fit items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-700 disabled:opacity-60 dark:bg-white dark:text-neutral-900"
      >
        <FiPlus aria-hidden className="h-4 w-4" />
        New document
      </button>

      {rows === undefined ? (
        <p className="text-sm text-neutral-500">Loading your documents…</p>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-black/15 p-10 text-center text-neutral-500 dark:border-white/15">
          No documents yet. Create one — it works fully offline.
        </p>
      ) : (
        <ul className="divide-y divide-black/10 rounded-xl border border-black/10 dark:divide-white/10 dark:border-white/10">
          {rows.map((doc) => (
            <li key={doc.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <Link href={`/documents/${doc.id}` as Route} className="flex min-w-0 flex-1 items-center gap-3 hover:underline">
                <FiFileText aria-hidden className="h-4 w-4 shrink-0 text-neutral-400" />
                <span className="truncate">{doc.title}</span>
                {doc.role !== "owner" && (
                  <span className="shrink-0 rounded-full bg-black/5 px-2 py-0.5 text-xs text-neutral-500 dark:bg-white/10">
                    {doc.role === "editor" ? "Editor" : "Viewer"}
                  </span>
                )}
              </Link>
              <button
                type="button"
                aria-label={`Delete ${doc.title}`}
                onClick={() => onDelete(doc.id)}
                className="rounded-md p-1.5 text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
              >
                <FiTrash2 aria-hidden className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
