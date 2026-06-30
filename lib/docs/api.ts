import type { Role } from "@/types/auth";
import type { Member, ServerDoc } from "@/types/docs";

// Returns [] when offline so the local list still renders.
export async function listServerDocs(): Promise<ServerDoc[]> {
  try {
    const res = await fetch("/api/docs");
    if (!res.ok) return [];
    return ((await res.json()) as { documents: ServerDoc[] }).documents;
  } catch {
    return [];
  }
}

// null when the doc is local-only (not yet on the server) or the user has no access.
export async function getDocAccess(docId: string): Promise<{ title: string; role: Role } | null> {
  try {
    const res = await fetch(`/api/docs/${docId}`);
    if (!res.ok) return null;
    return (await res.json()) as { title: string; role: Role };
  } catch {
    return null;
  }
}

export async function listMembers(docId: string): Promise<Member[]> {
  const res = await fetch(`/api/docs/${docId}/members`);
  if (!res.ok) throw new Error(`load members failed: ${res.status}`);
  return ((await res.json()) as { members: Member[] }).members;
}

export async function addMember(
  docId: string,
  email: string,
  role: "editor" | "viewer",
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`/api/docs/${docId}/members`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, role }),
  });
  if (res.ok) return { ok: true };
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  return { ok: false, error: body.error ?? "Couldn't add collaborator." };
}

export async function removeMember(docId: string, userId: string): Promise<void> {
  await fetch(`/api/docs/${docId}/members/${userId}`, { method: "DELETE" });
}

// Delete the document on the server (owner only; RLS makes it a no-op for others).
export async function deleteServerDoc(docId: string): Promise<void> {
  await fetch(`/api/docs/${docId}`, { method: "DELETE" });
}
