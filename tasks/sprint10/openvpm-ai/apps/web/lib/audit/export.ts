import { createHash } from "node:crypto";
import { and, eq, isNull, desc } from "drizzle-orm";
import type { Database } from "@openpims/db/client";
import {
  auditLog,
  extAiAuditLog,
  clinicalRecordCorrections,
  users,
} from "@openpims/db";
import type { AuditTimelineEvent } from "./timeline";

export interface TimelineFilter {
  entityType?: string;
  entityId?: string;
  limit?: number;
}

/**
 * Zbiera a normalizuje forenznú históriu z troch zdrojov:
 *   audit_log, ext_ai_audit_log, clinical_record_corrections.
 */
export async function collectTimelineEvents(
  db: Database,
  practiceId: string,
  filter: TimelineFilter = {}
): Promise<AuditTimelineEvent[]> {
  const limit = filter.limit ?? 1000;
  const events: AuditTimelineEvent[] = [];

  // 1) audit_log — mutácie (s menom a rolou používateľa z users)
  const auditWhere = [
    eq(auditLog.practiceId, practiceId),
    isNull(auditLog.deletedAt),
  ];
  if (filter.entityType) auditWhere.push(eq(auditLog.entityType, filter.entityType));
  if (filter.entityId) auditWhere.push(eq(auditLog.entityId, filter.entityId));

  const mutationRows = await db
    .select({
      id: auditLog.id,
      action: auditLog.action,
      entityType: auditLog.entityType,
      entityId: auditLog.entityId,
      changes: auditLog.changes,
      ipAddress: auditLog.ipAddress,
      createdAt: auditLog.createdAt,
      userName: users.name,
      userRole: users.role,
      userId: users.id,
    })
    .from(auditLog)
    .leftJoin(users, eq(auditLog.userId, users.id))
    .where(and(...auditWhere))
    .orderBy(desc(auditLog.createdAt))
    .limit(limit);

  for (const row of mutationRows) {
    events.push({
      id: row.id,
      kind: "mutation",
      occurredAt: row.createdAt.toISOString(),
      actorName: row.userName,
      actorRole: row.userRole,
      actorId: row.userId,
      ipAddress: row.ipAddress,
      action: `${row.entityType}.${row.action}`,
      entityType: row.entityType,
      entityId: row.entityId,
      reason: null,
      before: row.changes ?? undefined,
      after: undefined,
      eventHash: null,
      previousEventHash: null,
      sequenceNumber: null,
    });
  }

  // 2) ext_ai_audit_log — potvrdenia AI návrhov (hash chain)
  const aiWhere = [
    eq(extAiAuditLog.practiceId, practiceId),
    isNull(extAiAuditLog.deletedAt),
  ];
  if (filter.entityType) {
    aiWhere.push(
      eq(
        extAiAuditLog.entityType,
        filter.entityType as
          | "soap_note"
          | "discharge_report"
          | "imaging_analysis"
          | "treatment_plan"
          | "prescription"
      )
    );
  }
  if (filter.entityId) aiWhere.push(eq(extAiAuditLog.entityId, filter.entityId));

  const aiRows = await db
    .select()
    .from(extAiAuditLog)
    .where(and(...aiWhere))
    .orderBy(desc(extAiAuditLog.confirmedAt))
    .limit(limit);

  for (const row of aiRows) {
    events.push({
      id: row.id,
      kind: "ai_confirmation",
      occurredAt: row.confirmedAt.toISOString(),
      actorName: row.actorName,
      actorRole: row.actorRole,
      actorId: row.actorId,
      ipAddress: row.ipAddress,
      action: row.actionType ?? "ai_confirmed",
      entityType: row.entityType,
      entityId: row.entityId,
      reason: row.wasEditedByClinician ? "Lekár upravil AI návrh pred potvrdením" : null,
      before: { originalDraftHash: row.originalDraftHash },
      after: { confirmedContentHash: row.confirmedContentHash },
      eventHash: row.eventHash,
      previousEventHash: row.previousEventHash,
      sequenceNumber: row.sequenceNumber,
    });
  }

  // 3) clinical_record_corrections — opravy záznamov s odôvodnením
  // (append-only tabuľka bez soft-delete stĺpca deletedAt)
  const corrWhere = [eq(clinicalRecordCorrections.practiceId, practiceId)];
  if (filter.entityType) {
    corrWhere.push(
      eq(
        clinicalRecordCorrections.recordType,
        filter.entityType as
          | "soap_note"
          | "vital_sign"
          | "vaccination_record"
          | "lab_result"
          | "patient_allergy"
      )
    );
  }
  if (filter.entityId) {
    // korekcia je viazaná na konkrétny záznam cez rôzne stĺpce; filtrujeme
    // len keď sa typ zhoduje so soap_note (najčastejší prípad)
    corrWhere.push(eq(clinicalRecordCorrections.soapNoteId, filter.entityId));
  }

  const correctionRows = await db
    .select()
    .from(clinicalRecordCorrections)
    .where(and(...corrWhere))
    .orderBy(desc(clinicalRecordCorrections.createdAt))
    .limit(limit);

  for (const row of correctionRows) {
    events.push({
      id: row.id,
      kind: "clinical_correction",
      occurredAt: row.createdAt.toISOString(),
      actorName: row.correctedByName,
      actorRole: null,
      actorId: row.correctedBy,
      ipAddress: null,
      action: `${row.recordType}.${row.action}`,
      entityType: row.recordType,
      entityId:
        row.soapNoteId ?? row.vitalSignId ?? row.vaccinationRecordId ??
        row.labResultId ?? row.patientAllergyId ?? row.patientId,
      reason: row.reason,
      before: row.operationPayloadHash
        ? { operationPayloadHash: row.operationPayloadHash }
        : undefined,
      after: undefined,
      eventHash: null,
      previousEventHash: null,
      sequenceNumber: null,
    });
  }

  // Zjednotené zoradenie (najnovšie najskôr)
  events.sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
  );
  return events.slice(0, limit);
}

/** CSV (semicolon-delimited, UTF-8 BOM pre Excel). */
export function buildAuditCsv(events: AuditTimelineEvent[]): string {
  const header = [
    "id",
    "kind",
    "occurred_at",
    "actor_name",
    "actor_role",
    "ip_address",
    "action",
    "entity_type",
    "entity_id",
    "reason",
    "event_hash",
    "sequence_number",
  ];
  const escapeCell = (val: unknown) => {
    const text = val == null ? "" : String(val);
    return `"${text.replace(/"/g, '""')}"`;
  };
  const rows = events.map((e) =>
    [
      e.id,
      e.kind,
      e.occurredAt,
      e.actorName,
      e.actorRole,
      e.ipAddress,
      e.action,
      e.entityType,
      e.entityId,
      e.reason,
      e.eventHash,
      e.sequenceNumber,
    ]
      .map(escapeCell)
      .join(";")
  );
  return "\uFEFF" + [header.map(escapeCell).join(";"), ...rows].join("\r\n");
}

export interface AuditManifest {
  generatedAt: string;
  eventCount: number;
  sha256Csv: string;
  sha256Json: string;
  hashAlgorithm: "sha256";
}

/** SHA-256 podpisový sumár exportu (integračný dôkaz). */
export function buildAuditManifest(params: {
  events: AuditTimelineEvent[];
  csv: string;
  json: string;
}): AuditManifest {
  const sha256 = (input: string) =>
    createHash("sha256").update(input, "utf8").digest("hex");
  return {
    generatedAt: new Date().toISOString(),
    eventCount: params.events.length,
    sha256Csv: sha256(params.csv),
    sha256Json: sha256(params.json),
    hashAlgorithm: "sha256",
  };
}
