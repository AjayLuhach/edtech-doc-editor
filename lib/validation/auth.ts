import { z } from "zod";

// Length caps double as a cheap input-size guard.
export const credentialsSchema = z.object({
  email: z.email().max(200),
  password: z.string().min(8, "At least 8 characters").max(200),
});

export const registerSchema = credentialsSchema.extend({
  name: z.string().min(1, "Name is required").max(100),
});
