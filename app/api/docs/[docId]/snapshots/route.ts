import { sql } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db/client";
import { isRlsDenial } from "@/lib/db/errors";
import { readBoundedText } from "@/lib/http/read-body";
import { fromBase64 } from "@/lib/sync/base64";
import { snapshotSchema } from "@/lib/validation/versions";

const MAX_BODY = 8_000_000;

// Create a version snapshot (editors/owners only — enforced by RLS WITH CHECK).
export async function POST(request: NextRequest, ctx: { params: Promise<{ docId: string }> }) {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { docId } = await ctx.params;
  if (!z.uuid().safeParse(docId).success) return Response.json({ error: "invalid id" }, { status: 400 });

  const text = await readBoundedText(request, MAX_BODY);
  if (text === null) return Response.json({ error: "payload too large" }, { status: 413 });

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  const parsed = snapshotSchema.safeParse(raw);
  if (!parsed.success) return Response.json({ error: "invalid payload" }, { status: 400 });

  let state: Uint8Array;
  try {
    state = fromBase64(parsed.data.state);
  } catch {
    return Response.json({ error: "invalid state encoding" }, { status: 400 });
  }
  try {
    await withUser(session.userId, (tx) =>
      tx.execute(
        sql`insert into document_snapshots (document_id, author_id, label, state, upto_seq)
            values (${docId}, ${session.userId}, ${parsed.data.label ?? null}, ${Buffer.from(state)}, ${parsed.data.uptoSeq})`,
      ),
    );
    return Response.json({ ok: true });
  } catch (err) {
    if (isRlsDenial(err)) return Response.json({ error: "forbidden" }, { status: 403 });
    console.error("snapshot create failed", err);
    return Response.json({ error: "server error" }, { status: 500 });
  }
}

// List the version timeline (members only) without the heavy state blobs.
export async function GET(_request: NextRequest, ctx: { params: Promise<{ docId: string }> }) {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { docId } = await ctx.params;
  if (!z.uuid().safeParse(docId).success) return Response.json({ error: "invalid id" }, { status: 400 });

  const rows = (await withUser(session.userId, (tx) =>
    tx.execute(
      sql`select s.id, s.label, s.created_at, u.name as author_name
          from document_snapshots s left join users u on u.id = s.author_id
          where s.document_id = ${docId}
          order by s.created_at desc limit 100`,
    ),
  )) as unknown as Array<{ id: string; label: string | null; created_at: string; author_name: string | null }>;

  const snapshots = rows.map((r) => ({
    id: r.id,
    label: r.label,
    authorName: r.author_name,
    createdAt: r.created_at,
  }));
  return Response.json({ snapshots });
}
