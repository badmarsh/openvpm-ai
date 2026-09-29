import { db } from "./client";
import { sql } from "drizzle-orm";

async function main() {
  const res = await db
    .execute(
      sql`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'ext_marketing_website%'`,
    )
    .then((r) => (Array.isArray(r) ? r : (r as { rows?: unknown[] }).rows));
  console.log("Found tables:", res);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
