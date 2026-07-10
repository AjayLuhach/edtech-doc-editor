import { runAiAction } from "./actions";

export type AiAction = "summarize" | "title" | "improve";

// Client adapter over the AI server action; returns the model's text or throws a friendly message.
export async function runAi(docId: string, action: AiAction, text: string): Promise<string> {
  const res = await runAiAction(docId, action, text);
  if (!res.ok) throw new Error(res.message ?? "AI request failed");
  return res.result;
}
