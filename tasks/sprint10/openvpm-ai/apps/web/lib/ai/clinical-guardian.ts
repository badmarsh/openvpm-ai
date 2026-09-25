import { and, eq, isNull, desc, inArray, sql, gte, lt, lte, or } from "drizzle-orm";
import {
  extClinicalGuardianAlerts,
  patients,
  patientAllergies,
  problemList,
  labResults,
  prescriptions,
  extRabiesObservations,
  extWithdrawalPeriods,
  microchipRegistrations,
  type ExtClinicalGuardianAlert,
} from "@openpims/db";

// ============================================================================
// Clinical Constants & Drug Classification Lists
// ============================================================================

export const NSAID_KEYWORDS = [
  "meloxicam",
  "metacam",
  "meloxivet",
  "meloxidyl",
  "carprofen",
  "rimadyl",
  "rycarfa",
  "canidryl",
  "ketoprofen",
  "ketofen",
  "tolfenamic",
  "tolfedine",
  "flunixin",
  "finadyne",
  "firocoxib",
  "previcox",
  "robenacoxib",
  "onsior",
  "cimicoxib",
  "cimalgex",
  "mavacoxib",
  "trocoxil",
  "grapiprant",
  "galliprant",
  "aspirin",
  "acetylsalicylic",
  "ibuprofen",
  "ibalgin",
  "nurofen",
  "diclofenac",
  "voltaren",
];

export const CORTICOSTEROID_KEYWORDS = [
  "prednisolon",
  "prednisone",
  "prednison",
  "dexamethason",
  "dexamethasone",
  "dexamed",
  "dexapolrex",
  "hydrocortison",
  "hydrocortisone",
  "methylprednisolon",
  "methylprednisolone",
  "depo-medrol",
  "solu-medrol",
  "medrol",
  "triamcinolon",
  "triamcinolone",
  "betamethason",
  "betamethasone",
  "flumethasone",
];

export const NEPHROTOXIC_KEYWORDS = [
  "gentamicin",
  "gentamicín",
  "amikacin",
  "amikacín",
  "tobramycin",
  "neomycin",
  "kanamycin",
  "polymyxin",
  "amphotericin",
  "cisplatin",
];

export const RENAL_FAILURE_KEYWORDS = [
  "obličk",
  "renál",
  "renal",
  "ckd",
  "creatinine",
  "kreatinín",
  "azotémia",
  "azotemia",
  "zlyhanie obličiek",
  "nefritída",
  "nephritis",
  "glomerulonefritída",
];

export const FELINE_TOXIC_KEYWORDS = [
  "paracetamol",
  "paralen",
  "panadol",
  "acetaminophen",
  "coldrex",
  "tylenol",
  "flector",
  "ibalgin",
  "ibuprofen",
];

export const MDR1_BREED_KEYWORDS = [
  "collie",
  "kólia",
  "kólia dlhosrstá",
  "kólia krátkosrstá",
  "border collie",
  "border kólia",
  "australian shepherd",
  "austrálsky ovčiak",
  "aussie",
  "shetland sheepdog",
  "šeltia",
  "bobtail",
  "staroanglický ovčiak",
  "old english sheepdog",
  "white swiss shepherd",
  "biely švajčiarsky ovčiak",
  "whippet",
  "dlhosrstý vipet",
  "longhaired whippet",
];

export const MDR1_HIGH_RISK_DRUGS = [
  "ivermectin",
  "ivermektín",
  "doramectin",
  "doramektín",
  "moxidectin",
  "moxidektín",
  "loperamid",
  "loperamide",
  "imodium",
];

export interface EvaluatedSafetyAlert {
  category: "medication_safety" | "statutory_deadline" | "vet_intelligence";
  severity: "critical" | "warning" | "info";
  title: string;
  message: string;
  suggestedAction?: string;
  patientId?: string;
  encounterId?: string;
}

// ============================================================================
// Medication Safety Evaluation (Real-time)
// ============================================================================

export function evaluateMedicationSafetyRules(params: {
  patientId: string;
  encounterId?: string;
  medications: Array<{ name: string; dose?: string }>;
  species?: string | null;
  breed?: string | null;
  allergies?: Array<{ allergen: string }>;
  problems?: Array<{ description: string }>;
  latestCreatinineUmol?: number | null;
}): EvaluatedSafetyAlert[] {
  const alerts: EvaluatedSafetyAlert[] = [];
  const {
    patientId,
    encounterId,
    medications,
    species = "",
    breed = "",
    allergies = [],
    problems = [],
    latestCreatinineUmol,
  } = params;

  if (!medications || medications.length === 0) {
    return alerts;
  }

  const normalizedMeds = medications.map((m) => ({
    raw: m.name,
    lower: m.name.toLowerCase().trim(),
    dose: m.dose,
  }));

  const normalizedSpecies = (species || "").toLowerCase();
  const isFeline =
    normalizedSpecies.includes("feline") ||
    normalizedSpecies.includes("cat") ||
    normalizedSpecies.includes("mačka") ||
    normalizedSpecies.includes("kocúr");

  const normalizedBreed = (breed || "").toLowerCase();
  const isMdr1Breed = MDR1_BREED_KEYWORDS.some((k) => normalizedBreed.includes(k));

  // 1. NSAID + Corticosteroid Interaction (Fatal/Critical GI perforation risk)
  const hasNsaid = normalizedMeds.some((m) =>
    NSAID_KEYWORDS.some((k) => m.lower.includes(k)),
  );
  const hasCorticosteroid = normalizedMeds.some((m) =>
    CORTICOSTEROID_KEYWORDS.some((k) => m.lower.includes(k)),
  );

  if (hasNsaid && hasCorticosteroid) {
    alerts.push({
      category: "medication_safety",
      severity: "critical",
      title: "Nebezpečná kombinácia: NSAID + Kortikoidy",
      message:
        "Súbežné podávanie nesteroidných antiflogistík (NSAID) a systémových kortikoidov dramaticky zvyšuje riziko ulcerácie a perforácie gastrointestinálneho traktu.",
      suggestedAction:
        "Vysadiť jedno z liečiv, dodržať washout periódu (min. 3-5 dní) alebo nasadiť intenzívne gastroprotektíva (omeprazol, sukralfát).",
      patientId,
      encounterId,
    });
  }

  // 2. Paracetamol / Toxic Human Drugs for Cats
  if (isFeline) {
    const toxicMed = normalizedMeds.find((m) =>
      FELINE_TOXIC_KEYWORDS.some((k) => m.lower.includes(k)),
    );
    if (toxicMed) {
      alerts.push({
        category: "medication_safety",
        severity: "critical",
        title: "Fatálna toxicita: Paracetamol / Toxické antiflogistikum u mačiek",
        message: `Mačky majú deficit enzýmu glukuronyltransferázy. Podanie liečiva (${toxicMed.raw}) vyvoláva ťažkú methemoglobinémiu, cyanózu, hepatálnu nekrózu a smrť.`,
        suggestedAction:
          "Okamžite kontraindikované! V prípade aplikácie nasadiť N-acetylcysteín (NAC), kyslíkovú terapiu a liečiť ako akútnu intoxikáciu.",
        patientId,
        encounterId,
      });
    }
  }

  // 3. MDR1 Breed Sensitivity
  if (isMdr1Breed) {
    const mdr1Med = normalizedMeds.find((m) =>
      MDR1_HIGH_RISK_DRUGS.some((k) => m.lower.includes(k)),
    );
    if (mdr1Med) {
      alerts.push({
        category: "medication_safety",
        severity: "critical",
        title: `MDR1 Neurotoxické riziko (${breed || "kólia / ovčiak"})`,
        message: `Plemeno ${breed} má vysokú prevalenciu mutácie génu MDR1/ABCB1 (defekt P-glykoproteínu). Podanie ${mdr1Med.raw} spôsobuje masívny prienik do CNS, ťažkú neurotoxicitu, kómu a úmrtie.`,
        suggestedAction:
          "Zvoliť bezpečné alternatívy (napr. selamektín, milbemycín v overených dávkach) alebo vykonať DNA test na mutáciu MDR1.",
        patientId,
        encounterId,
      });
    }
  }

  // 4. Nephrotoxicity in Renal Impairment
  const hasRenalFailure =
    (latestCreatinineUmol != null && latestCreatinineUmol > 140) ||
    problems.some((p) =>
      RENAL_FAILURE_KEYWORDS.some((k) => p.description.toLowerCase().includes(k)),
    );

  if (hasRenalFailure) {
    const nephrotoxicMed = normalizedMeds.find(
      (m) =>
        NEPHROTOXIC_KEYWORDS.some((k) => m.lower.includes(k)) ||
        NSAID_KEYWORDS.some((k) => m.lower.includes(k)),
    );
    if (nephrotoxicMed) {
      alerts.push({
        category: "medication_safety",
        severity: "critical",
        title: "Riziko nefrotoxicity pri renálnom zlyhávaní",
        message: `Pacient má evidovanú renálnu insuficienciu / elevovaný kreatinín. Podanie liečiva ${nephrotoxicMed.raw} môže spôsobiť dekompenzáciu obličiek a akútne tubulárne poškodenie.`,
        suggestedAction:
          "Zvoliť alternatívu šetriacu obličky, znížiť dávku podľa klírensu alebo zabezpečiť primeranú IV infúznu podporu.",
        patientId,
        encounterId,
      });
    }
  }

  // 5. Patient Allergies Matching
  for (const allergy of allergies) {
    const allergenLower = allergy.allergen.toLowerCase().trim();
    if (!allergenLower) continue;

    const matchingMed = normalizedMeds.find(
      (m) =>
        m.lower.includes(allergenLower) ||
        allergenLower.includes(m.lower) ||
        (allergenLower.includes("penicil") &&
          (m.lower.includes("amoxicil") ||
            m.lower.includes("synulox") ||
            m.lower.includes("clavaseptin") ||
            m.lower.includes("augmentin") ||
            m.lower.includes("ampicil"))) ||
        (allergenLower.includes("chinol") &&
          (m.lower.includes("enroflox") ||
            m.lower.includes("baytril") ||
            m.lower.includes("marboflox"))),
    );

    if (matchingMed) {
      alerts.push({
        category: "medication_safety",
        severity: "critical",
        title: `Známa alergia pacienta na liečivo: ${allergy.allergen}`,
        message: `V karte pacienta je evidovaná alergická reakcia na "${allergy.allergen}". Predpísané liečivo (${matchingMed.raw}) je priamo alebo krížovo kontraindikované.`,
        suggestedAction:
          "Vybrať alternatívne liečivo z inej farmakologickej skupiny bez rizika anafylaxie.",
        patientId,
        encounterId,
      });
    }
  }

  return alerts;
}

// ============================================================================
// Full Encounter Medication Check with DB Context
// ============================================================================

export async function checkEncounterMedications(
  db: any,
  practiceId: string,
  patientId: string,
  medications: Array<{ name: string; dose?: string }>,
  encounterId?: string,
): Promise<EvaluatedSafetyAlert[]> {
  // 1. Fetch patient signalment
  const [patient] = await db
    .select({
      id: patients.id,
      species: patients.species,
      breed: patients.breed,
    })
    .from(patients)
    .where(
      and(
        eq(patients.id, patientId),
        eq(patients.practiceId, practiceId),
        isNull(patients.deletedAt),
      ),
    )
    .limit(1);

  if (!patient) return [];

  // 2. Fetch allergies
  const allergies = await db
    .select({ allergen: patientAllergies.allergen })
    .from(patientAllergies)
    .where(
      and(
        eq(patientAllergies.patientId, patientId),
        isNull(patientAllergies.deletedAt),
      ),
    );

  // 3. Fetch active problems
  const problems = await db
    .select({ description: problemList.description })
    .from(problemList)
    .where(
      and(
        eq(problemList.patientId, patientId),
        eq(problemList.practiceId, practiceId),
        eq(problemList.status, "active"),
        isNull(problemList.deletedAt),
      ),
    );

  // 4. Fetch latest creatinine from lab results if available
  const [latestCreatinine] = await db
    .select({
      resultValue: labResults.resultValue,
    })
    .from(labResults)
    .where(
      and(
        eq(labResults.patientId, patientId),
        eq(labResults.practiceId, practiceId),
        or(
          sql`LOWER(${labResults.testName}) LIKE '%creatinine%'`,
          sql`LOWER(${labResults.testName}) LIKE '%kreatin%'`,
        ),
        isNull(labResults.deletedAt),
      ),
    )
    .orderBy(desc(labResults.createdAt))
    .limit(1);

  let creatinineValue: number | null = null;
  if (latestCreatinine?.resultValue) {
    const parsed = parseFloat(latestCreatinine.resultValue);
    if (!isNaN(parsed)) {
      creatinineValue = parsed;
    }
  }

  // 5. Evaluate rules
  return evaluateMedicationSafetyRules({
    patientId,
    encounterId,
    medications,
    species: patient.species,
    breed: patient.breed,
    allergies,
    problems,
    latestCreatinineUmol: creatinineValue,
  });
}

// ============================================================================
// Statutory Compliance Audit (Rabies, Withdrawals, CRSZ chips)
// EXCLUDES cashier / unbilled items and AI receptionist per user decision.
// ============================================================================

export async function auditStatutoryDeadlines(
  db: any,
  practiceId: string,
): Promise<EvaluatedSafetyAlert[]> {
  const alerts: EvaluatedSafetyAlert[] = [];
  const now = new Date();

  // A. Rabies 14-day Observation Deadlines (Zákon č. 39/2007 Z. z. § 19)
  const activeRabies = await db
    .select()
    .from(extRabiesObservations)
    .where(
      and(
        eq(extRabiesObservations.practiceId, practiceId),
        eq(extRabiesObservations.status, "IN_PROGRESS"),
        isNull(extRabiesObservations.deletedAt),
      ),
    );

  for (const obs of activeRabies) {
    const biteTime = new Date(obs.biteDate).getTime();
    const diffDays = Math.floor((now.getTime() - biteTime) / (1000 * 60 * 60 * 24));

    // Day 5 Exam missing
    if (diffDays >= 5 && !obs.day5ExaminedAt) {
      alerts.push({
        category: "statutory_deadline",
        severity: diffDays >= 8 ? "critical" : "warning",
        title: `Besnota: Chýbajúca kontrola na 5. deň (${diffDays}. deň po pohryznutí)`,
        message: `Pozorovanie po poranení osoby (${obs.injuredPersonName}): Uplynulo ${diffDays} dní od incidentu a chýba záznam o povinnej 2. prehliadke (Zákon č. 39/2007 Z. z.).`,
        suggestedAction: "Kontaktovať majiteľa, vykonať vyšetrenie na 5. deň v module /statutory?tab=rabies.",
        patientId: obs.patientId,
      });
    }

    // Day 14 Exam missing
    if (diffDays >= 14 && !obs.day14ExaminedAt) {
      alerts.push({
        category: "statutory_deadline",
        severity: "critical",
        title: `Besnota: Uplynulá 14-dňová lehota pozorovania (${diffDays}. deň)`,
        message: `Pozorovanie po poranení osoby (${obs.injuredPersonName}): Uplynula zákonná lehota 14 dní. Je nutné vykonať záverečné vyšetrenie, uzavrieť status a vystaviť potvrdenie pre lekára a RVPS.`,
        suggestedAction: "Ukončiť pozorovanie a vytlačiť potvrdenie v /statutory?tab=rabies.",
        patientId: obs.patientId,
      });
    }
  }

  // B. Active Withdrawal Periods (Ochranné lehoty pre hospodárske zvieratá)
  const activeWithdrawals = await db
    .select()
    .from(extWithdrawalPeriods)
    .where(
      and(
        eq(extWithdrawalPeriods.practiceId, practiceId),
        gte(extWithdrawalPeriods.safeUntil, now),
        isNull(extWithdrawalPeriods.deletedAt),
      ),
    );

  for (const wp of activeWithdrawals) {
    const safeUntilDate = new Date(wp.safeUntil).toLocaleDateString("sk-SK");
    alerts.push({
      category: "statutory_deadline",
      severity: "info",
      title: `Ochranná lehota: ${wp.medicationName} (${wp.targetAnimalType})`,
      message: `Hospodárske zviera má aktívnu ochrannú lehotu do ${safeUntilDate}. Zákaz dodávky produktov (mäso/mlieko/vajcia) do potravinového reťazca (Zákon č. 39/2007 Z. z.).`,
      suggestedAction: "Skontrolovať záznam v Knihe ošetrení hospodárskych zvierat v /statutory?tab=withdrawals.",
      patientId: wp.patientId,
    });
  }

  // C. Unregistered Microchips in CRSZ past 7 days (Zákon č. 39/2007 Z. z. § 19)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().slice(0, 10);

  const unregisteredChips = await db
    .select()
    .from(microchipRegistrations)
    .where(
      and(
        eq(microchipRegistrations.practiceId, practiceId),
        or(
          eq(microchipRegistrations.crszStatus, "NOT_REGISTERED"),
          eq(microchipRegistrations.crszStatus, "PENDING_SUBMISSION"),
        ),
        lte(microchipRegistrations.implantedAt, sevenDaysAgoStr),
        isNull(microchipRegistrations.deletedAt),
      ),
    );

  for (const chip of unregisteredChips) {
    alerts.push({
      category: "statutory_deadline",
      severity: "warning",
      title: `CRSZ: Čip ${chip.microchipNumber} nebol zaregistrovaný v zákonnej lehote`,
      message: `Zviera bolo označené čipom ${chip.microchipNumber} dňa ${chip.implantedAt}, avšak čip stále nie je evidovaný v CRSZ (lehota do 7 dní podľa Zákona č. 39/2007 Z. z.).`,
      suggestedAction: "Odoslať registráciu do CRSZ v module /statutory?tab=crsz.",
      patientId: chip.patientId,
    });
  }

  return alerts;
}

// ============================================================================
// Synchronize Statutory Alerts into Database (Avoiding Duplicates)
// ============================================================================

export async function syncStatutoryAlertsToDb(
  db: any,
  practiceId: string,
): Promise<{ count: number }> {
  const generatedAlerts = await auditStatutoryDeadlines(db, practiceId);

  // Fetch open alerts to avoid inserting duplicate open statutory alerts
  const existingOpenAlerts = await db
    .select({
      id: extClinicalGuardianAlerts.id,
      title: extClinicalGuardianAlerts.title,
      patientId: extClinicalGuardianAlerts.patientId,
    })
    .from(extClinicalGuardianAlerts)
    .where(
      and(
        eq(extClinicalGuardianAlerts.practiceId, practiceId),
        eq(extClinicalGuardianAlerts.status, "open"),
        eq(extClinicalGuardianAlerts.category, "statutory_deadline"),
        isNull(extClinicalGuardianAlerts.deletedAt),
      ),
    );

  let insertedCount = 0;

  for (const alert of generatedAlerts) {
    const isDuplicate = existingOpenAlerts.some(
      (ex: any) =>
        ex.title === alert.title && ex.patientId === (alert.patientId ?? null),
    );

    if (!isDuplicate) {
      await db.insert(extClinicalGuardianAlerts).values({
        practiceId,
        patientId: alert.patientId ?? null,
        encounterId: alert.encounterId ?? null,
        category: alert.category,
        severity: alert.severity,
        title: alert.title,
        message: alert.message,
        suggestedAction: alert.suggestedAction ?? null,
        status: "open",
      });
      insertedCount++;
    }
  }

  return { count: insertedCount };
}
