import { sql } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db/client";

// List the documents the current user can access on the server, with their role on each.
export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  const rows = (await withUser(session.userId, (tx) =>
    tx.execute(
      sql`select d.id, d.title, m.role from documents d
          join document_members m on m.document_id = d.id
          where m.user_id = ${session.userId}
          order by d.updated_at desc limit 200`,
    ),
  )) as unknown as Array<{ id: string; title: string; role: "owner" | "editor" | "viewer" }>;

  return Response.json({ documents: rows.map((r) => ({ id: r.id, title: r.title, role: r.role })) });
}
