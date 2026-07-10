"use server";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db/client";
import { aiSchema } from "@/lib/validation/ai";
import type { ActionResult } from "@/types/actions";
import { complete } from "./bedrock";

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
export async function runAiAction(docId: string, action: string, text: string): Promise<ActionResult<{ result: string }>> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthorized" };
  if (!z.uuid().safeParse(docId).success) return { ok: false, error: "invalid" };

  const parsed = aiSchema.safeParse({ action, text });
  if (!parsed.success) return { ok: false, error: "invalid", message: "Invalid AI request." };

  // Gate on membership so only people with access can spend tokens; ensure works for freshly-created docs too.
  const rows = (await withUser(session.userId, (tx) =>
    tx.execute(sql`select app_ensure_document(${docId}, ${null}) as role`),
  )) as unknown as Array<{ role: string | null }>;
  if (!rows[0]?.role) return { ok: false, error: "not-found" };

  const spec = PROMPTS[parsed.data.action];
  try {
    const result = await complete(spec.build(parsed.data.text), { maxTokens: spec.maxTokens });
    if (!result) return { ok: false, error: "server", message: "The model returned no output." };
    return { ok: true, result };
  } catch (err) {
    console.error("ai request failed", err);
    return { ok: false, error: "server", message: "AI is unavailable right now." };
  }
}
