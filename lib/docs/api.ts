import type { Role } from "@/types/auth";
import type { Member, ServerDoc } from "@/types/docs";
import {
  addMemberAction,
  deleteDocAction,
  getDocAccessAction,
  listDocsAction,
  listMembersAction,
  removeMemberAction,
} from "./actions";

// Client adapters over the document server actions; they normalize offline/denied into UI-friendly shapes.

// Returns [] when offline so the local list still renders.
export async function listServerDocs(): Promise<ServerDoc[]> {
  try {
    const res = await listDocsAction();
    return res.ok ? res.documents : [];
  } catch {
    return [];
  }
}

// null when the doc is local-only (not yet on the server) or the user has no access.
export async function getDocAccess(docId: string): Promise<{ title: string; role: Role } | null> {
  try {
    const res = await getDocAccessAction(docId);
    return res.ok ? { title: res.title, role: res.role } : null;
  } catch {
    return null;
  }
}

export async function listMembers(docId: string): Promise<Member[]> {
  const res = await listMembersAction(docId);
  if (!res.ok) throw new Error(`load members failed: ${res.error}`);
  return res.members;
}

export async function addMember(
  docId: string,
  email: string,
  role: "editor" | "viewer",
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await addMemberAction(docId, email, role);
    if (res.ok) return { ok: true };
    return { ok: false, error: res.message ?? "Couldn't add collaborator." };
  } catch {
    return { ok: false, error: "Couldn't add collaborator — are you online?" };
  }
}

export async function removeMember(docId: string, userId: string): Promise<void> {
  await removeMemberAction(docId, userId);
}

// Delete the document on the server (owner only; RLS makes it a no-op for others).
export async function deleteServerDoc(docId: string): Promise<void> {
  await deleteDocAction(docId);
}
