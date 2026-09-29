/**
 * Advisory reference-range status derivation for lab results.
 * The recorded clinical flag always wins for "critical"; numeric comparison
 * only refines an out-of-range result into LOW / HIGH. Never diagnostic.
 */
export type RangeStatus =
  | "normal"
  | "low"
  | "high"
  | "abnormal"
  | "critical"
  | "pending";

export const RANGE_STATUS_BADGE_CLASS: Record<RangeStatus, string> = {
  normal: "border-success/40 bg-success-muted text-success-muted-foreground",
  low: "border-warning/40 bg-warning-muted text-warning-muted-foreground",
  high: "border-warning/40 bg-warning-muted text-warning-muted-foreground",
  abnormal: "border-warning/40 bg-warning-muted text-warning-muted-foreground",
  critical:
    "border-destructive/40 bg-destructive-muted text-destructive-muted-foreground font-semibold",
  pending: "border-border bg-muted text-muted-foreground",
};

type RangeInput = {
  resultFlag: "unknown" | "normal" | "abnormal" | "critical";
  resultValue: string | null;
  referenceRangeLow: string | number | null;
  referenceRangeHigh: string | number | null;
};

function toNumber(value: string | number | null): number | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function deriveRangeStatus(row: RangeInput): RangeStatus {
  if (row.resultFlag === "critical") return "critical";
  const value = toNumber(row.resultValue);
  const low = toNumber(row.referenceRangeLow);
  const high = toNumber(row.referenceRangeHigh);
  if (value != null) {
    if (low != null && value < low) return "low";
    if (high != null && value > high) return "high";
  }
  if (row.resultFlag === "abnormal") return "abnormal";
  if (row.resultFlag === "normal") return "normal";
  if (value != null && low != null && high != null) return "normal";
  return "pending";
}
