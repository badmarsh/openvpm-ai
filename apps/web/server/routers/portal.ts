import { z } from "zod";
import { eq, and, isNull, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, publicProcedure } from "../trpc";
import {
  clients,
  patients,
  patientWeights,
  patientAllergies,
  vaccinationRecords,
  prescriptions,
  appointments,
  appointmentTypes,
  invoices,
  communications,
} from "@openpims/db";
import { users } from "@openpims/db";
import { rateLimit } from "@/lib/rate-limit";
import { dispatchWebhookEvent } from "@/lib/webhook-dispatcher";
import { buildRequestedSlot } from "@/lib/portal/booking";
import { findOpenSlots } from "@/lib/scheduling/availability";
import { not, inArray, lt, gt } from "drizzle-orm";

async function getClientByToken(db: any, token: string) {
  const [client] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.accessToken, token), isNull(clients.deletedAt)))
    .limit(1);

  if (!client) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Invalid portal link",
    });
  }

  return client;
}

export const portalRouter = createRouter({
  getClient: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const client = await getClientByToken(ctx.db, input.token);

      const clientPatients = await ctx.db
        .select({
          id: patients.id,
          name: patients.name,
          species: patients.species,
          breed: patients.breed,
          dob: patients.dob,
          color: patients.color,
          sex: patients.sex,
          photoUrl: patients.photoUrl,
          status: patients.status,
        })
        .from(patients)
        .where(
          and(
            eq(patients.clientId, client.id),
            isNull(patients.deletedAt),
            eq(patients.status, "active")
          )
        );

      return {
        id: client.id,
        firstName: client.firstName,
        lastName: client.lastName,
        email: client.email,
        phone: client.phone,
        patients: clientPatients,
      };
    }),

  getPetDetail: publicProcedure
    .input(
      z.object({
        token: z.string().min(1),
        patientId: z.string().uuid(),
      })
    )
    .query(async ({ ctx, input }) => {
      const client = await getClientByToken(ctx.db, input.token);

      const [patient] = await ctx.db
        .select()
        .from(patients)
        .where(
          and(
            eq(patients.id, input.patientId),
            eq(patients.clientId, client.id),
            isNull(patients.deletedAt)
          )
        )
        .limit(1);

      if (!patient) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Pet not found",
        });
      }

      const [weights, allergies, vaccinations, activeRx] = await Promise.all([
        ctx.db
          .select({
            id: patientWeights.id,
            weightKg: patientWeights.weightKg,
            recordedAt: patientWeights.recordedAt,
          })
          .from(patientWeights)
          .where(eq(patientWeights.patientId, input.patientId))
          .orderBy(desc(patientWeights.recordedAt)),

        ctx.db
          .select({
            id: patientAllergies.id,
            allergen: patientAllergies.allergen,
            reaction: patientAllergies.reaction,
            severity: patientAllergies.severity,
          })
          .from(patientAllergies)
          .where(eq(patientAllergies.patientId, input.patientId)),

        ctx.db
          .select({
            id: vaccinationRecords.id,
            vaccineName: vaccinationRecords.vaccineName,
            administeredAt: vaccinationRecords.administeredAt,
            nextDueDate: vaccinationRecords.nextDueDate,
          })
          .from(vaccinationRecords)
          .where(eq(vaccinationRecords.patientId, input.patientId))
          .orderBy(desc(vaccinationRecords.administeredAt)),

        ctx.db
          .select({
            id: prescriptions.id,
            medicationName: prescriptions.medicationName,
            dosage: prescriptions.dosage,
            frequency: prescriptions.frequency,
            startDate: prescriptions.startDate,
            endDate: prescriptions.endDate,
            instructions: prescriptions.instructions,
            status: prescriptions.status,
            refillsRemaining: prescriptions.refillsRemaining,
          })
          .from(prescriptions)
          .where(
            and(
              eq(prescriptions.patientId, input.patientId),
              eq(prescriptions.status, "active")
            )
          ),
      ]);

      return {
        ...patient,
        weights,
        allergies,
        vaccinations,
        prescriptions: activeRx,
      };
    }),

  getAppointments: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const client = await getClientByToken(ctx.db, input.token);

      const rows = await ctx.db
        .select({
          id: appointments.id,
          startTime: appointments.startTime,
          endTime: appointments.endTime,
          status: appointments.status,
          notes: appointments.notes,
          patientName: patients.name,
          patientSpecies: patients.species,
          doctorName: users.name,
          typeName: appointmentTypes.name,
        })
        .from(appointments)
        .leftJoin(patients, eq(appointments.patientId, patients.id))
        .leftJoin(users, eq(appointments.doctorId, users.id))
        .leftJoin(appointmentTypes, eq(appointments.typeId, appointmentTypes.id))
        .where(eq(appointments.clientId, client.id))
        .orderBy(desc(appointments.startTime));

      return rows;
    }),

  getInvoices: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const client = await getClientByToken(ctx.db, input.token);

      const rows = await ctx.db
        .select({
          id: invoices.id,
          status: invoices.status,
          subtotal: invoices.subtotal,
          tax: invoices.tax,
          total: invoices.total,
          paidAmount: invoices.paidAmount,
          dueDate: invoices.dueDate,
          createdAt: invoices.createdAt,
          patientName: patients.name,
        })
        .from(invoices)
        .leftJoin(patients, eq(invoices.patientId, patients.id))
        .where(and(eq(invoices.clientId, client.id), isNull(invoices.deletedAt)))
        .orderBy(desc(invoices.createdAt));

      return rows;
    }),

  /** Appointment types a client can choose from when booking. */
  getAppointmentTypes: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const client = await getClientByToken(ctx.db, input.token);
      return ctx.db
        .select({
          id: appointmentTypes.id,
          name: appointmentTypes.name,
          durationMinutes: appointmentTypes.durationMinutes,
        })
        .from(appointmentTypes)
        .where(
          and(
            eq(appointmentTypes.practiceId, client.practiceId),
            isNull(appointmentTypes.deletedAt)
          )
        )
        .orderBy(appointmentTypes.name);
    }),

  /** Suggested open times on a date for the booking form (practice-wide). */
  availableSlots: publicProcedure
    .input(
      z.object({
        token: z.string().min(1),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        durationMinutes: z.number().int().min(10).max(120).default(30),
      })
    )
    .query(async ({ ctx, input }) => {
      const client = await getClientByToken(ctx.db, input.token);
      const dayStart = new Date(`${input.date}T08:00:00`);
      const dayEnd = new Date(`${input.date}T18:00:00`);

      const busy = await ctx.db
        .select({
          startTime: appointments.startTime,
          endTime: appointments.endTime,
        })
        .from(appointments)
        .where(
          and(
            eq(appointments.practiceId, client.practiceId),
            isNull(appointments.deletedAt),
            not(inArray(appointments.status, ["cancelled", "no_show"])),
            lt(appointments.startTime, dayEnd),
            gt(appointments.endTime, dayStart)
          )
        );

      return findOpenSlots({
        dayStart,
        dayEnd,
        slotMinutes: input.durationMinutes,
        busy,
      }).map((s) => ({
        // 24h HH:MM in the server's local time, matching the booking form input.
        time: `${String(s.start.getHours()).padStart(2, "0")}:${String(s.start.getMinutes()).padStart(2, "0")}`,
        iso: s.start.toISOString(),
      }));
    }),

  requestAppointment: publicProcedure
    .input(
      z.object({
        token: z.string().min(1),
        patientId: z.string().uuid(),
        typeId: z.string().uuid().optional(),
        preferredDate: z.string(),
        preferredTime: z.string(),
        reason: z.string().min(1).max(1000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const client = await getClientByToken(ctx.db, input.token);

      // Throttle public booking per portal link to deter abuse.
      const { success } = rateLimit({
        key: `portal-book:${input.token}`,
        limit: 5,
        windowMs: 60 * 60 * 1000,
      });
      if (!success) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Too many requests. Please try again later or call the clinic.",
        });
      }

      // Verify the patient belongs to this client.
      const [patient] = await ctx.db
        .select({ id: patients.id, name: patients.name })
        .from(patients)
        .where(
          and(
            eq(patients.id, input.patientId),
            eq(patients.clientId, client.id),
            isNull(patients.deletedAt)
          )
        )
        .limit(1);

      if (!patient) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Pet not found" });
      }

      // Resolve the requested type (must belong to this practice) for duration.
      let durationMinutes = 30;
      let typeId: string | null = null;
      if (input.typeId) {
        const [type] = await ctx.db
          .select({ id: appointmentTypes.id, durationMinutes: appointmentTypes.durationMinutes })
          .from(appointmentTypes)
          .where(
            and(
              eq(appointmentTypes.id, input.typeId),
              eq(appointmentTypes.practiceId, client.practiceId),
              isNull(appointmentTypes.deletedAt)
            )
          )
          .limit(1);
        if (!type) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Appointment type not found" });
        }
        typeId = type.id;
        durationMinutes = type.durationMinutes;
      }

      let slot;
      try {
        slot = buildRequestedSlot({
          preferredDate: input.preferredDate,
          preferredTime: input.preferredTime,
          durationMinutes,
        });
      } catch (e) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: e instanceof Error ? e.message : "Invalid date or time",
        });
      }

      // Create the appointment as "scheduled" — staff confirm/adjust on the
      // calendar. Notes flag it as a portal request and capture the reason.
      const [appt] = await ctx.db
        .insert(appointments)
        .values({
          practiceId: client.practiceId,
          clientId: client.id,
          patientId: patient.id,
          typeId,
          startTime: slot.startTime,
          endTime: slot.endTime,
          status: "scheduled",
          notes: `[Portal request] ${input.reason}`,
        })
        .returning();

      // Mirror into the communications inbox so front desk sees it there too.
      await ctx.db.insert(communications).values({
        practiceId: client.practiceId,
        clientId: client.id,
        channel: "portal",
        direction: "inbound",
        subject: `Appointment request for ${patient.name}`,
        content: [
          `Pet: ${patient.name}`,
          `Requested: ${slot.startTime.toISOString()}`,
          `Reason: ${input.reason}`,
        ].join("\n"),
        status: "pending",
      });

      await dispatchWebhookEvent(client.practiceId, "appointment.created", {
        id: appt!.id,
        startTime: appt!.startTime,
        endTime: appt!.endTime,
        status: appt!.status,
        source: "portal",
      });

      return {
        success: true,
        appointmentId: appt!.id,
        message:
          "Your appointment request has been sent! The clinic will confirm your appointment.",
      };
    }),
});
