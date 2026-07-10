"use server";
import { sql } from "drizzle-orm";
import { after } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { createDoc } from "@/lib/crdt/doc";
import { applyUpdate, diffFrom } from "@/lib/crdt/updates";
import { withUser } from "@/lib/db/client";
import { isRlsDenial } from "@/lib/db/errors";
import { pullSchema, pushSchema } from "@/lib/validation/sync";
import type { ActionResult } from "@/types/actions";
import { COMPACT_THRESHOLD, compactDocument } from "./compaction";

// Yjs updates travel as raw Uint8Array — React serializes typed arrays across the action boundary.
// Next's server-action bodySizeLimit (next.config.ts) is the OOM guard; zod bounds the parsed sizes.

export async function pushAction(
  docId: string,
  updates: Uint8Array[],
  title?: string,
): Promise<ActionResult<{ seqs: number[]; latestSeq: number }>> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthorized" };
  if (!z.uuid().safeParse(docId).success) return { ok: false, error: "invalid" };

  const parsed = pushSchema.safeParse({ title, updates });
  if (!parsed.success) return { ok: false, error: "invalid" };

  try {
    const result = await withUser(session.userId, async (tx) => {
      // Bootstrap the server document the first time a locally-created doc is pushed.
      const roleRows = (await tx.execute(
        sql`select app_ensure_document(${docId}, ${parsed.data.title ?? null}) as role`,
      )) as unknown as Array<{ role: string | null }>;
      // Null means the doc exists but the caller is not a member — don't leak its existence.
      if (!roleRows[0]?.role) return { forbidden: true as const };

      const seqs: number[] = [];
      for (const update of parsed.data.updates) {
        // RLS WITH CHECK still blocks Viewers here even though the doc was ensured above.
        const row = (await tx.execute(
          sql`insert into document_updates (document_id, author_id, update) values (${docId}, ${session.userId}, ${Buffer.from(update)}) returning seq`,
        )) as unknown as Array<{ seq: number | string }>;
        seqs.push(Number(row[0].seq));
      }
      const countRows = (await tx.execute(
        sql`select count(*)::int as n from document_updates where document_id = ${docId}`,
      )) as unknown as Array<{ n: number }>;
      return { forbidden: false as const, seqs, shouldCompact: Number(countRows[0].n) > COMPACT_THRESHOLD };
    });

    if (result.forbidden) return { ok: false, error: "forbidden" };
    // Bound state growth without delaying the response.
    if (result.shouldCompact) {
      after(() => compactDocument(docId, session.userId).catch((e) => console.error("compaction failed", e)));
    }
    return { ok: true, seqs: result.seqs, latestSeq: result.seqs.length ? Math.max(...result.seqs) : 0 };
  } catch (err) {
    // RLS blocks Viewers and non-members from pushing.
    if (isRlsDenial(err)) return { ok: false, error: "forbidden" };
    console.error("push failed", err);
    return { ok: false, error: "server" };
  }
}

// Pull is a CRDT state-vector diff: the client sends what it has, the server returns exactly the ops it
// is missing — computed from the merged document state, so no commit-ordering race can skip an update.
export async function pullAction(docId: string, sv: Uint8Array): Promise<ActionResult<{ diff: Uint8Array }>> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthorized" };
  if (!z.uuid().safeParse(docId).success) return { ok: false, error: "invalid" };

  const parsed = pullSchema.safeParse({ sv });
  if (!parsed.success) return { ok: false, error: "invalid" };

  // RLS limits both reads to documents the caller can access.
  const data = await withUser(session.userId, async (tx) => {
    const docRows = (await tx.execute(
      sql`select compacted_state, compacted_seq from documents where id = ${docId}`,
    )) as unknown as Array<{ compacted_state: Uint8Array | null; compacted_seq: number | string }>;
    if (docRows.length === 0) return null;
    const updateRows = (await tx.execute(
      sql`select update from document_updates where document_id = ${docId} and seq > ${Number(docRows[0].compacted_seq)} order by seq asc`,
    )) as unknown as Array<{ update: Uint8Array }>;
    return { compacted: docRows[0].compacted_state, updates: updateRows.map((r) => r.update) };
  });

  if (data === null) return { ok: false, error: "not-found" };

  const doc = createDoc();
  if (data.compacted) applyUpdate(doc, data.compacted);
  for (const u of data.updates) applyUpdate(doc, u);
  const diff = diffFrom(doc, parsed.data.sv);
  doc.destroy();

  return { ok: true, diff };
}
