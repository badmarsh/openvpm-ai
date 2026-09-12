/**
 * OpenVPM AI — Regulatory & Statutory Acceptance Test Suite
 * 
 * End-to-end statutory validation scenarios for veterinary surgeons and practice accountants
 * in compliance with Slovak Veterinary Legislation:
 * - Zákon č. 39/2007 Z. z. (Veterinárna starostlivosť, KVEPIS, besnota, ochranné lehoty)
 * - Zákon č. 139/1998 Z. z. (Omamné a psychotropné látky)
 * - Zákon č. 289/2008 Z. z. (e-Kasa fiskalizácia a storno)
 */

import { describe, expect, it } from "vitest";
import {
  validateRabiesNotification,
  validateTreatmentDiaryBatch,
  validateAnimalMovement,
} from "../kvepis/validator";
import {
  buildRabiesNotificationXml,
  buildTreatmentDiaryBatchXml,
  buildAnimalMovementXml,
} from "../kvepis/builder";
import {
  EmulationDriver,
  FiskalProDriver,
  FiscalReceiptPayload,
  FiscalVoidPayload,
} from "../ekasa/driver";

describe("Regulatory Acceptance Scenario 1: Rabies Observation & RVPS Notification", () => {
  it("rejects rabies notification when animal has neither microchip nor passport", () => {
    const invalidData = {
      patient: {
        id: "pat-1",
        name: "Dunčo",
        species: "canine",
        microchipNumber: null,
        passportNumber: null,
      },
      client: {
        name: "Ján Novák",
        address: "Hlavná 12",
        city: "Bratislava",
      },
      vaccination: {
        vaccineName: "Nobivac Rabies",
        batchNumber: "A123B45",
        administeredAt: new Date(),
        validUntil: new Date(Date.now() + 365 * 24 * 3600 * 1000),
      },
      veterinarian: {
        name: "MVDr. Peter Kováč",
        kvlNumber: "KVL-SK-1234",
      },
      rvpsCode: "SK-RVPS-BA",
    };

    const validation = validateRabiesNotification(invalidData);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => e.code === "MISSING_IDENTIFICATION")).toBe(true);
  });

  it("successfully validates and generates canonical XML for valid rabies vaccination", () => {
    const validData = {
      patient: {
        id: "pat-1",
        name: "Dunčo",
        species: "canine",
        microchipNumber: "941000025123456",
        passportNumber: "SK 0987654",
      },
      client: {
        name: "Ján Novák",
        address: "Hlavná 12",
        city: "Bratislava",
        phone: "+421905111222",
      },
      vaccination: {
        vaccineName: "Nobivac Rabies",
        batchNumber: "A123B45",
        administeredAt: new Date(),
        validUntil: new Date(Date.now() + 365 * 24 * 3600 * 1000),
      },
      veterinarian: {
        name: "MVDr. Peter Kováč",
        kvlNumber: "KVL-SK-1234",
      },
      rvpsCode: "SK-RVPS-BA",
    };

    const validation = validateRabiesNotification(validData);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);

    const { xml, hash } = buildRabiesNotificationXml("KVEPIS-BES-TEST01", validData);
    expect(xml).toContain("<SubmissionId>KVEPIS-BES-TEST01</SubmissionId>");
    expect(xml).toContain("<MicrochipNumber>941000025123456</MicrochipNumber>");
    expect(xml).toContain("<RabiesStatutoryNotice>Potvrdené podľa § 17 ods. 3 Zákona č. 39/2007 Z. z.</RabiesStatutoryNotice>");
    expect(hash).toMatch(/^[0-9a-f]{64}$/); // SHA-256 hex digest
  });
});

describe("Regulatory Acceptance Scenario 2: Food Animal Treatment & Slaughter Ban Gate", () => {
  it("blocks slaughterhouse animal movement if animal has an active withdrawal period", () => {
    const movementData = {
      sourceCehz: "123456",
      destinationCehz: "999888",
      destinationType: "SLAUGHTERHOUSE" as const,
      animals: [
        {
          identification: "SK000888777666",
          species: "bovine",
          activeWithdrawalPeriod: true, // ZÁKAZ!
          withdrawalExpiryDate: new Date(Date.now() + 5 * 24 * 3600 * 1000),
        },
      ],
      inspectionDate: new Date(),
      veterinarian: {
        name: "MVDr. Juraj Horváth",
        kvlNumber: "KVL-SK-5678",
      },
    };

    const validation = validateAnimalMovement(movementData);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => e.code === "ACTIVE_WITHDRAWAL_PERIOD_SLAUGHTER_BAN")).toBe(true);
  });

  it("permits animal movement to slaughterhouse when all animals are past withdrawal periods", () => {
    const safeMovement = {
      sourceCehz: "123456",
      destinationCehz: "999888",
      destinationType: "SLAUGHTERHOUSE" as const,
      animals: [
        {
          identification: "SK000888777666",
          species: "bovine",
          activeWithdrawalPeriod: false, // Bezpečná porážka
          withdrawalExpiryDate: null,
        },
      ],
      inspectionDate: new Date(),
      veterinarian: {
        name: "MVDr. Juraj Horváth",
        kvlNumber: "KVL-SK-5678",
      },
    };

    const validation = validateAnimalMovement(safeMovement);
    expect(validation.valid).toBe(true);

    const { xml, hash } = buildAnimalMovementXml("KVEPIS-MOV-SAFE", safeMovement);
    expect(xml).toContain("<DestinationType>SLAUGHTERHOUSE</DestinationType>");
    expect(xml).toContain("<ActiveWithdrawalPeriod>false</ActiveWithdrawalPeriod>");
    expect(hash).toHaveLength(64);
  });

  it("validates and generates treatment diary batch with withdrawal days", () => {
    const diaryData = {
      farm: {
        cehzCode: "654321",
        ownerName: "Agrospol s.r.o.",
        farmAddress: "Veľké Pole 4",
      },
      treatments: [
        {
          patientId: "cow-1",
          animalIdentification: "SK000111222333",
          species: "bovine",
          diagnosis: "Akútna mastitída",
          medicationName: "Cobactan LC",
          batchNumber: "L9876",
          meatWithdrawalDays: 5,
          milkWithdrawalDays: 3,
          administeredAt: new Date(),
          safeUntilMeat: new Date(Date.now() + 5 * 24 * 3600 * 1000),
          safeUntilMilk: new Date(Date.now() + 3 * 24 * 3600 * 1000),
        },
      ],
      veterinarian: {
        name: "MVDr. Juraj Horváth",
        kvlNumber: "KVL-SK-5678",
      },
    };

    const validation = validateTreatmentDiaryBatch(diaryData);
    expect(validation.valid).toBe(true);

    const { xml } = buildTreatmentDiaryBatchXml("KVEPIS-TRT-001", diaryData);
    expect(xml).toContain("<WithdrawalMilkDays>3</WithdrawalMilkDays>");
    expect(xml).toContain("<WithdrawalMeatDays>5</WithdrawalMeatDays>");
  });
});

describe("Regulatory Acceptance Scenario 3: e-Kasa Fiscal Receipts and Void/Storno", () => {
  it("generates valid fiscal receipt and handles subsequent storno with original UID link", async () => {
    const driver = new EmulationDriver();

    const receiptPayload: FiscalReceiptPayload = {
      receiptNumber: "2026-000456",
      dic: "2020123456",
      pokladnicaId: "88812345678900001",
      amountTotal: "45.50",
      amountBase: "36.99",
      amountVat: "8.51",
      vatRate: "STANDARD_23",
      paymentMethod: "CARD",
      items: [
        {
          name: "Nexgard Spectra 10-20kg",
          qty: 1,
          unitPrice: "45.50",
          vatRate: "STANDARD_23",
        },
      ],
      issuedAt: new Date(),
    };

    const printResult = await driver.printReceipt(receiptPayload);
    expect(printResult.success).toBe(true);
    expect(printResult.uid).toBeDefined();
    expect(printResult.okp).toBeDefined();

    // Storno s väzbou na pôvodný UID
    const voidPayload: FiscalVoidPayload = {
      originalReceiptUid: printResult.uid!,
      receiptNumber: receiptPayload.receiptNumber,
      dic: receiptPayload.dic,
      pokladnicaId: receiptPayload.pokladnicaId,
      amountTotal: receiptPayload.amountTotal,
      reason: "Omyl v type antiparazitika — vrátené na sklad",
      issuedAt: new Date(),
    };

    const voidResult = await driver.voidReceipt(voidPayload);
    expect(voidResult.success).toBe(true);
    expect(voidResult.receiptNumber).toContain("STORNO");
    expect(voidResult.uid).toContain("STORNO");
  });
});
