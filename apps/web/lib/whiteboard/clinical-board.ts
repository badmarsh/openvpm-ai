/**
 * Clinical whiteboard derivations (Sprint 6 — Clinical Whiteboard).
 *
 * Pure helpers only: every badge, tag and duration shown on `/whiteboard` is
 * derived from data the server actually recorded. Nothing here invents a
 * clinical state — when there is no evidence the helper returns "unknown"
 * and the UI renders nothing.
 */

import type { ImagingModality } from "@/lib/imaging/modality";

/** Typography token for clinical times and durations (docs/UIKIT.md). */
export const CLINICAL_NUMERIC_CLASS = "font-mono tabular-nums text-xs";

/** Care-unit departments shown in the whiteboard toolbar filter. */
export const WHITEBOARD_DEPARTMENTS = [
  "ambulancia",
  "chirurgia",
  "hospitalizacia",
] as const;

export type WhiteboardDepartment = (typeof WHITEBOARD_DEPARTMENTS)[number];

export type BoardDepartmentFilter = WhiteboardDepartment | "all";

/** `rooms.type` / `appointment_types.default_room_type` values. */
export type RoomType = "exam" | "surgery" | "treatment" | "boarding";

const ROOM_TYPE_DEPARTMENT: Record<RoomType, WhiteboardDepartment> = {
  exam: "ambulancia",
  surgery: "chirurgia",
  treatment: "ambulancia",
  boarding: "hospitalizacia",
};

function asRoomType(value: string | null | undefined): RoomType | null {
  if (
    value === "exam" ||
    value === "surgery" ||
    value === "treatment" ||
    value === "boarding"
  ) {
    return value;
  }
  return null;
}

export function departmentForRoomType(
  value: string | null | undefined,
): WhiteboardDepartment | null {
  const roomType = asRoomType(value);
  return roomType ? ROOM_TYPE_DEPARTMENT[roomType] : null;
}

/**
 * Appointment room wins over the appointment-type default; when neither is
 * recorded the patient is treated as an outpatient clinic case (the only
 * department that needs no room assignment).
 */
export function departmentOfAppointment(appointment: {
  roomType?: string | null;
  typeDefaultRoomType?: string | null;
}): WhiteboardDepartment {
  return (
    departmentForRoomType(appointment.roomType) ??
    departmentForRoomType(appointment.typeDefaultRoomType) ??
    "ambulancia"
  );
}

export function matchesDepartment(
  appointment: { roomType?: string | null; typeDefaultRoomType?: string | null },
  filter: BoardDepartmentFilter,
): boolean {
  if (filter === "all") return true;
  return departmentOfAppointment(appointment) === filter;
}

function normalizeSearchValue(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

/**
 * Board search covers what staff say out loud on the floor: patient, owner,
 * doctor and room.
 */
export function matchesBoardSearch(
  appointment: {
    patientName?: string | null;
    clientFirstName?: string | null;
    clientLastName?: string | null;
    doctorName?: string | null;
    roomName?: string | null;
    locationName?: string | null;
  },
  query: string,
): boolean {
  const needle = normalizeSearchValue(query);
  if (!needle) return true;
  const haystack = [
    appointment.patientName,
    [appointment.clientFirstName, appointment.clientLastName]
      .filter(Boolean)
      .join(" "),
    appointment.doctorName,
    appointment.roomName,
    appointment.locationName,
  ]
    .map(normalizeSearchValue)
    .join(" \u0000 ");
  return haystack.includes(needle);
}

/** Per-patient clinical signals returned by `whiteboard.clinicalSignals`. */
export type ClinicalSignals = {
  patientId: string;
  /** Canonical imaging modalities attached today, stable-ordered. */
  imagingModalities: ImagingModality[];
  /** Available lab-report attachments recorded today. */
  labReports: number;
  /** Lab results flagged `critical` today. */
  criticalLabs: number;
  /** Procedures/surgeries recorded today. */
  procedures: number;
  /** Vital-signs records taken today. */
  vitalsRecorded: number;
  /** Today's visit is clinically closed while the patient stays admitted. */
  awaitingDischarge: boolean;
};

export const EMPTY_CLINICAL_SIGNALS: Omit<ClinicalSignals, "patientId"> = {
  imagingModalities: [],
  labReports: 0,
  criticalLabs: 0,
  procedures: 0,
  vitalsRecorded: 0,
  awaitingDischarge: false,
};

export function emptyClinicalSignals(patientId: string): ClinicalSignals {
  return { patientId, ...EMPTY_CLINICAL_SIGNALS };
}

export type ConditionTag =
  | "critical"
  | "postOp"
  | "awaitingDischarge"
  | "stable";

/**
 * Condition tags, most urgent first. Each tag requires positive evidence:
 *  - `critical`          → a lab result flagged critical today
 *  - `postOp`            → a procedure recorded today
 *  - `awaitingDischarge` → closed visit while the patient is still admitted
 *  - `stable`            → admitted patient with vitals taken today and no
 *                          critical, surgical or discharge signal
 */
export function conditionTagsFor(
  appointment: { status?: string | null },
  department: WhiteboardDepartment,
  signals: ClinicalSignals | undefined,
): ConditionTag[] {
  if (!signals) return [];
  const tags: ConditionTag[] = [];
  if (signals.criticalLabs > 0) tags.push("critical");
  if (signals.procedures > 0) tags.push("postOp");
  if (department === "hospitalizacia" && signals.awaitingDischarge) {
    tags.push("awaitingDischarge");
  }
  if (
    department === "hospitalizacia" &&
    tags.length === 0 &&
    signals.vitalsRecorded > 0
  ) {
    tags.push("stable");
  }
  return tags;
}

/** Pre-operative fasting protocol applied to surgical patients. */
export const PREOPERATIVE_FASTING_HOURS = 12;
const HOUR_MS = 60 * 60 * 1000;

export type FastingWindow = {
  startedAt: Date;
  /** True while the patient is inside the NPO window. */
  active: boolean;
  /**
   * Milliseconds since fasting started. Negative before the window opens, so
   * the UI can render a countdown instead of a duration.
   */
  elapsedMs: number;
};

/**
 * NPO window for a surgical/anaesthesia case. Derived from the scheduled
 * procedure time and the practice's 12-hour fasting protocol — it is a
 * countdown, not a measurement, so the UI labels it as the protocol.
 */
export function fastingWindowForAppointment(
  startTime: Date | string,
  department: WhiteboardDepartment,
  now: Date,
): FastingWindow | null {
  if (department !== "chirurgia" && department !== "hospitalizacia") {
    return null;
  }
  const start = startTime instanceof Date ? startTime : new Date(startTime);
  if (Number.isNaN(start.getTime())) return null;
  const startedAt = new Date(start.getTime() - PREOPERATIVE_FASTING_HOURS * HOUR_MS);
  const elapsedMs = now.getTime() - startedAt.getTime();
  return { startedAt, active: elapsedMs >= 0, elapsedMs };
}

/** Elapsed waiting time since the appointment slot began. */
export function elapsedSince(
  startTime: Date | string,
  now: Date,
): number | null {
  const start = startTime instanceof Date ? startTime : new Date(startTime);
  if (Number.isNaN(start.getTime())) return null;
  return Math.max(now.getTime() - start.getTime(), 0);
}

/**
 * Clinical duration formatting: hours keep two digits so tabular numerals
 * stay aligned in the card grid (`02 h 05 min`).
 */
export function formatClinicalDuration(ms: number | null): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return "--";
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${String(minutes).padStart(2, "0")} min`;
  return `${String(hours).padStart(2, "0")} h ${String(minutes).padStart(2, "0")} min`;
}

/** Shift an `YYYY-MM-DD` input value by whole days (UTC-safe). */
export function shiftDateInput(dateInput: string, days: number): string {
  const [year, month, day] = dateInput.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return [
    shifted.getUTCFullYear(),
    String(shifted.getUTCMonth() + 1).padStart(2, "0"),
    String(shifted.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

/** Waiting-room sorting: earliest scheduled slot first. */
export function compareByStartTime(
  a: { startTime: Date | string },
  b: { startTime: Date | string },
): number {
  return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
}
