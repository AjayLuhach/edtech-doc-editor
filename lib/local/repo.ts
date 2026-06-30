import { localDb, type LocalDoc, type LocalUpdate } from "./db";

export async function listDocuments(userId: string): Promise<LocalDoc[]> {
  const docs = await localDb.documents.where("userId").equals(userId).toArray();
  return docs.filter((d) => !d.deleted).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getDocument(id: string): Promise<LocalDoc | undefined> {
  return localDb.documents.get(id);
}

export async function createDocument(userId: string, id: string, title: string): Promise<void> {
  await localDb.documents.put({ id, userId, title, updatedAt: Date.now(), lastServerSeq: 0 });
}

export async function renameDocument(id: string, title: string): Promise<void> {
  await localDb.documents.update(id, { title, updatedAt: Date.now() });
}

export async function deleteDocument(id: string): Promise<void> {
  await localDb.documents.update(id, { deleted: 1, updatedAt: Date.now() });
}

// Persist one Yjs update and bump the document's updatedAt in a single transaction.
export async function appendUpdate(docId: string, data: Uint8Array, synced: 0 | 1): Promise<void> {
  await localDb.transaction("rw", localDb.updates, localDb.documents, async () => {
    await localDb.updates.add({ docId, data, synced, createdAt: Date.now() });
    await localDb.documents.update(docId, { updatedAt: Date.now() });
  });
}

export async function loadUpdates(docId: string): Promise<Uint8Array[]> {
  const rows = await localDb.updates.where("docId").equals(docId).toArray();
  return rows.map((r) => r.data);
}

export function pendingUpdates(docId: string): Promise<LocalUpdate[]> {
  return localDb.updates.where("[docId+synced]").equals([docId, 0]).toArray();
}

export async function markSynced(localSeqs: number[]): Promise<void> {
  await localDb.updates.where("localSeq").anyOf(localSeqs).modify({ synced: 1 });
}

export async function setLastServerSeq(docId: string, seq: number): Promise<void> {
  await localDb.documents.update(docId, { lastServerSeq: seq });
}
