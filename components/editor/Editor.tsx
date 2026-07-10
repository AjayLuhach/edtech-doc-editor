"use client";
import type { Editor as TiptapEditor } from "@tiptap/react";
import { type ChangeEvent, useEffect, useState } from "react";
import { FiClock, FiUsers, FiZap } from "react-icons/fi";
import { getLegacyText, getMeta, getTitle } from "@/lib/crdt/doc";
import { ORIGIN_USER } from "@/lib/crdt/origins";
import { migrateLegacyBody } from "@/lib/crdt/richbody";
import { renameDocument } from "@/lib/local/repo";
import AiPanel from "./AiPanel";
import RichBody from "./RichBody";
import SharePanel from "./SharePanel";
import SyncIndicator from "./SyncIndicator";
import { useAutoSnapshot } from "./useAutoSnapshot";
import { useDocAccess } from "./useDocAccess";
import { useSync } from "./useSync";
import { docFromText } from "./useTiptap";
import { useYDoc } from "./useYDoc";
import VersionHistory from "./VersionHistory";

export default function Editor({ docId }: { docId: string }) {
  const { doc, ready } = useYDoc(docId);
  const { role, resolved } = useDocAccess(docId);
  const [title, setTitle] = useState("");
  const [editor, setEditor] = useState<TiptapEditor | null>(null);
  const [migrated, setMigrated] = useState(false);
  const [panel, setPanel] = useState<"none" | "history" | "share" | "ai">("none");
  const syncStatus = useSync(docId, doc, ready, title);
  const canEdit = role !== "viewer";
  useAutoSnapshot(docId, doc, ready, canEdit);

  // Mirror the Yjs title into the input; remote/load/restore changes refresh it, local edits don't.
  useEffect(() => {
    if (!doc || !ready) return;
    const meta = getMeta(doc);
    setTitle(getTitle(doc));
    const onMeta = (_e: unknown, tr: { origin: unknown }) => {
      if (tr.origin !== ORIGIN_USER) setTitle(getTitle(doc));
    };
    meta.observe(onMeta);
    return () => meta.unobserve(onMeta);
  }, [doc, ready]);

  // Upgrade pre-Tiptap docs before the editor binds; also catches legacy text arriving on first sync.
  useEffect(() => {
    if (!doc || !ready || !resolved) return;
    if (canEdit) migrateLegacyBody(doc);
    setMigrated(true);
    if (!canEdit) return;
    const legacy = getLegacyText(doc);
    const onLegacy = () => migrateLegacyBody(doc);
    legacy.observe(onLegacy);
    return () => legacy.unobserve(onLegacy);
  }, [doc, ready, resolved, canEdit]);

  // Replace the whole body (AI "Replace body"); flows through the Yjs binding like any edit.
  function applyBodyValue(next: string) {
    if (editor && canEdit) editor.commands.setContent(docFromText(next));
  }

  // Write a new title into Yjs + local metadata (shared by manual typing and AI "Use this title").
  function applyTitleValue(next: string) {
    if (!doc || !canEdit) return;
    doc.transact(() => getMeta(doc).set("title", next), ORIGIN_USER);
    setTitle(next);
    void renameDocument(docId, next);
  }

  function onTitleChange(e: ChangeEvent<HTMLInputElement>) {
    applyTitleValue(e.target.value);
  }

  if (!doc || !ready || !migrated) {
    return <p className="px-1 py-8 text-sm text-neutral-500">Loading document…</p>;
  }

  return (
    <div className="relative flex flex-1 flex-col gap-3">
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
          <button
            type="button"
            onClick={() => setPanel((p) => (p === "ai" ? "none" : "ai"))}
            aria-expanded={panel === "ai"}
            className="flex items-center gap-1.5 rounded-lg border border-black/15 px-3 py-1.5 text-sm transition-colors hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
          >
            <FiZap aria-hidden className="h-4 w-4" />
            AI
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
      {panel === "ai" && (
        <AiPanel
          docId={docId}
          title={title}
          getBody={() => editor?.getText() ?? ""}
          canEdit={canEdit}
          onApplyTitle={applyTitleValue}
          onApplyBody={applyBodyValue}
          onClose={() => setPanel("none")}
        />
      )}

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
      <RichBody doc={doc} canEdit={canEdit} onEditor={setEditor} />
    </div>
  );
}
