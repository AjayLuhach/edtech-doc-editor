import { sql } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { createDoc } from "@/lib/crdt/doc";
import { applyUpdate, diffFrom } from "@/lib/crdt/updates";
import { withUser } from "@/lib/db/client";
import { readBoundedText } from "@/lib/http/read-body";
import { fromBase64, toBase64 } from "@/lib/sync/base64";
import { pullSchema } from "@/lib/validation/sync";

const MAX_BODY = 200_000; // state vectors are tiny

// Pull is a CRDT state-vector diff: the client sends what it has, the server returns exactly the ops it
// is missing — computed from the merged document state, so no commit-ordering race can skip an update.
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
  const parsed = pullSchema.safeParse(raw);
  if (!parsed.success) return Response.json({ error: "invalid payload" }, { status: 400 });
  let clientSV: Uint8Array;
  try {
    clientSV = fromBase64(parsed.data.sv);
  } catch {
    return Response.json({ error: "invalid state vector" }, { status: 400 });
  }

  // RLS limits both reads to documents the caller can access.
  const data = await withUser(session.userId, async (tx) => {
    const docRows = (await tx.execute(
      sql`select compacted_state, compacted_seq from documents where id = ${docId}`,
    )) as unknown as Array<{ compacted_state: Uint8Array | null; compacted_seq: number | string }>;
    if (docRows.length === 0) return null;
    const updateRows = (await tx.execute(
      sql`select update from document_updates where document_id = ${docId} and seq > ${Number(docRows[0].compacted_seq)} order by seq asc`,
    )) as unknown as Array<{ update: Uint8Array }>;
    return { compacted: docRows[0].compacted_state, updates: updateRows.map((r) => r.update) };
  });

  if (data === null) return Response.json({ error: "not found" }, { status: 404 });

  const doc = createDoc();
  if (data.compacted) applyUpdate(doc, data.compacted);
  for (const u of data.updates) applyUpdate(doc, u);
  const diff = diffFrom(doc, clientSV);
  doc.destroy();

  return Response.json({ diff: toBase64(diff) });
}
