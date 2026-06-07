import { config } from "dotenv";
config({ path: "../../.env" });

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const sqlText = readFileSync(join(here, "rls", "enable-rls.sql"), "utf8");

const sql = postgres(url, { max: 1 });
try {
  // Simple protocol so the multi-statement / DO-block migration runs as one.
  await sql.unsafe(sqlText).simple();
  console.log("✓ RLS policies applied (run as the DB owner).");
} catch (err) {
  console.error("✗ Failed to apply RLS policies:", err);
  process.exitCode = 1;
} finally {
  await sql.end();
}
