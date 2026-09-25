export type StockStatus = "not_tracked" | "out" | "low" | "ok";
export type ExpirationStatus = "expired" | "expiring_soon" | "ok" | "none";

export type InventoryAlertInput = {
  inventoryTracked?: boolean;
  stockQuantity: number;
  reorderPoint?: number | null;
  expirationDate?: string | Date | null;
};

export type InventoryAlert = {
  stockStatus: StockStatus;
  expirationStatus: ExpirationStatus;
  needsAttention: boolean;
};

export function ymdFromDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function ymdToDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return ymdFromDate(date) === value ? date : null;
}

function normalizeDateKey(value: Date | string): string | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : ymdFromDate(value);
  }
  return ymdToDate(value) ? value : null;
}

export function addDaysYmd(date: Date | string, days: number): string {
  const dateKey = normalizeDateKey(date);
  const base = dateKey ? ymdToDate(dateKey) : null;
  const copy = base ?? new Date();
  copy.setUTCDate(copy.getUTCDate() + days);
  return ymdFromDate(copy);
}

function normalizeDate(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : ymdFromDate(value);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return value;
}

export function classifyStock(
  stockQuantity: number,
  reorderPoint: number | null | undefined
): StockStatus {
  if (stockQuantity <= 0) return "out";
  if (stockQuantity <= (reorderPoint ?? 10)) return "low";
  return "ok";
}

export function classifyExpiration(
  expirationDate: string | Date | null | undefined,
  today: Date | string = new Date(),
  windowDays = 90
): ExpirationStatus {
  const exp = normalizeDate(expirationDate);
  if (!exp) return "none";
  const todayYmd = normalizeDateKey(today) ?? ymdFromDate(new Date());
  if (exp < todayYmd) return "expired";
  if (exp <= addDaysYmd(today, windowDays)) return "expiring_soon";
  return "ok";
}

export function inventoryAlert(
  product: InventoryAlertInput,
  today: Date | string = new Date(),
  windowDays = 90
): InventoryAlert {
  const tracked = product.inventoryTracked !== false;
  const stockStatus = tracked
    ? classifyStock(product.stockQuantity, product.reorderPoint)
    : "not_tracked";
  const expirationStatus = tracked
    ? classifyExpiration(product.expirationDate, today, windowDays)
    : "none";
  return {
    stockStatus,
    expirationStatus,
    needsAttention:
      tracked &&
      (stockStatus !== "ok" ||
        expirationStatus === "expired" ||
        expirationStatus === "expiring_soon"),
  };
}

/**
 * Sprint 27 — expiry-date warning badges.
 *
 * The product register flags a lot as amber once it is inside the
 * `INVENTORY_EXPIRY_WARNING_DAYS` window and red once the date has passed.
 * Pure date maths so both the table badge and the tests share one contract.
 */
export const INVENTORY_EXPIRY_WARNING_DAYS = 30;

export type ExpiryBadgeTone = "expired" | "warning";

/** Whole days from `today` until `expirationDate`; negative once expired. */
export function daysUntilExpiry(
  expirationDate: string | Date | null | undefined,
  today: Date | string = new Date()
): number | null {
  const exp = normalizeDate(expirationDate);
  if (!exp) return null;
  const todayYmd = normalizeDateKey(today) ?? ymdFromDate(new Date());
  const expDate = ymdToDate(exp);
  const todayDate = ymdToDate(todayYmd);
  if (!expDate || !todayDate) return null;
  return Math.round(
    (expDate.getTime() - todayDate.getTime()) / (24 * 60 * 60 * 1000)
  );
}

/**
 * Badge tone for a lot expiry: `expired` (destructive token) when the date has
 * passed, `warning` (amber token) inside the warning window, otherwise null.
 */
export function expiryBadgeTone(
  expirationDate: string | Date | null | undefined,
  today: Date | string = new Date(),
  warningDays: number = INVENTORY_EXPIRY_WARNING_DAYS
): ExpiryBadgeTone | null {
  const days = daysUntilExpiry(expirationDate, today);
  if (days === null) return null;
  if (days < 0) return "expired";
  return days <= warningDays ? "warning" : null;
}
