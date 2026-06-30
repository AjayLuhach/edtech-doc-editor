import type { Role } from "./auth";

// A document the current user can access on the server, with their role on it.
export type ServerDoc = { id: string; title: string; role: Role };

// A collaborator on a document.
export type Member = { userId: string; name: string; email: string; role: Role };
