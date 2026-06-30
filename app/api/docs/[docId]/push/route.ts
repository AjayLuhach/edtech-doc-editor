import { sql } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db/client";
import { isRlsDenial } from "@/lib/db/errors";
import { fromBase64 } from "@/lib/sync/base64";
import { pushSchema } from "@/lib/validation/sync";

// Hard ceiling before we even read the body — first line of OOM defense.
const MAX_BODY = 2_000_000;

export async function POST(request: NextRequest, ctx: { params: Promise<{ docId: string }> }) {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { docId } = await ctx.params;
  if (!z.uuid().safeParse(docId).success) return Response.json({ error: "invalid id" }, { status: 400 });

  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY) {
    return Response.json({ error: "payload too large" }, { status: 413 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  const parsed = pushSchema.safeParse(raw);
  if (!parsed.success) return Response.json({ error: "invalid payload" }, { status: 400 });

  const updates = parsed.data.updates.map(fromBase64);
  const { title } = parsed.data;

  try {
    const result = await withUser(session.userId, async (tx) => {
      // Bootstrap the server document the first time a locally-created doc is pushed.
      const roleRows = (await tx.execute(
        sql`select app_ensure_document(${docId}, ${title ?? null}) as role`,
      )) as unknown as Array<{ role: string | null }>;
      // Null means the doc exists but the caller is not a member — don't leak its existence.
      if (!roleRows[0]?.role) return { forbidden: true as const };

      const seqs: number[] = [];
      for (const update of updates) {
        // RLS WITH CHECK still blocks Viewers here even though the doc was ensured above.
        const row = (await tx.execute(
          sql`insert into document_updates (document_id, author_id, update) values (${docId}, ${session.userId}, ${Buffer.from(update)}) returning seq`,
        )) as unknown as Array<{ seq: number | string }>;
        seqs.push(Number(row[0].seq));
      }
      return { forbidden: false as const, seqs };
    });

    if (result.forbidden) return Response.json({ error: "forbidden" }, { status: 403 });
    return Response.json({ seqs: result.seqs, latestSeq: result.seqs.length ? Math.max(...result.seqs) : 0 });
  } catch (err) {
    // RLS blocks Viewers and non-members from pushing.
    if (isRlsDenial(err)) return Response.json({ error: "forbidden" }, { status: 403 });
    console.error("push failed", err);
    return Response.json({ error: "server error" }, { status: 500 });
  }
}
