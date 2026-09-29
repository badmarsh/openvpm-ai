/** Postgres undefined_table. Drizzle/postgres.js may nest the original error. */
export function isMissingRelationError(err: unknown, relation: string): boolean {
  const blob = collectErrorText(err);
  if (!blob.includes(relation)) return false;
  return /\b42P01\b/.test(blob) || /does not exist/i.test(blob);
}

function collectErrorText(err: unknown, depth = 0): string {
  if (err == null || depth > 6) return "";
  if (typeof err === "string") return err;
  if (typeof err !== "object") return String(err);
  const rec = err as { code?: unknown; message?: unknown; cause?: unknown };
  const parts = [rec.code, rec.message, err instanceof Error ? err.stack : null];
  return `${parts.filter(Boolean).join(" ")} ${collectErrorText(rec.cause, depth + 1)}`;
}
