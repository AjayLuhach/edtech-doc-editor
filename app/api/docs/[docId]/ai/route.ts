import { sql } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { complete } from "@/lib/ai/bedrock";
import { getSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db/client";
import { readBoundedText } from "@/lib/http/read-body";
import { aiSchema } from "@/lib/validation/ai";

const MAX_BODY = 200_000;

// Per-action prompt + output budget. Kept server-side so the client can't inject arbitrary instructions.
const PROMPTS: Record<string, { build: (text: string) => string; maxTokens: number }> = {
  summarize: {
    build: (t) => `Summarize the following document in 2-3 clear sentences. Reply with only the summary.\n\n${t}`,
    maxTokens: 400,
  },
  title: {
    build: (t) =>
      `Suggest a short, descriptive title (3 to 6 words) for the following document. Reply with only the title, no quotes or trailing punctuation.\n\n${t}`,
    maxTokens: 40,
  },
  improve: {
    build: (t) =>
      `Improve the grammar, clarity, and flow of the following text while preserving its meaning and approximate length. Reply with only the revised text.\n\n${t}`,
    maxTokens: 1500,
  },
};

// Run a cheap LLM helper over the caller's current document text (members only).
export async function POST(request: NextRequest, ctx: { params: Promise<{ docId: string }> }) {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { docId } = await ctx.params;
  if (!z.uuid().safeParse(docId).success) return Response.json({ error: "invalid id" }, { status: 400 });

  const raw = await readBoundedText(request, MAX_BODY);
  if (raw === null) return Response.json({ error: "payload too large" }, { status: 413 });

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  const parsed = aiSchema.safeParse(parsedJson);
  if (!parsed.success) return Response.json({ error: "invalid payload" }, { status: 400 });

  // Gate on membership so only people with access can spend tokens; ensure works for freshly-created docs too.
  const rows = (await withUser(session.userId, (tx) =>
    tx.execute(sql`select app_ensure_document(${docId}, ${null}) as role`),
  )) as unknown as Array<{ role: string | null }>;
  if (!rows[0]?.role) return Response.json({ error: "not found" }, { status: 404 });

  const spec = PROMPTS[parsed.data.action];
  try {
    const result = await complete(spec.build(parsed.data.text), { maxTokens: spec.maxTokens });
    if (!result) return Response.json({ error: "no output" }, { status: 502 });
    return Response.json({ result });
  } catch (err) {
    console.error("ai request failed", err);
    return Response.json({ error: "ai unavailable" }, { status: 502 });
  }
}
