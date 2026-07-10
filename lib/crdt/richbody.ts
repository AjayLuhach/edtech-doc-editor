import * as Y from "yjs";
import { getBody, getLegacyText, getMeta } from "./doc";
import { ORIGIN_USER } from "./origins";

// One <paragraph> element per line of plain text (the Tiptap/ProseMirror block model).
function paragraphsFrom(text: string): Y.XmlElement[] {
  return text.split("\n").map((line) => {
    const p = new Y.XmlElement("paragraph");
    if (line.length > 0) p.insert(0, [new Y.XmlText(line)]);
    return p;
  });
}

// Append plain text to the rich body as paragraphs (used by seeding, migration, and legacy restore).
export function fillBodyFromText(doc: Y.Doc, text: string): void {
  const body = getBody(doc);
  body.insert(body.length, paragraphsFrom(text));
}

// Deep-copy a doc's rich body into unintegrated nodes that another doc can insert (used by restore).
export function cloneBodyNodes(doc: Y.Doc): Array<Y.XmlElement | Y.XmlText> {
  return getBody(doc)
    .toArray()
    .map((n) => n.clone())
    .filter((n): n is Y.XmlElement | Y.XmlText => n instanceof Y.XmlElement || n instanceof Y.XmlText);
}

// One-time upgrade of pre-Tiptap docs: lift the legacy plain-text body into the rich-text fragment.
// Editors only (a viewer's migration could never push); the meta flag keeps other clients from repeating it.
export function migrateLegacyBody(doc: Y.Doc): void {
  const meta = getMeta(doc);
  const legacy = getLegacyText(doc).toString();
  if (meta.get("bodyMigrated") === true || legacy.length === 0) return;
  doc.transact(() => {
    fillBodyFromText(doc, legacy);
    meta.set("bodyMigrated", true);
  }, ORIGIN_USER);
}
