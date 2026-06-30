// One entry in a document's version timeline (no state blob — that is fetched on restore).
export type SnapshotMeta = {
  id: string;
  label: string | null;
  authorName: string | null;
  createdAt: string;
};
