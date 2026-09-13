import { z } from "zod";
import { eq, and, isNull, desc, gte, lte, sql, count } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, protectedProcedure, requireRole } from "../../trpc";
import {
  clients,
  patients,
  appointments,
  invoices,
  ekasaReceipts,
  products,
  soapNotes,
  labAnalyzerReports,
  extAutomationSuppressionLog,
  extPilotFeedback,
  users,
} from "@openpims/db";

const staffProcedure = protectedProcedure.use(
  requireRole("admin", "veterinarian", "technician", "front_desk")
);

export const reconciliationRouter = createRouter({
  /**
   * Daily Data Parity Summary between OpenVPM AI and VetSoftware v2.
   * Computes counts for created clients, created patients, completed visits,
   * total revenue turnover, and inventory updates.
   */
  getDailyParitySummary: staffProcedure
    .input(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Dátum musí byť vo formáte YYYY-MM-DD"),
      })
    )
    .query(async ({ ctx, input }) => {
      const startOfDay = new Date(`${input.date}T00:00:00.000Z`);
      const endOfDay = new Date(`${input.date}T23:59:59.999Z`);

      // 1. Clients created on that date
      const [clientsCount] = await ctx.db
        .select({ value: count() })
        .from(clients)
        .where(
          and(
            eq(clients.practiceId, ctx.practiceId),
            gte(clients.createdAt, startOfDay),
            lte(clients.createdAt, endOfDay),
            isNull(clients.deletedAt)
          )
        );

      // 2. Patients created on that date
      const [patientsCount] = await ctx.db
        .select({ value: count() })
        .from(patients)
        .where(
          and(
            eq(patients.practiceId, ctx.practiceId),
            gte(patients.createdAt, startOfDay),
            lte(patients.createdAt, endOfDay),
            isNull(patients.deletedAt)
          )
        );

      // 3. Completed visits on that date
      const [completedVisitsCount] = await ctx.db
        .select({ value: count() })
        .from(appointments)
        .where(
          and(
            eq(appointments.practiceId, ctx.practiceId),
            eq(appointments.status, "checked_out"),
            gte(appointments.startTime, startOfDay),
            lte(appointments.startTime, endOfDay),
            isNull(appointments.deletedAt)
          )
        );

      // 4. Financial turnover (Invoices + e-Kasa receipts)
      const invoiceRows = await ctx.db
        .select({
          total: invoices.total,
        })
        .from(invoices)
        .where(
          and(
            eq(invoices.practiceId, ctx.practiceId),
            gte(invoices.createdAt, startOfDay),
            lte(invoices.createdAt, endOfDay),
            isNull(invoices.deletedAt)
          )
        );

      const ekasaRows = await ctx.db
        .select({
          totalAmount: ekasaReceipts.amountTotal,
        })
        .from(ekasaReceipts)
        .where(
          and(
            eq(ekasaReceipts.practiceId, ctx.practiceId),
            eq(ekasaReceipts.status, "CONFIRMED"),
            gte(ekasaReceipts.createdAt, startOfDay),
            lte(ekasaReceipts.createdAt, endOfDay),
            isNull(ekasaReceipts.deletedAt)
          )
        );

      const invoicesTotal = invoiceRows.reduce(
        (sum, row) => sum + (parseFloat(row?.total || "0") || 0),
        0
      );
      const ekasaTotal = ekasaRows.reduce(
        (sum, row) => sum + (parseFloat(row?.totalAmount || "0") || 0),
        0
      );
      // Total financial volume
      const totalTurnover = Math.max(invoicesTotal, ekasaTotal) || (invoicesTotal + ekasaTotal);

      // 5. Inventory movements / modified items
      const [inventoryMovements] = await ctx.db
        .select({ value: count() })
        .from(products)
        .where(
          and(
            eq(products.practiceId, ctx.practiceId),
            gte(products.updatedAt, startOfDay),
            lte(products.updatedAt, endOfDay),
            isNull(products.deletedAt)
          )
        );

      return {
        date: input.date,
        clientsCreated: clientsCount?.value ?? 0,
        patientsCreated: patientsCount?.value ?? 0,
        completedVisits: completedVisitsCount?.value ?? 0,
        totalTurnover: Math.round(totalTurnover * 100) / 100,
        inventoryMovements: inventoryMovements?.value ?? 0,
      };
    }),

  /**
   * Audit of Clinical AI Drafts (Zákon 39/2007 Z. z. §3).
   * Lists all unclosed/unfinalized SOAP notes and lab analyzer imports waiting
   * for veterinarian authorization and signature.
   */
  getPendingClinicalDrafts: staffProcedure.query(async ({ ctx }) => {
    // Unfinalized SOAP notes
    const draftSoaps = await ctx.db
      .select({
        id: soapNotes.id,
        patientId: soapNotes.patientId,
        patientName: patients.name,
        authorName: soapNotes.authorName,
        createdAt: soapNotes.createdAt,
        revision: soapNotes.revision,
        appointmentId: soapNotes.appointmentId,
        subjective: soapNotes.subjective,
        assessment: soapNotes.assessment,
      })
      .from(soapNotes)
      .leftJoin(patients, eq(soapNotes.patientId, patients.id))
      .where(
        and(
          eq(soapNotes.practiceId, ctx.practiceId),
          eq(soapNotes.status, "draft"),
          isNull(soapNotes.deletedAt)
        )
      )
      .orderBy(desc(soapNotes.createdAt))
      .limit(50);

    // Unreviewed Lab Analyzer Reports
    const draftLabs = await ctx.db
      .select({
        id: labAnalyzerReports.id,
        patientId: labAnalyzerReports.patientId,
        patientName: patients.name,
        sampleId: labAnalyzerReports.sampleId,
        analyzerType: labAnalyzerReports.analyzerType,
        deviceModel: labAnalyzerReports.deviceModel,
        abnormalCount: labAnalyzerReports.abnormalCount,
        criticalCount: labAnalyzerReports.criticalCount,
        status: labAnalyzerReports.status,
        createdAt: labAnalyzerReports.createdAt,
      })
      .from(labAnalyzerReports)
      .leftJoin(patients, eq(labAnalyzerReports.patientId, patients.id))
      .where(
        and(
          eq(labAnalyzerReports.practiceId, ctx.practiceId),
          sql`${labAnalyzerReports.status} != 'REVIEWED'`,
          isNull(labAnalyzerReports.deletedAt)
        )
      )
      .orderBy(desc(labAnalyzerReports.createdAt))
      .limit(50);

    return {
      draftSoaps: draftSoaps.map((s) => ({
        ...s,
        patientName: s.patientName ?? "Neznámy pacient",
      })),
      draftLabs: draftLabs.map((l) => ({
        ...l,
        patientName: l.patientName ?? "Nepriradený pacient",
      })),
      totalPending: draftSoaps.length + draftLabs.length,
    };
  }),

  /**
   * Overview of Suppressed Communications (GDPR Art. 22 / Sympathy Gate).
   * Shows suppressed messages for the selected date with explicit statutory/ethical reasons.
   */
  getSuppressedCommunications: staffProcedure
    .input(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        limit: z.number().int().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const startOfDay = new Date(`${input.date}T00:00:00.000Z`);
      const endOfDay = new Date(`${input.date}T23:59:59.999Z`);

      const rows = await ctx.db
        .select({
          id: extAutomationSuppressionLog.id,
          clientId: extAutomationSuppressionLog.clientId,
          clientFirstName: clients.firstName,
          clientLastName: clients.lastName,
          patientId: extAutomationSuppressionLog.patientId,
          patientName: patients.name,
          suppressionReason: extAutomationSuppressionLog.suppressionReason,
          blockedAction: extAutomationSuppressionLog.blockedAction,
          channelAttempted: extAutomationSuppressionLog.channelAttempted,
          blockedAt: extAutomationSuppressionLog.blockedAt,
          detail: extAutomationSuppressionLog.detail,
        })
        .from(extAutomationSuppressionLog)
        .leftJoin(clients, eq(extAutomationSuppressionLog.clientId, clients.id))
        .leftJoin(patients, eq(extAutomationSuppressionLog.patientId, patients.id))
        .where(
          and(
            eq(extAutomationSuppressionLog.practiceId, ctx.practiceId),
            gte(extAutomationSuppressionLog.blockedAt, startOfDay),
            lte(extAutomationSuppressionLog.blockedAt, endOfDay),
            isNull(extAutomationSuppressionLog.deletedAt)
          )
        )
        .orderBy(desc(extAutomationSuppressionLog.blockedAt))
        .limit(input.limit);

      return rows.map((r) => ({
        ...r,
        clientName: r.clientFirstName && r.clientLastName ? `${r.clientFirstName} ${r.clientLastName}` : "Klient",
        patientName: r.patientName ?? undefined,
      }));
    }),

  /**
   * List recent Pilot Feedback & Discrepancies reported by staff.
   */
  listDiscrepancies: staffProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(100).default(50),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          id: extPilotFeedback.id,
          incidentDate: extPilotFeedback.incidentDate,
          moduleWorkflow: extPilotFeedback.moduleWorkflow,
          vetSoftwareReference: extPilotFeedback.vetSoftwareReference,
          description: extPilotFeedback.description,
          severity: extPilotFeedback.severity,
          status: extPilotFeedback.status,
          reportedByName: extPilotFeedback.reportedByName,
          createdAt: extPilotFeedback.createdAt,
        })
        .from(extPilotFeedback)
        .where(
          and(
            eq(extPilotFeedback.practiceId, ctx.practiceId),
            isNull(extPilotFeedback.deletedAt)
          )
        )
        .orderBy(desc(extPilotFeedback.incidentDate))
        .limit(input?.limit ?? 50);

      return rows;
    }),

  /**
   * 1-Click Pilot Discrepancy & Incident Logger.
   * Enables veterinarians and staff to rapidly log parity differences with VetSoftware v2.
   */
  reportDiscrepancy: staffProcedure
    .input(
      z.object({
        incidentDate: z.string().optional(),
        moduleWorkflow: z.string().min(1, "Zvoľte modul alebo workflow"),
        vetSoftwareReference: z.string().optional(),
        description: z.string().min(3, "Zadajte popis rozdielu (aspoň 3 znaky)"),
        severity: z.enum(["low", "medium", "critical"]).default("medium"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const actorName = ctx.session?.user?.name || "Personál ambulancie";

      const [feedback] = await ctx.db
        .insert(extPilotFeedback)
        .values({
          practiceId: ctx.practiceId,
          reportedById: ctx.session?.user?.id ? (ctx.session.user.id as any) : null,
          reportedByName: actorName,
          incidentDate: input.incidentDate ? new Date(input.incidentDate) : new Date(),
          moduleWorkflow: input.moduleWorkflow,
          vetSoftwareReference: input.vetSoftwareReference || null,
          description: input.description,
          severity: input.severity,
          status: "open",
        })
        .returning();

      return {
        success: true,
        feedbackId: feedback.id,
      };
    }),
});
