// Per-document collaboration role; a user can hold different roles on different documents.
export type Role = "owner" | "editor" | "viewer";

// Identity carried in the signed session cookie (authn); authz is resolved per document.
export type SessionUser = { userId: string; name: string; email: string };

// Return shape for auth server actions consumed by useActionState.
export type AuthState = { error?: string };
