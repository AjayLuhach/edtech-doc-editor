import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";

// Registration runs through the SECURITY DEFINER app_register (RLS blocks direct user inserts).
export async function registerUser(email: string, name: string, passwordHash: string): Promise<string> {
  const rows = (await db.execute(
    sql`select app_register(${email}, ${name}, ${passwordHash}) as id`,
  )) as unknown as Array<{ id: string }>;
  return rows[0].id;
}

// Pre-session credential lookup via the SECURITY DEFINER app_login_lookup.
export async function findLogin(
  email: string,
): Promise<{ id: string; name: string; passwordHash: string } | null> {
  const rows = (await db.execute(
    sql`select id, name, password_hash from app_login_lookup(${email})`,
  )) as unknown as Array<{ id: string; name: string; password_hash: string }>;
  const row = rows[0];
  return row ? { id: row.id, name: row.name, passwordHash: row.password_hash } : null;
}
