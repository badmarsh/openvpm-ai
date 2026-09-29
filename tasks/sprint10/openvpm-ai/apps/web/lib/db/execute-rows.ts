/** Normalize Drizzle/Postgres execute results across direct-driver arrays and
 * adapters that wrap rows in `{ rows }`. Unknown shapes fail closed to []. */
export function rowsFromExecute<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  const rows = (result as { rows?: unknown[] } | null)?.rows;
  return Array.isArray(rows) ? (rows as T[]) : [];
}
