import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { config } from "dotenv";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { createDoc, getMeta } from "@/lib/crdt/doc";
import { fillBodyFromText } from "@/lib/crdt/richbody";
import { encodeState } from "@/lib/crdt/updates";

// Idempotent demo data: two users and a document shared between them.
config({ path: ".env.local" });

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const client = postgres(url, { prepare: false });
  const db = drizzle(client);

  const withUser = <T>(uid: string, fn: (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => Promise<T>) =>
    db.transaction(async (tx) => {
      await tx.execute(sql`select set_config('app.user_id', ${uid}, true)`);
      return fn(tx);
    });

  async function register(email: string, name: string, password: string): Promise<string> {
    const hash = await bcrypt.hash(password, 12);
    try {
      const rows = (await db.execute(sql`select app_register(${email}, ${name}, ${hash}) as id`)) as unknown as Array<{ id: string }>;
      return rows[0].id;
    } catch {
      const rows = (await db.execute(sql`select id from app_login_lookup(${email})`)) as unknown as Array<{ id: string }>;
      return rows[0].id;
    }
  }

  const aliceId = await register("alice@demo.com", "Alice", "demo12345");
  await register("bob@demo.com", "Bob", "demo12345");

  const title = "Welcome to Local-first Docs";
  const docId = randomUUID();
  const doc = createDoc();
  getMeta(doc).set("title", title);
  fillBodyFromText(doc, "This document is shared. Edit it offline — it syncs and merges on reconnect.");
  const state = encodeState(doc);
  doc.destroy();

  await withUser(aliceId, async (tx) => {
    await tx.execute(sql`select app_ensure_document(${docId}, ${title})`);
    await tx.execute(sql`insert into document_updates (document_id, author_id, update) values (${docId}, ${aliceId}, ${Buffer.from(state)})`);
    await tx.execute(sql`select app_add_member(${docId}, ${"bob@demo.com"}, 'editor'::public.role)`);
  });

  console.log("seeded:", { alice: "alice@demo.com / demo12345", bob: "bob@demo.com / demo12345", docId });
  await client.end();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
