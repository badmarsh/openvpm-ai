/**
 * OpenVPM AI — KVEPIS Statutory Validation Engine
 * 
 * Enforces compliance with Slovak Veterinary Legislation (Zákon č. 39/2007 Z. z.)
 * and official ŠVPS SR submission specifications for:
 * - Oznámenie o vakcinácii proti besnote (3-dňová lehota hlásenia na RVPS)
 * - Kniha ošetrení hospodárskych zvierat a ochranné lehoty
 * - Sprievodný doklad na premiestnenie / bitúnok
 */

export interface KvepisValidationError {
  field: string;
  message: string;
  code: string;
}

export interface KvepisValidationResult {
  valid: boolean;
  errors: KvepisValidationError[];
  warnings: string[];
}

export interface RabiesNotificationData {
  patient: {
    id: string;
    name: string;
    species: string;
    microchipNumber?: string | null;
    passportNumber?: string | null;
  };
  client: {
    name: string;
    address?: string | null;
    city?: string | null;
    phone?: string | null;
  };
  vaccination: {
    vaccineName: string;
    batchNumber: string;
    administeredAt: Date;
    validUntil: Date;
  };
  veterinarian: {
    name: string;
    kvlNumber: string;
  };
  rvpsCode: string;
}

export interface TreatmentDiaryBatchData {
  farm: {
    cehzCode: string; // 6-miestny kód chovu CEHZ
    ownerName: string;
    farmAddress: string;
  };
  treatments: Array<{
    patientId: string;
    animalIdentification: string; // Ušná známka (napr. SK000123456789)
    species: string;
    diagnosis: string;
    medicationName: string;
    batchNumber: string;
    meatWithdrawalDays: number;
    milkWithdrawalDays: number;
    administeredAt: Date;
    safeUntilMeat: Date;
    safeUntilMilk: Date;
  }>;
  veterinarian: {
    name: string;
    kvlNumber: string;
  };
}

export interface AnimalMovementData {
  sourceCehz: string;
  destinationCehz: string;
  destinationType: "FARM" | "SLAUGHTERHOUSE" | "EXPORT";
  animals: Array<{
    identification: string;
    species: string;
    activeWithdrawalPeriod: boolean;
    withdrawalExpiryDate?: Date | null;
  }>;
  inspectionDate: Date;
  veterinarian: {
    name: string;
    kvlNumber: string;
  };
}

/**
 * Validuje oznámenie o očkovaní proti besnote podľa § 17 Zákona č. 39/2007 Z. z.
 */
export function validateRabiesNotification(data: RabiesNotificationData): KvepisValidationResult {
  const errors: KvepisValidationError[] = [];
  const warnings: string[] = [];

  // 1. Identifikácia zvieraťa (čip alebo pas je zákonná podmienka)
  if (!data.patient.microchipNumber && !data.patient.passportNumber) {
    errors.push({
      field: "patient.microchipNumber",
      code: "MISSING_IDENTIFICATION",
      message: "Zviera musí mať evidovaný transpondér (mikročip) alebo pas spoločenského zvieraťa.",
    });
  }

  if (data.patient.microchipNumber) {
    const chipClean = data.patient.microchipNumber.trim();
    if (!/^\d{15}$/.test(chipClean)) {
      warnings.push(`Číslo transpondéra ${chipClean} nezodpovedá štandardu ISO 11784 (15 číslic).`);
    }
  }

  // 2. Majiteľ zvieraťa
  if (!data.client.name || data.client.name.trim().length < 2) {
    errors.push({
      field: "client.name",
      code: "INVALID_OWNER_NAME",
      message: "Meno a priezvisko majiteľa zvieraťa je povinné pre hlásenie RVPS.",
    });
  }

  // 3. Vakcína a šarža
  if (!data.vaccination.vaccineName || data.vaccination.vaccineName.trim().length === 0) {
    errors.push({
      field: "vaccination.vaccineName",
      code: "MISSING_VACCINE_NAME",
      message: "Obchodný názov vakcíny je povinný.",
    });
  }

  if (!data.vaccination.batchNumber || data.vaccination.batchNumber.trim().length === 0) {
    errors.push({
      field: "vaccination.batchNumber",
      code: "MISSING_BATCH_NUMBER",
      message: "Číslo šarže vakcíny je povinné pre dosledovateľnosť.",
    });
  }

  // 4. Zákonná lehota nahlásenia (3 pracovné dni od vakcinácie)
  const now = new Date();
  const administered = new Date(data.vaccination.administeredAt);
  const diffTime = Math.abs(now.getTime() - administered.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays > 3) {
    warnings.push(
      `Upozornenie: Hlásenie na RVPS sa odosiela po zákonnej lehote 3 dní od vakcinácie (${diffDays} dní od podania).`
    );
  }

  // 5. Veterinárny lekár a KVL číslo
  if (!data.veterinarian.kvlNumber || data.veterinarian.kvlNumber.trim().length === 0) {
    errors.push({
      field: "veterinarian.kvlNumber",
      code: "MISSING_KVL_NUMBER",
      message: "Registračné číslo veterinárneho lekára v KVL SR je povinné.",
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validuje dávku záznamov v Knihe ošetrení hospodárskych zvierat
 */
export function validateTreatmentDiaryBatch(data: TreatmentDiaryBatchData): KvepisValidationResult {
  const errors: KvepisValidationError[] = [];
  const warnings: string[] = [];

  // CEHZ kód chovu (musí byť 6-miestny alfanumerický kód)
  if (!data.farm.cehzCode || !/^\d{6}$/.test(data.farm.cehzCode.trim())) {
    errors.push({
      field: "farm.cehzCode",
      code: "INVALID_CEHZ_CODE",
      message: "Kód chovu CEHZ musí mať formát 6 číslic (register hospodárskych zvierat).",
    });
  }

  if (!data.treatments || data.treatments.length === 0) {
    errors.push({
      field: "treatments",
      code: "EMPTY_BATCH",
      message: "Dávka knihy ošetrení neobsahuje žiadne záznamy o liečbe.",
    });
  }

  data.treatments.forEach((t, idx) => {
    if (!t.animalIdentification || t.animalIdentification.trim().length === 0) {
      errors.push({
        field: `treatments[${idx}].animalIdentification`,
        code: "MISSING_ANIMAL_ID",
        message: `Záznam #${idx + 1}: Chýba individuálne označenie zvieraťa (ušná známka).`,
      });
    }

    if (!t.medicationName || !t.batchNumber) {
      errors.push({
        field: `treatments[${idx}].medication`,
        code: "MISSING_MEDICATION_DETAILS",
        message: `Záznam #${idx + 1}: Názov lieku a šarža sú povinné pre KVEPIS.`,
      });
    }

    if (t.meatWithdrawalDays < 0 || t.milkWithdrawalDays < 0) {
      errors.push({
        field: `treatments[${idx}].withdrawalDays`,
        code: "INVALID_WITHDRAWAL_DAYS",
        message: `Záznam #${idx + 1}: Ochranná lehota nemôže byť záporné číslo.`,
      });
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validuje sprievodný doklad na premiestnenie / porážku zvieraťa
 */
export function validateAnimalMovement(data: AnimalMovementData): KvepisValidationResult {
  const errors: KvepisValidationError[] = [];
  const warnings: string[] = [];

  if (!data.sourceCehz || !/^\d{6}$/.test(data.sourceCehz.trim())) {
    errors.push({
      field: "sourceCehz",
      code: "INVALID_SOURCE_CEHZ",
      message: "Kód zdrojového chovu CEHZ musí mať 6 číslic.",
    });
  }

  if (!data.destinationCehz || !/^\d{6}$/.test(data.destinationCehz.trim())) {
    errors.push({
      field: "destinationCehz",
      code: "INVALID_DEST_CEHZ",
      message: "Kód cieľového chovu alebo bitúnku CEHZ musí mať 6 číslic.",
    });
  }

  // KRITICKÝ BEZPEČNOSTNÝ GATE: Žiadne zviera nesmie ísť na bitúnok v ochrannej lehote!
  if (data.destinationType === "SLAUGHTERHOUSE") {
    data.animals.forEach((animal, idx) => {
      if (animal.activeWithdrawalPeriod) {
        errors.push({
          field: `animals[${idx}].activeWithdrawalPeriod`,
          code: "ACTIVE_WITHDRAWAL_PERIOD_SLAUGHTER_BAN",
          message: `ZÁKAZ PREMIESTNENIA NA BITÚNOK: Zviera ${animal.identification} má aktívnu ochrannú lehotu do ${animal.withdrawalExpiryDate?.toLocaleDateString("sk-SK") || "nešpecifikované"}.`,
        });
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
