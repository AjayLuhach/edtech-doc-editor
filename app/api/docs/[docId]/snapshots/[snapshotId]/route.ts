import { sql } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db/client";
import { toBase64 } from "@/lib/sync/base64";

// Fetch one snapshot's full state for restore (members only, enforced by RLS).
export async function GET(_request: NextRequest, ctx: { params: Promise<{ docId: string; snapshotId: string }> }) {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { docId, snapshotId } = await ctx.params;
  if (!z.uuid().safeParse(docId).success || !z.uuid().safeParse(snapshotId).success) {
    return Response.json({ error: "invalid id" }, { status: 400 });
  }

  const rows = (await withUser(session.userId, (tx) =>
    tx.execute(
      sql`select state from document_snapshots where id = ${snapshotId} and document_id = ${docId}`,
    ),
  )) as unknown as Array<{ state: Uint8Array }>;

  if (rows.length === 0) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json({ state: toBase64(rows[0].state) });
}
