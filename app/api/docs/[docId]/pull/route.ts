import { sql } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db/client";
import { toBase64 } from "@/lib/sync/base64";

const MAX_PULL = 1000;

export async function GET(request: NextRequest, ctx: { params: Promise<{ docId: string }> }) {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { docId } = await ctx.params;
  if (!z.uuid().safeParse(docId).success) return Response.json({ error: "invalid id" }, { status: 400 });

  const sinceRaw = Number(request.nextUrl.searchParams.get("since") ?? "0");
  const since = Number.isFinite(sinceRaw) && sinceRaw >= 0 ? Math.floor(sinceRaw) : 0;

  // RLS limits the result to documents the caller can read; non-members get nothing.
  const rows = (await withUser(session.userId, (tx) =>
    tx.execute(
      sql`select seq, update from document_updates where document_id = ${docId} and seq > ${since} order by seq asc limit ${MAX_PULL}`,
    ),
  )) as unknown as Array<{ seq: number | string; update: Uint8Array }>;

  const updates = rows.map((r) => ({ seq: Number(r.seq), data: toBase64(r.update) }));
  const latestSeq = updates.length ? updates[updates.length - 1].seq : since;
  return Response.json({ updates, latestSeq });
}
