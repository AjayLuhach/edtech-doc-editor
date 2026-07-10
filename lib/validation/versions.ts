import { z } from "zod";

// Full-document state can be sizeable; cap it here and via the server-action bodySizeLimit.
export const snapshotSchema = z.object({
  label: z.string().max(200).optional(),
  state: z.instanceof(Uint8Array).refine((u) => u.byteLength > 0 && u.byteLength <= 4_000_000),
  uptoSeq: z.number().int().min(0),
});

export type SnapshotPayload = z.infer<typeof snapshotSchema>;
