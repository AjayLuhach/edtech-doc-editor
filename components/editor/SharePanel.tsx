"use client";
import { type FormEvent, useEffect, useState } from "react";
import { FiTrash2, FiUserPlus, FiX } from "react-icons/fi";
import { addMember, listMembers, removeMember } from "@/lib/docs/api";
import type { Member } from "@/types/docs";

const ROLE_LABEL: Record<string, string> = { owner: "Owner", editor: "Editor", viewer: "Viewer" };

export default function SharePanel({ docId, onClose }: { docId: string; onClose: () => void }) {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("viewer");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try {
      setMembers(await listMembers(docId));
    } catch {
      setError("Couldn't load collaborators.");
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId]);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await addMember(docId, email.trim(), role);
    if (res.ok) {
      setEmail("");
      await refresh();
    } else {
      setError(res.error ?? "Couldn't add collaborator.");
    }
    setBusy(false);
  }

  async function onRemove(userId: string) {
    setBusy(true);
    await removeMember(docId, userId);
    await refresh();
    setBusy(false);
  }

  return (
    <section className="rounded-xl border border-black/10 p-4 dark:border-white/10" aria-label="Share document">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Share</h2>
        <button type="button" aria-label="Close share panel" onClick={onClose} className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200">
          <FiX className="h-4 w-4" />
        </button>
      </div>

      <form onSubmit={onAdd} className="mt-3 flex flex-wrap gap-2">
        <input
          aria-label="Collaborator email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="collaborator@email.com"
          className="min-w-0 flex-1 rounded-lg border border-black/15 bg-transparent px-3 py-1.5 text-sm outline-none focus:border-neutral-900 dark:border-white/15"
        />
        <select
          aria-label="Role"
          value={role}
          onChange={(e) => setRole(e.target.value as "editor" | "viewer")}
          className="rounded-lg border border-black/15 bg-transparent px-2 py-1.5 text-sm dark:border-white/15"
        >
          <option value="viewer">Viewer</option>
          <option value="editor">Editor</option>
        </select>
        <button
          type="submit"
          disabled={busy}
          className="flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-60 dark:bg-white dark:text-neutral-900"
        >
          <FiUserPlus aria-hidden className="h-4 w-4" />
          Add
        </button>
      </form>

      {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}

      <ul className="mt-3 flex flex-col divide-y divide-black/5 dark:divide-white/5">
        {members === null ? (
          <li className="py-2 text-sm text-neutral-500">Loading…</li>
        ) : (
          members.map((m) => (
            <li key={m.userId} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{m.name}</p>
                <p className="truncate text-xs text-neutral-500">{m.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10">{ROLE_LABEL[m.role]}</span>
                {m.role !== "owner" && (
                  <button
                    type="button"
                    aria-label={`Remove ${m.name}`}
                    onClick={() => onRemove(m.userId)}
                    disabled={busy}
                    className="rounded-md p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-60 dark:hover:bg-red-950/40"
                  >
                    <FiTrash2 aria-hidden className="h-4 w-4" />
                  </button>
                )}
              </div>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
