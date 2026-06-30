import { sql } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db/client";

// Remove a collaborator. RLS only lets the owner delete; for anyone else it removes 0 rows.
export async function DELETE(_request: NextRequest, ctx: { params: Promise<{ docId: string; userId: string }> }) {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { docId, userId } = await ctx.params;
  if (!z.uuid().safeParse(docId).success || !z.uuid().safeParse(userId).success) {
    return Response.json({ error: "invalid id" }, { status: 400 });
  }

  await withUser(session.userId, (tx) =>
    tx.execute(
      sql`delete from document_members m using documents d
          where m.document_id = ${docId} and m.user_id = ${userId}
          and d.id = m.document_id and m.user_id <> d.owner_id`,
    ),
  );
  return Response.json({ ok: true });
}
