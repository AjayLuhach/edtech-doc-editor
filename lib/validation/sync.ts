import { z } from "zod";

// Per-update and batch caps bound memory; Next's server-action bodySizeLimit caps the raw request.
const MAX_UPDATE_BYTES = 48_000;
const MAX_BATCH = 200;

const yUpdate = z.instanceof(Uint8Array).refine((u) => u.byteLength > 0 && u.byteLength <= MAX_UPDATE_BYTES);

export const pushSchema = z.object({
  title: z.string().max(300).optional(),
  updates: z.array(yUpdate).min(1).max(MAX_BATCH),
});

// Yjs state vector for pull (small: one entry per contributing client).
export const pullSchema = z.object({
  sv: z.instanceof(Uint8Array).refine((u) => u.byteLength <= 75_000),
});

export type PushPayload = z.infer<typeof pushSchema>;
