import { z } from "zod";

// Per-update and batch caps bound memory use; the route also rejects oversized bodies with 413.
const MAX_UPDATE_B64 = 200_000; // ~150 KB of binary per Yjs update
const MAX_BATCH = 500;

export const pushSchema = z.object({
  title: z.string().max(300).optional(),
  updates: z.array(z.string().max(MAX_UPDATE_B64)).min(1).max(MAX_BATCH),
});

export type PushPayload = z.infer<typeof pushSchema>;
