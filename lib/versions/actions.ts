"use server";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db/client";
import { isRlsDenial } from "@/lib/db/errors";
import { snapshotSchema } from "@/lib/validation/versions";
import type { ActionResult } from "@/types/actions";
import type { SnapshotMeta } from "@/types/versions";

// Create a version snapshot (editors/owners only — enforced by RLS WITH CHECK).
export async function createSnapshotAction(
  docId: string,
  state: Uint8Array,
  uptoSeq: number,
  label?: string,
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthorized" };
  if (!z.uuid().safeParse(docId).success) return { ok: false, error: "invalid" };

  const parsed = snapshotSchema.safeParse({ label, state, uptoSeq });
  if (!parsed.success) return { ok: false, error: "invalid" };

  try {
    const result = await withUser(session.userId, async (tx) => {
      // Ensure the server document exists so snapshots work even before the doc has finished syncing.
      const roleRows = (await tx.execute(
        sql`select app_ensure_document(${docId}, ${null}) as role`,
      )) as unknown as Array<{ role: string | null }>;
      if (!roleRows[0]?.role) return { forbidden: true as const };

      // RLS WITH CHECK still blocks Viewers from creating snapshots.
      await tx.execute(
        sql`insert into document_snapshots (document_id, author_id, label, state, upto_seq)
            values (${docId}, ${session.userId}, ${parsed.data.label ?? null}, ${Buffer.from(parsed.data.state)}, ${parsed.data.uptoSeq})`,
      );
      return { forbidden: false as const };
    });

    if (result.forbidden) return { ok: false, error: "forbidden" };
    return { ok: true };
  } catch (err) {
    if (isRlsDenial(err)) return { ok: false, error: "forbidden" };
    console.error("snapshot create failed", err);
    return { ok: false, error: "server" };
  }
}

// List the version timeline (members only) without the heavy state blobs.
export async function listSnapshotsAction(docId: string): Promise<ActionResult<{ snapshots: SnapshotMeta[] }>> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthorized" };
  if (!z.uuid().safeParse(docId).success) return { ok: false, error: "invalid" };

  const rows = (await withUser(session.userId, (tx) =>
    tx.execute(
      sql`select s.id, s.label, s.created_at, u.name as author_name
          from document_snapshots s left join users u on u.id = s.author_id
          where s.document_id = ${docId}
          order by s.created_at desc limit 100`,
    ),
  )) as unknown as Array<{ id: string; label: string | null; created_at: string; author_name: string | null }>;

  return {
    ok: true,
    snapshots: rows.map((r) => ({ id: r.id, label: r.label, authorName: r.author_name, createdAt: r.created_at })),
  };
}

// Fetch one snapshot's full state for restore (members only, enforced by RLS).
export async function getSnapshotStateAction(
  docId: string,
  snapshotId: string,
): Promise<ActionResult<{ state: Uint8Array }>> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthorized" };
  if (!z.uuid().safeParse(docId).success || !z.uuid().safeParse(snapshotId).success) {
    return { ok: false, error: "invalid" };
  }

  const rows = (await withUser(session.userId, (tx) =>
    tx.execute(sql`select state from document_snapshots where id = ${snapshotId} and document_id = ${docId}`),
  )) as unknown as Array<{ state: Uint8Array }>;

  if (rows.length === 0) return { ok: false, error: "not-found" };
  return { ok: true, state: new Uint8Array(rows[0].state) };
}
