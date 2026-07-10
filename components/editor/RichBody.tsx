"use client";
import { type Editor, EditorContent } from "@tiptap/react";
import { useEffect } from "react";
import type * as Y from "yjs";
import Toolbar from "./Toolbar";
import { useTiptap } from "./useTiptap";

// The collaborative rich-text surface; hands the editor instance up so the AI panel can read/replace text.
export default function RichBody({
  doc,
  canEdit,
  onEditor,
}: {
  doc: Y.Doc;
  canEdit: boolean;
  onEditor: (editor: Editor | null) => void;
}) {
  const editor = useTiptap(doc, canEdit);

  useEffect(() => {
    onEditor(editor);
    return () => onEditor(null);
  }, [editor, onEditor]);

  // Role can resolve after the editor mounts (e.g. server says viewer) — keep editability in sync.
  useEffect(() => {
    if (editor && editor.isEditable !== canEdit) editor.setEditable(canEdit);
  }, [editor, canEdit]);

  return (
    <div className="flex flex-1 flex-col gap-3">
      {canEdit && <Toolbar editor={editor} />}
      <EditorContent editor={editor} className="flex flex-1 flex-col [&>div]:flex-1" />
    </div>
  );
}
