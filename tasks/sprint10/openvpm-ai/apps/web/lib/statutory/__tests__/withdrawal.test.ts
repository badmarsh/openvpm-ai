import { describe, it, expect } from "vitest";
import {
  calculateWithdrawalSafeUntil,
  formatWithdrawalCertificateHtml,
  COMMON_VETERINARY_DRUGS,
} from "../withdrawal";

describe("Statutory Withdrawal Period Tracker (§ 22 Law 39/2007 Z. z.)", () => {
  it("calculates safe until date based on the maximum of meat and milk withdrawal days", () => {
    const adminDate = new Date("2026-06-01T08:00:00Z");
    const currentDate = new Date("2026-06-10T08:00:00Z"); // 9 days later

    // Shotapen L.A.: meat = 30 days, milk = 10 days => max = 30 days
    const result = calculateWithdrawalSafeUntil(adminDate, 30, 10, currentDate);

    expect(result.maxDays).toBe(30);
    expect(result.isActive).toBe(true);
    expect(result.daysRemaining).toBe(21); // 30 - 9
    expect(result.safeUntil.toISOString().slice(0, 10)).toBe("2026-07-01");
  });

  it("marks withdrawal period as inactive once safe until date is passed", () => {
    const adminDate = new Date("2026-05-01T08:00:00Z");
    const currentDate = new Date("2026-05-20T08:00:00Z"); // 19 days later

    // Flunixin: meat = 4 days, milk = 1 day => max = 4 days
    const result = calculateWithdrawalSafeUntil(adminDate, 4, 1, currentDate);

    expect(result.maxDays).toBe(4);
    expect(result.isActive).toBe(false);
    expect(result.daysRemaining).toBe(0);
  });

  it("correctly handles zero-withdrawal substances (e.g. Duphalyte)", () => {
    const adminDate = new Date("2026-06-01T08:00:00Z");
    const currentDate = new Date("2026-06-01T09:00:00Z");

    const result = calculateWithdrawalSafeUntil(adminDate, 0, 0, currentDate);

    expect(result.maxDays).toBe(0);
    expect(result.isActive).toBe(false);
    expect(result.daysRemaining).toBe(0);
  });

  it("verifies common veterinary drugs catalog contains required drugs and withdrawal days", () => {
    expect(COMMON_VETERINARY_DRUGS.length).toBeGreaterThanOrEqual(8);

    const draxxin = COMMON_VETERINARY_DRUGS.find((d) => d.id === "draxxin");
    expect(draxxin).toBeDefined();
    expect(draxxin?.meatWithdrawalDays).toBe(22);

    const cobactan = COMMON_VETERINARY_DRUGS.find((d) => d.id === "cobactan");
    expect(cobactan).toBeDefined();
    expect(cobactan?.milkWithdrawalDays).toBe(1);
  });

  it("generates official printable statutory certificate HTML with required legal notices (§ 22 & § 48)", () => {
    const html = formatWithdrawalCertificateHtml({
      clinicName: "Veterinárna Klinika VET.IS",
      clinicAddress: "Bratislavská 14, Trnava",
      clinicPhone: "+421 905 123 456",
      clinicIco: "12345678",
      vetName: "MVDr. Martin Kováč",
      patientName: "Bystruša SK 001",
      species: "Hovädzí dobytok",
      breed: "Slovenský strakatý",
      earTagOrChip: "SK 000801234567",
      targetAnimalType: "bovine",
      clientName: "PD Vlčkovce",
      clientAddress: "Vlčkovce 45",
      clientPhone: "+421 903 987 654",
      medicationName: "Cobactan 2.5% inj.",
      batchNumber: "LOT-998822",
      meatWithdrawalDays: 5,
      milkWithdrawalDays: 1,
      administeredAt: new Date("2026-06-01T08:00:00Z"),
      safeUntil: new Date("2026-06-06T08:00:00Z"),
      notes: "Aplikované 20 ml i.m. pri bronchopneumónii",
    });

    expect(html).toContain("POTVRDENIE O APLIKÁCII LIEČIVA A OCHRANNÝCH LEHOTÁCH");
    expect(html).toContain("Cobactan 2.5% inj.");
    expect(html).toContain("LOT-998822");
    expect(html).toContain("Bystruša SK 001");
    expect(html).toContain("PD Vlčkovce");
    expect(html).toContain("MVDr. Martin Kováč");
    expect(html).toContain("Zákaz dodávať na ľudskú spotrebu");
    expect(html).toContain("§ 22");
    expect(html).toContain("§ 48");
  });
});
