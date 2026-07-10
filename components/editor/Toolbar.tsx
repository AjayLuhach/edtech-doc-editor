"use client";
import { type Editor, useEditorState } from "@tiptap/react";
import type { IconType } from "react-icons";
import {
  LuBold,
  LuCode,
  LuHeading1,
  LuHeading2,
  LuItalic,
  LuList,
  LuListOrdered,
  LuRedo2,
  LuStrikethrough,
  LuTextQuote,
  LuUndo2,
} from "react-icons/lu";

type Item = { key: string; icon: IconType; label: string; run: (e: Editor) => void; active?: (e: Editor) => boolean };

const ITEMS: Item[] = [
  { key: "undo", icon: LuUndo2, label: "Undo", run: (e) => e.chain().focus().undo().run() },
  { key: "redo", icon: LuRedo2, label: "Redo", run: (e) => e.chain().focus().redo().run() },
  {
    key: "h1",
    icon: LuHeading1,
    label: "Heading 1",
    run: (e) => e.chain().focus().toggleHeading({ level: 1 }).run(),
    active: (e) => e.isActive("heading", { level: 1 }),
  },
  {
    key: "h2",
    icon: LuHeading2,
    label: "Heading 2",
    run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
    active: (e) => e.isActive("heading", { level: 2 }),
  },
  { key: "bold", icon: LuBold, label: "Bold", run: (e) => e.chain().focus().toggleBold().run(), active: (e) => e.isActive("bold") },
  { key: "italic", icon: LuItalic, label: "Italic", run: (e) => e.chain().focus().toggleItalic().run(), active: (e) => e.isActive("italic") },
  { key: "strike", icon: LuStrikethrough, label: "Strikethrough", run: (e) => e.chain().focus().toggleStrike().run(), active: (e) => e.isActive("strike") },
  { key: "bullet", icon: LuList, label: "Bullet list", run: (e) => e.chain().focus().toggleBulletList().run(), active: (e) => e.isActive("bulletList") },
  { key: "ordered", icon: LuListOrdered, label: "Numbered list", run: (e) => e.chain().focus().toggleOrderedList().run(), active: (e) => e.isActive("orderedList") },
  { key: "quote", icon: LuTextQuote, label: "Blockquote", run: (e) => e.chain().focus().toggleBlockquote().run(), active: (e) => e.isActive("blockquote") },
  { key: "code", icon: LuCode, label: "Code block", run: (e) => e.chain().focus().toggleCodeBlock().run(), active: (e) => e.isActive("codeBlock") },
];

export default function Toolbar({ editor }: { editor: Editor | null }) {
  // Subscribes to editor state so active-button highlights follow the selection.
  const active = useEditorState({
    editor,
    selector: ({ editor: e }) => (e ? ITEMS.map((i) => (i.active ? i.active(e) : false)) : null),
  });

  if (!editor) return null;
  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      className="flex flex-wrap items-center gap-1 rounded-lg border border-black/10 p-1 dark:border-white/10"
    >
      {ITEMS.map((item, i) => (
        <button
          key={item.key}
          type="button"
          aria-label={item.label}
          aria-pressed={active?.[i] ?? false}
          title={item.label}
          onClick={() => item.run(editor)}
          className={`rounded-md p-1.5 transition-colors hover:bg-black/5 dark:hover:bg-white/10 ${
            active?.[i] ? "bg-black/10 dark:bg-white/15" : ""
          }`}
        >
          <item.icon aria-hidden className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}
