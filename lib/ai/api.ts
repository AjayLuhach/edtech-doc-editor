export type AiAction = "summarize" | "title" | "improve";

// Call the server AI helper for the current document; returns the model's text.
export async function runAi(docId: string, action: AiAction, text: string): Promise<string> {
  const res = await fetch(`/api/docs/${docId}/ai`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action, text }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "AI request failed");
  }
  const body = (await res.json()) as { result: string };
  return body.result;
}
