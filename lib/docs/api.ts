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

export type DocAccess = { access: { title: string; role: Role } | null; reachable: boolean };

// access=null + reachable=true means the server answered but doesn't know the doc (local-only);
// reachable=false means we couldn't ask (offline / logged out) and must not assume write access.
export async function getDocAccess(docId: string): Promise<DocAccess> {
  try {
    const res = await getDocAccessAction(docId);
    if (res.ok) return { access: { title: res.title, role: res.role }, reachable: true };
    return { access: null, reachable: res.error === "not-found" };
  } catch {
    return { access: null, reachable: false };
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
