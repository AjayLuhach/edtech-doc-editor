"use client";
import { type ChangeEvent, useEffect, useState } from "react";
import { getContent, getMeta, getTitle } from "@/lib/crdt/doc";
import { ORIGIN_USER } from "@/lib/crdt/origins";
import { applyTextDiff } from "@/lib/crdt/text";
import { renameDocument } from "@/lib/local/repo";
import { useYDoc } from "./useYDoc";

export default function Editor({ docId }: { docId: string }) {
  const { doc, ready } = useYDoc(docId);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  // Mirror Yjs into React state; remote/load changes refresh the inputs, local edits don't (no caret jump).
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
    if (!doc) return;
    const next = e.target.value;
    const content = getContent(doc);
    const prev = content.toString();
    doc.transact(() => applyTextDiff(content, prev, next), ORIGIN_USER);
    setBody(next);
  }

  function onTitleChange(e: ChangeEvent<HTMLInputElement>) {
    if (!doc) return;
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
      <label htmlFor="doc-title" className="sr-only">
        Document title
      </label>
      <input
        id="doc-title"
        value={title}
        onChange={onTitleChange}
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
        placeholder="Start writing… your edits are saved locally and work offline."
        className="min-h-[60vh] w-full flex-1 resize-none bg-transparent text-base leading-7 outline-none placeholder:text-neutral-400"
      />
    </div>
  );
}
