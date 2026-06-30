import { sql } from "drizzle-orm";
import { createDoc } from "@/lib/crdt/doc";
import { applyUpdate, encodeState } from "@/lib/crdt/updates";
import { withUser } from "@/lib/db/client";

// Compact once a document accumulates this many uncompacted updates.
export const COMPACT_THRESHOLD = 50;

// Merge the uncompacted updates into a single base and drop them, bounding storage and pull cost.
// Runs under a row lock so it serializes against other compactions and concurrent pushes to this doc.
export async function compactDocument(docId: string, userId: string): Promise<void> {
  await withUser(userId, async (tx) => {
    const docRows = (await tx.execute(
      sql`select compacted_state, compacted_seq from documents where id = ${docId} for update`,
    )) as unknown as Array<{ compacted_state: Uint8Array | null; compacted_seq: number | string }>;
    if (docRows.length === 0) return;

    const compactedSeq = Number(docRows[0].compacted_seq);
    const updateRows = (await tx.execute(
      sql`select seq, update from document_updates where document_id = ${docId} and seq > ${compactedSeq} order by seq asc`,
    )) as unknown as Array<{ seq: number | string; update: Uint8Array }>;
    if (updateRows.length < COMPACT_THRESHOLD) return;

    const maxSeq = Number(updateRows[updateRows.length - 1].seq);
    const doc = createDoc();
    if (docRows[0].compacted_state) applyUpdate(doc, docRows[0].compacted_state);
    for (const r of updateRows) applyUpdate(doc, r.update);
    const merged = encodeState(doc);
    doc.destroy();

    await tx.execute(sql`select app_compact(${docId}, ${Buffer.from(merged)}, ${maxSeq})`);
  });
}
