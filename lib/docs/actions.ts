"use server";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db/client";
import { addMemberSchema } from "@/lib/validation/members";
import type { ActionError, ActionResult } from "@/types/actions";
import type { Role } from "@/types/auth";
import type { Member, ServerDoc } from "@/types/docs";

// Server actions are public POST endpoints — each one re-checks the session and validates its ids.
const isUuid = (v: string) => z.uuid().safeParse(v).success;

// List the documents the current user can access on the server, with their role on each.
export async function listDocsAction(): Promise<ActionResult<{ documents: ServerDoc[] }>> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthorized" };

  const rows = (await withUser(session.userId, (tx) =>
    tx.execute(
      sql`select d.id, d.title, m.role from documents d
          join document_members m on m.document_id = d.id
          where m.user_id = ${session.userId}
          order by d.updated_at desc limit 200`,
    ),
  )) as unknown as Array<{ id: string; title: string; role: Role }>;

  return { ok: true, documents: rows.map((r) => ({ id: r.id, title: r.title, role: r.role })) };
}

// The caller's role + title on a document. not-found when local-only or no access (don't leak existence).
export async function getDocAccessAction(docId: string): Promise<ActionResult<{ title: string; role: Role }>> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthorized" };
  if (!isUuid(docId)) return { ok: false, error: "invalid" };

  const rows = (await withUser(session.userId, (tx) =>
    tx.execute(sql`select title, app_role_on(${docId}) as role from documents where id = ${docId}`),
  )) as unknown as Array<{ title: string; role: Role | null }>;

  if (rows.length === 0 || !rows[0].role) return { ok: false, error: "not-found" };
  return { ok: true, title: rows[0].title, role: rows[0].role };
}

// Delete the document. RLS only lets the owner delete; for anyone else it removes 0 rows.
export async function deleteDocAction(docId: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthorized" };
  if (!isUuid(docId)) return { ok: false, error: "invalid" };

  await withUser(session.userId, (tx) => tx.execute(sql`delete from documents where id = ${docId}`));
  return { ok: true };
}

export async function listMembersAction(docId: string): Promise<ActionResult<{ members: Member[] }>> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthorized" };
  if (!isUuid(docId)) return { ok: false, error: "invalid" };

  const rows = (await withUser(session.userId, (tx) =>
    tx.execute(
      sql`select u.id as user_id, u.name, u.email, m.role from document_members m
          join users u on u.id = m.user_id where m.document_id = ${docId} order by m.created_at`,
    ),
  )) as unknown as Array<{ user_id: string; name: string; email: string; role: Role }>;

  return { ok: true, members: rows.map((r) => ({ userId: r.user_id, name: r.name, email: r.email, role: r.role })) };
}

// Map the app_add_member() status string to an action result.
const ADD_STATUS: Record<string, { error: ActionError; message: string }> = {
  forbidden: { error: "forbidden", message: "Only the owner can manage collaborators." },
  user_not_found: { error: "not-found", message: "No account with that email." },
  self: { error: "invalid", message: "You already own this document." },
  invalid_role: { error: "invalid", message: "Invalid role." },
};

export async function addMemberAction(docId: string, email: string, role: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthorized" };
  if (!isUuid(docId)) return { ok: false, error: "invalid" };

  const parsed = addMemberSchema.safeParse({ email, role });
  if (!parsed.success) return { ok: false, error: "invalid", message: "Enter a valid email and role." };

  const rows = (await withUser(session.userId, (tx) =>
    tx.execute(
      sql`select app_add_member(${docId}, ${parsed.data.email}, ${parsed.data.role}::public.role) as status`,
    ),
  )) as unknown as Array<{ status: string }>;

  if (rows[0]?.status === "ok") return { ok: true };
  const outcome = ADD_STATUS[rows[0]?.status];
  if (outcome) return { ok: false, error: outcome.error, message: outcome.message };
  return { ok: false, error: "server", message: "Couldn't add collaborator." };
}

// Remove a collaborator. RLS only lets the owner delete, and the owner row itself is protected.
export async function removeMemberAction(docId: string, userId: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthorized" };
  if (!isUuid(docId) || !isUuid(userId)) return { ok: false, error: "invalid" };

  await withUser(session.userId, (tx) =>
    tx.execute(
      sql`delete from document_members m using documents d
          where m.document_id = ${docId} and m.user_id = ${userId}
          and d.id = m.document_id and m.user_id <> d.owner_id`,
    ),
  );
  return { ok: true };
}
