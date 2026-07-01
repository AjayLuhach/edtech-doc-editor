"use client";
import { useState } from "react";
import { FiCheck, FiX } from "react-icons/fi";
import { type AiAction, runAi } from "@/lib/ai/api";

const ACTIONS: Array<{ key: AiAction; label: string }> = [
  { key: "summarize", label: "Summarize" },
  { key: "title", label: "Suggest title" },
  { key: "improve", label: "Improve writing" },
];

export default function AiPanel({
  docId,
  title,
  body,
  canEdit,
  onApplyTitle,
  onApplyBody,
  onClose,
}: {
  docId: string;
  title: string;
  body: string;
  canEdit: boolean;
  onApplyTitle: (value: string) => void;
  onApplyBody: (value: string) => void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState<AiAction | null>(null);
  const [action, setAction] = useState<AiAction | null>(null);
  const [result, setResult] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function run(a: AiAction) {
    // Title uses the heading too; summarize/improve act on the body.
    const text = a === "title" ? `${title}\n\n${body}`.trim() : body.trim();
    if (!text) {
      setError("Write something first.");
      return;
    }
    setBusy(a);
    setError(null);
    setResult("");
    setAction(a);
    try {
      setResult(await runAi(docId, a, text));
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI request failed");
      setAction(null);
    } finally {
      setBusy(null);
    }
  }

  function apply() {
    if (action === "title") onApplyTitle(result.trim());
    else if (action === "improve") onApplyBody(result);
    onClose();
  }

  const canApply = canEdit && (action === "title" || action === "improve") && result.length > 0;

  return (
    <section className="rounded-xl border border-black/10 p-4 dark:border-white/10" aria-label="AI assistant">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">AI assistant</h2>
        <button
          type="button"
          aria-label="Close AI panel"
          onClick={onClose}
          className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
        >
          <FiX className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {ACTIONS.map((a) => (
          <button
            key={a.key}
            type="button"
            onClick={() => run(a.key)}
            disabled={busy !== null}
            className="rounded-lg border border-black/15 px-3 py-1.5 text-sm transition-colors hover:bg-black/5 disabled:opacity-60 dark:border-white/15 dark:hover:bg-white/10"
          >
            {busy === a.key ? "Working…" : a.label}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      )}

      {result && (
        <div className="mt-3">
          <p className="whitespace-pre-wrap rounded-lg bg-black/5 px-3 py-2 text-sm dark:bg-white/10">{result}</p>
          {canApply && (
            <button
              type="button"
              onClick={apply}
              className="mt-2 flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900"
            >
              <FiCheck aria-hidden className="h-4 w-4" />
              {action === "title" ? "Use this title" : "Replace body"}
            </button>
          )}
        </div>
      )}

      <p className="mt-3 text-xs text-neutral-500">Powered by Gemma on Amazon Bedrock.</p>
    </section>
  );
}
