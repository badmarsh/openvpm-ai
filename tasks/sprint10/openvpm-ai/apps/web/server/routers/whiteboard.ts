import { z } from "zod";
import { eq, and, isNull, gte, gt, lt, inArray, not, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, protectedProcedure, requireRole } from "../trpc";
import {
  appointments,
  practices,
  patients,
  clients,
  users,
  appointmentTypes,
  rooms,
  locations,
  visitCloseouts,
  files,
  labResults,
  procedures,
  vitalSigns,
} from "@openpims/db";
import type { Database } from "@openpims/db/client";
import {
  dateInputDayUtcRange,
  dateInputUtcRangeForTimeZone,
} from "@/lib/date-input";
import { clinicalDateInput } from "@/lib/records/clinical-inputs";
import {
  IMAGING_FILE_CATEGORY,
  normalizeModalityList,
  type ImagingModality,
} from "@/lib/imaging/modality";
import {
  appointmentStatusValues,
  canTransitionAppointmentStatus,
} from "@/lib/scheduling/appointment-status";
import { dispatchAppointmentWebhookAfterCommit } from "@/lib/appointment-webhooks";
import { CLOSEOUT_BYPASS_MESSAGE } from "@/lib/encounters/closeout-policy";
import { conflictMessage, detectConflicts } from "@/lib/scheduling/conflicts";
import {
  resolveAppointmentLocation,
  takeAppointmentSchedulingLock,
} from "@/lib/scheduling/location";

type WhiteboardContext = {
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

function practiceNotFound(): TRPCError {
  return new TRPCError({ code: "NOT_FOUND", message: "Practice not found" });
}

async function practiceSettings(ctx: WhiteboardContext): Promise<{
  name: string;
  phone: string | null;
  timezone: string | null;
}> {
  const [practice] = await ctx.db
    .select({
      name: practices.name,
      phone: practices.phone,
      timezone: practices.timezone,
    })
    .from(practices)
    .where(and(eq(practices.id, ctx.practiceId), isNull(practices.deletedAt)))
    .limit(1);

  if (!practice) {
    throw practiceNotFound();
  }

  return {
    name: practice.name.trim() || "Veterinary Practice",
    phone: practice.phone ?? null,
    timezone: practice.timezone ?? null,
  };
}

async function practiceTimeZone(ctx: WhiteboardContext): Promise<string | null> {
  return (await practiceSettings(ctx)).timezone;
}

async function practiceDayRange(
  ctx: WhiteboardContext,
  dateInput?: string,
): Promise<{ date: string; start: Date; end: Date }> {
  const timeZone = await practiceTimeZone(ctx);
  // An explicit board date is resolved in the practice timezone too, so the
  // previous/next-day navigation matches the clinic's wall clock.
  if (dateInput) return dateInputDayUtcRange(dateInput, timeZone);
  return dateInputUtcRangeForTimeZone(new Date(), timeZone);
}

/** Lab-results attachment categories counted next to the imaging chips. */
const LAB_REPORT_CATEGORY = "lab-results";
/** Visits that are clinically done while the patient may still be admitted. */
const CLOSED_CLOSEOUT_STATUSES = ["clinical_finalized", "completed"] as const;

export const whiteboardRouter = createRouter({
  settings: protectedProcedure.query(async ({ ctx }) => practiceSettings(ctx)),

  getActive: protectedProcedure
    .input(z.object({ date: clinicalDateInput("Date").optional() }).optional())
    .query(async ({ ctx, input }) => {
      const today = await practiceDayRange(ctx, input?.date);

      return ctx.db
        .select({
          id: appointments.id,
          status: appointments.status,
          startTime: appointments.startTime,
          endTime: appointments.endTime,
          notes: appointments.notes,
          patientId: patients.id,
          clientId: clients.id,
          patientName: patients.name,
          patientSpecies: patients.species,
          patientPhotoUrl: patients.photoUrl,
          clientFirstName: clients.firstName,
          clientLastName: clients.lastName,
          doctorName: users.name,
          roomName: rooms.name,
          roomType: rooms.type,
          locationName: locations.name,
          locationId: appointments.locationId,
          typeName: appointmentTypes.name,
          typeColor: appointmentTypes.color,
          typeDefaultRoomType: appointmentTypes.defaultRoomType,
          doctorId: appointments.doctorId,
          typeRequiresDoctor: appointmentTypes.requiresDoctor,
        })
        .from(appointments)
        .leftJoin(
          patients,
          and(
            eq(appointments.patientId, patients.id),
            eq(patients.clientId, appointments.clientId),
            eq(patients.practiceId, ctx.practiceId),
            eq(patients.status, "active"),
            activePracticePredicate(ctx.practiceId),
            isNull(patients.deletedAt)
          )
        )
        .leftJoin(
          clients,
          and(
            eq(appointments.clientId, clients.id),
            eq(clients.practiceId, ctx.practiceId),
            activePracticePredicate(ctx.practiceId),
            isNull(clients.deletedAt)
          )
        )
        .leftJoin(
          users,
          and(
            eq(appointments.doctorId, users.id),
            eq(users.practiceId, ctx.practiceId),
            activePracticePredicate(ctx.practiceId),
            isNull(users.deletedAt)
          )
        )
        .leftJoin(
          appointmentTypes,
          and(
            eq(appointments.typeId, appointmentTypes.id),
            eq(appointmentTypes.practiceId, ctx.practiceId),
            activePracticePredicate(ctx.practiceId),
            isNull(appointmentTypes.deletedAt)
          )
        )
        .leftJoin(
          rooms,
          and(
            eq(appointments.roomId, rooms.id),
            eq(rooms.practiceId, ctx.practiceId),
            activePracticePredicate(ctx.practiceId),
            isNull(rooms.deletedAt)
          )
        )
        .leftJoin(
          locations,
          and(
            eq(appointments.locationId, locations.id),
            eq(locations.practiceId, ctx.practiceId),
          ),
        )
        .where(
          and(
            eq(appointments.practiceId, ctx.practiceId),
            activePracticePredicate(ctx.practiceId),
            isNull(appointments.deletedAt),
            gte(appointments.startTime, today.start),
            lt(appointments.startTime, today.end),
            inArray(appointments.status, [
              "confirmed",
              "checked_in",
              "in_exam",
              "checked_out",
            ])
          )
        )
        .orderBy(appointments.startTime)
        .limit(100);
    }),

  /**
   * Clinical signals for the patients on today's board: imaging modalities,
   * lab reports, critical lab flags, procedures, vitals and discharge state.
   *
   * Read-only aggregation over the practice's own rows; it never writes, and
   * imaging attachments are read from category `"imaging"` only so a
   * diagnostic scan can never be presented as a patient profile photo.
   */
  clinicalSignals: protectedProcedure
    .input(
      z.object({
        date: clinicalDateInput("Date").optional(),
        patientIds: z.array(z.string().uuid()).min(1).max(100),
      }),
    )
    .query(async ({ ctx, input }) => {
      const day = await practiceDayRange(ctx, input.date);
      const patientIds = [...new Set(input.patientIds)];
      const dayWindow = and(
        eq(files.practiceId, ctx.practiceId),
        inArray(files.patientId, patientIds),
        eq(files.storageStatus, "available"),
        isNull(files.deletedAt),
        gte(files.createdAt, day.start),
        lt(files.createdAt, day.end),
      );

      const [attachmentRows, labRows, procedureRows, vitalsRows] =
        await Promise.all([
          ctx.db
            .select({
              patientId: files.patientId,
              category: files.category,
              documentType: files.documentType,
            })
            .from(files)
            .where(
              and(
                dayWindow,
                inArray(files.category, [
                  IMAGING_FILE_CATEGORY,
                  LAB_REPORT_CATEGORY,
                ]),
              ),
            )
            .limit(500),
          ctx.db
            .select({
              patientId: labResults.patientId,
              resultFlag: labResults.resultFlag,
            })
            .from(labResults)
            .where(
              and(
                eq(labResults.practiceId, ctx.practiceId),
                inArray(labResults.patientId, patientIds),
                isNull(labResults.deletedAt),
                gte(labResults.createdAt, day.start),
                lt(labResults.createdAt, day.end),
              ),
            )
            .limit(500),
          ctx.db
            .select({
              patientId: procedures.patientId,
              id: procedures.id,
            })
            .from(procedures)
            .where(
              and(
                eq(procedures.practiceId, ctx.practiceId),
                inArray(procedures.patientId, patientIds),
                isNull(procedures.deletedAt),
                gte(procedures.createdAt, day.start),
                lt(procedures.createdAt, day.end),
              ),
            )
            .limit(500),
          ctx.db
            .select({
              patientId: vitalSigns.patientId,
              id: vitalSigns.id,
            })
            .from(vitalSigns)
            .where(
              and(
                eq(vitalSigns.practiceId, ctx.practiceId),
                inArray(vitalSigns.patientId, patientIds),
                isNull(vitalSigns.deletedAt),
                gte(vitalSigns.recordedAt, day.start),
                lt(vitalSigns.recordedAt, day.end),
              ),
            )
            .limit(500),
        ]);

      // A closed visit stays on the board as "awaiting discharge" while the
      // patient is still admitted to a boarding room.
      const boardingRows = await ctx.db
        .select({
          patientId: appointments.patientId,
          status: visitCloseouts.status,
        })
        .from(visitCloseouts)
        .innerJoin(
          appointments,
          and(
            eq(visitCloseouts.appointmentId, appointments.id),
            eq(appointments.practiceId, ctx.practiceId),
          ),
        )
        .leftJoin(
          rooms,
          and(
            eq(appointments.roomId, rooms.id),
            eq(rooms.practiceId, ctx.practiceId),
          ),
        )
        .leftJoin(
          appointmentTypes,
          and(
            eq(appointments.typeId, appointmentTypes.id),
            eq(appointmentTypes.practiceId, ctx.practiceId),
          ),
        )
        .where(
          and(
            eq(visitCloseouts.practiceId, ctx.practiceId),
            isNull(visitCloseouts.deletedAt),
            inArray(appointments.patientId, patientIds),
            isNull(appointments.deletedAt),
            inArray(visitCloseouts.status, [...CLOSED_CLOSEOUT_STATUSES]),
            sql`coalesce(${rooms.type}::text, ${appointmentTypes.defaultRoomType}::text) = 'boarding'`,
          ),
        )
        .limit(200);

      const signals = new Map(
        patientIds.map((patientId) => [
          patientId,
          {
            patientId,
            imagingModalities: [] as ImagingModality[],
            labReports: 0,
            criticalLabs: 0,
            procedures: 0,
            vitalsRecorded: 0,
            awaitingDischarge: false,
          },
        ]),
      );

      const imagingDocuments = new Map<string, string[]>();
      for (const row of attachmentRows) {
        if (!row.patientId) continue;
        const entry = signals.get(row.patientId);
        if (!entry) continue;
        if (row.category === IMAGING_FILE_CATEGORY) {
          const documents = imagingDocuments.get(row.patientId) ?? [];
          documents.push(row.documentType ?? "");
          imagingDocuments.set(row.patientId, documents);
        } else if (row.category === LAB_REPORT_CATEGORY) {
          entry.labReports += 1;
        }
      }

      for (const [patientId, documents] of imagingDocuments) {
        const entry = signals.get(patientId);
        if (entry) entry.imagingModalities = normalizeModalityList(documents);
      }

      for (const row of labRows) {
        if (row.resultFlag !== "critical") continue;
        const entry = signals.get(row.patientId);
        if (entry) entry.criticalLabs += 1;
      }
      for (const row of procedureRows) {
        const entry = signals.get(row.patientId);
        if (entry) entry.procedures += 1;
      }
      for (const row of vitalsRows) {
        const entry = signals.get(row.patientId);
        if (entry) entry.vitalsRecorded += 1;
      }
      for (const row of boardingRows) {
        if (!row.patientId) continue;
        const entry = signals.get(row.patientId);
        if (entry) entry.awaitingDischarge = true;
      }

      return [...signals.values()];
    }),

  updateStatus: protectedProcedure
    .use(requireRole("admin", "veterinarian", "technician", "front_desk"))
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.enum(appointmentStatusValues),
        doctorId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { current, appt } = await ctx.db.transaction(async (tx) => {
        await takeAppointmentSchedulingLock(
          tx as unknown as Database,
          ctx.practiceId,
        );
        const [current] = await tx
          .select({
            id: appointments.id,
            status: appointments.status,
            doctorId: appointments.doctorId,
            roomId: appointments.roomId,
            locationId: appointments.locationId,
            patientId: appointments.patientId,
            clientId: appointments.clientId,
            activePatientId: patients.id,
            activeClientId: clients.id,
            startTime: appointments.startTime,
            endTime: appointments.endTime,
            typeRequiresDoctor: appointmentTypes.requiresDoctor,
          })
          .from(appointments)
          .leftJoin(
            appointmentTypes,
            and(
              eq(appointments.typeId, appointmentTypes.id),
              eq(appointmentTypes.practiceId, ctx.practiceId),
              isNull(appointmentTypes.deletedAt),
            ),
          )
          .leftJoin(
            patients,
            and(
              eq(appointments.patientId, patients.id),
              eq(patients.clientId, appointments.clientId),
              eq(patients.practiceId, ctx.practiceId),
              eq(patients.status, "active"),
              isNull(patients.deletedAt)
            )
          )
          .leftJoin(
            clients,
            and(
              eq(appointments.clientId, clients.id),
              eq(clients.practiceId, ctx.practiceId),
              isNull(clients.deletedAt)
            )
          )
          .where(
            and(
              eq(appointments.id, input.id),
              eq(appointments.practiceId, ctx.practiceId),
              activePracticePredicate(ctx.practiceId),
              isNull(appointments.deletedAt)
            )
          )
          // Lock only the appointment owner row; PostgreSQL cannot apply
          // FOR UPDATE to the nullable side of these validation LEFT JOINs.
          .for("update", { of: appointments });
        if (!current) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Appointment not found",
          });
        }
        if (input.status === "checked_out") {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: CLOSEOUT_BYPASS_MESSAGE,
          });
        }
        if (!canTransitionAppointmentStatus(current.status, input.status)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Cannot change appointment status from ${current.status} to ${input.status}.`,
          });
        }
        const effectiveDoctorId =
          input.status === "checked_in" && input.doctorId
            ? input.doctorId
            : current.doctorId;

        if (
          input.status === "checked_in" &&
          current.typeRequiresDoctor === 1 &&
          !effectiveDoctorId
        ) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Assign a doctor before checking in this appointment.",
          });
        }
        if (input.status === "checked_in" && input.doctorId) {
          const [doc] = await tx
            .select({ id: users.id })
            .from(users)
            .where(
              and(
                eq(users.id, input.doctorId),
                eq(users.practiceId, ctx.practiceId),
                eq(users.isVeterinarian, true),
                activePracticePredicate(ctx.practiceId),
                isNull(users.deletedAt),
              ),
            )
            .limit(1);
          if (!doc) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Doctor not found" });
          }
        }
        if (
          input.status === "in_exam" &&
          (!current.patientId ||
            !current.clientId ||
            current.activePatientId !== current.patientId ||
            current.activeClientId !== current.clientId)
        ) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message:
              "Attach an active patient and matching client before starting the exam.",
          });
        }
        let restoredLocationId: string | undefined;
        if (
          (current.status === "cancelled" || current.status === "no_show") &&
          input.status !== "cancelled" &&
          input.status !== "no_show"
        ) {
          const resolution = await resolveAppointmentLocation(
            tx as unknown as Database,
            {
              practiceId: ctx.practiceId,
              locationId: current.locationId,
              doctorId: current.doctorId,
              roomId: current.roomId,
            },
          );
          if (!resolution.ok) {
            throw new TRPCError({
              code: resolution.code,
              message: resolution.message,
            });
          }
          restoredLocationId = resolution.locationId;
          const existing = await tx
            .select({
              id: appointments.id,
              startTime: appointments.startTime,
              endTime: appointments.endTime,
              doctorId: appointments.doctorId,
              roomId: appointments.roomId,
              locationId: appointments.locationId,
              status: appointments.status,
            })
            .from(appointments)
            .where(
              and(
                eq(appointments.practiceId, ctx.practiceId),
                activePracticePredicate(ctx.practiceId),
                isNull(appointments.deletedAt),
                not(inArray(appointments.status, ["cancelled", "no_show"])),
                lt(appointments.startTime, current.endTime),
                gt(appointments.endTime, current.startTime),
              ),
            );
          const message = conflictMessage(
            detectConflicts(
              {
                startTime: current.startTime,
                endTime: current.endTime,
                doctorId: current.doctorId,
                roomId: current.roomId,
                locationId: restoredLocationId,
                excludeId: current.id,
              },
              existing,
            ),
          );
          if (message) {
            throw new TRPCError({ code: "CONFLICT", message });
          }
        }

        const [closeout] = await tx
          .select({ id: visitCloseouts.id, status: visitCloseouts.status })
          .from(visitCloseouts)
          .where(
            and(
              eq(visitCloseouts.appointmentId, input.id),
              eq(visitCloseouts.practiceId, ctx.practiceId),
              isNull(visitCloseouts.deletedAt)
            )
          )
          .limit(1);
        if (
          closeout?.status === "clinical_finalized" ||
          closeout?.status === "completed"
        ) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message:
              "Clinical handoff is finalized. Complete the visit through closeout instead of changing its status.",
          });
        }

        const [appt] = await tx
          .update(appointments)
          .set({
            status: input.status,
            ...(restoredLocationId ? { locationId: restoredLocationId } : {}),
            ...(input.status === "checked_in" && input.doctorId
              ? { doctorId: input.doctorId }
              : {}),
          })
          .where(
            and(
              eq(appointments.id, input.id),
              eq(appointments.practiceId, ctx.practiceId),
              eq(appointments.status, current.status),
              activePracticePredicate(ctx.practiceId),
              isNull(appointments.deletedAt)
            )
          )
          .returning();
        if (!appt) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Appointment status changed; try again.",
          });
        }
        if (
          closeout?.status === "draft" &&
          (input.status === "cancelled" || input.status === "no_show")
        ) {
          const now = new Date();
          await tx
            .update(visitCloseouts)
            .set({ deletedAt: now, updatedAt: now })
            .where(
              and(
                eq(visitCloseouts.id, closeout.id),
                eq(visitCloseouts.practiceId, ctx.practiceId),
                eq(visitCloseouts.status, "draft"),
                isNull(visitCloseouts.deletedAt)
              )
            );
        }
        return { current, appt };
      });
      if (appt.status === "checked_in") {
        await dispatchAppointmentWebhookAfterCommit(ctx, ctx.practiceId, "appointment.checked_in", {
          id: appt.id,
          appointmentId: appt.id,
          startTime: appt.startTime,
          endTime: appt.endTime,
          status: appt.status,
          previousStatus: current.status,
          patientId: appt.patientId,
          clientId: appt.clientId,
          doctorId: appt.doctorId,
          roomId: appt.roomId,
          locationId: appt.locationId,
          typeId: appt.typeId,
          source: "dashboard",
        });
      }
      if (appt.status === "cancelled") {
        await dispatchAppointmentWebhookAfterCommit(ctx, ctx.practiceId, "appointment.cancelled", {
          id: appt.id,
          appointmentId: appt.id,
          startTime: appt.startTime,
          endTime: appt.endTime,
          status: appt.status,
          previousStatus: current.status,
          patientId: appt.patientId,
          clientId: appt.clientId,
          doctorId: appt.doctorId,
          roomId: appt.roomId,
          locationId: appt.locationId,
          typeId: appt.typeId,
          source: "dashboard",
        });
      }
      return appt;
    }),
});
