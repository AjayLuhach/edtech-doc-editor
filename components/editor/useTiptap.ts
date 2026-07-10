"use client";
import Collaboration from "@tiptap/extension-collaboration";
import { Placeholder } from "@tiptap/extensions";
import { type Editor, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import type * as Y from "yjs";
import { getBody } from "@/lib/crdt/doc";

// A Tiptap editor bound to the shared Yjs fragment — every edit flows through the CRDT, never HTML state.
export function useTiptap(doc: Y.Doc, canEdit: boolean): Editor | null {
  return useEditor(
    {
      extensions: [
        // Collaboration ships its own Yjs-aware undo, so the plain undoRedo history must be off.
        StarterKit.configure({ undoRedo: false, link: { openOnClick: false } }),
        Collaboration.configure({ fragment: getBody(doc) }),
        Placeholder.configure({
          placeholder: "Start writing… your edits are saved locally and work offline.",
        }),
      ],
      editable: canEdit,
      // The Yjs doc only exists client-side; skip SSR rendering to avoid a hydration mismatch.
      immediatelyRender: false,
      editorProps: { attributes: { class: "tiptap-body", "aria-label": "Document body" } },
    },
    [doc],
  );
}

// Plain text → ProseMirror doc JSON (one paragraph per line) for programmatic body replacement.
export function docFromText(text: string): object {
  return {
    type: "doc",
    content: text.split("\n").map((line) => ({
      type: "paragraph",
      ...(line.length > 0 ? { content: [{ type: "text", text: line }] } : {}),
    })),
  };
}
