import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// drizzle-kit runs locally/CI as the owner role so it can create roles and RLS policies.
config({ path: ".env.local" });

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./lib/db/migrations",
  dialect: "postgresql",
  dbCredentials: { url: process.env.MIGRATION_DATABASE_URL ?? "" },
  strict: true,
  verbose: true,
});
