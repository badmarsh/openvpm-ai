import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  generateDischargeInstructions,
  generateMedicalSummaryPdf,
  generateRabiesVaccinationCertificatePdf,
  generateReportPdf,
  generateVaccinationHistoryCertificatePdf,
} from "../pdf";

describe("medical summary header", () => {
  const source = readFileSync("lib/pdf.ts", "utf8");

  it("stacks logo, clinic name, then the title so long names cannot collide", () => {
    const headerSection = source.slice(
      source.indexOf("export function generateMedicalSummaryPdf"),
      source.indexOf('sectionHeading("Patient Information")'),
    );
    const logoAt = headerSection.indexOf("drawPawMark");
    const nameAt = headerSection.indexOf("splitTextToSize(data.practiceName");
    const titleAt = headerSection.indexOf('"MEDICAL RECORD SUMMARY"');
    expect(logoAt).toBeGreaterThan(-1);
    expect(nameAt).toBeGreaterThan(logoAt);
    expect(titleAt).toBeGreaterThan(nameAt);
    // The title is no longer right-aligned onto the same line as the name.
    expect(headerSection).not.toContain('align: "right"');
  });

  it("renders with a very long clinic name without throwing", () => {
    const doc = generateMedicalSummaryPdf({
      practiceName:
        "Bushwick Veterinary Clinic and Animal Wellness Center of Greater Brooklyn",
      practiceAddress: "123 Knickerbocker Ave, Brooklyn, NY",
      practicePhone: "(555) 000-1234",
      patientName: "Biscuit",
      species: "Canine",
      clientName: "Jordan Avery",
      allergies: [],
      problems: [],
      vaccinations: [
        { name: "Rabies", date: "2026-05-01", nextDue: "2027-05-01" },
      ],
      recentNotes: [],
      prescriptions: [],
      generatedDate: "7/11/2026",
    });
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
    expect(doc.output("arraybuffer").byteLength).toBeGreaterThan(1000);
  });

  it("paginates long SOAP sections and addenda while retaining correction evidence", () => {
    const longClinicalText = Array.from(
      { length: 900 },
      (_, index) => `observation-${index}`,
    ).join(" ");
    const doc = generateMedicalSummaryPdf({
      practiceName: "OpenVPM Test Clinic",
      patientName: "Biscuit",
      species: "Canine",
      clientName: "Jordan Avery",
      allergies: [],
      problems: [],
      vaccinations: [],
      recentNotes: [
        {
          date: "August 9, 2026",
          subjective: longClinicalText,
          authorName: "Dr. Rivera",
          finalizerName: "Dr. Rivera",
          finalizedAt: "August 9, 2026 at 10:30 AM",
          addenda: [
            {
              content: longClinicalText,
              authorName: "Dr. Rivera",
              createdAt: "August 9, 2026 at 11:00 AM",
            },
          ],
        },
      ],
      recordCorrections: [
        {
          recordLabel: "SOAP note dated August 8, 2026",
          reason: "Documented on the wrong visit.",
          correctedByName: "Dr. Rivera",
          correctedAt: "August 9, 2026 at 11:30 AM",
        },
      ],
      prescriptions: [],
      generatedDate: "8/9/2026",
    });

    expect(doc.getNumberOfPages()).toBeGreaterThan(2);
    expect(doc.output("arraybuffer").byteLength).toBeGreaterThan(10_000);
  });
});

describe("pdf generation date labels", () => {
  const source = readFileSync("lib/pdf.ts", "utf8");

  it("uses caller-provided generated dates for medical summaries", () => {
    expect(source).toContain("generatedDate?: string;");
    expect(source).toContain("function formatGeneratedDateUtc()");
    expect(source).toContain(
      'return new Date().toLocaleDateString("en-US", { timeZone: "UTC" })',
    );
    expect(source).toContain(
      "const generatedDate = data.generatedDate ?? formatGeneratedDateUtc()",
    );
    expect(source).toContain("`Generated on ${generatedDate}");
    expect(source).not.toContain(
      "const today = new Date().toLocaleDateString()",
    );
  });

  it("generates vaccination certificates with caller-provided date labels", () => {
    expect(source).toContain("export interface VaccinationCertificateData");
    expect(source).toContain(
      "export function generateVaccinationCertificatePdf",
    );
    expect(source).toContain("VACCINATION CERTIFICATE");
    expect(source).toContain('["Vaccine", data.vaccineName]');
    expect(source).toContain('["Administered", data.administeredAt]');
    expect(source).toContain('["Next due", data.nextDueDate]');
    expect(source).toContain('["Manufacturer", data.manufacturer]');
    expect(source).toContain('["Lot number", data.lotNumber]');
    expect(source).toContain(
      "const generatedDate = data.generatedDate ?? formatGeneratedDateUtc()",
    );
  });

  it("generates generic tabular report PDFs", () => {
    expect(source).toContain("export interface ReportPdfData");
    expect(source).toContain("export function generateReportPdf");
    expect(source).toContain(
      'orientation: data.columns.length > 4 ? "landscape" : "portrait"',
    );
    expect(source).toContain("data.columns.forEach((column, index) =>");
    expect(source).toContain(
      'doc.text(data.emptyMessage ?? "No report data available.", margin, y)',
    );
    expect(source).toContain("doc.text(`Page ${i} of ${pageCount}`");
  });
});

describe("staff vaccination certificate PDFs", () => {
  const identity = {
    certificateId: "00000000-0000-0000-0000-000000000001",
    generatedDate: "Aug 24, 2026",
    practice: {
      name: "Neighborhood Veterinary",
      address: "100 Clinic Way, Brooklyn, NY",
      phone: "555-0100",
      email: "care@example.test",
    },
    owner: {
      name: "Alex Rivera",
      address: "10 Main Street\nBrooklyn, NY, 11201",
      phone: "555-0102",
    },
    patient: {
      name: "Biscuit",
      species: "Canine",
      breed: "Mixed breed",
      sex: "Female (Spayed)",
      dob: "May 1, 2020",
      color: "Brown",
      microchipNumber: "985141000000001",
      weightKg: "18.250",
    },
  };

  it("renders a multi-page vaccination history with certificate identity", () => {
    const doc = generateVaccinationHistoryCertificatePdf({
      ...identity,
      vaccinations: Array.from({ length: 60 }, (_, index) => ({
        vaccineName: `Vaccination ${index + 1}`,
        productName: `Product ${index + 1}`,
        administeredAt: "Aug 24, 2026",
        nextDueDate: "Aug 24, 2027",
        lotNumber: `LOT-${index + 1}`,
        administeredByName: "Dr. Rivera",
      })),
    });

    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
    expect(doc.output("arraybuffer").byteLength).toBeGreaterThan(10_000);
  });

  it("renders all required routine rabies evidence and a wet-signature line", () => {
    const doc = generateRabiesVaccinationCertificatePdf({
      ...identity,
      vaccination: {
        vaccineName: "Rabies",
        productName: "Defensor 3",
        manufacturer: "Zoetis",
        lotNumber: "LOT-123",
        productExpirationDate: "May 1, 2027",
        doseType: "booster",
        licensedDurationMonths: 36,
        rabiesTagNumber: "TAG-42",
        administeredAt: "Aug 24, 2026",
        nextDueDate: "Aug 24, 2029",
        administeredByName: "Taylor Tech",
        veterinarianName: "Dr. Rivera",
        veterinarianLicenseNumber: "NY-12345",
      },
    });

    expect(doc.getNumberOfPages()).toBe(1);
    expect(doc.output("arraybuffer").byteLength).toBeGreaterThan(4_000);
    const source = readFileSync("lib/pdf.ts", "utf8");
    expect(source).toContain("Veterinarian signature");
    expect(source).toContain(
      "Routine vaccination record — not a travel health certificate",
    );
    expect(source).toContain("Certificate ID: ${data.certificateId}");
  });
});

describe("slovak translated PDF reports", () => {
  const identity = {
    certificateId: "00000000-0000-0000-0000-000000000001",
    generatedDate: "2026-08-24",
    practice: {
      name: "Veterinárna klinika VetCare",
      address: "Mlynská 15, Bratislava",
      phone: "+421 2 1234 5678",
      email: "info@vetcare.sk",
    },
    owner: {
      name: "Ján Novák",
      address: "Hlavná 1\nBratislava, 81101",
      phone: "+421 905 111 222",
    },
    patient: {
      name: "Dunčo",
      species: "Pes",
      breed: "Slovenský čuvač",
      sex: "Samec (kastrovaný)",
      dob: "2020-05-01",
      color: "Biela",
      microchipNumber: "985141000000001",
      weightKg: "32.5",
    },
  };

  it("generates slovak vaccination history certificate PDF", () => {
    const doc = generateVaccinationHistoryCertificatePdf({
      ...identity,
      locale: "sk",
      vaccinations: [
        {
          vaccineName: "Nobivac DHPPi",
          productName: "Nobivac",
          administeredAt: "2026-08-24",
          nextDueDate: "2027-08-24",
          lotNumber: "A123B45",
          administeredByName: "MVDr. Kováč",
        },
      ],
    });

    expect(doc.getNumberOfPages()).toBe(1);
    expect(doc.output("arraybuffer").byteLength).toBeGreaterThan(3_000);
  });

  it("generates slovak rabies vaccination certificate PDF with duration and license formatting", () => {
    for (const months of [12, 24, 36, 60, 6]) {
      const doc = generateRabiesVaccinationCertificatePdf({
        ...identity,
        locale: "sk",
        vaccination: {
          vaccineName: "Nobivac Rabies",
          productName: "Nobivac Rabies",
          manufacturer: "MSD Animal Health",
          lotNumber: "LOT-999",
          productExpirationDate: "2027-05-01",
          doseType: "initial",
          licensedDurationMonths: months,
          rabiesTagNumber: "BA-2026-01",
          administeredAt: "2026-08-24",
          nextDueDate: "2027-08-24",
          administeredByName: "MVDr. Kováč",
          veterinarianName: "MVDr. Peter Kováč",
          veterinarianLicenseNumber: "1234",
        },
      });

      expect(doc.getNumberOfPages()).toBe(1);
      expect(doc.output("arraybuffer").byteLength).toBeGreaterThan(4_000);
    }
  });

  it("generates slovak generic report PDF", () => {
    const docEmpty = generateReportPdf({
      title: "Denný prehľad",
      columns: ["Dátum", "Pacient", "Služba", "Cena"],
      rows: [],
      locale: "sk",
    });
    expect(docEmpty.getNumberOfPages()).toBe(1);

    const docWithRows = generateReportPdf({
      title: "Denný prehľad tržieb",
      subtitle: "Prehľad za august 2026",
      columns: ["Dátum", "Klient", "Popis", "Suma"],
      rows: [["24.8.2026", "Ján Novák", "Očkovanie", "45,00 €"]],
      locale: "sk",
    });
    expect(docWithRows.getNumberOfPages()).toBe(1);
    expect(docWithRows.output("arraybuffer").byteLength).toBeGreaterThan(2_000);
  });

  it("generates slovak discharge instructions PDF", () => {
    const doc = generateDischargeInstructions({
      practiceName: "Veterinárna klinika VetCare",
      practicePhone: "+421 2 1234 5678",
      patientName: "Dunčo",
      species: "Pes",
      clientName: "Ján Novák",
      visitDate: "2026-08-24",
      doctorName: "MVDr. Peter Kováč",
      diagnosis: "Gastroenteritída",
      medications: [
        {
          name: "Amoksiklav 500mg",
          dosage: "1 tableta",
          frequency: "každých 12 hodín",
          instructions: "Podávať s jedlom",
        },
      ],
      instructions: [
        "Diéta: varená ryža s kuracím mäsom v malých dávkach.",
        "Dostatočný prísun čerstvej vody.",
      ],
      restrictions: ["Pokojový režim bez fyzickej námahy počas 3 dní."],
      followUpDate: "2026-08-28",
      followUpNotes: "Kontrola zdravotného stavu a ukončenie antibiotickej liečby.",
      emergencyNotes:
        "Pri opakovanom zvracaní, apatii alebo prítomnosti krvi v stolici ihneď vyhľadajte pohotovosť.",
      locale: "sk",
    });

    expect(doc.getNumberOfPages()).toBe(1);
    expect(doc.output("arraybuffer").byteLength).toBeGreaterThan(3_000);
  });
});
