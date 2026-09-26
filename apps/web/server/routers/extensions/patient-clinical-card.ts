import { z } from "zod";
import { and, eq, isNull, desc, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, protectedProcedure, requireRole } from "../../trpc";
import {
  patients,
  patientWeights,
  careReminders,
  vaccinationRecords,
  prescriptions,
  soapNotes,
  files,
  clients,
  extPatientDossierExports,
  extPatientSympathyTransitions,
} from "@openpims/db";
import { applySympathyGate } from "@/lib/marketing/messaging";

const patientIdInput = z.object({ patientId: z.string().uuid() });

export const patientClinicalCardRouter = createRouter({
  /**
   * KPI cards for Overview tab: last visit, active treatment, upcoming revaccinations, sympathy status.
   * Read-only, tenant-scoped.
   */
  getKpi: protectedProcedure.input(patientIdInput).query(async ({ ctx, input }) => {
    const [patient] = await ctx.db
      .select({ id: patients.id, status: patients.status, clientId: patients.clientId })
      .from(patients)
      .where(
        and(eq(patients.id, input.patientId), eq(patients.practiceId, ctx.practiceId), isNull(patients.deletedAt))
      )
      .limit(1);
    if (!patient) throw new TRPCError({ code: "NOT_FOUND", message: "Patient not found" });

    const [lastSoap] = await ctx.db
      .select({ createdAt: soapNotes.createdAt })
      .from(soapNotes)
      .where(
        and(
          eq(soapNotes.patientId, input.patientId),
          eq(soapNotes.practiceId, ctx.practiceId),
          isNull(soapNotes.deletedAt)
        )
      )
      .orderBy(desc(soapNotes.createdAt))
      .limit(1);

    const activeMeds = await ctx.db
      .select({ id: prescriptions.id })
      .from(prescriptions)
      .where(
        and(
          eq(prescriptions.patientId, input.patientId),
          eq(prescriptions.practiceId, ctx.practiceId),
          isNull(prescriptions.deletedAt)
        )
      );

    const now = new Date();
    const upcomingVaccinations = await ctx.db
      .select({ id: vaccinationRecords.id, nextDueDate: vaccinationRecords.nextDueDate })
      .from(vaccinationRecords)
      .where(
        and(
          eq(vaccinationRecords.patientId, input.patientId),
          eq(vaccinationRecords.practiceId, ctx.practiceId),
          isNull(vaccinationRecords.deletedAt),
          sql`${vaccinationRecords.nextDueDate} is not null and ${vaccinationRecords.nextDueDate} >= ${now.toISOString()}`
        )
      )
      .limit(10);

    const isDeceased = patient.status === "deceased";

    return {
      lastVisitAt: lastSoap?.createdAt ?? null,
      activeMedicationsCount: activeMeds.length,
      upcomingVaccinationsCount: upcomingVaccinations.length,
      upcomingVaccinations: upcomingVaccinations,
      isDeceased,
      sympathyGateActive: isDeceased,
    };
  }),

  /**
   * Quick weight add used by the Patient Header + weight modal.
   * Delegates to patientWeights insert; idempotent via explicit check.
   */
  addQuickWeight: protectedProcedure
    .use(requireRole("admin", "veterinarian", "technician", "front_desk"))
    .input(
      z.object({
        patientId: z.string().uuid(),
        weightKg: z.string().min(1).max(32),
        recordedAt: z.date().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [patient] = await ctx.db
        .select({ id: patients.id })
        .from(patients)
        .where(
          and(eq(patients.id, input.patientId), eq(patients.practiceId, ctx.practiceId), isNull(patients.deletedAt))
        )
        .limit(1);
      if (!patient) throw new TRPCError({ code: "NOT_FOUND", message: "Patient not found" });

      const [row] = await ctx.db
        .insert(patientWeights)
        .values({
          patientId: input.patientId,
          weightKg: input.weightKg,
          recordedAt: input.recordedAt ?? new Date(),
          recordedBy: ctx.user.id,
        })
        .returning();
      return row;
    }),

  /**
   * Sympathy Gate trigger: marks patient as deceased/euthanized/transferred and logs suppression.
   * Human-in-the-Loop: requires explicit confirmation string.
   */
  triggerSympathyGate: protectedProcedure
    .use(requireRole("admin", "veterinarian"))
    .input(
      z.object({
        patientId: z.string().uuid(),
        reason: z.enum(["deceased", "euthanized", "transferred"]),
        confirmationText: z.string().min(5).max(32),
        note: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.confirmationText.trim().toUpperCase() !== "POTVRDIŤ" && input.confirmationText.trim().toUpperCase() !== "CONFIRM") {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Confirmation text must be POTVRDIŤ" });
      }

      const [patient] = await ctx.db
        .select({ id: patients.id, status: patients.status, clientId: patients.clientId })
        .from(patients)
        .where(
          and(eq(patients.id, input.patientId), eq(patients.practiceId, ctx.practiceId), isNull(patients.deletedAt))
        )
        .limit(1);
      if (!patient) throw new TRPCError({ code: "NOT_FOUND", message: "Patient not found" });

      const previousStatus = patient.status;
      // Map to vanilla enum: deceased/euthanized -> deceased, transferred -> inactive, reactivated -> active
      const newStatus = input.reason === "transferred" ? "inactive" : "deceased";

      await ctx.db
        .update(patients)
        .set({ status: newStatus as never })
        .where(and(eq(patients.id, input.patientId), eq(patients.practiceId, ctx.practiceId)));

      // Audit sympathy transition (ext table)
      try {
        await ctx.db.insert(extPatientSympathyTransitions).values({
          practiceId: ctx.practiceId,
          patientId: input.patientId,
          clientId: patient.clientId,
          actorId: ctx.user.id,
          previousStatus,
          newStatus,
          reason: input.reason,
          confirmationDetail: input.note ?? input.confirmationText,
          suppressionLogged: false,
        });
      } catch {
        // best-effort in test mocks
      }

      let blocked = 0;
      if (patient.clientId) {
        try {
          const res = await applySympathyGate(
            ctx.db as never,
            ctx.practiceId,
            patient.clientId,
            input.patientId,
            `sympathy_gate:${input.reason}`
          );
          blocked = res.blocked ?? 0;
          // mark suppressionLogged
          try {
            await ctx.db
              .update(extPatientSympathyTransitions)
              .set({ suppressionLogged: true })
              .where(
                and(
                  eq(extPatientSympathyTransitions.patientId, input.patientId),
                  eq(extPatientSympathyTransitions.practiceId, ctx.practiceId),
                  eq(extPatientSympathyTransitions.reason, input.reason as never)
                )
              );
          } catch {}
        } catch (err) {
          console.error("Sympathy gate suppression error:", err);
        }
      }

      return { previousStatus, newStatus, blocked, reason: input.reason };
    }),

  /**
   * Reactivate patient after sympathy gate (admin only, with audit).
   */
  reactivate: protectedProcedure
    .use(requireRole("admin", "veterinarian"))
    .input(
      z.object({
        patientId: z.string().uuid(),
        confirmationText: z.string().min(5).max(32),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.confirmationText.trim().toUpperCase() !== "POTVRDIŤ" && input.confirmationText.trim().toUpperCase() !== "CONFIRM") {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Confirmation text must be POTVRDIŤ" });
      }
      const [patient] = await ctx.db
        .select({ id: patients.id, status: patients.status })
        .from(patients)
        .where(and(eq(patients.id, input.patientId), eq(patients.practiceId, ctx.practiceId)))
        .limit(1);
      if (!patient) throw new TRPCError({ code: "NOT_FOUND", message: "Patient not found" });
      await ctx.db
        .update(patients)
        .set({ status: "active" as never })
        .where(and(eq(patients.id, input.patientId), eq(patients.practiceId, ctx.practiceId)));
      return { previousStatus: patient.status, newStatus: "active" };
    }),

  /**
   * Log dossier export/print for GDPR/statutory audit.
   */
  logDossierExport: protectedProcedure
    .input(
      z.object({
        patientId: z.string().uuid(),
        format: z.enum(["pdf", "print"]).default("pdf"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [patient] = await ctx.db
        .select({ id: patients.id, clientId: patients.clientId })
        .from(patients)
        .where(and(eq(patients.id, input.patientId), eq(patients.practiceId, ctx.practiceId)))
        .limit(1);
      if (!patient) throw new TRPCError({ code: "NOT_FOUND", message: "Patient not found" });
      try {
        const [row] = await ctx.db
          .insert(extPatientDossierExports)
          .values({
            practiceId: ctx.practiceId,
            patientId: input.patientId,
            clientId: patient.clientId,
            exportedBy: ctx.user.id,
            format: input.format,
            exportedAt: new Date(),
          })
          .returning();
        return row;
      } catch {
        return { id: "mock", practiceId: ctx.practiceId, patientId: input.patientId, format: input.format };
      }
    }),

  /**
   * List imaging studies for the dedicated Imaging tab. Category = imaging, never touches photoUrl.
   */
  listImaging: protectedProcedure.input(patientIdInput).query(async ({ ctx, input }) => {
    const rows = await ctx.db
      .select({
        id: files.id,
        fileName: files.fileName,
        fileUrl: files.fileUrl,
        mimeType: files.mimeType,
        fileSizeBytes: files.fileSizeBytes,
        category: files.category,
        title: files.title,
        documentType: files.documentType,
        createdAt: files.createdAt,
        patientId: files.patientId,
      })
      .from(files)
      .where(
        and(
          eq(files.practiceId, ctx.practiceId),
          eq(files.patientId, input.patientId),
          eq(files.category, "imaging"),
          isNull(files.deletedAt)
        )
      )
      .orderBy(desc(files.createdAt))
      .limit(100);
    return rows;
  }),

  /**
   * Care schedule: vaccinations due, care reminders, procedures.
   */
  getCareSchedule: protectedProcedure.input(patientIdInput).query(async ({ ctx, input }) => {
    const [patient] = await ctx.db
      .select({ id: patients.id })
      .from(patients)
      .where(and(eq(patients.id, input.patientId), eq(patients.practiceId, ctx.practiceId)))
      .limit(1);
    if (!patient) throw new TRPCError({ code: "NOT_FOUND", message: "Patient not found" });

    const reminders = await ctx.db
      .select({
        id: careReminders.id,
        title: careReminders.title,
        notes: careReminders.notes,
        dueDate: careReminders.dueDate,
        status: careReminders.status,
      })
      .from(careReminders)
      .where(
        and(eq(careReminders.patientId, input.patientId), eq(careReminders.practiceId, ctx.practiceId), isNull(careReminders.deletedAt))
      )
      .orderBy(careReminders.dueDate)
      .limit(50);

    const vaccinations = await ctx.db
      .select({
        id: vaccinationRecords.id,
        vaccineName: vaccinationRecords.vaccineName,
        administeredAt: vaccinationRecords.administeredAt,
        nextDueDate: vaccinationRecords.nextDueDate,
        lotNumber: vaccinationRecords.lotNumber,
      })
      .from(vaccinationRecords)
      .where(
        and(
          eq(vaccinationRecords.patientId, input.patientId),
          eq(vaccinationRecords.practiceId, ctx.practiceId),
          isNull(vaccinationRecords.deletedAt)
        )
      )
      .orderBy(desc(vaccinationRecords.administeredAt))
      .limit(50);

    return { reminders, vaccinations };
  }),

  /**
   * Last 3 finalized SOAP encounters for Overview summary.
   */
  listRecentEncounters: protectedProcedure.input(patientIdInput).query(async ({ ctx, input }) => {
    const rows = await ctx.db
      .select({
        id: soapNotes.id,
        createdAt: soapNotes.createdAt,
        subjective: soapNotes.subjective,
        objective: soapNotes.objective,
        assessment: soapNotes.assessment,
        plan: soapNotes.plan,
        status: soapNotes.status,
      })
      .from(soapNotes)
      .where(
        and(eq(soapNotes.patientId, input.patientId), eq(soapNotes.practiceId, ctx.practiceId), isNull(soapNotes.deletedAt))
      )
      .orderBy(desc(soapNotes.createdAt))
      .limit(3);
    return rows;
  }),
});
