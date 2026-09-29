import { config } from "dotenv";
config({ path: "../../.env" });
import { db } from "./client";
import { sql } from "drizzle-orm";

async function main() {
  const res = await db.execute(sql`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'users'
    ORDER BY ordinal_position
  `);
  console.log(JSON.stringify((res as any).rows ?? res, null, 2));
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
