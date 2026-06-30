"use client";
import { type ChangeEvent, useEffect, useState } from "react";
import { FiClock, FiUsers } from "react-icons/fi";
import { getContent, getMeta, getTitle } from "@/lib/crdt/doc";
import { ORIGIN_USER } from "@/lib/crdt/origins";
import { applyTextDiff } from "@/lib/crdt/text";
import { renameDocument } from "@/lib/local/repo";
import SharePanel from "./SharePanel";
import SyncIndicator from "./SyncIndicator";
import { useAutoSnapshot } from "./useAutoSnapshot";
import { useDocAccess } from "./useDocAccess";
import { useSync } from "./useSync";
import { useYDoc } from "./useYDoc";
import VersionHistory from "./VersionHistory";

export default function Editor({ docId }: { docId: string }) {
  const { doc, ready } = useYDoc(docId);
  const { role } = useDocAccess(docId);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [panel, setPanel] = useState<"none" | "history" | "share">("none");
  const syncStatus = useSync(docId, doc, ready, title);
  const canEdit = role !== "viewer";
  useAutoSnapshot(docId, doc, ready, canEdit);

  // Mirror Yjs into React state; remote/load/restore changes refresh the inputs, local edits don't.
  useEffect(() => {
    if (!doc || !ready) return;
    const content = getContent(doc);
    const meta = getMeta(doc);
    setTitle(getTitle(doc));
    setBody(content.toString());

    const onContent = (_e: unknown, tr: { origin: unknown }) => {
      if (tr.origin !== ORIGIN_USER) setBody(content.toString());
    };
    const onMeta = (_e: unknown, tr: { origin: unknown }) => {
      if (tr.origin !== ORIGIN_USER) setTitle(getTitle(doc));
    };
    content.observe(onContent);
    meta.observe(onMeta);
    return () => {
      content.unobserve(onContent);
      meta.unobserve(onMeta);
    };
  }, [doc, ready]);

  function onBodyChange(e: ChangeEvent<HTMLTextAreaElement>) {
    if (!doc || !canEdit) return;
    const next = e.target.value;
    const content = getContent(doc);
    doc.transact(() => applyTextDiff(content, content.toString(), next), ORIGIN_USER);
    setBody(next);
  }

  function onTitleChange(e: ChangeEvent<HTMLInputElement>) {
    if (!doc || !canEdit) return;
    const next = e.target.value;
    doc.transact(() => getMeta(doc).set("title", next), ORIGIN_USER);
    setTitle(next);
    void renameDocument(docId, next);
  }

  if (!doc || !ready) {
    return <p className="px-1 py-8 text-sm text-neutral-500">Loading document…</p>;
  }

  return (
    <div className="flex flex-1 flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPanel((p) => (p === "history" ? "none" : "history"))}
            aria-expanded={panel === "history"}
            className="flex items-center gap-1.5 rounded-lg border border-black/15 px-3 py-1.5 text-sm transition-colors hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
          >
            <FiClock aria-hidden className="h-4 w-4" />
            History
          </button>
          {role === "owner" && (
            <button
              type="button"
              onClick={() => setPanel((p) => (p === "share" ? "none" : "share"))}
              aria-expanded={panel === "share"}
              className="flex items-center gap-1.5 rounded-lg border border-black/15 px-3 py-1.5 text-sm transition-colors hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
            >
              <FiUsers aria-hidden className="h-4 w-4" />
              Share
            </button>
          )}
        </div>
        <SyncIndicator status={syncStatus} />
      </div>

      {panel === "history" && <VersionHistory docId={docId} doc={doc} onClose={() => setPanel("none")} />}
      {panel === "share" && <SharePanel docId={docId} onClose={() => setPanel("none")} />}

      {!canEdit && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
          You have view-only access to this document.
        </p>
      )}

      <label htmlFor="doc-title" className="sr-only">
        Document title
      </label>
      <input
        id="doc-title"
        value={title}
        onChange={onTitleChange}
        readOnly={!canEdit}
        placeholder="Untitled"
        className="w-full bg-transparent text-2xl font-semibold outline-none placeholder:text-neutral-400"
      />
      <label htmlFor="doc-body" className="sr-only">
        Document body
      </label>
      <textarea
        id="doc-body"
        value={body}
        onChange={onBodyChange}
        readOnly={!canEdit}
        placeholder="Start writing… your edits are saved locally and work offline."
        className="min-h-[60vh] w-full flex-1 resize-none bg-transparent text-base leading-7 outline-none placeholder:text-neutral-400"
      />
    </div>
  );
}
