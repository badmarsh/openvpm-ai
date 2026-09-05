import { describe, expect, it } from "vitest";
import {
  validateMicrochipNumber,
  calculateTravelEligibility,
  generateMicrochipCertificateHtml,
} from "../microchip";

describe("microchip ISO validation (CRSZ)", () => {
  it("validates a valid 15-digit Slovak national code (703)", () => {
    const result = validateMicrochipNumber("703098100000001");
    expect(result.valid).toBe(true);
    expect(result.code).toBe("703098100000001");
    expect(result.isSlovakNationalCode).toBe(true);
    expect(result.countryOrManufacturer).toContain("Slovensko");
  });

  it("validates a valid 15-digit manufacturer code", () => {
    const result = validateMicrochipNumber("985141000000001");
    expect(result.valid).toBe(true);
    expect(result.code).toBe("985141000000001");
    expect(result.isSlovakNationalCode).toBe(false);
    expect(result.countryOrManufacturer).toContain("Destron Fearing");
  });

  it("handles whitespace in microchip numbers cleanly", () => {
    const result = validateMicrochipNumber(" 985 141 000 000 001 ");
    expect(result.valid).toBe(true);
    expect(result.code).toBe("985141000000001");
  });

  it("rejects microchips with incorrect length", () => {
    expect(validateMicrochipNumber("12345").valid).toBe(false);
    expect(validateMicrochipNumber("1234567890123456").valid).toBe(false);
  });

  it("rejects non-numeric microchips", () => {
    expect(validateMicrochipNumber("98514100000000A").valid).toBe(false);
  });
});

describe("travel eligibility calculator (PetPass EÚ)", () => {
  it("enforces 21-day waiting period for primovaccination", () => {
    const res = calculateTravelEligibility({
      microchipDate: "2026-08-01",
      rabiesDate: "2026-08-01",
      isRevaccination: false,
    });
    expect(res.eligibleFrom).toBe("2026-08-22");
    expect(res.isValidSequence).toBe(true);
  });

  it("allows immediate travel for revaccination within window", () => {
    const res = calculateTravelEligibility({
      microchipDate: "2025-01-01",
      rabiesDate: "2026-09-01",
      isRevaccination: true,
    });
    expect(res.eligibleFrom).toBe("2026-09-01");
    expect(res.isValidSequence).toBe(true);
  });

  it("warns if microchip was implanted AFTER rabies vaccination", () => {
    const res = calculateTravelEligibility({
      microchipDate: "2026-08-15",
      rabiesDate: "2026-08-01",
      isRevaccination: false,
    });
    expect(res.isValidSequence).toBe(false);
    expect(res.warning).toContain("UPOZORNENIE");
  });
});

describe("microchip certificate HTML generator", () => {
  it("generates complete Slovak statutory certificate", () => {
    const html = generateMicrochipCertificateHtml({
      clinicName: "Veterinárna klinika Tatry",
      clinicPhone: "+421903123456",
      vetName: "MVDr. Peter Novák",
      vetKvlNumber: "1234",
      patientName: "Dunčo",
      species: "Pes",
      breed: "Slovenský čuvač",
      ownerName: "Ján Kováč",
      ownerPhone: "+421905111222",
      microchipNumber: "703098100000001",
      implantedAt: "2026-09-05",
      location: "LEFT_NECK",
      verifiedBefore: "Áno",
      verifiedAfter: "Áno",
    });

    expect(html).toContain("703098100000001");
    expect(html).toContain("Potvrdenie o trvalom označení zvieraťa transpondérom");
    expect(html).toContain("MVDr. Peter Novák");
    expect(html).toContain("Dunčo");
    expect(html).toContain("39/2007 Z. z.");
  });
});
