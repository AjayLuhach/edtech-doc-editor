import * as Y from "yjs";

// A document is one Y.Doc: body text under "content", title under the "meta" map.
const CONTENT_KEY = "content";
const META_KEY = "meta";

export function createDoc(): Y.Doc {
  return new Y.Doc();
}

export function getContent(doc: Y.Doc): Y.Text {
  return doc.getText(CONTENT_KEY);
}

export function getMeta(doc: Y.Doc): Y.Map<unknown> {
  return doc.getMap(META_KEY);
}

export function getTitle(doc: Y.Doc): string {
  const title = getMeta(doc).get("title");
  return typeof title === "string" ? title : "";
}
