import { describe, it, expect } from "vitest";
import {
  validatePetExpertEligibility,
  buildPetExpertClaimPayload,
  generatePetExpertClaimHtml,
  type PetExpertClaimData,
  type PetExpertPolicyInput,
  type PetExpertPatientInput,
} from "../petexpert";

describe("PetExpert Insurance Library", () => {
  const validPolicy: PetExpertPolicyInput = {
    policyNumber: "PE-SK-2026-8899",
    providerName: "PetExpert Slovensko",
    coveragePercent: 90,
    deductible: 35,
    effectiveDate: "2026-01-01",
    expirationDate: "2027-01-01",
  };

  const validPatient: PetExpertPatientInput = {
    id: "11111111-1111-1111-1111-111111111111",
    name: "Rex",
    species: "canine",
    breed: "Nemecký ovčiak",
    microchipNumber: "941000028475812",
    birthDate: "2022-04-15",
    weightKg: 32.5,
  };

  it("should validate an eligible canine patient with active policy and 15-digit microchip", () => {
    const res = validatePetExpertEligibility(validPolicy, validPatient, 250);
    expect(res.eligible).toBe(true);
    expect(res.errors).toHaveLength(0);
    // 250 EUR claim: 10% co-pay = 25 EUR, but minimum deductible is 35 EUR
    expect(res.estimatedCoPay).toBe(35);
    expect(res.estimatedInsurerCoverage).toBe(215);
  });

  it("should calculate 10% co-pay when higher than minimum deductible", () => {
    // 500 EUR claim: 10% co-pay = 50 EUR > 35 EUR
    const res = validatePetExpertEligibility(validPolicy, validPatient, 500);
    expect(res.eligible).toBe(true);
    expect(res.estimatedCoPay).toBe(50);
    expect(res.estimatedInsurerCoverage).toBe(450);
  });

  it("should reject claim when pet is missing a microchip", () => {
    const patientWithoutChip: PetExpertPatientInput = {
      ...validPatient,
      microchipNumber: null,
    };
    const res = validatePetExpertEligibility(validPolicy, patientWithoutChip, 150);
    expect(res.eligible).toBe(false);
    expect(res.errors.some((e) => e.includes("mikročip"))).toBe(true);
  });

  it("should reject claim when policy has expired", () => {
    const expiredPolicy: PetExpertPolicyInput = {
      ...validPolicy,
      expirationDate: "2025-01-01",
    };
    const res = validatePetExpertEligibility(expiredPolicy, validPatient, 150);
    expect(res.eligible).toBe(false);
    expect(res.errors.some((e) => e.includes("expirovala"))).toBe(true);
  });

  it("should build structured PetExpert JSON payload conforming to API v2.1", () => {
    const claimData: PetExpertClaimData = {
      claimNumber: "PETEXP-2026-001",
      policy: validPolicy,
      patient: validPatient,
      client: {
        id: "22222222-2222-2222-2222-222222222222",
        firstName: "Ján",
        lastName: "Novák",
        phone: "+421905123456",
        email: "jan.novak@example.com",
        address: "Hlavná 12, Bratislava",
      },
      veterinarianName: "MVDr. Peter Kováč",
      veterinarianKvl: "KVL-4812",
      diagnosisText: "Akútna gastroenteritída",
      diagnosisCode: "K52.9",
      incidentDate: "2026-09-11",
      treatmentSummary: "Infúzna terapia Ringer, Cerenia inj., probiotiká.",
      items: [
        {
          name: "Klinické vyšetrenie",
          quantity: 1,
          unitPrice: 30,
          vatRate: 20,
          totalPrice: 30,
        },
        {
          name: "Cerenia 10mg/ml inj.",
          quantity: 1,
          unitPrice: 22.5,
          vatRate: 20,
          totalPrice: 22.5,
          isMedication: true,
        },
      ],
      invoiceTotal: 52.5,
      clientCoPayAmount: 35,
      insurerPayoutAmount: 17.5,
      clientConsentForDirectSettlement: true,
    };

    const payload = buildPetExpertClaimPayload(claimData);
    expect(payload.partnerApiVersion).toBe("2.1");
    expect(payload.insurer).toBe("PETEXPERT_SK");
    expect(payload.claimReference).toBe("PETEXP-2026-001");
    expect(payload.insuredPet.microchipNumber).toBe("941000028475812");
    expect(payload.policyHolder.fullName).toBe("Ján Novák");
    expect(payload.clinicalCase.veterinarian.kvlRegistration).toBe("KVL-4812");
    expect(payload.financials.items).toHaveLength(2);
    expect(payload.financials.items[1].category).toBe("MEDICATION");
  });

  it("should generate clean, valid printable HTML report", () => {
    const claimData: PetExpertClaimData = {
      claimNumber: "PETEXP-2026-002",
      policy: validPolicy,
      patient: validPatient,
      client: {
        id: "22222222-2222-2222-2222-222222222222",
        firstName: "Ján",
        lastName: "Novák",
      },
      veterinarianName: "MVDr. Peter Kováč",
      diagnosisText: "Lacerácia labky",
      incidentDate: "2026-09-12",
      treatmentSummary: "Sutúra rany v lokálnej anestézii.",
      items: [
        {
          name: "Chirurgické ošetrenie rany",
          quantity: 1,
          unitPrice: 75,
          vatRate: 20,
          totalPrice: 75,
        },
      ],
      invoiceTotal: 75,
      clientCoPayAmount: 35,
      insurerPayoutAmount: 40,
      clientConsentForDirectSettlement: true,
    };

    const html = generatePetExpertClaimHtml(claimData);
    expect(html).toContain("Oznámenie poistnej udalosti");
    expect(html).toContain("PetExpert Slovensko");
    expect(html).toContain("941000028475812");
    expect(html).toContain("Chirurgické ošetrenie rany");
    expect(html).toContain("75.00 €");
  });
});
