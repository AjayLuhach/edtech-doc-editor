import { z } from "zod";

// Full-document state can be sizeable; cap it and also reject oversized bodies at the route.
export const snapshotSchema = z.object({
  label: z.string().max(200).optional(),
  state: z.string().min(1).max(5_000_000),
  uptoSeq: z.number().int().min(0),
});

export type SnapshotPayload = z.infer<typeof snapshotSchema>;
