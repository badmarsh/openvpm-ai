/**
 * Terénna prax — Farmy & Hospodárske zvieratá (Modul 4)
 * ------------------------------------------------------
 * Čistá (pure) logika pre UI stránku `/field-visits` a tRPC router
 * `extensions.fieldVisits`. Žiadne I/O, deterministicky testovateľné:
 *
 *  1. CEHZ ušné známky — normalizácia a validácia slovenského formátu
 *     (SK + 12 číslic, napr. `SK 000801452101` / `SK000801452101`).
 *  2. Ochranné lehoty (Zákon č. 39/2007 Z. z. a nariadenia EÚ) — výpočet
 *     zostávajúcich dní pre mäso/mlieko a ohraničenie MAX_WITHDRAWAL_DAYS.
 *  3. Kontrolované látky (Zákon č. 139/1998 Z. z.) — detekcia a blokovanie
 *     AI prefillu / terénneho podania omamných látok.
 *  4. Withdrawal Watch — vyhodnotenie konfliktu pred ukončením liečby,
 *     expedíciou zvieraťa alebo dodávkou produktov počas lehoty.
 */

import { isControlledSubstanceName } from "@/lib/controlled-substances/policy";
import { calculateStatutoryWithdrawal } from "@/lib/statutory/withdrawal";

/** Horná hranica evidovanej ochrannej lehoty v dňoch (garbage bound). */
export const MAX_WITHDRAWAL_DAYS = 365;

/** Ušná známka CEHZ: presne "SK" + 12 číslic (bez medzier). */
export const CEHZ_EAR_TAG_PATTERN = /^SK\d{12}$/i;

/** Dni v milisekundách (výpočty zostávajúcich dní lehoty). */
const DAY_MS = 86_400_000;

// ---------------------------------------------------------------------------
// 1. CEHZ ušné známky
// ---------------------------------------------------------------------------

/**
 * Normalizuje vstup veterinára na kanonický tvar `SK###########`:
 * - odstráni medzery/pomlčky (vstup `SK 000801452101`, `sk-000801452101`),
 * - ak chýba prefix SK, doplní ho pri 12-miestnom čísle (`000801452101`),
 * - vráti null, ak formát nie je platný (iný prefix, iný počet číslic,
 *   nulové číslo — neexistujúca známka).
 */
export function normalizeCehzEarTag(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const compact = raw.trim().toUpperCase().replace(/[\s-]+/g, "");
  if (compact.length === 0) return null;

  const digitsOnly = compact.startsWith("SK") ? compact.slice(2) : compact;
  if (!/^\d{12}$/.test(digitsOnly)) return null;
  // Číselný rozsah: 12 číslic, ale nie "všetko nuly" (neexistujúca známka).
  if (/^0{12}$/.test(digitsOnly)) return null;

  return `SK${digitsOnly}`;
}

/** True, ak vstup predstavuje platnú slovenskú ušnú známku CEHZ. */
export function isValidCehzEarTag(raw: string | null | undefined): boolean {
  return normalizeCehzEarTag(raw) !== null;
}

/** Zobraziteľný tvar známky (`SK 000801452101`) alebo null pri neplatnosti. */
export function formatCehzEarTag(raw: string | null | undefined): string | null {
  const normalized = normalizeCehzEarTag(raw);
  return normalized ? `SK ${normalized.slice(2)}` : null;
}

// ---------------------------------------------------------------------------
// 2. Ochranné lehoty (mäso / mlieko)
// ---------------------------------------------------------------------------

/** Orezá hodnotu do rozsahu [0, MAX_WITHDRAWAL_DAYS]; nečíselný vstup → 0. */
export function clampWithdrawalDays(value: unknown): number {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return 0;
  const rounded = Math.round(num);
  if (rounded < 0) return 0;
  if (rounded > MAX_WITHDRAWAL_DAYS) return MAX_WITHDRAWAL_DAYS;
  return rounded;
}

/** Platná evidovaná lehota: celé číslo 0…MAX_WITHDRAWAL_DAYS. */
export function isValidWithdrawalDays(value: unknown): boolean {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= MAX_WITHDRAWAL_DAYS
  );
}

export interface WithdrawalChannelStatus {
  /** Evidované dni lehoty (orezané na MAX_WITHDRAWAL_DAYS). */
  days: number;
  /** Koniec lehoty (23:59:59.999 príslušného dňa) alebo null, ak 0 dní. */
  safeUntil: Date | null;
  /** Zostávajúce kalendárne dni (0 = lehota neplatí / vypršala). */
  remainingDays: number;
  /** true, kým lehota ešte blokuje dodávku na ľudský konzum. */
  active: boolean;
}

export interface FieldWithdrawalStatus {
  administeredAt: Date;
  medicationName: string | null;
  meat: WithdrawalChannelStatus;
  milk: WithdrawalChannelStatus;
  /** Skratka posledného bezpečného dňa z oboch kanálov. */
  overallSafeUntil: Date | null;
  anyActive: boolean;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function calendarDaysBetween(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / DAY_MS);
}

function channelStatus(
  days: number,
  safeUntil: Date | null,
  now: Date
): WithdrawalChannelStatus {
  const active = days > 0 && safeUntil !== null && safeUntil.getTime() > now.getTime();
  let remainingDays = 0;
  if (active && safeUntil) {
    // Posledný deň lehoty stále blokuje — zobraz aspoň 1 deň.
    remainingDays = Math.max(1, calendarDaysBetween(now, safeUntil));
  }
  return { days, safeUntil, remainingDays, active };
}

/**
 * Vypočíta stav ochrannej lehoty pre jedno podanie lieku.
 * Lehota končí o 23:59:59.999 príslušného kalendárneho dňa (Zákon 39/2007
 * Z. z. / nariadenie EÚ 2019/6). Dni sú vždy ohraničené MAX_WITHDRAWAL_DAYS.
 */
export function computeFieldWithdrawalStatus(params: {
  administeredAt: Date | string;
  meatWithdrawalDays?: number | null;
  milkWithdrawalDays?: number | null;
  medicationName?: string | null;
  now?: Date;
}): FieldWithdrawalStatus {
  const now = params.now ?? new Date();
  const administeredAt =
    params.administeredAt instanceof Date
      ? params.administeredAt
      : new Date(params.administeredAt);

  const meatDays = clampWithdrawalDays(params.meatWithdrawalDays ?? 0);
  const milkDays = clampWithdrawalDays(params.milkWithdrawalDays ?? 0);

  const calc = calculateStatutoryWithdrawal(
    administeredAt,
    { meat: meatDays, milk: milkDays },
    false,
    now
  );

  const meat = channelStatus(meatDays, calc.meatSafeUntil, now);
  const milk = channelStatus(milkDays, calc.milkSafeUntil, now);
  const timestamps = [meat.safeUntil?.getTime() ?? 0, milk.safeUntil?.getTime() ?? 0];
  const overallTs = Math.max(...timestamps);

  return {
    administeredAt,
    medicationName: params.medicationName ?? null,
    meat,
    milk,
    overallSafeUntil: overallTs > 0 ? new Date(overallTs) : null,
    anyActive: meat.active || milk.active,
  };
}

// ---------------------------------------------------------------------------
// 3. Kontrolované látky (Zákon č. 139/1998 Z. z.)
// ---------------------------------------------------------------------------

/**
 * Vráti názov prvého lieku z výberu, ktorý je kontrolovanou látkou
 * (ketamín, butorfanol, fentanyl, propofol, …), inak null. Terénny výjazd
 * s AI prefillom takú látku nesmie nikdy predvyplniť ani podať.
 */
export function findControlledSubstanceConflict(
  productNames: Array<string | null | undefined>
): string | null {
  for (const name of productNames) {
    if (name && isControlledSubstanceName(name)) return name;
  }
  return null;
}

/** True, ak výber liekov obsahuje kontrolovanú látku — terénny záznam blokuj. */
export function hasControlledSubstanceConflict(
  productNames: Array<string | null | undefined>
): boolean {
  return findControlledSubstanceConflict(productNames) !== null;
}

// ---------------------------------------------------------------------------
// 4. Withdrawal Watch — blokovanie expedície / ukončenia liečby
// ---------------------------------------------------------------------------

/** Akcie, ktoré nesmú prebehnúť, kým platí ochranná lehota. */
export type GuardedFieldAction =
  | "finish_treatment"
  | "dispatch_animal"
  | "supply_milk"
  | "slaughter";

/** Akcie, ktoré sú počas lehoty v poriadku (napr. záznam ďalšieho ošetrenia). */
export type PermittedFieldAction = "start_treatment" | "record_visit";

export type FieldVisitAction = GuardedFieldAction | PermittedFieldAction;

export interface WithdrawalConflict {
  code: "WITHDRAWAL_ACTIVE";
  action: GuardedFieldAction;
  /** Najneskorší koniec lehoty zo všetkých dotknutých zvierat. */
  safeUntil: Date;
  /** Kanály, ktoré ešte blokujú (`meat` / `milk`). */
  channels: Array<"meat" | "milk">;
}

const GUARDED_ACTIONS: ReadonlySet<string> = new Set<GuardedFieldAction>([
  "finish_treatment",
  "dispatch_animal",
  "supply_milk",
  "slaughter",
]);

/**
 * Červená bezpečnostná brána: pokus o ukončenie liečby, expedíciu zvieraťa
 * na porážku alebo dodávku mlieka pred uplynutím ochrannej lehoty sa musí
 * blokovať s dátumom, kedy je produkt bezpečný.
 *
 * Vracia null, keď je akcia povolená (žiadna aktívna lehota / povolená akcia).
 */
export function evaluateWithdrawalConflict(
  action: FieldVisitAction,
  statuses: FieldWithdrawalStatus[]
): WithdrawalConflict | null {
  if (!GUARDED_ACTIONS.has(action)) return null;

  const active = statuses.filter((s) => s.anyActive);
  if (active.length === 0) return null;

  const channels: Array<"meat" | "milk"> = [];
  if (active.some((s) => s.meat.active)) channels.push("meat");
  if (active.some((s) => s.milk.active)) channels.push("milk");

  const safeUntil = new Date(
    Math.max(
      ...active.map((s) =>
        Math.max(s.meat.safeUntil?.getTime() ?? 0, s.milk.safeUntil?.getTime() ?? 0)
      )
    )
  );

  return {
    code: "WITHDRAWAL_ACTIVE",
    action: action as GuardedFieldAction,
    safeUntil,
    channels,
  };
}
