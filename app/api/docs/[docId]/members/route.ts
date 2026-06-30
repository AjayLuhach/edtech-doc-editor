import { sql } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db/client";
import { addMemberSchema } from "@/lib/validation/members";

// Map the function's status string to an HTTP response.
const STATUS: Record<string, { status: number; error?: string }> = {
  ok: { status: 200 },
  forbidden: { status: 403, error: "Only the owner can manage collaborators." },
  user_not_found: { status: 404, error: "No account with that email." },
  self: { status: 400, error: "You already own this document." },
  invalid_role: { status: 400, error: "Invalid role." },
};

export async function GET(_request: NextRequest, ctx: { params: Promise<{ docId: string }> }) {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { docId } = await ctx.params;
  if (!z.uuid().safeParse(docId).success) return Response.json({ error: "invalid id" }, { status: 400 });

  const rows = (await withUser(session.userId, (tx) =>
    tx.execute(
      sql`select u.id as user_id, u.name, u.email, m.role from document_members m
          join users u on u.id = m.user_id where m.document_id = ${docId} order by m.created_at`,
    ),
  )) as unknown as Array<{ user_id: string; name: string; email: string; role: "owner" | "editor" | "viewer" }>;

  return Response.json({
    members: rows.map((r) => ({ userId: r.user_id, name: r.name, email: r.email, role: r.role })),
  });
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ docId: string }> }) {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { docId } = await ctx.params;
  if (!z.uuid().safeParse(docId).success) return Response.json({ error: "invalid id" }, { status: 400 });

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  const parsed = addMemberSchema.safeParse(raw);
  if (!parsed.success) return Response.json({ error: "invalid payload" }, { status: 400 });

  const rows = (await withUser(session.userId, (tx) =>
    tx.execute(
      sql`select app_add_member(${docId}, ${parsed.data.email}, ${parsed.data.role}::public.role) as status`,
    ),
  )) as unknown as Array<{ status: string }>;

  const outcome = STATUS[rows[0]?.status] ?? { status: 500, error: "server error" };
  if (outcome.status === 200) return Response.json({ ok: true });
  return Response.json({ error: outcome.error }, { status: outcome.status });
}
