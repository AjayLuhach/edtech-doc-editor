import { z } from "zod";

// Bound the prompt text so a single call can't blow up token cost.
const MAX_TEXT = 20_000;

export const aiSchema = z.object({
  action: z.enum(["summarize", "title", "improve"]),
  text: z.string().min(1).max(MAX_TEXT),
});

export type AiPayload = z.infer<typeof aiSchema>;
