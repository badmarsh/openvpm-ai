/**
 * Post-operative care trigger detection.
 *
 * When a visit is checked out, we look for surgical signals in the encounter:
 *   1. a procedure row with anesthesia recorded, or a surgical name/description;
 *   2. a visit invoice line whose catalog service is surgical (code/category/name);
 *   3. discharge instructions containing post-operative care wording; or
 *   4. a surgical appointment type.
 *
 * A positive detection emits a durable `surgery_completed` event (with
 * event_subtype `post_operative_care` — the pgEnum is additive-only, variants
 * belong in the subtype column per the ext_automation design contract) into
 * ext_automation_events so the autopilot can start the post_operative_care
 * journey (24 h condition check → day 3 recovery → day 10 suture check).
 *
 * SKILL.md §3 Sympathy Gate: deceased patients never emit (a surgical
 * checkout should not happen on one, but the gate is enforced unconditionally
 * by filtering the detection queries on patient status).
 */

import { sql } from "drizzle-orm";
import type { Database } from "@openpims/db/client";
import { extAutomationEvents } from "@openpims/db";
import { createMessagesForTrigger } from "@/lib/marketing/messaging";

/** Surgical procedure wording (SK + EN) used for procedure/appointment-type text. */
const SURGICAL_TEXT_RE =
  /oper[aá]|\bchirurg|\bsurg|sekci[aev]|resekc|amput|kastr|steriliz|laparot|torakot|sutur|incis|extrakci|biopsi|kystekt|splenekt/i;

/** Post-operative wording in discharge instructions (SK + EN). */
const POST_OP_INSTRUCTIONS_RE =
  /po ?-? ?oper|poopera|stehy|šteby|švov|šitie|sutur|incizi|rekonvales|post[- ]?op|zahojeni|jazv/i;

/** Surgical service catalog categories/codes (SK + EN). */
const SURGICAL_SERVICE_RE =
  /chirurg|surg|oper[aá]c|aneste|anesth|dent[aá]l.*chir|orthop|^SURG/i;

export interface PostOpDetectionResult {
  isPostOp: boolean;
  signals: string[];
}

/**
 * Pure text-level classifier, exported for unit tests.
 * Returns the list of matched signal labels for auditability.
 */
export function classifyPostOpText(input: {
  procedureTexts?: (string | null | undefined)[];
  anesthesiaUsed?: boolean;
  serviceTexts?: (string | null | undefined)[];
  appointmentTypeText?: string | null;
  dischargeInstructions?: string | null;
}): PostOpDetectionResult {
  const signals: string[] = [];

  if (input.anesthesiaUsed) {
    signals.push("anesthesia");
  }
  for (const text of input.procedureTexts ?? []) {
    if (text && SURGICAL_TEXT_RE.test(text)) {
      signals.push("surgical_procedure");
      break;
    }
  }
  for (const text of input.serviceTexts ?? []) {
    if (text && SURGICAL_SERVICE_RE.test(text)) {
      signals.push("surgical_service_code");
      break;
    }
  }
  if (input.appointmentTypeText && SURGICAL_TEXT_RE.test(input.appointmentTypeText)) {
    signals.push("surgical_appointment_type");
  }
  if (
    input.dischargeInstructions &&
    POST_OP_INSTRUCTIONS_RE.test(input.dischargeInstructions)
  ) {
    signals.push("post_op_instructions");
  }

  return { isPostOp: signals.length > 0, signals };
}

type DbLike = Pick<Database, "execute" | "insert" | "select">;

/**
 * Detects surgical signals for a completed visit.
 * All queries are parameterized and practice-scoped; the appointment's
 * patient must not be deceased (Sympathy Gate, SKILL.md §3).
 */
export async function detectPostOperativeSignals(
  db: DbLike,
  practiceId: string,
  appointmentId: string,
): Promise<PostOpDetectionResult> {
  const result = await db.execute(sql`
    with apt as (
      select a.id, a.patient_id, a.client_id, a.notes,
             p.status as patient_status,
             atype.name as type_name
      from appointments a
      left join patients p
        on p.id = a.patient_id
       and p.practice_id = a.practice_id
       and p.deleted_at is null
      left join appointment_types atype
        on atype.id = a.type_id
       and atype.practice_id = a.practice_id
       and atype.deleted_at is null
      where a.id = ${appointmentId}
        and a.practice_id = ${practiceId}
        and a.deleted_at is null
      limit 1
    ),
    procs as (
      select
        bool_or(pr.anesthesia_used is not null and btrim(pr.anesthesia_used) <> '') as any_anesthesia,
        coalesce(array_agg(concat_ws(' ', pr.name, pr.description)) filter
          (where pr.name is not null or pr.description is not null), '{}'::text[]) as texts
      from procedures pr
      where pr.appointment_id = ${appointmentId}
        and pr.practice_id = ${practiceId}
        and pr.deleted_at is null
    ),
    services as (
      select coalesce(array_agg(concat_ws(' ', s.code, s.category, s.name)) filter
        (where s.id is not null), '{}'::text[]) as texts
      from invoices i
      join invoice_items ii
        on ii.invoice_id = i.id
       and ii.deleted_at is null
      join services s
        on s.id = ii.item_id
       and s.practice_id = i.practice_id
       and s.deleted_at is null
      where i.appointment_id = ${appointmentId}
        and i.practice_id = ${practiceId}
        and i.deleted_at is null
        and ii.item_type = 'service'
    )
    select
      apt.patient_id as "patientId",
      apt.client_id as "clientId",
      apt.patient_status as "patientStatus",
      apt.type_name as "typeName",
      procs.any_anesthesia as "anyAnesthesia",
      procs.texts as "procedureTexts",
      services.texts as "serviceTexts",
      (
        select string_agg(vc.discharge_instructions, ' ')
        from visit_closeouts vc
        where vc.appointment_id = ${appointmentId}
          and vc.practice_id = ${practiceId}
          and vc.deleted_at is null
      ) as "dischargeInstructions"
    from apt, procs, services
  `);

  const rows = (result as unknown as { rows?: Record<string, unknown>[] }).rows ?? [];
  const row = rows[0] as
    | {
        patientId: string | null;
        clientId: string | null;
        patientStatus: string | null;
        typeName: string | null;
        anyAnesthesia: boolean | null;
        procedureTexts: string[] | null;
        serviceTexts: string[] | null;
        dischargeInstructions: string | null;
      }
    | undefined;

  if (!row) {
    return { isPostOp: false, signals: [] };
  }

  // SKILL.md §3 — unconditional sympathy gate.
  if (row.patientStatus === "deceased") {
    return { isPostOp: false, signals: [] };
  }

  return classifyPostOpText({
    procedureTexts: row.procedureTexts ?? undefined,
    anesthesiaUsed: row.anyAnesthesia === true,
    serviceTexts: row.serviceTexts ?? [],
    appointmentTypeText: row.typeName,
    dischargeInstructions: row.dischargeInstructions,
  });
}

/**
 * Post-checkout side effect: detects post-op signals and, when present,
 * emits the durable `surgery_completed` (`post_operative_care`) event and
 * fires the legacy marketing trigger. Idempotent per appointment via
 * dedupeKey; call after the checkout transaction commits.
 */
export async function emitPostOperativeCareIfSurgical(
  db: DbLike,
  practiceId: string,
  input: {
    appointmentId: string;
    clientId: string;
    patientId?: string;
    visitCloseoutId?: string | null;
    emittedBy?: string | null;
  },
): Promise<{ emitted: boolean; signals: string[] }> {
  const detection = await detectPostOperativeSignals(
    db,
    practiceId,
    input.appointmentId,
  );

  if (!detection.isPostOp) {
    return { emitted: false, signals: [] };
  }

  await (db as any)
    .insert(extAutomationEvents)
    .values({
      practiceId,
      eventType: "surgery_completed",
      eventSubtype: "post_operative_care",
      clientId: input.clientId,
      patientId: input.patientId ?? null,
      appointmentId: input.appointmentId,
      visitCloseoutId: input.visitCloseoutId ?? null,
      sourceRouter: "encounters.completeCheckout",
      dedupeKey: `post_operative_care_${input.appointmentId}`,
      emittedBy: input.emittedBy ?? null,
      status: "pending",
      availableAt: new Date(),
      payload: {
        appointmentId: input.appointmentId,
        clientId: input.clientId,
        patientId: input.patientId ?? null,
        detectionSignals: detection.signals,
      },
    })
    .onConflictDoNothing();

  await createMessagesForTrigger(db as unknown as Database, practiceId, {
    triggerKey: "surgery_completed",
    clientId: input.clientId,
    patientId: input.patientId,
    eventId: input.appointmentId,
  });

  return { emitted: true, signals: detection.signals };
}
