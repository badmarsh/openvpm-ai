import { z } from "zod";
import { and, asc, eq, isNull, or, sql, type SQL } from "drizzle-orm";
import { createRouter, protectedProcedure } from "../../trpc";
import { clients, patients, practices } from "@openpims/db";
import { clientSearchContainsPattern } from "@/lib/clients/search";

/**
 * Clinical-card register.
 *
 * The `/records` page used to open with a patient search box: nothing was on
 * screen until the operator typed a name, and there was no way to see which
 * clinical cards exist, which are stale, or which need attention. This router
 * powers the list-first experience — one row per patient with the clinical
 * facts a vet wants before opening the chart:
 *
 *   last visit · active problems · active prescriptions · next vaccination ·
 *   open Clinical Guardian alerts · hospitalisation-free counters
 *
 * Everything is derived from the vanilla clinical tables plus the extension
 * alert table, so no schema change is required.
 */

const PATIENT_SEARCH_MAX_LENGTH = 120;

const searchInput = z
  .string()
  .trim()
  .max(PATIENT_SEARCH_MAX_LENGTH)
  .optional();

const registerInput = z
  .object({
    search: searchInput,
    species: z.string().trim().max(40).optional(),
    status: z.enum(["active", "inactive", "deceased", "all"]).default("active"),
    /** "attention" = open alerts, active problems or overdue vaccination. */
    focus: z.enum(["all", "attention", "recent"]).default("all"),
    limit: z.number().int().min(1).max(100).default(50),
    offset: z.number().int().min(0).default(0),
  })
  .optional();

export const clinicalRegisterRouter = createRouter({
  listCards: protectedProcedure
    .input(registerInput)
    .query(async ({ ctx, input }) => {
      const search = input?.search ?? "";
      const species = input?.species ?? "";
      const status = input?.status ?? "active";
      const focus = input?.focus ?? "all";
      const limit = input?.limit ?? 50;
      const offset = input?.offset ?? 0;

      const lastVisitAt = sql<string | null>`(
        select max(soap_notes.created_at)
        from soap_notes
        where soap_notes.patient_id = patients.id
          and soap_notes.practice_id = ${ctx.practiceId}
          and soap_notes.deleted_at is null
      )`;

      const lastVisitAuthor = sql<string | null>`(
        select soap_notes.author_name
        from soap_notes
        where soap_notes.patient_id = patients.id
          and soap_notes.practice_id = ${ctx.practiceId}
          and soap_notes.deleted_at is null
        order by soap_notes.created_at desc
        limit 1
      )`;

      const soapNoteCount = sql<number>`(
        select count(*)::int
        from soap_notes
        where soap_notes.patient_id = patients.id
          and soap_notes.practice_id = ${ctx.practiceId}
          and soap_notes.deleted_at is null
      )`;

      const activeProblemCount = sql<number>`(
        select count(*)::int
        from problem_list
        where problem_list.patient_id = patients.id
          and problem_list.practice_id = ${ctx.practiceId}
          and problem_list.status = 'active'
          and problem_list.deleted_at is null
      )`;

      const activePrescriptionCount = sql<number>`(
        select count(*)::int
        from prescriptions
        where prescriptions.patient_id = patients.id
          and prescriptions.practice_id = ${ctx.practiceId}
          and prescriptions.status = 'active'
          and prescriptions.deleted_at is null
      )`;

      const nextVaccinationDue = sql<string | null>`(
        select min(vaccination_records.next_due_date)::text
        from vaccination_records
        where vaccination_records.patient_id = patients.id
          and vaccination_records.practice_id = ${ctx.practiceId}
          and vaccination_records.deleted_at is null
          and vaccination_records.next_due_date >= current_date
      )`;

      const overdueVaccinationCount = sql<number>`(
        select count(*)::int
        from vaccination_records
        where vaccination_records.patient_id = patients.id
          and vaccination_records.practice_id = ${ctx.practiceId}
          and vaccination_records.deleted_at is null
          and vaccination_records.next_due_date < current_date
      )`;

      const openAlertCount = sql<number>`(
        select count(*)::int
        from ext_clinical_guardian_alerts
        where ext_clinical_guardian_alerts.patient_id = patients.id
          and ext_clinical_guardian_alerts.practice_id = ${ctx.practiceId}
          and ext_clinical_guardian_alerts.status = 'open'
          and ext_clinical_guardian_alerts.deleted_at is null
      )`;

      const conditions: SQL[] = [
        eq(patients.practiceId, ctx.practiceId),
        isNull(patients.deletedAt),
        sql`exists (
          select 1 from ${practices}
          where ${practices.id} = ${ctx.practiceId}
            and ${practices.deletedAt} is null
        )`,
      ];

      if (status !== "all") {
        conditions.push(sql`${patients.status} = ${status}`);
      }

      if (species) {
        conditions.push(sql`${patients.species}::text = ${species}`);
      }

      if (search) {
        const pattern = clientSearchContainsPattern(search);
        const match = or(
          sql`${patients.name} ilike ${pattern} escape '\\'`,
          sql`${patients.microchipNumber} ilike ${pattern} escape '\\'`,
          sql`${clients.firstName} ilike ${pattern} escape '\\'`,
          sql`${clients.lastName} ilike ${pattern} escape '\\'`,
          sql`concat_ws(' ', ${clients.firstName}, ${clients.lastName}) ilike ${pattern} escape '\\'`,
        );
        if (match) conditions.push(match);
      }

      if (focus === "attention") {
        conditions.push(
          sql`(${openAlertCount} > 0 or ${activeProblemCount} > 0 or ${overdueVaccinationCount} > 0)`,
        );
      } else if (focus === "recent") {
        conditions.push(
          sql`${lastVisitAt} >= (now() - interval '30 days')`,
        );
      }

      const [items, countRows] = await Promise.all([
        ctx.db
          .select({
            patientId: patients.id,
            name: patients.name,
            species: patients.species,
            breed: patients.breed,
            sex: patients.sex,
            dob: patients.dob,
            microchipNumber: patients.microchipNumber,
            photoUrl: patients.photoUrl,
            status: patients.status,
            clientId: patients.clientId,
            clientFirstName: clients.firstName,
            clientLastName: clients.lastName,
            clientPhone: clients.phone,
            lastVisitAt,
            lastVisitAuthor,
            soapNoteCount,
            activeProblemCount,
            activePrescriptionCount,
            nextVaccinationDue,
            overdueVaccinationCount,
            openAlertCount,
          })
          .from(patients)
          .leftJoin(
            clients,
            and(eq(clients.id, patients.clientId), isNull(clients.deletedAt)),
          )
          .where(and(...conditions))
          .orderBy(
            sql`coalesce(${lastVisitAt}, to_timestamp(0)) desc`,
            asc(patients.name),
          )
          .limit(limit)
          .offset(offset),
        ctx.db
          .select({ count: sql<number>`count(*)::int` })
          .from(patients)
          .leftJoin(
            clients,
            and(eq(clients.id, patients.clientId), isNull(clients.deletedAt)),
          )
          .where(and(...conditions)),
      ]);

      return {
        items,
        total: Number(countRows[0]?.count ?? 0),
      };
    }),

  /** KPI strip for the register header. */
  summary: protectedProcedure.query(async ({ ctx }) => {
    const [row] = await ctx.db
      .select({
        patientCount: sql<number>`count(*)::int`,
        withActivePrescriptions: sql<number>`count(*) filter (
          where exists (
            select 1 from prescriptions
            where prescriptions.patient_id = patients.id
              and prescriptions.practice_id = ${ctx.practiceId}
              and prescriptions.status = 'active'
              and prescriptions.deleted_at is null
          )
        )::int`,
        withOpenProblems: sql<number>`count(*) filter (
          where exists (
            select 1 from problem_list
            where problem_list.patient_id = patients.id
              and problem_list.practice_id = ${ctx.practiceId}
              and problem_list.status = 'active'
              and problem_list.deleted_at is null
          )
        )::int`,
        withOpenAlerts: sql<number>`count(*) filter (
          where exists (
            select 1 from ext_clinical_guardian_alerts
            where ext_clinical_guardian_alerts.patient_id = patients.id
              and ext_clinical_guardian_alerts.practice_id = ${ctx.practiceId}
              and ext_clinical_guardian_alerts.status = 'open'
              and ext_clinical_guardian_alerts.deleted_at is null
          )
        )::int`,
        withOverdueVaccination: sql<number>`count(*) filter (
          where exists (
            select 1 from vaccination_records
            where vaccination_records.patient_id = patients.id
              and vaccination_records.practice_id = ${ctx.practiceId}
              and vaccination_records.deleted_at is null
              and vaccination_records.next_due_date < current_date
          )
        )::int`,
      })
      .from(patients)
      .where(
        and(
          eq(patients.practiceId, ctx.practiceId),
          isNull(patients.deletedAt),
          eq(patients.status, "active"),
        ),
      );

    return {
      patientCount: Number(row?.patientCount ?? 0),
      withActivePrescriptions: Number(row?.withActivePrescriptions ?? 0),
      withOpenProblems: Number(row?.withOpenProblems ?? 0),
      withOpenAlerts: Number(row?.withOpenAlerts ?? 0),
      withOverdueVaccination: Number(row?.withOverdueVaccination ?? 0),
    };
  }),
});
