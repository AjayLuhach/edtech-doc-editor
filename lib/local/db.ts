import Dexie, { type Table } from "dexie";

// Cached document metadata; the authoritative content lives in the updates log.
export interface LocalDoc {
  id: string;
  userId: string;
  title: string;
  updatedAt: number;
  lastServerSeq: number; // highest server seq pulled so far
  deleted?: 0 | 1;
}

// Append-only Yjs updates. synced=0 means not yet pushed (the offline queue).
export interface LocalUpdate {
  localSeq?: number;
  docId: string;
  data: Uint8Array;
  synced: 0 | 1;
  createdAt: number;
}

class LocalDb extends Dexie {
  documents!: Table<LocalDoc, string>;
  updates!: Table<LocalUpdate, number>;

  constructor() {
    super("edtech-doc-editor");
    this.version(1).stores({
      documents: "id, userId, updatedAt",
      updates: "++localSeq, docId, [docId+synced]",
    });
  }
}

// IndexedDB source of truth; instantiated only in the browser (imported from client modules).
export const localDb = new LocalDb();
