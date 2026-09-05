import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, gte, lte, lt, isNull, sql, ne } from "drizzle-orm";
import {
  createRouter,
  protectedProcedure,
  requireFeature,
  requireRole,
} from "../trpc";
import {
  invoices,
  invoiceItems,
  products,
  appointments,
  users,
  practices,
  vaccinationRecords,
  patients,
  clients,
  soapNotes,
  legacyFinancialDocuments,
} from "@openpims/db";
import type { Database } from "@openpims/db/client";
import {
  resolveReportDateRange,
  validateReportDateRangeInput,
  zeroFillDailySeries,
  type ResolvedReportDateRange,
} from "@/lib/reports/date-range";
import { addDaysYmd } from "@/lib/inventory/alerts";
import { formatDateInputForTimeZone } from "@/lib/date-input";

// Advanced reporting is a Cloud feature on hosted; unrestricted on self-host.
const reportProcedure = protectedProcedure
  .use(requireRole("admin", "veterinarian"))
  .use(requireFeature("advancedReporting"));

const reportDateRangeInput = z
  .object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  })
  .optional();

type ReportsContext = {
  db: Database;
  practiceId: string;
};

function activePracticePredicate(practiceId: string) {
  return sql`exists (
    select 1
    from ${practices}
    where ${practices.id} = ${practiceId}
      and ${practices.deletedAt} is null
  )`;
}

async function practiceTimeZone(ctx: ReportsContext): Promise<string | null> {
  const [practice] = await ctx.db
    .select({ timezone: practices.timezone })
    .from(practices)
    .where(and(eq(practices.id, ctx.practiceId), isNull(practices.deletedAt)))
    .limit(1);
  if (!practice) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Practice not found",
    });
  }
  return practice.timezone ?? null;
}

async function getReportDateRange(
  ctx: ReportsContext,
  input: z.infer<typeof reportDateRangeInput>
): Promise<ResolvedReportDateRange> {
  try {
    validateReportDateRangeInput(input);
    return resolveReportDateRange(
      input,
      new Date(),
      await practiceTimeZone(ctx)
    );
  } catch (error) {
    if (error instanceof TRPCError) {
      throw error;
    }
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        error instanceof Error ? error.message : "Invalid report date range",
    });
  }
}

function sqlStringLiteral(value: string) {
  return sql.raw(`'${value.replace(/'/g, "''")}'`);
}

export const reportsRouter = createRouter({
  settings: reportProcedure.query(async ({ ctx }) => ({
    timezone: await practiceTimeZone(ctx),
  })),

  revenue: reportProcedure
    .input(reportDateRangeInput)
    .query(async ({ ctx, input }) => {
      const range = await getReportDateRange(ctx, input);
      const reportTimeZone = sqlStringLiteral(range.timeZone ?? "UTC");
      const reportDay = sql`
        date_trunc('day', timezone(${reportTimeZone}, ${invoices.createdAt}))
      `;
      const baseConds = [
        eq(invoices.practiceId, ctx.practiceId),
        activePracticePredicate(ctx.practiceId),
        isNull(invoices.deletedAt),
        eq(invoices.status, "paid"),
        eq(invoices.isEstimate, false),
      ];

      const [rangeResult, previousResult, dailyRows] = await Promise.all([
        ctx.db
          .select({
            total: sql<string>`coalesce(sum(${invoices.total}::numeric), 0)`,
          })
          .from(invoices)
          .where(
            and(
              ...baseConds,
              gte(invoices.createdAt, range.start),
              lt(invoices.createdAt, range.endExclusive)
            )
          ),

        ctx.db
          .select({
            total: sql<string>`coalesce(sum(${invoices.total}::numeric), 0)`,
          })
          .from(invoices)
          .where(
            and(
              ...baseConds,
              gte(invoices.createdAt, range.previousStart),
              lt(invoices.createdAt, range.previousEndExclusive)
            )
          ),

        ctx.db
          .select({
            date: sql<string>`to_char(${reportDay}, 'YYYY-MM-DD')`,
            amount: sql<string>`coalesce(sum(${invoices.total}::numeric), 0)`,
          })
          .from(invoices)
          .where(
            and(
              ...baseConds,
              gte(invoices.createdAt, range.start),
              lt(invoices.createdAt, range.endExclusive)
            )
          )
          .groupBy(reportDay)
          .orderBy(sql`min(${invoices.createdAt})`),
      ]);

      const total = parseFloat(String(rangeResult[0]?.total ?? "0"));
      const previousTotal = parseFloat(String(previousResult[0]?.total ?? "0"));

      return {
        range,
        total,
        previousTotal,
        thisMonth: total,
        lastMonth: previousTotal,
        // One point per day so the chart draws a continuous line instead of
        // floating dots on sparse revenue.
        daily: zeroFillDailySeries(
          dailyRows.map((r) => ({
            date: r.date,
            amount: parseFloat(String(r.amount)),
          })),
          range.startDate,
          range.endDate
        ),
      };
    }),

  appointments: reportProcedure
    .input(reportDateRangeInput)
    .query(async ({ ctx, input }) => {
      const range = await getReportDateRange(ctx, input);
      const baseConds = [
        eq(appointments.practiceId, ctx.practiceId),
        activePracticePredicate(ctx.practiceId),
        isNull(appointments.deletedAt),
        gte(appointments.startTime, range.start),
        lt(appointments.startTime, range.endExclusive),
      ];

      const [
        totalResult,
        completedResult,
        noShowResult,
        cancelledResult,
        byDoctor,
      ] = await Promise.all([
        ctx.db
          .select({ count: sql<number>`count(*)::int` })
          .from(appointments)
          .where(and(...baseConds)),

        ctx.db
          .select({ count: sql<number>`count(*)::int` })
          .from(appointments)
          .where(and(...baseConds, eq(appointments.status, "checked_out"))),

        ctx.db
          .select({ count: sql<number>`count(*)::int` })
          .from(appointments)
          .where(and(...baseConds, eq(appointments.status, "no_show"))),

        ctx.db
          .select({ count: sql<number>`count(*)::int` })
          .from(appointments)
          .where(and(...baseConds, eq(appointments.status, "cancelled"))),

        // By doctor breakdown
        ctx.db
          .select({
            doctorName: users.name,
            total: sql<number>`count(*)::int`,
            completed: sql<number>`count(*) filter (where ${appointments.status} = 'checked_out')::int`,
          })
          .from(appointments)
          .leftJoin(
            users,
            and(
              eq(appointments.doctorId, users.id),
              eq(users.practiceId, ctx.practiceId),
              activePracticePredicate(ctx.practiceId)
            )
          )
          .where(and(...baseConds))
          .groupBy(users.name)
          .orderBy(sql`count(*) desc`),
      ]);

      const total = Number(totalResult[0]?.count ?? 0);
      const completed = Number(completedResult[0]?.count ?? 0);
      const noShows = Number(noShowResult[0]?.count ?? 0);
      const cancelled = Number(cancelledResult[0]?.count ?? 0);
      const fillRate = total > 0 ? Math.round((completed / total) * 100) : 0;

      return {
        range,
        total,
        completed,
        noShows,
        cancelled,
        fillRate,
        byDoctor: byDoctor.map((d) => ({
          doctorName: d.doctorName ?? "Unassigned",
          total: Number(d.total),
          completed: Number(d.completed),
        })),
      };
    }),

  topServices: reportProcedure
    .input(reportDateRangeInput)
    .query(async ({ ctx, input }) => {
      const range = await getReportDateRange(ctx, input);
      const rows = await ctx.db
        .select({
          name: invoiceItems.description,
          count: sql<number>`count(*)::int`,
          revenue: sql<string>`coalesce(sum(${invoiceItems.total}::numeric), 0)`,
        })
        .from(invoiceItems)
        .innerJoin(
          invoices,
          and(
            eq(invoiceItems.invoiceId, invoices.id),
            eq(invoices.practiceId, ctx.practiceId),
            activePracticePredicate(ctx.practiceId),
            isNull(invoices.deletedAt)
          )
        )
        .where(
          and(
            eq(invoices.practiceId, ctx.practiceId),
            activePracticePredicate(ctx.practiceId),
            isNull(invoices.deletedAt),
            isNull(invoiceItems.deletedAt),
            eq(invoices.isEstimate, false),
            ne(invoices.status, "void"),
            eq(invoiceItems.itemType, "service"),
            gte(invoices.createdAt, range.start),
            lt(invoices.createdAt, range.endExclusive)
          )
        )
        .groupBy(invoiceItems.description)
        .orderBy(sql`count(*) desc`)
        .limit(10);

      return {
        range,
        items: rows.map((r) => ({
          name: r.name,
          count: Number(r.count),
          revenue: parseFloat(String(r.revenue)),
        })),
      };
    }),

  inventoryAlerts: reportProcedure.query(async ({ ctx }) => {
    const timezone = await practiceTimeZone(ctx);
    const todayYmd = formatDateInputForTimeZone(new Date(), timezone);
    const soonYmd = addDaysYmd(todayYmd, 90);

    const baseConds = [
      eq(products.practiceId, ctx.practiceId),
      eq(products.inventoryTracked, true),
      activePracticePredicate(ctx.practiceId),
      isNull(products.deletedAt),
    ];

    const [lowStock, expired, expiringSoon] = await Promise.all([
      ctx.db
        .select({
          name: products.name,
          sku: products.sku,
          stockQuantity: products.stockQuantity,
          reorderPoint: products.reorderPoint,
        })
        .from(products)
        .where(
          and(
            ...baseConds,
            sql`${products.stockQuantity} <= coalesce(${products.reorderPoint}, 10)`
          )
        )
        .orderBy(products.stockQuantity),

      ctx.db
        .select({
          name: products.name,
          sku: products.sku,
          expirationDate: products.expirationDate,
          stockQuantity: products.stockQuantity,
        })
        .from(products)
        .where(
          and(
            ...baseConds,
            sql`${products.expirationDate} is not null`,
            lt(products.expirationDate, todayYmd)
          )
        )
        .orderBy(products.expirationDate),

      ctx.db
        .select({
          name: products.name,
          sku: products.sku,
          expirationDate: products.expirationDate,
          stockQuantity: products.stockQuantity,
        })
        .from(products)
        .where(
          and(
            ...baseConds,
            sql`${products.expirationDate} is not null`,
            gte(products.expirationDate, todayYmd),
            lte(products.expirationDate, soonYmd)
          )
        )
        .orderBy(products.expirationDate),
    ]);

    return { lowStock, expired, expiringSoon };
  }),

  /**
   * Zákonný register očkovania proti besnote (RVPS report).
   */
  rabiesRegister: reportProcedure
    .input(
      z
        .object({
          startDate: z.string().optional(),
          endDate: z.string().optional(),
          search: z.string().optional(),
          limit: z.number().int().min(1).max(500).default(100),
          offset: z.number().int().min(0).default(0),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const search = input?.search?.trim().toLowerCase();
      const whereConds = [
        eq(vaccinationRecords.practiceId, ctx.practiceId),
        isNull(vaccinationRecords.deletedAt),
        sql`(
          lower(${vaccinationRecords.vaccineName}) LIKE '%rab%' 
          OR lower(${vaccinationRecords.vaccineName}) LIKE '%besnot%'
          OR lower(${vaccinationRecords.vaccineName}) LIKE '%biocan r%'
          OR lower(${vaccinationRecords.vaccineName}) LIKE '%rabisin%'
          OR lower(${vaccinationRecords.vaccineName}) LIKE '%nobivac r%'
          OR lower(${vaccinationRecords.vaccineName}) LIKE '%defensor%'
        )`,
      ];

      if (input?.startDate) {
        whereConds.push(gte(vaccinationRecords.administeredAt, new Date(input.startDate)));
      }
      if (input?.endDate) {
        whereConds.push(lte(vaccinationRecords.administeredAt, new Date(input.endDate)));
      }
      if (search) {
        whereConds.push(
          sql`(
            lower(${patients.name}) LIKE ${`%${search}%`}
            OR lower(coalesce(${patients.microchipNumber}, '')) LIKE ${`%${search}%`}
            OR lower(${clients.lastName}) LIKE ${`%${search}%`}
            OR lower(coalesce(${clients.firstName}, '')) LIKE ${`%${search}%`}
          )`
        );
      }

      const rows = await ctx.db
        .select({
          id: vaccinationRecords.id,
          createdAt: vaccinationRecords.createdAt,
          administeredAt: vaccinationRecords.administeredAt,
          vaccineName: vaccinationRecords.vaccineName,
          productName: vaccinationRecords.productName,
          lotNumber: vaccinationRecords.lotNumber,
          productExpirationDate: vaccinationRecords.productExpirationDate,
          nextDueDate: vaccinationRecords.nextDueDate,
          rabiesTagNumber: vaccinationRecords.rabiesTagNumber,
          patientId: patients.id,
          patientName: patients.name,
          species: patients.species,
          breed: patients.breed,
          microchipNumber: patients.microchipNumber,
          clientId: clients.id,
          clientFirstName: clients.firstName,
          clientLastName: clients.lastName,
          clientAddress: clients.address,
          clientCity: clients.city,
          clientPhone: clients.phone,
        })
        .from(vaccinationRecords)
        .innerJoin(
          patients,
          and(
            eq(vaccinationRecords.patientId, patients.id),
            eq(patients.practiceId, ctx.practiceId)
          )
        )
        .innerJoin(
          clients,
          and(
            eq(patients.clientId, clients.id),
            eq(clients.practiceId, ctx.practiceId)
          )
        )
        .where(and(...whereConds))
        .orderBy(sql`${vaccinationRecords.administeredAt} DESC`)
        .limit(input?.limit ?? 100)
        .offset(input?.offset ?? 0);

      const [totalCountResult] = await ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(vaccinationRecords)
        .innerJoin(
          patients,
          and(
            eq(vaccinationRecords.patientId, patients.id),
            eq(patients.practiceId, ctx.practiceId)
          )
        )
        .innerJoin(
          clients,
          and(
            eq(patients.clientId, clients.id),
            eq(clients.practiceId, ctx.practiceId)
          )
        )
        .where(and(...whereConds));

      return {
        items: rows,
        totalCount: totalCountResult?.count ?? 0,
      };
    }),

  /**
   * Klinický denník ošetrených zvierat (Kniha ošetrení).
   */
  treatmentDiary: reportProcedure
    .input(
      z
        .object({
          startDate: z.string().optional(),
          endDate: z.string().optional(),
          search: z.string().optional(),
          limit: z.number().int().min(1).max(500).default(50),
          offset: z.number().int().min(0).default(0),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const search = input?.search?.trim().toLowerCase();
      const whereConds = [
        eq(soapNotes.practiceId, ctx.practiceId),
        isNull(soapNotes.deletedAt),
      ];

      if (input?.startDate) {
        whereConds.push(gte(soapNotes.createdAt, new Date(input.startDate)));
      }
      if (input?.endDate) {
        whereConds.push(lte(soapNotes.createdAt, new Date(input.endDate)));
      }
      if (search) {
        whereConds.push(
          sql`(
            lower(${patients.name}) LIKE ${`%${search}%`}
            OR lower(${clients.lastName}) LIKE ${`%${search}%`}
            OR lower(coalesce(${soapNotes.assessment}, '')) LIKE ${`%${search}%`}
            OR lower(coalesce(${soapNotes.plan}, '')) LIKE ${`%${search}%`}
          )`
        );
      }

      const rows = await ctx.db
        .select({
          id: soapNotes.id,
          createdAt: soapNotes.createdAt,
          authorName: soapNotes.authorName,
          subjective: soapNotes.subjective,
          objective: soapNotes.objective,
          assessment: soapNotes.assessment,
          plan: soapNotes.plan,
          imported: soapNotes.imported,
          patientId: patients.id,
          patientName: patients.name,
          species: patients.species,
          breed: patients.breed,
          microchipNumber: patients.microchipNumber,
          clientId: clients.id,
          clientFirstName: clients.firstName,
          clientLastName: clients.lastName,
          clientPhone: clients.phone,
        })
        .from(soapNotes)
        .innerJoin(
          patients,
          and(
            eq(soapNotes.patientId, patients.id),
            eq(patients.practiceId, ctx.practiceId)
          )
        )
        .innerJoin(
          clients,
          and(
            eq(patients.clientId, clients.id),
            eq(clients.practiceId, ctx.practiceId)
          )
        )
        .where(and(...whereConds))
        .orderBy(sql`${soapNotes.createdAt} DESC`)
        .limit(input?.limit ?? 50)
        .offset(input?.offset ?? 0);

      const [totalCountResult] = await ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(soapNotes)
        .innerJoin(
          patients,
          and(
            eq(soapNotes.patientId, patients.id),
            eq(patients.practiceId, ctx.practiceId)
          )
        )
        .innerJoin(
          clients,
          and(
            eq(patients.clientId, clients.id),
            eq(clients.practiceId, ctx.practiceId)
          )
        )
        .where(and(...whereConds));

      return {
        items: rows,
        totalCount: totalCountResult?.count ?? 0,
      };
    }),

  /**
   * Register eutanázií a asanovaných tiel.
   */
  euthanasiaRegister: reportProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(500).default(100),
          offset: z.number().int().min(0).default(0),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const whereConds = [
        eq(patients.practiceId, ctx.practiceId),
        eq(patients.status, "deceased"),
        isNull(patients.deletedAt),
      ];

      const rows = await ctx.db
        .select({
          id: patients.id,
          name: patients.name,
          species: patients.species,
          breed: patients.breed,
          microchipNumber: patients.microchipNumber,
          updatedAt: patients.updatedAt,
          clientId: clients.id,
          clientFirstName: clients.firstName,
          clientLastName: clients.lastName,
          clientAddress: clients.address,
          clientCity: clients.city,
          clientPhone: clients.phone,
        })
        .from(patients)
        .innerJoin(
          clients,
          and(
            eq(patients.clientId, clients.id),
            eq(clients.practiceId, ctx.practiceId)
          )
        )
        .where(and(...whereConds))
        .orderBy(sql`${patients.updatedAt} DESC`)
        .limit(input?.limit ?? 100)
        .offset(input?.offset ?? 0);

      const [totalCountResult] = await ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(patients)
        .where(and(...whereConds));

      return {
        items: rows,
        totalCount: totalCountResult?.count ?? 0,
      };
    }),

  /**
   * Finančný prehľad dokladov z VetSoftware V2.
   */
  legacyFinancialSummary: reportProcedure.query(async ({ ctx }) => {
    const [totalStats] = await ctx.db
      .select({
        totalDocuments: sql<number>`count(*)::int`,
        totalRevenue: sql<string>`coalesce(sum(${legacyFinancialDocuments.total}::numeric), 0)`,
      })
      .from(legacyFinancialDocuments)
      .where(
        and(
          eq(legacyFinancialDocuments.practiceId, ctx.practiceId),
          isNull(legacyFinancialDocuments.deletedAt)
        )
      );

    const byYear = await ctx.db
      .select({
        year: sql<string>`coalesce(to_char(${legacyFinancialDocuments.issuedAt}, 'YYYY'), 'Unknown')`,
        count: sql<number>`count(*)::int`,
        total: sql<string>`coalesce(sum(${legacyFinancialDocuments.total}::numeric), 0)`,
      })
      .from(legacyFinancialDocuments)
      .where(
        and(
          eq(legacyFinancialDocuments.practiceId, ctx.practiceId),
          isNull(legacyFinancialDocuments.deletedAt)
        )
      )
      .groupBy(sql`to_char(${legacyFinancialDocuments.issuedAt}, 'YYYY')`)
      .orderBy(sql`to_char(${legacyFinancialDocuments.issuedAt}, 'YYYY') DESC`);

    return {
      totalDocuments: totalStats?.totalDocuments ?? 0,
      totalRevenue: parseFloat(totalStats?.totalRevenue ?? "0"),
      byYear: byYear.map((y) => ({
        year: y.year,
        count: y.count,
        total: parseFloat(y.total),
      })),
    };
  }),
});
