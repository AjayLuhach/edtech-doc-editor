import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

// Apply migrations as the owner role (creates app_user, RLS policies, grants).
config({ path: ".env.local" });

async function main() {
  const url = process.env.MIGRATION_DATABASE_URL;
  if (!url) throw new Error("MIGRATION_DATABASE_URL is not set");
  const sql = postgres(url, { max: 1 });
  await migrate(drizzle(sql), { migrationsFolder: "./lib/db/migrations" });
  await sql.end();
  console.log("migrations applied");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
