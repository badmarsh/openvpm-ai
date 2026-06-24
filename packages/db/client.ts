import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index";

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

function getConnectionString() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL environment variable is not set");
  }
  return url;
}

// Supabase's transaction pooler (PgBouncer, port 6543) does not support the
// prepared statements postgres-js uses by default, so disable them for pooled
// connections. Direct/local connections keep prepares on for performance.
function isPooledConnection(url: string): boolean {
  return (
    url.includes("pooler.supabase.com") ||
    url.includes(":6543") ||
    url.includes("pgbouncer=true")
  );
}

export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop) {
    if (!_db) {
      const url = getConnectionString();
      const client = postgres(url, isPooledConnection(url) ? { prepare: false } : {});
      _db = drizzle(client, { schema });
    }
    return (_db as any)[prop];
  },
});

export type Database = ReturnType<typeof drizzle<typeof schema>>;
