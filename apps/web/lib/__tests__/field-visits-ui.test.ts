/**
 * Field Visits UI — Modul 4 (Terénna prax, Farmy & Hospodárske zvieratá)
 * ----------------------------------------------------------------------
 * Kryje tri zákonné / UI brány dokumentované v zadaní:
 *   1. Validáciu formátu ušnej známky CEHZ (SK prefix + číselný rozsah 12 číslic),
 *   2. Výpočet a ohraničenie ochrannej lehoty (MAX_WITHDRAWAL_DAYS = 365),
 *   3. Detekciu a blokovanie omamných látok pri terénnom výjazde.
 * Plus i18n / UI-craft markeri na stránke a v routery.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CEHZ_EAR_TAG_PATTERN,
  MAX_WITHDRAWAL_DAYS,
  clampWithdrawalDays,
  computeFieldWithdrawalStatus,
  evaluateWithdrawalConflict,
  findControlledSubstanceConflict,
  formatCehzEarTag,
  hasControlledSubstanceConflict,
  isValidCehzEarTag,
  isValidWithdrawalDays,
  normalizeCehzEarTag,
} from "../field-visits/policy";

// ---------------------------------------------------------------------------
// 1. CEHZ ušné známky
// ---------------------------------------------------------------------------

describe("CEHZ ear tag format validation", () => {
  it("accepts the Slovak CEHZ format: SK prefix + 12 digits", () => {
    expect(normalizeCehzEarTag("SK000801452101")).toBe("SK000801452101");
    expect(normalizeCehzEarTag("SK 000801452101")).toBe("SK000801452101");
    expect(normalizeCehzEarTag("sk 000801452101")).toBe("SK000801452101");
    expect(normalizeCehzEarTag("SK-000801452101")).toBe("SK000801452101");
    // Skrátený vstup bez prefixu sa doplní na kanonický tvar.
    expect(normalizeCehzEarTag("000801452101")).toBe("SK000801452101");
    expect(isValidCehzEarTag("SK 000801452101")).toBe(true);
    expect(CEHZ_EAR_TAG_PATTERN.test("SK000801452101")).toBe(true);
  });

  it("enforces the 12-digit numeric range and rejects bad prefixes", () => {
    // Príliš málo / príliš veľa číslic
    expect(isValidCehzEarTag("SK00080145210")).toBe(false); // 11 číslic
    expect(isValidCehzEarTag("SK0008014521012")).toBe(false); // 13 číslic
    expect(isValidCehzEarTag("12345")).toBe(false);
    // Cudzí štátny prefix
    expect(isValidCehzEarTag("AT000801452101")).toBe(false);
    expect(isValidCehzEarTag("DE000801452101")).toBe(false);
    // Neexistujúca známka (samé nuly) a prázdny vstup
    expect(isValidCehzEarTag("SK000000000000")).toBe(false);
    expect(isValidCehzEarTag("")).toBe(false);
    expect(isValidCehzEarTag(null)).toBe(false);
    expect(isValidCehzEarTag(undefined)).toBe(false);
    expect(normalizeCehzEarTag("SK 00AB01452101")).toBe(null);
  });

  it("formats a display variant with the space after SK", () => {
    expect(formatCehzEarTag("SK000801452101")).toBe("SK 000801452101");
    expect(formatCehzEarTag("000801452101")).toBe("SK 000801452101");
    expect(formatCehzEarTag("not-a-tag")).toBe(null);
  });
});

// ---------------------------------------------------------------------------
// 2. Ochranné lehoty — výpočet a ohraničenie
// ---------------------------------------------------------------------------

describe("withdrawal period computation and bounds", () => {
  it("caps every recorded period at MAX_WITHDRAWAL_DAYS = 365", () => {
    expect(MAX_WITHDRAWAL_DAYS).toBe(365);
    expect(clampWithdrawalDays(100_000)).toBe(365);
    expect(clampWithdrawalDays(366)).toBe(365);
    expect(clampWithdrawalDays(365)).toBe(365);
    expect(clampWithdrawalDays(-1)).toBe(0);
    expect(clampWithdrawalDays(-1000)).toBe(0);
    expect(clampWithdrawalDays(Number.NaN)).toBe(0);
    expect(clampWithdrawalDays("garbage")).toBe(0);
    expect(clampWithdrawalDays(14)).toBe(14);

    expect(isValidWithdrawalDays(0)).toBe(true);
    expect(isValidWithdrawalDays(365)).toBe(true);
    expect(isValidWithdrawalDays(366)).toBe(false);
    expect(isValidWithdrawalDays(-1)).toBe(false);
    expect(isValidWithdrawalDays(3.5)).toBe(false);
  });

  it("clamps absurd voice-dictated periods inside the KVEPIS bound", () => {
    const status = computeFieldWithdrawalStatus({
      administeredAt: new Date(2026, 8, 23, 10, 0, 0),
      meatWithdrawalDays: 10_000,
      milkWithdrawalDays: -5,
      medicationName: "Noroclav",
      now: new Date(2026, 8, 23, 12, 0, 0),
    });
    expect(status.meat.days).toBe(MAX_WITHDRAWAL_DAYS);
    expect(status.milk.days).toBe(0);
    expect(status.milk.active).toBe(false);
    expect(status.anyActive).toBe(true);
  });

  it("computes remaining milk/meat days with end-of-day semantics", () => {
    const administeredAt = new Date(2026, 8, 23, 10, 0, 0);
    const now = new Date(2026, 8, 23, 12, 0, 0);
    const status = computeFieldWithdrawalStatus({
      administeredAt,
      meatWithdrawalDays: 14,
      milkWithdrawalDays: 3,
      medicationName: "Baytril 10%",
      now,
    });

    // Mlieko: koniec 26.09. → „ešte 3 dni (do 26.09.)"
    expect(status.milk.active).toBe(true);
    expect(status.milk.remainingDays).toBe(3);
    expect(status.milk.safeUntil?.getFullYear()).toBe(2026);
    expect(status.milk.safeUntil?.getMonth()).toBe(8);
    expect(status.milk.safeUntil?.getDate()).toBe(26);
    // Koniec lehoty je vždy 23:59:59.999 príslušného dňa.
    expect(status.milk.safeUntil?.getHours()).toBe(23);
    expect(status.milk.safeUntil?.getMinutes()).toBe(59);

    // Mäso: ešte 14 dní
    expect(status.meat.active).toBe(true);
    expect(status.meat.remainingDays).toBe(14);
    expect(status.anyActive).toBe(true);

    // Posledný deň lehoty stále blokuje (zobraz aspoň 1 deň)…
    const lastDay = computeFieldWithdrawalStatus({
      administeredAt,
      milkWithdrawalDays: 3,
      now: new Date(2026, 8, 26, 8, 0, 0),
    });
    expect(lastDay.milk.active).toBe(true);
    expect(lastDay.milk.remainingDays).toBe(1);

    // Po vypršaní mliečnej lehoty mäso ešte plynie…
    const milkExpired = computeFieldWithdrawalStatus({
      administeredAt,
      milkWithdrawalDays: 3,
      meatWithdrawalDays: 14,
      now: new Date(2026, 8, 27, 0, 0, 0),
    });
    expect(milkExpired.milk.active).toBe(false);
    expect(milkExpired.milk.remainingDays).toBe(0);
    expect(milkExpired.meat.active).toBe(true);

    // …a po uplynutí najdlhšej lehoty je zviera opäť voľné.
    const after = computeFieldWithdrawalStatus({
      administeredAt,
      milkWithdrawalDays: 3,
      meatWithdrawalDays: 14,
      now: new Date(2026, 9, 8, 0, 0, 0),
    });
    expect(after.anyActive).toBe(false);
    expect(after.milk.remainingDays).toBe(0);
    expect(after.meat.remainingDays).toBe(0);
  });

  it("blocks finishing treatment or dispatching while any period is active", () => {
    const active = computeFieldWithdrawalStatus({
      administeredAt: new Date(2026, 8, 23, 10, 0, 0),
      meatWithdrawalDays: 14,
      milkWithdrawalDays: 3,
      now: new Date(2026, 8, 24, 10, 0, 0),
    });
    const expired = computeFieldWithdrawalStatus({
      administeredAt: new Date(2026, 7, 1, 10, 0, 0),
      meatWithdrawalDays: 14,
      milkWithdrawalDays: 3,
      now: new Date(2026, 8, 24, 10, 0, 0),
    });

    const finish = evaluateWithdrawalConflict("finish_treatment", [active]);
    expect(finish).not.toBeNull();
    expect(finish?.code).toBe("WITHDRAWAL_ACTIVE");
    expect(finish?.channels).toEqual(["meat", "milk"]);

    const dispatch = evaluateWithdrawalConflict("dispatch_animal", [active]);
    expect(dispatch).not.toBeNull();

    // Nové ošetrenie / záznam počas lehoty je povolený.
    expect(evaluateWithdrawalConflict("record_visit", [active])).toBeNull();
    expect(evaluateWithdrawalConflict("start_treatment", [active])).toBeNull();
    // Vypršaná lehota nič neblokuje.
    expect(evaluateWithdrawalConflict("finish_treatment", [expired])).toBeNull();
    expect(evaluateWithdrawalConflict("slaughter", [])).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 3. Kontrolované látky (Zákon č. 139/1998 Z. z.)
// ---------------------------------------------------------------------------

describe("controlled substance detection for field visits", () => {
  it("detects opiates, ketamine and other controlled substances", () => {
    expect(findControlledSubstanceConflict(["Ketamin 100 mg/ml"])).toBe("Ketamin 100 mg/ml");
    expect(findControlledSubstanceConflict(["butorfanol 10 mg"])).toBe("butorfanol 10 mg");
    expect(findControlledSubstanceConflict(["Torbugesic 10 mg/ml"])).toBe("Torbugesic 10 mg/ml");
    expect(findControlledSubstanceConflict(["Fentanyl 50 µg/ml"])).toBe("Fentanyl 50 µg/ml");
    expect(findControlledSubstanceConflict(["Propofol 1%"])).toBe("Propofol 1%");
    expect(hasControlledSubstanceConflict([null, undefined, "Diazepam 5 mg"])).toBe(true);
  });

  it("leaves ordinary livestock medicines unblocked", () => {
    expect(findControlledSubstanceConflict(["Noroclav 100 mg inj."])).toBe(null);
    expect(findControlledSubstanceConflict(["Baytril 10% inj.", "Draxxin 100 mg/ml"])).toBe(null);
    expect(findControlledSubstanceConflict([null, undefined])).toBe(null);
    expect(hasControlledSubstanceConflict([])).toBe(false);
  });

  it("blocks the field-visit form when the selected product conflicts", () => {
    const selected = "Narkamon (ketamín) 10 mg/ml";
    const conflict = findControlledSubstanceConflict([selected]);
    expect(conflict).toBe(selected);
    // Simulácia brány vo formulári: pri konflikte sa výjazd neodosiela.
    const shouldSubmit = conflict === null;
    expect(shouldSubmit).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4. UI craft & i18n markeri (page + router + messages)
// ---------------------------------------------------------------------------

describe("field visits UI craft and i18n wiring", () => {
  const pageSource = readFileSync("app/(dashboard)/field-visits/page.tsx", "utf8");
  const routerSource = readFileSync("server/routers/extensions/field-visits.ts", "utf8");
  const sk = JSON.parse(readFileSync("messages/sk.json", "utf8"));
  const en = JSON.parse(readFileSync("messages/en.json", "utf8"));

  function leafKeys(obj: Record<string, unknown>, prefix = ""): Set<string> {
    const out = new Set<string>();
    for (const [k, v] of Object.entries(obj)) {
      const kp = prefix ? `${prefix}.${k}` : k;
      if (v !== null && typeof v === "object") {
        for (const sub of leafKeys(v as Record<string, unknown>, kp)) out.add(sub);
      } else {
        out.add(kp);
      }
    }
    return out;
  }

  it("uses the canonical i18n page header and useI18n everywhere", () => {
    expect(pageSource).toContain('t("fieldVisits.title", "Terénna prax & Farmy")');
    expect(pageSource).toContain("useI18n");
    expect(pageSource).toContain("PageHeader");
    // Žiadny hardcoded slovenský nadpis v PageHeader.
    expect(pageSource).not.toContain('title="Terénna prax');
  });

  it("keeps 100% fieldVisits key symmetry between sk.json and en.json", () => {
    expect(sk.fieldVisits).toBeDefined();
    expect(en.fieldVisits).toBeDefined();
    const skKeys = leafKeys(sk.fieldVisits, "fieldVisits");
    const enKeys = leafKeys(en.fieldVisits, "fieldVisits");
    expect([...skKeys].filter((k) => !enKeys.has(k))).toEqual([]);
    expect([...enKeys].filter((k) => !skKeys.has(k))).toEqual([]);
    expect(skKeys.size).toBeGreaterThanOrEqual(150);
  });

  it("wires the mobile field UI: ear-tag search, mic transcription, touch targets", () => {
    expect(pageSource).toContain("fieldVisits.transcribeVoice");
    expect(pageSource).toContain("earTagQuery");
    expect(pageSource).toContain("min-h-[44px]");
    expect(pageSource).toContain("withdrawal-watch");
    expect(pageSource).toContain('t("fieldVisits.earTagSearch.title"');
  });

  it("standardizes dense dashboard tables (py-2.5 px-3, tabular-nums)", () => {
    expect(pageSource).toContain("py-2.5 px-3");
    expect(pageSource).toContain("tabular-nums");
  });

  it("supports herd batch actions with ear-tag breakdown in the router", () => {
    expect(pageSource).toContain("createHerdBatchVisit");
    expect(routerSource).toContain("createHerdBatchVisit");
    expect(routerSource).toContain("breakdown");
    expect(routerSource).toContain('batchAction: z.enum(["vaccination", "deworming", "estrus_synch", "other"])');
  });

  it("shares the withdrawal bound and auto-generates KVEPIS drafts with medicine", () => {
    expect(routerSource).toContain('from "@/lib/field-visits/policy"');
    expect(routerSource).toContain("MAX_WITHDRAWAL_DAYS");
    expect(routerSource).toContain("buildReferenceNumber");
    expect(routerSource).toContain("extWithdrawalPeriods");
    // Výjazd s liečivom → koncept KVEPIS (produkty + platná ušná známka).
    expect(routerSource).toContain("input.sendToKvepis && input.products.length > 0 && cowEarTag");
    // Kontrolované látky zostávajú blokované na serveri.
    expect(routerSource).toContain("isControlledSubstanceName");
    expect(routerSource).toContain('code: "FORBIDDEN"');
  });
});
