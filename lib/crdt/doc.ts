import * as Y from "yjs";

// A document is one Y.Doc: rich-text body under the "body" XML fragment, title under the "meta" map.
// "content" is the pre-Tiptap plain-text body, kept only so old docs and snapshots can be upgraded.
const BODY_KEY = "body";
const LEGACY_TEXT_KEY = "content";
const META_KEY = "meta";

export function createDoc(): Y.Doc {
  return new Y.Doc();
}

export function getBody(doc: Y.Doc): Y.XmlFragment {
  return doc.getXmlFragment(BODY_KEY);
}

export function getLegacyText(doc: Y.Doc): Y.Text {
  return doc.getText(LEGACY_TEXT_KEY);
}

export function getMeta(doc: Y.Doc): Y.Map<unknown> {
  return doc.getMap(META_KEY);
}

export function getTitle(doc: Y.Doc): string {
  const title = getMeta(doc).get("title");
  return typeof title === "string" ? title : "";
}
