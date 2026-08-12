import type { CareReminderImportRecord } from "@/lib/csv/import";
import { normalizeKey } from "@/lib/csv/parse";
import {
  normalizeDateValue,
  normalizePatientStatusValue,
} from "@/lib/import/normalize";
import type {
  ShepherdBundleRows,
  ShepherdDomainCoverage,
} from "./shepherd-core-adapter";
import type { ShepherdRawRow } from "./shepherd-bundle";

export type ShepherdCareReminderIssueCode =
  | "completed_reminder_excluded"
  | "deleted_reminder_excluded"
  | "inactive_patient_reminder_excluded"
  | "inactive_reminder_setting_excluded"
  | "missing_reminder_identity"
  | "missing_patient_link"
  | "missing_reminder_setting"
  | "invalid_reminder_due_date"
  | "reminder_title_too_long";

export interface ShepherdCareReminderIssue {
  rowIndex: number;
  code: ShepherdCareReminderIssueCode;
  severity: "warning" | "error";
}

export interface ShepherdCareReminderAdaptation {
  reminders: CareReminderImportRecord[];
  issues: ShepherdCareReminderIssue[];
  coverage: ShepherdDomainCoverage;
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

function rows(
  bundle: ShepherdBundleRows,
  kind: "patient" | "patient_status" | "reminder" | "reminder_setting",
): NormalizedRow[] {
  return (bundle[kind] ?? []).map(normalized);
}

function truthy(value: string | undefined): boolean {
  return ["1", "true", "yes", "y"].includes(value?.trim().toLowerCase() ?? "");
}

function coverage(
  sourceRows: number,
  plannedRows: number,
  excludedRows: number,
  errorRows: number,
): ShepherdDomainCoverage {
  if (plannedRows + excludedRows + errorRows !== sourceRows) {
    throw new Error("Shepherd reminder coverage must account for every row.");
  }
  return {
    sourceRows,
    plannedRows,
    deferredRows: 0,
    excludedRows,
    errorRows,
  };
}

/**
 * Convert only active Shepherd care reminders into OpenVPM's generic internal
 * task format. No output from this adapter is a communication or send request.
 */
export function adaptShepherdCareReminders(
  bundle: ShepherdBundleRows,
): ShepherdCareReminderAdaptation {
  const statusNames = new Map(
    rows(bundle, "patient_status")
      .filter((row) => row.id)
      .map((row) => [row.id!, row.name || row.description] as const),
  );
  const patientRows = rows(bundle, "patient").filter(
    (row) => row.id && !truthy(row.deleted) && !truthy(row.isdeleted),
  );
  const knownPatientIds = new Set(patientRows.map((row) => row.id!));
  const activePatientIds = new Set(
    patientRows
      .filter(
        (row) =>
          !truthy(row.isdeceased) &&
          normalizePatientStatusValue(
            row.statusid ? statusNames.get(row.statusid) : undefined,
          ) === "active",
      )
      .map((row) => row.id!),
  );
  const settingRows = rows(bundle, "reminder_setting");
  const knownSettingIds = new Set(
    settingRows.filter((row) => row.id).map((row) => row.id!),
  );
  const settings = new Map(
    settingRows
      .filter(
        (row) =>
          row.id && row.name && truthy(row.isactive) && !truthy(row.isdeleted),
      )
      .map((row) => [row.id!, row.name!] as const),
  );
  const sourceRows = rows(bundle, "reminder");
  const reminders: CareReminderImportRecord[] = [];
  const issues: ShepherdCareReminderIssue[] = [];
  let excludedRows = 0;
  let errorRows = 0;

  sourceRows.forEach((row, rowIndex) => {
    if (truthy(row.isdeleted)) {
      excludedRows++;
      issues.push({
        rowIndex,
        code: "deleted_reminder_excluded",
        severity: "warning",
      });
      return;
    }
    if (truthy(row.iscompleted)) {
      excludedRows++;
      issues.push({
        rowIndex,
        code: "completed_reminder_excluded",
        severity: "warning",
      });
      return;
    }
    if (!row.id) {
      errorRows++;
      issues.push({
        rowIndex,
        code: "missing_reminder_identity",
        severity: "error",
      });
      return;
    }
    if (!row.patientid || !knownPatientIds.has(row.patientid)) {
      errorRows++;
      issues.push({
        rowIndex,
        code: "missing_patient_link",
        severity: "error",
      });
      return;
    }
    if (!activePatientIds.has(row.patientid) || truthy(row.ispatientdeceased)) {
      excludedRows++;
      issues.push({
        rowIndex,
        code: "inactive_patient_reminder_excluded",
        severity: "warning",
      });
      return;
    }
    if (
      row.remindersettingid &&
      knownSettingIds.has(row.remindersettingid) &&
      !settings.has(row.remindersettingid)
    ) {
      excludedRows++;
      issues.push({
        rowIndex,
        code: "inactive_reminder_setting_excluded",
        severity: "warning",
      });
      return;
    }
    const title = row.remindersettingid
      ? settings.get(row.remindersettingid)
      : undefined;
    if (!title) {
      errorRows++;
      issues.push({
        rowIndex,
        code: "missing_reminder_setting",
        severity: "error",
      });
      return;
    }
    if (title.length > 255) {
      errorRows++;
      issues.push({
        rowIndex,
        code: "reminder_title_too_long",
        severity: "error",
      });
      return;
    }
    const dueDate = normalizeDateValue(row.datedue);
    if (!dueDate) {
      errorRows++;
      issues.push({
        rowIndex,
        code: "invalid_reminder_due_date",
        severity: "error",
      });
      return;
    }
    reminders.push({
      externalReminderId: row.id,
      externalPatientId: row.patientid,
      title,
      dueDate,
    });
  });

  return {
    reminders,
    issues,
    coverage: coverage(
      sourceRows.length,
      reminders.length,
      excludedRows,
      errorRows,
    ),
  };
}
