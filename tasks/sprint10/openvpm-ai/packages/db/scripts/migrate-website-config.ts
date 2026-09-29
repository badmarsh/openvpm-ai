import { db } from "../client";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Applying ext_marketing_website_config table if not exists...");
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "ext_marketing_website_config" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
      "deleted_at" timestamp with time zone,
      "practice_id" uuid NOT NULL REFERENCES "practices"("id") ON DELETE CASCADE,
      "sections_draft" jsonb DEFAULT '[]'::jsonb NOT NULL,
      "sections_published" jsonb,
      "published" boolean DEFAULT false NOT NULL,
      "published_at" timestamp with time zone
    );
  `);

  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "ext_marketing_website_config_practice_id_unique"
    ON "ext_marketing_website_config" ("practice_id");
  `);

  const result = await db.execute(sql`
    SELECT to_regclass('public.ext_marketing_website_config') as table_name;
  `);

  console.log("Migration result:", result);
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
