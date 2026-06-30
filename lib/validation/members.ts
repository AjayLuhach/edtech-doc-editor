import { z } from "zod";

// Collaborators can be added as editor or viewer; ownership is not transferable here.
export const addMemberSchema = z.object({
  email: z.email().max(200),
  role: z.enum(["editor", "viewer"]),
});

export type AddMemberPayload = z.infer<typeof addMemberSchema>;
