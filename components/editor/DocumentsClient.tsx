"use client";
import { useLiveQuery } from "dexie-react-hooks";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FiFileText, FiPlus, FiTrash2 } from "react-icons/fi";
import { createLocalDocument } from "@/lib/local/create-document";
import { deleteDocument, listDocuments } from "@/lib/local/repo";

export default function DocumentsClient({ userId }: { userId: string }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const docs = useLiveQuery(() => listDocuments(userId), [userId], undefined);

  async function onCreate() {
    setCreating(true);
    try {
      const id = await createLocalDocument(userId, "Untitled");
      router.push(`/documents/${id}` as Route);
    } finally {
      setCreating(false);
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

      {docs === undefined ? (
        <p className="text-sm text-neutral-500">Loading your documents…</p>
      ) : docs.length === 0 ? (
        <p className="rounded-xl border border-dashed border-black/15 p-10 text-center text-neutral-500 dark:border-white/15">
          No documents yet. Create one — it works fully offline.
        </p>
      ) : (
        <ul className="divide-y divide-black/10 rounded-xl border border-black/10 dark:divide-white/10 dark:border-white/10">
          {docs.map((doc) => (
            <li key={doc.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <Link
                href={`/documents/${doc.id}` as Route}
                className="flex min-w-0 flex-1 items-center gap-3 hover:underline"
              >
                <FiFileText aria-hidden className="h-4 w-4 shrink-0 text-neutral-400" />
                <span className="truncate">{doc.title || "Untitled"}</span>
              </Link>
              <button
                type="button"
                aria-label={`Delete ${doc.title || "Untitled"}`}
                onClick={() => deleteDocument(doc.id)}
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
