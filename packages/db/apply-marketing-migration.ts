import { config } from "dotenv";
config({ path: "../../.env" });
import { db } from "./client";
import { sql } from "drizzle-orm";

async function applyMigration() {
  console.log("Applying marketing schema additions to PostgreSQL...");

  await db.execute(sql`
    ALTER TABLE ext_marketing_media_assets ADD COLUMN IF NOT EXISTS url text;
    ALTER TABLE ext_marketing_media_assets ADD COLUMN IF NOT EXISTS patient_name text;
    ALTER TABLE ext_marketing_media_assets ADD COLUMN IF NOT EXISTS subjects_present boolean NOT NULL DEFAULT false;
    ALTER TABLE ext_marketing_media_assets ADD COLUMN IF NOT EXISTS alt_text text DEFAULT '';
    ALTER TABLE ext_marketing_media_assets ADD COLUMN IF NOT EXISTS meta jsonb;

    ALTER TABLE ext_marketing_media_assets DROP CONSTRAINT IF EXISTS ext_mkt_media_consent_required;
    ALTER TABLE ext_marketing_media_assets ADD CONSTRAINT ext_mkt_media_consent_required CHECK ((subjects_present = false) OR (consent_id IS NOT NULL));

    ALTER TABLE ext_marketing_reviews ADD COLUMN IF NOT EXISTS platform text NOT NULL DEFAULT 'google';
    CREATE INDEX IF NOT EXISTS ext_mkt_reviews_platform_idx ON ext_marketing_reviews (practice_id, platform);

    CREATE TABLE IF NOT EXISTS ext_marketing_competitor_snapshots (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz,
      practice_id uuid NOT NULL REFERENCES practices(id),
      query text NOT NULL,
      region text NOT NULL,
      clinics jsonb NOT NULL DEFAULT '[]'::jsonb,
      recommendations jsonb NOT NULL DEFAULT '[]'::jsonb,
      articles jsonb NOT NULL DEFAULT '[]'::jsonb,
      sources jsonb NOT NULL DEFAULT '[]'::jsonb,
      model text NOT NULL DEFAULT 'gemini-3.6-flash',
      is_sample boolean NOT NULL DEFAULT false
    );

    CREATE INDEX IF NOT EXISTS ext_mkt_competitor_practice_idx ON ext_marketing_competitor_snapshots (practice_id, deleted_at);
  `);

  console.log("✓ Marketing schema additions successfully applied!");
}

applyMigration()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Migration error:", err);
    process.exit(1);
  });
