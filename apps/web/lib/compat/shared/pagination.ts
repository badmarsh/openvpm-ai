export interface Pagination {
  limit: number;
  offset: number;
}

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

/**
 * Parse `limit`/`offset` query params with safe bounds. Invalid or out-of-range
 * values fall back to defaults rather than erroring — lenient by design for a
 * public REST surface.
 */
export function parsePagination(searchParams: URLSearchParams): Pagination {
  const rawLimit = Number(searchParams.get("limit"));
  const rawOffset = Number(searchParams.get("offset"));

  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(Math.floor(rawLimit), MAX_LIMIT)
      : DEFAULT_LIMIT;
  const offset =
    Number.isFinite(rawOffset) && rawOffset > 0 ? Math.floor(rawOffset) : 0;

  return { limit, offset };
}

/** Standard list envelope: `{ data, pagination }`. */
export function paginated<T>(data: T[], pagination: Pagination, total: number) {
  return {
    data,
    pagination: { ...pagination, total },
  };
}
