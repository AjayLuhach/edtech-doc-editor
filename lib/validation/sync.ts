import { z } from "zod";

// Per-update and batch caps bound memory; the route also streams the body under a hard byte budget.
const MAX_UPDATE_B64 = 64_000; // ~48 KB of binary per Yjs update
const MAX_BATCH = 200;
const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

export const pushSchema = z.object({
  title: z.string().max(300).optional(),
  updates: z.array(z.string().max(MAX_UPDATE_B64).regex(BASE64)).min(1).max(MAX_BATCH),
});

// Yjs state vector for pull (small: one entry per contributing client).
export const pullSchema = z.object({
  sv: z.string().max(100_000).regex(BASE64),
});

export type PushPayload = z.infer<typeof pushSchema>;
