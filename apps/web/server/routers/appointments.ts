import { z } from "zod";
import { eq, and, isNull, gte, lte, lt, gt, sql, desc, not, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, protectedProcedure, requireRole } from "../trpc";
import type { Database } from "@openpims/db/client";
import {
  appointments,
  appointmentTypes,
  patients,
  clients,
  users,
  rooms,
  recurringSeries,
} from "@openpims/db";
import {
  detectConflicts,
  conflictMessage,
  hasConflict,
  type ExistingBooking,
} from "@/lib/scheduling/conflicts";
import { findOpenSlots } from "@/lib/scheduling/availability";

/** Fetch blocking appointments overlapping [start, end) for conflict checks. */
async function fetchOverlapping(
  db: Database,
  practiceId: string,
  start: Date,
  end: Date,
  excludeId?: string
): Promise<ExistingBooking[]> {
  const rows = await db
    .select({
      id: appointments.id,
      startTime: appointments.startTime,
      endTime: appointments.endTime,
      doctorId: appointments.doctorId,
      roomId: appointments.roomId,
      status: appointments.status,
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.practiceId, practiceId),
        isNull(appointments.deletedAt),
        not(inArray(appointments.status, ["cancelled", "no_show"])),
        // Strict time overlap pre-filter; detectConflicts re-checks precisely.
        lt(appointments.startTime, end),
        gt(appointments.endTime, start)
      )
    );
  return excludeId ? rows.filter((r) => r.id !== excludeId) : rows;
}

export const appointmentsRouter = createRouter({
  list: protectedProcedure
    .input(
      z.object({
        startDate: z.string(),
        endDate: z.string(),
        doctorId: z.string().uuid().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(appointments.practiceId, ctx.practiceId),
        isNull(appointments.deletedAt),
        gte(appointments.startTime, new Date(input.startDate)),
        lte(appointments.startTime, new Date(input.endDate)),
      ];

      if (input.doctorId) {
        conditions.push(eq(appointments.doctorId, input.doctorId));
      }

      return ctx.db
        .select({
          id: appointments.id,
          startTime: appointments.startTime,
          endTime: appointments.endTime,
          status: appointments.status,
          notes: appointments.notes,
          patientName: patients.name,
          patientSpecies: patients.species,
          patientId: appointments.patientId,
          clientFirstName: clients.firstName,
          clientLastName: clients.lastName,
          clientId: appointments.clientId,
          doctorName: users.name,
          doctorId: appointments.doctorId,
          typeName: appointmentTypes.name,
          typeColor: appointmentTypes.color,
          typeDuration: appointmentTypes.durationMinutes,
          roomName: rooms.name,
        })
        .from(appointments)
        .leftJoin(patients, eq(appointments.patientId, patients.id))
        .leftJoin(clients, eq(appointments.clientId, clients.id))
        .leftJoin(users, eq(appointments.doctorId, users.id))
        .leftJoin(appointmentTypes, eq(appointments.typeId, appointmentTypes.id))
        .leftJoin(rooms, eq(appointments.roomId, rooms.id))
        .where(and(...conditions))
        .orderBy(appointments.startTime);
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [appt] = await ctx.db
        .select({
          id: appointments.id,
          startTime: appointments.startTime,
          endTime: appointments.endTime,
          status: appointments.status,
          notes: appointments.notes,
          patientName: patients.name,
          patientId: appointments.patientId,
          clientFirstName: clients.firstName,
          clientLastName: clients.lastName,
          clientId: appointments.clientId,
          doctorName: users.name,
          doctorId: appointments.doctorId,
          typeName: appointmentTypes.name,
          typeColor: appointmentTypes.color,
          roomName: rooms.name,
        })
        .from(appointments)
        .leftJoin(patients, eq(appointments.patientId, patients.id))
        .leftJoin(clients, eq(appointments.clientId, clients.id))
        .leftJoin(users, eq(appointments.doctorId, users.id))
        .leftJoin(appointmentTypes, eq(appointments.typeId, appointmentTypes.id))
        .leftJoin(rooms, eq(appointments.roomId, rooms.id))
        .where(
          and(
            eq(appointments.id, input.id),
            eq(appointments.practiceId, ctx.practiceId)
          )
        )
        .limit(1);

      if (!appt) throw new Error("Appointment not found");
      return appt;
    }),

  create: protectedProcedure
    .use(requireRole("admin", "veterinarian", "front_desk"))
    .input(
      z.object({
        startTime: z.string(),
        endTime: z.string(),
        typeId: z.string().uuid().optional(),
        patientId: z.string().uuid().optional(),
        clientId: z.string().uuid().optional(),
        doctorId: z.string().uuid().optional(),
        roomId: z.string().uuid().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const startTime = new Date(input.startTime);
      const endTime = new Date(input.endTime);
      if (endTime <= startTime) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "End time must be after start time.",
        });
      }

      // Conflict check across both the doctor and the room.
      if (input.doctorId || input.roomId) {
        const existing = await fetchOverlapping(
          ctx.db,
          ctx.practiceId,
          startTime,
          endTime
        );
        const result = detectConflicts(
          { startTime, endTime, doctorId: input.doctorId, roomId: input.roomId },
          existing
        );
        const message = conflictMessage(result);
        if (message) throw new TRPCError({ code: "CONFLICT", message });
      }

      const [appt] = await ctx.db
        .insert(appointments)
        .values({
          ...input,
          startTime,
          endTime,
          practiceId: ctx.practiceId,
        })
        .returning();
      return appt!;
    }),

  updateStatus: protectedProcedure
    .use(requireRole("admin", "veterinarian", "technician", "front_desk"))
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.enum([
          "scheduled",
          "confirmed",
          "checked_in",
          "in_exam",
          "checked_out",
          "no_show",
          "cancelled",
        ]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [appt] = await ctx.db
        .update(appointments)
        .set({ status: input.status })
        .where(
          and(
            eq(appointments.id, input.id),
            eq(appointments.practiceId, ctx.practiceId)
          )
        )
        .returning();
      return appt!;
    }),

  reschedule: protectedProcedure
    .use(requireRole("admin", "veterinarian", "front_desk"))
    .input(
      z.object({
        id: z.string().uuid(),
        startTime: z.string(),
        endTime: z.string(),
        doctorId: z.string().uuid().nullable().optional(),
        roomId: z.string().uuid().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const startTime = new Date(input.startTime);
      const endTime = new Date(input.endTime);
      if (endTime <= startTime) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "End time must be after start time.",
        });
      }

      const [current] = await ctx.db
        .select({
          id: appointments.id,
          doctorId: appointments.doctorId,
          roomId: appointments.roomId,
        })
        .from(appointments)
        .where(
          and(
            eq(appointments.id, input.id),
            eq(appointments.practiceId, ctx.practiceId),
            isNull(appointments.deletedAt)
          )
        )
        .limit(1);
      if (!current) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Appointment not found" });
      }

      // Fall back to the appointment's existing doctor/room when not changing them.
      const doctorId =
        input.doctorId === undefined ? current.doctorId : input.doctorId;
      const roomId = input.roomId === undefined ? current.roomId : input.roomId;

      if (doctorId || roomId) {
        const existing = await fetchOverlapping(
          ctx.db,
          ctx.practiceId,
          startTime,
          endTime,
          input.id // exclude the appointment being moved
        );
        const result = detectConflicts(
          { startTime, endTime, doctorId, roomId, excludeId: input.id },
          existing
        );
        const message = conflictMessage(result);
        if (message) throw new TRPCError({ code: "CONFLICT", message });
      }

      const [updated] = await ctx.db
        .update(appointments)
        .set({ startTime, endTime, doctorId: doctorId ?? null, roomId: roomId ?? null })
        .where(
          and(
            eq(appointments.id, input.id),
            eq(appointments.practiceId, ctx.practiceId)
          )
        )
        .returning();
      return updated!;
    }),

  /** Open slots on a given date for a doctor and/or room. */
  availableSlots: protectedProcedure
    .input(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        durationMinutes: z.number().int().min(5).max(480).default(30),
        stepMinutes: z.number().int().min(5).max(240).optional(),
        doctorId: z.string().uuid().optional(),
        roomId: z.string().uuid().optional(),
        dayStartHour: z.number().int().min(0).max(23).default(8),
        dayEndHour: z.number().int().min(1).max(24).default(18),
      })
    )
    .query(async ({ ctx, input }) => {
      const dayStart = new Date(`${input.date}T${String(input.dayStartHour).padStart(2, "0")}:00:00`);
      const dayEnd = new Date(`${input.date}T${String(input.dayEndHour % 24 || 24).padStart(2, "0")}:00:00`);

      const existing = await fetchOverlapping(ctx.db, ctx.practiceId, dayStart, dayEnd);
      // Only the chosen doctor/room blocks availability; if neither given, any
      // booking on the day blocks (treat the schedule as a single resource).
      const busy = existing.filter((b) => {
        if (input.doctorId && b.doctorId === input.doctorId) return true;
        if (input.roomId && b.roomId === input.roomId) return true;
        return !input.doctorId && !input.roomId;
      });

      return findOpenSlots({
        dayStart,
        dayEnd,
        slotMinutes: input.durationMinutes,
        stepMinutes: input.stepMinutes,
        busy,
      });
    }),

  listTypes: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(appointmentTypes)
      .where(
        and(
          eq(appointmentTypes.practiceId, ctx.practiceId),
          isNull(appointmentTypes.deletedAt)
        )
      );
  }),

  listDoctors: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: users.id,
        name: users.name,
      })
      .from(users)
      .where(
        and(
          eq(users.practiceId, ctx.practiceId),
          eq(users.role, "veterinarian"),
          isNull(users.deletedAt)
        )
      );
  }),

  listRooms: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(rooms)
      .where(
        and(
          eq(rooms.practiceId, ctx.practiceId),
          isNull(rooms.deletedAt)
        )
      );
  }),

  createRecurring: protectedProcedure
    .use(requireRole("admin", "veterinarian", "front_desk"))
    .input(
      z.object({
        patientId: z.string().uuid(),
        clientId: z.string().uuid(),
        doctorId: z.string().uuid().optional(),
        typeId: z.string().uuid().optional(),
        roomId: z.string().uuid().optional(),
        startTime: z.string(),
        endTime: z.string(),
        frequency: z.enum(["weekly", "monthly", "annual"]),
        interval: z.number().int().min(1),
        occurrences: z.number().int().min(1).max(52),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Calculate the duration of a single appointment
      const firstStart = new Date(input.startTime);
      const firstEnd = new Date(input.endTime);
      const durationMs = firstEnd.getTime() - firstStart.getTime();

      if (durationMs <= 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "End time must be after start time.",
        });
      }

      // Create the recurring series record
      // Calculate the last occurrence date for the series endDate
      const lastOccurrenceDate = computeOccurrenceDate(
        firstStart,
        input.frequency,
        input.interval,
        input.occurrences - 1
      );

      const [series] = await ctx.db
        .insert(recurringSeries)
        .values({
          practiceId: ctx.practiceId,
          frequency: input.frequency,
          interval: input.interval,
          endDate: lastOccurrenceDate.toISOString().split("T")[0]!,
        })
        .returning();

      let created = 0;
      let skipped = 0;

      for (let i = 0; i < input.occurrences; i++) {
        const occStart = computeOccurrenceDate(
          firstStart,
          input.frequency,
          input.interval,
          i
        );
        const occEnd = new Date(occStart.getTime() + durationMs);

        // Skip an occurrence that conflicts on either the doctor or the room.
        if (input.doctorId || input.roomId) {
          const existing = await fetchOverlapping(
            ctx.db,
            ctx.practiceId,
            occStart,
            occEnd
          );
          const result = detectConflicts(
            {
              startTime: occStart,
              endTime: occEnd,
              doctorId: input.doctorId,
              roomId: input.roomId,
            },
            existing
          );
          if (hasConflict(result)) {
            skipped++;
            continue;
          }
        }

        await ctx.db.insert(appointments).values({
          practiceId: ctx.practiceId,
          patientId: input.patientId,
          clientId: input.clientId,
          doctorId: input.doctorId,
          typeId: input.typeId,
          roomId: input.roomId,
          startTime: occStart,
          endTime: occEnd,
          notes: input.notes,
          recurringSeriesId: series!.id,
        });

        created++;
      }

      return { seriesId: series!.id, created, skipped };
    }),
});

/** Compute the start date/time for the Nth occurrence (0-based). */
function computeOccurrenceDate(
  baseDate: Date,
  frequency: "weekly" | "monthly" | "annual",
  interval: number,
  n: number
): Date {
  const d = new Date(baseDate);
  switch (frequency) {
    case "weekly":
      d.setDate(d.getDate() + 7 * interval * n);
      break;
    case "monthly":
      d.setMonth(d.getMonth() + interval * n);
      break;
    case "annual":
      d.setFullYear(d.getFullYear() + interval * n);
      break;
  }
  return d;
}
