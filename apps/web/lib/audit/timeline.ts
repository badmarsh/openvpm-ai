/**
 * Shared audit timeline model — normalizovaná podoba forenzných udalostí,
 * ktorú konzumujú:
 *   - apps/web/components/common/audit-history-timeline.tsx (UI),
 *   - apps/web/server/routers/extensions/audit-export.ts (export CSV/PDF).
 *
 * Udalosti prichádzajú z troch zdrojov:
 *   - audit_log                → "mutation" (kto/čo/kedy, input payload),
 *   - ext_ai_audit_log         → "ai_confirmation" (hash chain + edit flag),
 *   - clinical_record_corrections → "clinical_correction" (reason + operation hash).
 */

export type AuditTimelineEventKind =
  | "mutation"
  | "ai_confirmation"
  | "clinical_correction";

export interface AuditTimelineEvent {
  id: string;
  kind: AuditTimelineEventKind;
  occurredAt: string; // ISO 8601
  actorName: string | null;
  actorRole: string | null;
  actorId: string | null;
  ipAddress: string | null;
  /** Akcia, napr. "clients.create", "soap_note_finalized", "entered_in_error". */
  action: string;
  entityType: string | null;
  entityId: string | null;
  /** Textové odôvodnenie lekára (pri oprave po uzatvorení). */
  reason: string | null;
  /** Pred/po hodnota pre vizuálny diff (ak sú dostupné). */
  before?: unknown;
  after?: unknown;
  /** Kryptografická pečať — hash chain integrity (AI ledger). */
  eventHash: string | null;
  previousEventHash: string | null;
  sequenceNumber: number | null;
}

export interface DiffLine {
  type: "context" | "add" | "remove";
  text: string;
}

/**
 * Jednoduchý, deterministický riadkový diff (spoločná predpona + prípona).
 * Dostatočný na zvýraznenie zmien v opravách lekárskych správ.
 */
export function diffLines(before: string, after: string): DiffLine[] {
  const b = before.split("\n");
  const a = after.split("\n");

  let prefix = 0;
  while (prefix < b.length && prefix < a.length && b[prefix] === a[prefix]) {
    prefix += 1;
  }

  let suffix = 0;
  while (
    suffix < b.length - prefix &&
    suffix < a.length - prefix &&
    b[b.length - 1 - suffix] === a[a.length - 1 - suffix]
  ) {
    suffix += 1;
  }

  const out: DiffLine[] = [];
  for (let i = 0; i < prefix; i++) out.push({ type: "context", text: b[i] });
  for (let i = prefix; i < b.length - suffix; i++)
    out.push({ type: "remove", text: b[i] });
  for (let i = prefix; i < a.length - suffix; i++)
    out.push({ type: "add", text: a[i] });
  for (let i = b.length - suffix; i < b.length; i++)
    out.push({ type: "context", text: b[i] });
  return out;
}

/** Bezpečná JSON stringifikácia pre zobrazenie "pred/po". */
export function stringifyForDiff(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
