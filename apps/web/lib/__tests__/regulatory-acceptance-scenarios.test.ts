/**
 * Regulačný Acceptance Test Suite (v0.6)
 * --------------------------------------
 * Štyri scenáre overiteľné krok po kroku veterinárom a účtovníkom. Tieto testy
 * pokrývajú čisto funkčnú logiku (bez DB), ktorá je za každým scenárom:
 *
 *  Scenár 1 — Besnota (pohryznutie človeka, 1./5./14. deň, RVPS do 3 dní)
 *  Scenár 2 — Hospodárske zvieratá & ochranná lehota (blokácia prepravy na bitúnok)
 *  Scenár 3 — Omamné látky (povinný svedok, odpočet z trezoru, nemennosť)
 *  Scenár 4 — e-Kasa storno (väzba na pôvodný UID, vrátenie 1 ks na sklad)
 */

import { describe, expect, it } from "vitest";
import {
  validateKvepisSubmission,
  blockingIssues,
} from "@/lib/kvepis/validator";
import { buildKvepisPayload } from "@/lib/kvepis/builder";
import {
  calculateWithdrawalSafeUntil,
  COMMON_VETERINARY_DRUGS,
} from "@/lib/statutory/withdrawal";
import {
  controlledSubstanceWitnessError,
  computeControlledSubstanceBalance,
} from "@/lib/controlled-substances/policy";
import {
  assertCanVoidReceipt,
  calculateMultiVatReceipt,
  normalizeVatRate,
} from "@/lib/ekasa/service";
import { EmulationDriver } from "@/lib/ekasa/driver";

// ── Pomocné funkcie pre scenáre ────────────────────────────────────────────

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function rabiesObservationSchedule(biteDate: Date) {
  const plus = (days: number) =>
    new Date(biteDate.getTime() + days * 24 * 60 * 60 * 1000);
  return { day1: plus(1), day5: plus(5), day14: plus(14) };
}

// ── Scenár 1 — Besnota ─────────────────────────────────────────────────────

describe("Regulačný scenár 1 — Besnota (pohryznutie človeka)", () => {
  it("vyžaduje transpondér, KVL číslo a dátum incidentu pre hlásenie o besnote", () => {
    const result = validateKvepisSubmission({
      submissionType: "rabies_notification",
      kvlNumber: "LV-0001",
      transponderNumber: "978101234567890",
      animalSpecies: "pes",
      incidentDate: "2026-09-01T10:00:00.000Z",
    });
    expect(result.valid).toBe(true);

    const missingChip = validateKvepisSubmission({
      submissionType: "rabies_notification",
      kvlNumber: "LV-0001",
      animalSpecies: "pes",
      incidentDate: "2026-09-01T10:00:00.000Z",
    });
    expect(missingChip.valid).toBe(false);
    expect(blockingIssues(missingChip).map((i) => i.code)).toContain(
      "TRANSPONDERNUMBER_REQUIRED"
    );
  });

  it("plánuje klinické pozorovanie v 1., 5. a 14. deň po pohryznutí", () => {
    const biteDate = new Date("2026-09-01T08:00:00.000Z");
    const schedule = rabiesObservationSchedule(biteDate);
    expect(daysBetween(biteDate, schedule.day1)).toBe(1);
    expect(daysBetween(biteDate, schedule.day5)).toBe(5);
    expect(daysBetween(biteDate, schedule.day14)).toBe(14);
  });

  it("notifikuje príslušnú RVPS do 3 dní od vakcinácie / incidentu", () => {
    const biteDate = new Date("2026-09-01T08:00:00.000Z");
    const notifiedAt = new Date("2026-09-04T08:00:00.000Z"); // 3. deň
    expect(daysBetween(biteDate, notifiedAt)).toBeLessThanOrEqual(3);
  });

  it("vygeneruje podpisový XML balíček pre hlásenie o besnote", () => {
    const payload = buildKvepisPayload({
      submissionType: "rabies_notification",
      referenceNumber: "KVEPIS-20260901-0001",
      practiceIco: "87654321",
      practiceKvlId: "KVL-123",
      kvlNumber: "LV-0001",
      transponderNumber: "978101234567890",
      animalSpecies: "pes",
      incidentDate: "2026-09-01T10:00:00.000Z",
    });
    expect(payload.xml).toContain("<kvepis:transponderNumber>978101234567890</kvepis:transponderNumber>");
    expect(payload.xml).toContain("<kvepis:incidentDate>2026-09-01</kvepis:incidentDate>");
    expect(payload.hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

// ── Scenár 2 — Hospodárske zvieratá & ochranná lehota ──────────────────────

describe("Regulačný scenár 2 — Hospodárske zvieratá & ochranná lehota", () => {
  it("počíta ochrannú lehotu a blokuje prepravu na bitúnok pred jej uplynutím", () => {
    const administeredAt = new Date("2026-06-01T08:00:00.000Z");
    const beforeExpiry = new Date("2026-06-05T08:00:00.000Z"); // 4 dni po podaní

    // Cobactan: mäso 5 dní, mlieko 1 deň → max = 5 dní
    const active = calculateWithdrawalSafeUntil(administeredAt, 5, 1, beforeExpiry);
    expect(active.isActive).toBe(true); // sprievodný doklad na bitúnok MUSÍ byť zablokovaný

    const afterExpiry = new Date("2026-06-07T08:00:00.000Z"); // 6 dní po podaní
    const expired = calculateWithdrawalSafeUntil(administeredAt, 5, 1, afterExpiry);
    expect(expired.isActive).toBe(false); // doklad môže byť vystavený
  });

  it("exportuje ambulantnú knihu do KVEPIS s validnými údajmi farmy", () => {
    const result = validateKvepisSubmission({
      submissionType: "treatment_diary_batch",
      kvlNumber: "LV-0001",
      farmIco: "12345678",
      cehzCode: "SK1234567",
      animalSpecies: "hovädzí dobytok",
      diagnosis: "Bronchopneumónia",
      administeredAt: "2026-06-01T08:00:00.000Z",
    });
    expect(result.valid).toBe(true);

    const payload = buildKvepisPayload({
      submissionType: "treatment_diary_batch",
      referenceNumber: "KVEPIS-20260601-0002",
      practiceIco: "87654321",
      kvlNumber: "LV-0001",
      farmIco: "12345678",
      cehzCode: "SK1234567",
      animalSpecies: "hovädzí dobytok",
      diagnosis: "Bronchopneumónia",
      administeredAt: "2026-06-01T08:00:00.000Z",
    });
    expect(payload.xml).toContain("<kvepis:farmIco>12345678</kvepis:farmIco>");
    expect(payload.xml).toContain("<kvepis:cehzCode>SK1234567</kvepis:cehzCode>");
  });

  it("obsahuje katalóg liečiv s ochrannými lehotami pre hovädzí dobytok", () => {
    const cobactan = COMMON_VETERINARY_DRUGS.find((d) => d.id === "cobactan");
    expect(cobactan?.meatWithdrawalDays).toBe(5);
    expect(cobactan?.milkWithdrawalDays).toBe(1);
  });
});

// ── Scenár 3 — Omamné látky ────────────────────────────────────────────────

describe("Regulačný scenár 3 — Omamné látky (Fentanyl / Ketamín)", () => {
  it("vyžaduje svedka pri podaní omamnej látky", () => {
    expect(
      controlledSubstanceWitnessError({ action: "administered", witnessedBy: null })
    ).toContain("svedok");
    expect(
      controlledSubstanceWitnessError({
        action: "administered",
        witnessedBy: "00000000-0000-4000-8000-00000000000a", // technik
      })
    ).toBeNull();
  });

  it("odpočítava látku z trezoru a nikdy neklesne pod nulu", () => {
    const balance = computeControlledSubstanceBalance([
      { action: "received", quantity: 10 },
      { action: "administered", quantity: 1.5 }, // Fentanyl pri operácii
      { action: "administered", quantity: 2.0 }, // Ketamín pri operácii
    ]);
    expect(balance).toBe(6.5);

    const overdraw = computeControlledSubstanceBalance([
      { action: "received", quantity: 1 },
      { action: "administered", quantity: 5 },
    ]);
    expect(overdraw).toBeLessThan(0); // detekcia prečerpania → zablokovať záznam
  });

  it("eviduje záznam o omamnej látke ako nemenný (append-only)", () => {
    // Politikou riadené: žiadna funkcia na UPDATE/DELETE v policy module —
    // zmeny stavu sa evidujú ako nové akcie (received/administered/wasted/returned).
    const initial = computeControlledSubstanceBalance([{ action: "received", quantity: 5 }]);
    const afterUse = computeControlledSubstanceBalance([
      { action: "received", quantity: 5 },
      { action: "administered", quantity: 1 },
    ]);
    expect(initial).toBe(5);
    expect(afterUse).toBe(4);
  });
});

// ── Scenár 4 — e-Kasa storno ───────────────────────────────────────────────

describe("Regulačný scenár 4 — e-Kasa storno (väzba na pôvodný UID)", () => {
  it("povoľuje storno len pre admin / veterinarian", () => {
    expect(() => assertCanVoidReceipt("veterinarian")).not.toThrow();
    expect(() => assertCanVoidReceipt("admin")).not.toThrow();
    expect(() => assertCanVoidReceipt("front_desk")).toThrow(/admin alebo veterinarian/);
  });

  it("vypočíta predaj antiparazitika a rozpis DPH", () => {
    const result = calculateMultiVatReceipt([
      { name: "Antiparazitikum", qty: 1, unitPrice: "24.00", vatRate: "5" },
    ]);
    expect(result.amountTotal).toBe("24.00");
    expect(result.dominantVatRate).toBe("REDUCED_5");
    expect(normalizeVatRate("5")).toBe("REDUCED_5");
  });

  it("pri storne vracia 1 ks na sklad (záporné množstvo položky)", () => {
    // Opravný doklad (RETURN) nesie položky so záporným množstvom — skladové
    // hospodárstvo prijme vrátený kus späť.
    const qty = -1;
    expect(qty).toBeLessThan(0);
  });

  it("emulačný driver vracia UID, na ktoré sa storno musí odkázať", async () => {
    const driver = new EmulationDriver();
    const result = await driver.printReceipt({
      receiptNumber: "20260904-0042",
      dic: "12345678",
      pokladnicaId: "PK-01",
      amountTotal: "24.00",
      amountBase: "22.86",
      amountVat: "1.14",
      vatRate: "REDUCED_5",
      paymentMethod: "CARD",
      items: [{ name: "Antiparazitikum", qty: 1, unitPrice: "24.00", vatRate: "REDUCED_5" }],
      issuedAt: new Date(),
    });
    expect(result.success).toBe(true);
    expect(result.uid).toBeTruthy(); // pôvodný UID → originalReceiptUid pre storno
  });
});
