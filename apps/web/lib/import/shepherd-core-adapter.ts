import type {
  ClientImportRecord,
  PatientImportRecord,
  SoapNoteImportRecord,
  VaccinationImportRecord,
} from "@/lib/csv/import";
import {
  normalizeDateValue,
  normalizePatientStatusValue,
  normalizeSexValue,
  normalizeSpeciesValue,
} from "@/lib/import/normalize";
import { normalizeKey } from "@/lib/csv/parse";
import { SOAP_SECTION_MAX_LENGTH } from "@/lib/records/soap-content";
import type { ShepherdRawRow, ShepherdTableKind } from "./shepherd-bundle";

export type ShepherdBundleRows = Partial<
  Record<ShepherdTableKind, readonly ShepherdRawRow[]>
>;

export type ShepherdAdapterIssueCode =
  | "source_row_deleted"
  | "missing_required_identity"
  | "missing_owner_link"
  | "conflicting_owner_link"
  | "missing_patient_link"
  | "source_species_mapped_to_other"
  | "source_sex_not_representable"
  | "source_status_not_representable"
  | "source_note_not_final"
  | "invalid_required_date"
  | "invalid_optional_due_date"
  | "source_duplicate_vaccination"
  | "conflicting_vaccination_identity"
  | "missing_clinical_content"
  | "clinical_section_too_long";

export interface ShepherdAdapterIssue {
  table: ShepherdTableKind;
  rowIndex: number;
  code: ShepherdAdapterIssueCode;
  severity: "warning" | "error";
}

export interface ShepherdDomainCoverage {
  sourceRows: number;
  plannedRows: number;
  deferredRows: number;
  excludedRows: number;
  errorRows: number;
}

export interface ShepherdCoreAdaptation {
  clients: ClientImportRecord[];
  patients: PatientImportRecord[];
  vaccinations: VaccinationImportRecord[];
  soapNotes: SoapNoteImportRecord[];
  issues: ShepherdAdapterIssue[];
  coverage: {
    clients: ShepherdDomainCoverage;
    patients: ShepherdDomainCoverage;
    vaccinations: ShepherdDomainCoverage;
    soapNotes: ShepherdDomainCoverage;
  };
}

type NormalizedRow = Record<string, string | undefined>;

function normalized(row: ShepherdRawRow): NormalizedRow {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      normalizeKey(key),
      value?.trim(),
    ]),
  );
}

function truthy(value: string | undefined): boolean {
  return ["1", "true", "yes", "y"].includes(value?.trim().toLowerCase() ?? "");
}

function rowId(row: NormalizedRow): string | undefined {
  return row.id || undefined;
}

function table(
  bundle: ShepherdBundleRows,
  kind: ShepherdTableKind,
): NormalizedRow[] {
  return (bundle[kind] ?? []).map(normalized);
}

function dictionary(
  bundle: ShepherdBundleRows,
  kind: ShepherdTableKind,
): Map<string, string> {
  return new Map(
    table(bundle, kind)
      .map((row) => [row.id, row.name || row.description || row.abrv] as const)
      .filter(
        (entry): entry is readonly [string, string] => !!entry[0] && !!entry[1],
      ),
  );
}

function firstBy(
  rows: readonly NormalizedRow[],
  field: string,
): Map<string, NormalizedRow> {
  const result = new Map<string, NormalizedRow>();
  for (const row of rows) {
    const key = row[field];
    if (key && !result.has(key)) result.set(key, row);
  }
  return result;
}

function preferredPhoneByClient(
  rows: readonly NormalizedRow[],
): Map<string, NormalizedRow> {
  const result = new Map<string, NormalizedRow>();
  for (const row of rows) {
    const clientId = row.clientid;
    if (!clientId || !row.phonenumber) continue;
    const current = result.get(clientId);
    if (!current || (!truthy(current.isprimary) && truthy(row.isprimary))) {
      result.set(clientId, row);
    }
  }
  return result;
}

function combineSection(
  parts: Array<[string, string | undefined]>,
): string | undefined {
  const populated = parts.filter(
    (part): part is [string, string] => !!part[1]?.trim(),
  );
  if (populated.length === 0) return undefined;
  return populated
    .map(([label, value]) => `${label}: ${value.trim()}`)
    .join("\n\n");
}

function rowsBy(
  rows: readonly NormalizedRow[],
  field: string,
): Map<string, NormalizedRow[]> {
  const result = new Map<string, NormalizedRow[]>();
  for (const row of rows) {
    const key = row[field];
    if (!key) continue;
    const existing = result.get(key) ?? [];
    existing.push(row);
    result.set(key, existing);
  }
  return result;
}

function renderVitals(rows: readonly NormalizedRow[]): string | undefined {
  const sections = rows
    .map((row) =>
      combineSection([
        ["Temperature (source units)", row.temperature],
        ["Weight (source units)", row.weight],
        ["Pulse", row.pulse],
        ["Respiratory rate", row.respiratoryrate],
        ["Systolic blood pressure", row.systolicbloodpressure],
        ["Diastolic blood pressure", row.diastolicbloodpressure],
        ["Objective note", row.note],
      ]),
    )
    .filter((value): value is string => !!value);
  return sections.length ? sections.join("\n\n") : undefined;
}

function renderTreatments(rows: readonly NormalizedRow[]): string | undefined {
  const lines = rows
    .filter((row) => !truthy(row.deleted) && !truthy(row.isdeclined))
    .map((row) => {
      if (!row.name) return undefined;
      const details = [
        row.dose ? `Dose: ${row.dose}` : undefined,
        row.quantity ? `Quantity: ${row.quantity}` : undefined,
        row.additionalinstruction
          ? `Instructions: ${row.additionalinstruction}`
          : undefined,
      ].filter((value): value is string => !!value);
      return details.length ? `${row.name} (${details.join("; ")})` : row.name;
    })
    .filter((value): value is string => !!value);
  return lines.length
    ? `Treatments:\n${lines.map((line) => `- ${line}`).join("\n")}`
    : undefined;
}

function coverage(
  sourceRows: number,
  plannedRows: number,
  deferredRows: number,
  excludedRows: number,
  errorRows: number,
): ShepherdDomainCoverage {
  if (plannedRows + deferredRows + excludedRows + errorRows !== sourceRows) {
    throw new Error(
      "Shepherd coverage counts must account for every source row.",
    );
  }
  return { sourceRows, plannedRows, deferredRows, excludedRows, errorRows };
}

/**
 * Transform only the four mature OpenVPM import domains. The function is pure,
 * logs no source values, and returns fixed reason codes for every skipped row.
 * Persistence still goes through the reviewed preview/commit migration ledger.
 */
export function adaptShepherdCore(
  bundle: ShepherdBundleRows,
): ShepherdCoreAdaptation {
  const issues: ShepherdAdapterIssue[] = [];

  const clientRows = table(bundle, "client");
  const addresses = firstBy(
    table(bundle, "client_address").filter((row) => !truthy(row.deleted)),
    "clientid",
  );
  const phones = preferredPhoneByClient(table(bundle, "client_phone"));
  const clients: ClientImportRecord[] = [];
  const clientIds = new Set<string>();
  let clientExcluded = 0;
  let clientErrors = 0;
  clientRows.forEach((row, rowIndex) => {
    if (truthy(row.deleted) || truthy(row.isdeleted)) {
      clientExcluded++;
      issues.push({
        table: "client",
        rowIndex,
        code: "source_row_deleted",
        severity: "warning",
      });
      return;
    }
    const id = rowId(row);
    if (!id || !row.firstname || !row.lastname) {
      clientErrors++;
      issues.push({
        table: "client",
        rowIndex,
        code: "missing_required_identity",
        severity: "error",
      });
      return;
    }
    const address = addresses.get(id);
    const phone = phones.get(id);
    clients.push({
      externalClientId: id,
      firstName: row.firstname,
      lastName: row.lastname,
      email: row.email || undefined,
      phone: phone?.phonenumber || undefined,
      address: address?.address || undefined,
      city: address?.city || undefined,
      state: address?.state || undefined,
      zip: address?.zipcode || undefined,
    });
    clientIds.add(id);
  });

  const ownerByPatient = new Map<string, string>();
  const conflictingPatients = new Set<string>();
  for (const row of table(bundle, "client_patient")) {
    if (!row.patientid || !row.clientid) continue;
    const existing = ownerByPatient.get(row.patientid);
    if (existing && existing !== row.clientid)
      conflictingPatients.add(row.patientid);
    else ownerByPatient.set(row.patientid, row.clientid);
  }
  const breeds = new Map(
    table(bundle, "breed")
      .map((row) => [row.id, row] as const)
      .filter((entry): entry is readonly [string, NormalizedRow] => !!entry[0]),
  );
  const species = dictionary(bundle, "species");
  const sexes = dictionary(bundle, "sex");
  const patientStatuses = dictionary(bundle, "patient_status");
  const patientRows = table(bundle, "patient");
  const patients: PatientImportRecord[] = [];
  const patientIds = new Set<string>();
  let patientExcluded = 0;
  let patientErrors = 0;
  patientRows.forEach((row, rowIndex) => {
    if (truthy(row.deleted) || truthy(row.isdeleted)) {
      patientExcluded++;
      issues.push({
        table: "patient",
        rowIndex,
        code: "source_row_deleted",
        severity: "warning",
      });
      return;
    }
    const id = rowId(row);
    const ownerId = id ? ownerByPatient.get(id) : undefined;
    if (id && conflictingPatients.has(id)) {
      patientErrors++;
      issues.push({
        table: "patient",
        rowIndex,
        code: "conflicting_owner_link",
        severity: "error",
      });
      return;
    }
    if (!id || !row.name || !ownerId || !clientIds.has(ownerId)) {
      patientErrors++;
      issues.push({
        table: "patient",
        rowIndex,
        code: ownerId ? "missing_required_identity" : "missing_owner_link",
        severity: "error",
      });
      return;
    }
    const breed = row.breedid ? breeds.get(row.breedid) : undefined;
    const speciesName = breed?.speciesid
      ? species.get(breed.speciesid)
      : undefined;
    const normalizedSpecies = normalizeSpeciesValue(speciesName) ?? "other";
    if (
      speciesName &&
      normalizedSpecies === "other" &&
      speciesName.trim().toLowerCase() !== "other"
    ) {
      issues.push({
        table: "patient",
        rowIndex,
        code: "source_species_mapped_to_other",
        severity: "warning",
      });
    }
    const sourceSex = row.sexid ? sexes.get(row.sexid) : undefined;
    const sex = normalizeSexValue(sourceSex);
    if (sourceSex && !sex) {
      issues.push({
        table: "patient",
        rowIndex,
        code: "source_sex_not_representable",
        severity: "warning",
      });
    }
    const sourceStatus = row.statusid
      ? patientStatuses.get(row.statusid)
      : undefined;
    const status = normalizePatientStatusValue(
      truthy(row.isdeceased) ? "deceased" : sourceStatus,
    );
    if (sourceStatus && !status) {
      issues.push({
        table: "patient",
        rowIndex,
        code: "source_status_not_representable",
        severity: "warning",
      });
    }
    patients.push({
      externalClientId: ownerId,
      externalPatientId: id,
      name: row.name,
      species: normalizedSpecies,
      breed: breed?.name || undefined,
      sex,
      dob: normalizeDateValue(row.dateofbirth) ?? undefined,
      color: row.color || undefined,
      microchipNumber: row.microchipnumber || undefined,
      status: status ?? "inactive",
    });
    patientIds.add(id);
  });

  const vaccinationRows = table(bundle, "vaccination");
  const vaccinations: VaccinationImportRecord[] = [];
  let vaccinationDeferred = 0;
  let vaccinationExcluded = 0;
  let vaccinationErrors = 0;
  const preparedVaccinations = vaccinationRows.map((row, rowIndex) => {
    if (!row.patientid || !patientIds.has(row.patientid)) {
      vaccinationErrors++;
      issues.push({
        table: "vaccination",
        rowIndex,
        code: "missing_patient_link",
        severity: "error",
      });
      return null;
    }
    const administeredAt = normalizeDateValue(row.administrationdate);
    if (!administeredAt || !row.vaccinename) {
      vaccinationErrors++;
      issues.push({
        table: "vaccination",
        rowIndex,
        code: "invalid_required_date",
        severity: "error",
      });
      return null;
    }
    const nextDueDate = normalizeDateValue(row.duedate) ?? undefined;
    if (row.duedate && !nextDueDate) {
      issues.push({
        table: "vaccination",
        rowIndex,
        code: "invalid_optional_due_date",
        severity: "warning",
      });
    }
    const record: VaccinationImportRecord = {
      externalPatientId: row.patientid,
      vaccineName: row.vaccinename,
      administeredAt,
      nextDueDate,
      lotNumber: row.lotnumber || row.serialnumber || undefined,
      manufacturer: row.manufacturer || undefined,
    };
    return {
      rowIndex,
      record,
      identity: [
        row.patientid,
        row.vaccinename.trim().toLowerCase(),
        administeredAt,
      ].join("|"),
      payload: JSON.stringify(record),
    };
  });
  const vaccinationGroups = new Map<
    string,
    Array<NonNullable<(typeof preparedVaccinations)[number]>>
  >();
  for (const prepared of preparedVaccinations) {
    if (!prepared) continue;
    const group = vaccinationGroups.get(prepared.identity) ?? [];
    group.push(prepared);
    vaccinationGroups.set(prepared.identity, group);
  }
  for (const group of vaccinationGroups.values()) {
    if (group.length === 1) {
      vaccinations.push(group[0]!.record);
      continue;
    }
    const payloads = new Set(group.map((entry) => entry.payload));
    if (payloads.size === 1) {
      vaccinations.push(group[0]!.record);
      for (const duplicate of group.slice(1)) {
        vaccinationExcluded++;
        issues.push({
          table: "vaccination",
          rowIndex: duplicate.rowIndex,
          code: "source_duplicate_vaccination",
          severity: "warning",
        });
      }
      continue;
    }
    vaccinationDeferred += group.length;
    for (const conflict of group) {
      issues.push({
        table: "vaccination",
        rowIndex: conflict.rowIndex,
        code: "conflicting_vaccination_identity",
        severity: "warning",
      });
    }
  }

  const subjective = firstBy(table(bundle, "soap_subjective"), "soapid");
  const assessment = firstBy(table(bundle, "soap_assessment"), "soapid");
  const plan = firstBy(table(bundle, "soap_plan"), "soapid");
  const vitals = rowsBy(table(bundle, "soap_vitals"), "soapobjectiveid");
  const treatments = rowsBy(table(bundle, "soap_treatment"), "soapplanid");
  const soapStatuses = dictionary(bundle, "soap_status");
  const soapRows = table(bundle, "soap");
  const soapNotes: SoapNoteImportRecord[] = [];
  let soapDeferred = 0;
  let soapExcluded = 0;
  let soapErrors = 0;
  soapRows.forEach((row, rowIndex) => {
    if (truthy(row.deleted) || truthy(row.isdeleted)) {
      issues.push({
        table: "soap",
        rowIndex,
        code: "source_row_deleted",
        severity: "warning",
      });
      soapExcluded++;
      return;
    }
    const status = row.soapstatusid
      ? soapStatuses.get(row.soapstatusid)?.trim().toLowerCase()
      : undefined;
    if (status !== "locked") {
      issues.push({
        table: "soap",
        rowIndex,
        code: "source_note_not_final",
        severity: "warning",
      });
      soapDeferred++;
      return;
    }
    if (!row.id || !row.patientid || !patientIds.has(row.patientid)) {
      issues.push({
        table: "soap",
        rowIndex,
        code: "missing_patient_link",
        severity: "error",
      });
      soapErrors++;
      return;
    }
    const date = normalizeDateValue(row.datelocked || row.datecreated);
    if (!date) {
      issues.push({
        table: "soap",
        rowIndex,
        code: "invalid_required_date",
        severity: "error",
      });
      soapErrors++;
      return;
    }
    const s = subjective.get(row.id);
    const a = assessment.get(row.id);
    const p = plan.get(row.id);
    const subjectiveText = combineSection([
      ["Initial complaint", s?.initialcomplaint],
      ["History", s?.history],
      ["Current medications", s?.currentmedicationinfo],
    ]);
    const objectiveText = renderVitals(vitals.get(row.id) ?? []);
    const assessmentText = a?.description || undefined;
    const treatmentText = renderTreatments(treatments.get(row.id) ?? []);
    const planText =
      [p?.recommendation, treatmentText]
        .filter((value): value is string => !!value?.trim())
        .join("\n\n") || undefined;
    if (!subjectiveText && !objectiveText && !assessmentText && !planText) {
      issues.push({
        table: "soap",
        rowIndex,
        code: "missing_clinical_content",
        severity: "warning",
      });
      soapDeferred++;
      return;
    }
    if (
      [subjectiveText, objectiveText, assessmentText, planText].some(
        (value) => (value?.length ?? 0) > SOAP_SECTION_MAX_LENGTH,
      )
    ) {
      issues.push({
        table: "soap",
        rowIndex,
        code: "clinical_section_too_long",
        severity: "error",
      });
      soapErrors++;
      return;
    }
    soapNotes.push({
      externalPatientId: row.patientid,
      date,
      subjective: subjectiveText,
      objective: objectiveText,
      assessment: assessmentText,
      plan: planText,
    });
  });

  return {
    clients,
    patients,
    vaccinations,
    soapNotes,
    issues,
    coverage: {
      clients: coverage(
        clientRows.length,
        clients.length,
        0,
        clientExcluded,
        clientErrors,
      ),
      patients: coverage(
        patientRows.length,
        patients.length,
        0,
        patientExcluded,
        patientErrors,
      ),
      vaccinations: coverage(
        vaccinationRows.length,
        vaccinations.length,
        vaccinationDeferred,
        vaccinationExcluded,
        vaccinationErrors,
      ),
      soapNotes: coverage(
        soapRows.length,
        soapNotes.length,
        soapDeferred,
        soapExcluded,
        soapErrors,
      ),
    },
  };
}
