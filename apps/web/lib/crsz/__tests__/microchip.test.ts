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

describe("KVL SR batch export and CRSZ lookup", () => {
  const sampleItems = [
    {
      microchipNumber: "703098100000001",
      patientName: "Blesk",
      species: "canine",
      breed: "Border Collie",
      sex: "male",
      dob: "2024-01-15",
      color: "čierno-biela",
      implantedAt: "2026-09-08",
      location: "LEFT_NECK",
      vetName: "MVDr. Marek Test",
      vetKvlNumber: "KVL-5432",
      ownerFirstName: "Ján",
      ownerLastName: "Novák",
      ownerAddress: "Hlavná 12",
      ownerCity: "Bratislava",
      ownerPostalCode: "81101",
      ownerPhone: "+421900123456",
      ownerEmail: "jan.novak@example.com",
    },
  ];

  it("exports valid KVL SR batch CSV with UTF-8 BOM and semicolon delimiters", async () => {
    const { exportKvlSrBatchCsv } = await import("../microchip");
    const csv = exportKvlSrBatchCsv(sampleItems);

    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain('"CisloTranspondera";"MenoZvierata";"Druh";"Plemeno"');
    expect(csv).toContain('"703098100000001";"Blesk";"canine";"Border Collie"');
    expect(csv).toContain("KVL-5432");
  });

  it("exports valid KVL SR batch XML with proper namespaces and escaping", async () => {
    const { exportKvlSrBatchXml } = await import("../microchip");
    const xml = exportKvlSrBatchXml(sampleItems);

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<DavkaCRSZ xmlns="urn:sk:kvl:crsz:export:v1"');
    expect(xml).toContain("<Transponder>703098100000001</Transponder>");
    expect(xml).toContain("<Meno>Blesk</Meno>");
    expect(xml).toContain("<CisloKVL>KVL-5432</CisloKVL>");
  });

  it("performs online lookup and detects Slovak 703 national code", async () => {
    const { lookupCrszOnline } = await import("../microchip");
    const result = await lookupCrszOnline("703098100000001");

    expect(result.valid).toBe(true);
    expect(result.isSlovakNationalCode).toBe(true);
    expect(result.registered).toBe(true);
    expect(result.status).toBe("REGISTERED");
    expect(result.registryName).toContain("CRSZ");
  });

  it("handles invalid chip length in online lookup", async () => {
    const { lookupCrszOnline } = await import("../microchip");
    const result = await lookupCrszOnline("123");

    expect(result.valid).toBe(false);
    expect(result.status).toBe("INVALID_FORMAT");
  });
});

