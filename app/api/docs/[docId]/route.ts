import { sql } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db/client";

// The caller's role + title on a document. 404 when the doc isn't on the server (local-only) or no access.
export async function GET(_request: NextRequest, ctx: { params: Promise<{ docId: string }> }) {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { docId } = await ctx.params;
  if (!z.uuid().safeParse(docId).success) return Response.json({ error: "invalid id" }, { status: 400 });

  const rows = (await withUser(session.userId, (tx) =>
    tx.execute(sql`select title, app_role_on(${docId}) as role from documents where id = ${docId}`),
  )) as unknown as Array<{ title: string; role: "owner" | "editor" | "viewer" | null }>;

  if (rows.length === 0 || !rows[0].role) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json({ title: rows[0].title, role: rows[0].role });
}

// Delete the document. RLS only lets the owner delete; for anyone else it removes 0 rows.
export async function DELETE(_request: NextRequest, ctx: { params: Promise<{ docId: string }> }) {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { docId } = await ctx.params;
  if (!z.uuid().safeParse(docId).success) return Response.json({ error: "invalid id" }, { status: 400 });

  await withUser(session.userId, (tx) => tx.execute(sql`delete from documents where id = ${docId}`));
  return Response.json({ ok: true });
}
