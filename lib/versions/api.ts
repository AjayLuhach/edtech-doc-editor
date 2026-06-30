import { fromBase64, toBase64 } from "@/lib/sync/base64";
import type { SnapshotMeta } from "@/types/versions";

export async function createSnapshot(
  docId: string,
  state: Uint8Array,
  uptoSeq: number,
  label?: string,
): Promise<void> {
  const res = await fetch(`/api/docs/${docId}/snapshots`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ label, uptoSeq, state: toBase64(state) }),
  });
  if (!res.ok) throw new Error(`save version failed: ${res.status}`);
}

export async function listSnapshots(docId: string): Promise<SnapshotMeta[]> {
  const res = await fetch(`/api/docs/${docId}/snapshots`);
  if (!res.ok) throw new Error(`load versions failed: ${res.status}`);
  return ((await res.json()) as { snapshots: SnapshotMeta[] }).snapshots;
}

export async function getSnapshotState(docId: string, snapshotId: string): Promise<Uint8Array> {
  const res = await fetch(`/api/docs/${docId}/snapshots/${snapshotId}`);
  if (!res.ok) throw new Error(`load version failed: ${res.status}`);
  return fromBase64(((await res.json()) as { state: string }).state);
}
