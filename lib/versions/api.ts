import type { SnapshotMeta } from "@/types/versions";
import { createSnapshotAction, getSnapshotStateAction, listSnapshotsAction } from "./actions";

// Client adapters over the version server actions; failures surface as exceptions for the panels.

export async function createSnapshot(
  docId: string,
  state: Uint8Array,
  uptoSeq: number,
  label?: string,
): Promise<void> {
  const res = await createSnapshotAction(docId, state, uptoSeq, label);
  if (!res.ok) throw new Error(`save version failed: ${res.error}`);
}

export async function listSnapshots(docId: string): Promise<SnapshotMeta[]> {
  const res = await listSnapshotsAction(docId);
  if (!res.ok) throw new Error(`load versions failed: ${res.error}`);
  return res.snapshots;
}

export async function getSnapshotState(docId: string, snapshotId: string): Promise<Uint8Array> {
  const res = await getSnapshotStateAction(docId, snapshotId);
  if (!res.ok) throw new Error(`load version failed: ${res.error}`);
  return res.state;
}
