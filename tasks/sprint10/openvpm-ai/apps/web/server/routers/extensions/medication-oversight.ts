import { z } from "zod";
import { and, desc, eq, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { createRouter, protectedProcedure, requireRole } from "../../trpc";
import {
  clients,
  drugInteractions,
  patients,
  prescriptions,
  products,
  users,
} from "@openpims/db";
import {
  CONTROLLED_SUBSTANCES_PATTERN_SOURCE,
  isControlledSubstanceName,
} from "@/lib/controlled-substances/policy";
import {
  medicationNamesMatch,
  type SafetySeverity,
} from "@/lib/records/prescription-safety";

/**
 * Medication oversight (dohľad nad predpísanými liečivami).
 *
 * One register that answers the three questions a clinic asks every day:
 *   1. What is currently prescribed — to whom, by whom, until when?
 *   2. What needs action now (ending, overdue, OPL, guardian alert)?
 *   3. Where do the prescriptions of one patient collide (drug interactions)?
 *
 * Clinical Guardian stores its alerts per practice/patient; this router joins
 * them onto the prescription rows so an alert is never orphaned from the
 * medication that triggered it.
 */

const medicationProcedure = protectedProcedure.use(
  requireRole("admin", "veterinarian", "technician"),
);

const SEARCH_MAX_LENGTH = 120;

const listInput = z
  .object({
    scope: z
      .enum(["active", "ending", "overdue", "controlled", "alerts", "all"])
      .default("active"),
    search: z.string().trim().max(SEARCH_MAX_LENGTH).optional(),
    patientId: z.string().uuid().optional(),
    limit: z.number().int().min(1).max(200).default(100),
    offset: z.number().int().min(0).default(0),
  })
  .optional();

const ENDING_SOON_DAYS = 7;

const severityRank: Record<SafetySeverity, number> = {
  minor: 1,
  moderate: 2,
  major: 3,
};

function emptyInteractionSummary() {
  return {
    interactionCount: 0,
    maxInteractionSeverity: null as SafetySeverity | null,
    interactionDetail: null as string | null,
  };
}

export const medicationOversightRouter = createRouter({
  list: medicationProcedure.input(listInput).query(async ({ ctx, input }) => {
    const scope = input?.scope ?? "active";
    const limit = input?.limit ?? 100;
    const offset = input?.offset ?? 0;
    const search = input?.search ?? "";

    const openAlertCount = sql<number>`(
      select count(*)::int
      from ext_clinical_guardian_alerts
      where ext_clinical_guardian_alerts.patient_id = patients.id
        and ext_clinical_guardian_alerts.practice_id = ${ctx.practiceId}
        and ext_clinical_guardian_alerts.category = 'medication_safety'
        and ext_clinical_guardian_alerts.status = 'open'
        and ext_clinical_guardian_alerts.deleted_at is null
    )`;

    const criticalAlertCount = sql<number>`(
      select count(*)::int
      from ext_clinical_guardian_alerts
      where ext_clinical_guardian_alerts.patient_id = patients.id
        and ext_clinical_guardian_alerts.practice_id = ${ctx.practiceId}
        and ext_clinical_guardian_alerts.category = 'medication_safety'
        and ext_clinical_guardian_alerts.severity = 'critical'
        and ext_clinical_guardian_alerts.status = 'open'
        and ext_clinical_guardian_alerts.deleted_at is null
    )`;

    const isControlledSql = sql`(${prescriptions.medicationName} ~* ${CONTROLLED_SUBSTANCES_PATTERN_SOURCE})`;

    const conditions: SQL[] = [
      eq(prescriptions.practiceId, ctx.practiceId),
      isNull(prescriptions.deletedAt),
      isNull(patients.deletedAt),
    ];

    if (input?.patientId) {
      conditions.push(eq(prescriptions.patientId, input.patientId));
    }

    if (scope === "active") {
      conditions.push(sql`${prescriptions.status} = 'active'`);
    } else if (scope === "ending") {
      conditions.push(sql`${prescriptions.status} = 'active'`);
      conditions.push(
        sql`${prescriptions.endDate} is not null
            and ${prescriptions.endDate} >= current_date
            and ${prescriptions.endDate} <= (current_date + cast(${ENDING_SOON_DAYS} as integer))`,
      );
    } else if (scope === "overdue") {
      conditions.push(sql`${prescriptions.status} = 'active'`);
      conditions.push(
        sql`${prescriptions.endDate} is not null and ${prescriptions.endDate} < current_date`,
      );
    } else if (scope === "controlled") {
      conditions.push(isControlledSql);
    } else if (scope === "alerts") {
      conditions.push(sql`${openAlertCount} > 0`);
    }

    if (search) {
      const pattern = `%${search.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
      const match = or(
        sql`${prescriptions.medicationName} ilike ${pattern} escape '\\'`,
        sql`${patients.name} ilike ${pattern} escape '\\'`,
        sql`${clients.firstName} ilike ${pattern} escape '\\'`,
        sql`${clients.lastName} ilike ${pattern} escape '\\'`,
      );
      if (match) conditions.push(match);
    }

    const [rows, countRows] = await Promise.all([
      ctx.db
        .select({
          id: prescriptions.id,
          patientId: prescriptions.patientId,
          appointmentId: prescriptions.appointmentId,
          patientName: patients.name,
          patientSpecies: patients.species,
          patientBreed: patients.breed,
          patientStatus: patients.status,
          clientFirstName: clients.firstName,
          clientLastName: clients.lastName,
          clientPhone: clients.phone,
          medicationName: prescriptions.medicationName,
          dosage: prescriptions.dosage,
          frequency: prescriptions.frequency,
          quantity: prescriptions.quantity,
          refillsRemaining: prescriptions.refillsRemaining,
          status: prescriptions.status,
          startDate: prescriptions.startDate,
          endDate: prescriptions.endDate,
          instructions: prescriptions.instructions,
          prescribedByName: users.name,
          prescribedByEmail: users.email,
          productName: products.name,
          createdAt: prescriptions.createdAt,
          openAlertCount,
          criticalAlertCount,
        })
        .from(prescriptions)
        .innerJoin(patients, eq(patients.id, prescriptions.patientId))
        .leftJoin(
          clients,
          and(eq(clients.id, patients.clientId), isNull(clients.deletedAt)),
        )
        .leftJoin(users, eq(users.id, prescriptions.prescribedBy))
        .leftJoin(products, eq(products.id, prescriptions.productId))
        .where(and(...conditions))
        .orderBy(desc(prescriptions.startDate), desc(prescriptions.createdAt))
        .limit(limit)
        .offset(offset),
      ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(prescriptions)
        .innerJoin(patients, eq(patients.id, prescriptions.patientId))
        .leftJoin(
          clients,
          and(eq(clients.id, patients.clientId), isNull(clients.deletedAt)),
        )
        .where(and(...conditions)),
    ]);

    // Cross-check the active medication list of every patient on the page
    // against the interaction catalogue, so an interaction warning shows up
    // next to the prescription that completes the pair.
    const patientIds = Array.from(new Set(rows.map((row) => row.patientId)));
    const interactionByPatient = new Map<
      string,
      ReturnType<typeof emptyInteractionSummary>
    >();
    if (patientIds.length > 0) {
      const [activeMeds, interactions] = await Promise.all([
        ctx.db
          .select({
            patientId: prescriptions.patientId,
            medicationName: prescriptions.medicationName,
          })
          .from(prescriptions)
          .where(
            and(
              eq(prescriptions.practiceId, ctx.practiceId),
              sql`${prescriptions.status} = 'active'`,
              isNull(prescriptions.deletedAt),
              inArray(prescriptions.patientId, patientIds),
            ),
          ),
        ctx.db
          .select({
            drugA: drugInteractions.drugA,
            drugB: drugInteractions.drugB,
            severity: drugInteractions.severity,
            description: drugInteractions.description,
          })
          .from(drugInteractions)
          .where(isNull(drugInteractions.deletedAt)),
      ]);

      for (const patientId of patientIds) {
        const meds = activeMeds
          .filter((med) => med.patientId === patientId)
          .map((med) => med.medicationName);
        let maxSeverity: SafetySeverity | null = null;
        let detail: string | null = null;
        let count = 0;
        for (let i = 0; i < meds.length; i += 1) {
          for (let j = i + 1; j < meds.length; j += 1) {
            const hit = interactions.find(
              (interaction) =>
                (medicationNamesMatch(meds[i], interaction.drugA) &&
                  medicationNamesMatch(meds[j], interaction.drugB)) ||
                (medicationNamesMatch(meds[i], interaction.drugB) &&
                  medicationNamesMatch(meds[j], interaction.drugA)),
            );
            if (!hit) continue;
            count += 1;
            if (
              !maxSeverity ||
              severityRank[hit.severity] > severityRank[maxSeverity]
            ) {
              maxSeverity = hit.severity;
            }
            detail =
              hit.description?.trim() ||
              `${meds[i]} + ${meds[j]}`;
          }
        }
        interactionByPatient.set(patientId, {
          interactionCount: count,
          maxInteractionSeverity: maxSeverity,
          interactionDetail: detail,
        });
      }
    }

    return {
      items: rows.map((row) => ({
        ...row,
        isControlled: isControlledSubstanceName(row.medicationName),
        ...(interactionByPatient.get(row.patientId) ??
          emptyInteractionSummary()),
      })),
      total: Number(countRows[0]?.count ?? 0),
      endingSoonDays: ENDING_SOON_DAYS,
    };
  }),

  summary: medicationProcedure.query(async ({ ctx }) => {
    // NOTE: columns are written as qualified SQL text on purpose. An
    // interpolated drizzle column is rendered WITHOUT its table qualifier when
    // it appears in a `select` field, and `status` exists on both `prescriptions`
    // and `patients` — interpolation would make this an ambiguous reference.
    const [prescriptionStats] = await ctx.db
      .select({
        active: sql<number>`count(*) filter (where prescriptions.status = 'active')::int`,
        endingSoon: sql<number>`count(*) filter (
          where prescriptions.status = 'active'
            and prescriptions.end_date is not null
            and prescriptions.end_date >= current_date
            and prescriptions.end_date <= (current_date + cast(${ENDING_SOON_DAYS} as integer))
        )::int`,
        overdue: sql<number>`count(*) filter (
          where prescriptions.status = 'active'
            and prescriptions.end_date is not null
            and prescriptions.end_date < current_date
        )::int`,
        controlledActive: sql<number>`count(*) filter (
          where prescriptions.status = 'active'
            and (prescriptions.medication_name ~* ${CONTROLLED_SUBSTANCES_PATTERN_SOURCE})
        )::int`,
        patientsWithActive: sql<number>`count(distinct prescriptions.patient_id) filter (where prescriptions.status = 'active')::int`,
      })
      .from(prescriptions)
      .innerJoin(patients, eq(patients.id, prescriptions.patientId))
      .where(
        and(
          eq(prescriptions.practiceId, ctx.practiceId),
          isNull(prescriptions.deletedAt),
          isNull(patients.deletedAt),
        ),
      );

    const [alertStats] = await ctx.db
      .select({
        openMedicationAlerts: sql<number>`count(*) filter (where ext_clinical_guardian_alerts.severity <> 'critical')::int`,
        criticalAlerts: sql<number>`count(*) filter (where ext_clinical_guardian_alerts.severity = 'critical')::int`,
      })
      .from(sql`ext_clinical_guardian_alerts`)
      .where(
        sql`ext_clinical_guardian_alerts.practice_id = ${ctx.practiceId}
            and ext_clinical_guardian_alerts.category = 'medication_safety'
            and ext_clinical_guardian_alerts.status = 'open'
            and ext_clinical_guardian_alerts.deleted_at is null`,
      );

    return {
      active: Number(prescriptionStats?.active ?? 0),
      endingSoon: Number(prescriptionStats?.endingSoon ?? 0),
      overdue: Number(prescriptionStats?.overdue ?? 0),
      controlledActive: Number(prescriptionStats?.controlledActive ?? 0),
      patientsWithActive: Number(prescriptionStats?.patientsWithActive ?? 0),
      openMedicationAlerts: Number(alertStats?.openMedicationAlerts ?? 0),
      criticalAlerts: Number(alertStats?.criticalAlerts ?? 0),
      endingSoonDays: ENDING_SOON_DAYS,
    };
  }),
});
