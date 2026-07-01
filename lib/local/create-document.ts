import { createDoc, getMeta } from "@/lib/crdt/doc";
import { ORIGIN_USER } from "@/lib/crdt/origins";
import { encodeState } from "@/lib/crdt/updates";
import { uuidv4 } from "@/lib/id";
import { appendUpdate, createDocument } from "./repo";

// Create a document entirely locally (no network): seed its title into the Yjs state and queue it.
export async function createLocalDocument(userId: string, title: string): Promise<string> {
  const id = uuidv4();
  const doc = createDoc();
  doc.transact(() => getMeta(doc).set("title", title), ORIGIN_USER);
  const state = encodeState(doc);
  doc.destroy();

  await createDocument(userId, id, title);
  await appendUpdate(id, state, 0);
  return id;
}
