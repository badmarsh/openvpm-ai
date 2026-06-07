import { z } from "zod";
import { eq, and, isNull, inArray } from "drizzle-orm";
import { hash } from "bcryptjs";
import { createRouter, protectedProcedure, requireRole } from "../trpc";
import {
  practices,
  users,
  appointmentTypes,
  rooms,
  clients,
  patients,
  appointments,
} from "@openpims/db";
import { regionDefaults } from "@/lib/locale/format";

const adminProcedure = protectedProcedure.use(requireRole("admin"));

interface PracticeSettings {
  onboardingCompletedAt?: string | null;
  demoData?: { clientIds: string[]; patientIds: string[]; appointmentIds: string[] };
  [k: string]: unknown;
}

export const settingsRouter = createRouter({
  // ── Practice ──────────────────────────────────────────────

  getPractice: adminProcedure.query(async ({ ctx }) => {
    const [practice] = await ctx.db
      .select()
      .from(practices)
      .where(eq(practices.id, ctx.practiceId))
      .limit(1);
    return practice ?? null;
  }),

  updatePractice: adminProcedure
    .input(
      z.object({
        name: z.string().min(1).optional(),
        address: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().email().optional(),
        website: z.string().optional(),
        timezone: z.string().optional(),
        // Region/locale (Phase 2). country is ISO 3166-1 alpha-2; currency is
        // ISO 4217 lowercase; taxRatePercent is a percent string e.g. "20.00".
        country: z.string().length(2).optional(),
        currency: z.string().min(3).max(3).optional(),
        taxRatePercent: z
          .string()
          .regex(/^\d{1,3}(\.\d{1,2})?$/, "Tax rate must be a number like 20 or 20.00")
          .optional(),
        vatNumber: z.string().max(32).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // When the country changes, fill in any region fields the caller didn't
      // explicitly set (currency/tax) with that country's sensible defaults.
      const patch: Record<string, unknown> = { ...input };
      if (input.country) {
        const defaults = regionDefaults(input.country);
        patch.country = input.country.toUpperCase();
        if (input.currency === undefined) patch.currency = defaults.currency;
        if (input.taxRatePercent === undefined)
          patch.taxRatePercent = defaults.taxRatePercent;
      }
      if (typeof patch.currency === "string") {
        patch.currency = (patch.currency as string).toLowerCase();
      }
      const [updated] = await ctx.db
        .update(practices)
        .set(patch)
        .where(eq(practices.id, ctx.practiceId))
        .returning();
      return updated!;
    }),

  // ── Onboarding ────────────────────────────────────────────

  /** Onboarding state for the first-run wizard / dashboard banner. */
  onboardingStatus: adminProcedure.query(async ({ ctx }) => {
    const [practice] = await ctx.db
      .select({ settings: practices.settings })
      .from(practices)
      .where(eq(practices.id, ctx.practiceId))
      .limit(1);
    const settings = (practice?.settings ?? {}) as PracticeSettings;
    return {
      completedAt: settings.onboardingCompletedAt ?? null,
      hasDemoData: !!settings.demoData,
    };
  }),

  /** Mark onboarding complete. */
  completeOnboarding: adminProcedure.mutation(async ({ ctx }) => {
    const [practice] = await ctx.db
      .select({ settings: practices.settings })
      .from(practices)
      .where(eq(practices.id, ctx.practiceId))
      .limit(1);
    const settings = (practice?.settings ?? {}) as PracticeSettings;
    await ctx.db
      .update(practices)
      .set({ settings: { ...settings, onboardingCompletedAt: new Date().toISOString() } })
      .where(eq(practices.id, ctx.practiceId));
    return { ok: true };
  }),

  /** Remove the seeded demo clients/patients/appointments (soft delete). */
  clearDemoData: adminProcedure.mutation(async ({ ctx }) => {
    const [practice] = await ctx.db
      .select({ settings: practices.settings })
      .from(practices)
      .where(eq(practices.id, ctx.practiceId))
      .limit(1);
    const settings = (practice?.settings ?? {}) as PracticeSettings;
    const demo = settings.demoData;
    if (demo) {
      const now = new Date();
      if (demo.appointmentIds?.length) {
        await ctx.db
          .update(appointments)
          .set({ deletedAt: now })
          .where(
            and(
              eq(appointments.practiceId, ctx.practiceId),
              inArray(appointments.id, demo.appointmentIds)
            )
          );
      }
      if (demo.patientIds?.length) {
        await ctx.db
          .update(patients)
          .set({ deletedAt: now })
          .where(
            and(
              eq(patients.practiceId, ctx.practiceId),
              inArray(patients.id, demo.patientIds)
            )
          );
      }
      if (demo.clientIds?.length) {
        await ctx.db
          .update(clients)
          .set({ deletedAt: now })
          .where(
            and(
              eq(clients.practiceId, ctx.practiceId),
              inArray(clients.id, demo.clientIds)
            )
          );
      }
    }
    const { demoData: _omit, ...rest } = settings;
    await ctx.db
      .update(practices)
      .set({ settings: rest })
      .where(eq(practices.id, ctx.practiceId));
    return { ok: true };
  }),

  // ── Staff / Users ─────────────────────────────────────────

  listUsers: adminProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        phone: users.phone,
        licenseNumber: users.licenseNumber,
        createdAt: users.createdAt,
        deletedAt: users.deletedAt,
      })
      .from(users)
      .where(
        and(eq(users.practiceId, ctx.practiceId), isNull(users.deletedAt))
      );
  }),

  createUser: adminProcedure
    .input(
      z.object({
        name: z.string().min(1),
        email: z.string().email(),
        password: z.string().min(6),
        role: z.enum(["admin", "veterinarian", "technician", "front_desk", "viewer"]),
        phone: z.string().optional(),
        licenseNumber: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { password, ...rest } = input;
      const passwordHash = await hash(password, 12);
      const [user] = await ctx.db
        .insert(users)
        .values({
          ...rest,
          passwordHash,
          practiceId: ctx.practiceId,
        })
        .returning({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
        });
      return user!;
    }),

  updateUser: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).optional(),
        role: z
          .enum(["admin", "veterinarian", "technician", "front_desk", "viewer"])
          .optional(),
        phone: z.string().optional(),
        licenseNumber: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const [updated] = await ctx.db
        .update(users)
        .set(data)
        .where(
          and(eq(users.id, id), eq(users.practiceId, ctx.practiceId))
        )
        .returning();
      return updated!;
    }),

  deactivateUser: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(users)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(users.id, input.id),
            eq(users.practiceId, ctx.practiceId)
          )
        );
      return { success: true };
    }),

  // ── Appointment Types ─────────────────────────────────────

  listAppointmentTypes: adminProcedure.query(async ({ ctx }) => {
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

  createAppointmentType: adminProcedure
    .input(
      z.object({
        name: z.string().min(1),
        durationMinutes: z.number().int().min(5).max(480),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
        requiresDoctor: z.number().int().min(0).max(1).default(1),
        defaultRoomType: z
          .enum(["exam", "surgery", "treatment", "boarding"])
          .default("exam"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [type] = await ctx.db
        .insert(appointmentTypes)
        .values({ ...input, practiceId: ctx.practiceId })
        .returning();
      return type!;
    }),

  updateAppointmentType: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).optional(),
        durationMinutes: z.number().int().min(5).max(480).optional(),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
        requiresDoctor: z.number().int().min(0).max(1).optional(),
        defaultRoomType: z
          .enum(["exam", "surgery", "treatment", "boarding"])
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const [updated] = await ctx.db
        .update(appointmentTypes)
        .set(data)
        .where(
          and(
            eq(appointmentTypes.id, id),
            eq(appointmentTypes.practiceId, ctx.practiceId)
          )
        )
        .returning();
      return updated!;
    }),

  deleteAppointmentType: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(appointmentTypes)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(appointmentTypes.id, input.id),
            eq(appointmentTypes.practiceId, ctx.practiceId)
          )
        );
      return { success: true };
    }),

  // ── Rooms ─────────────────────────────────────────────────

  listRooms: adminProcedure.query(async ({ ctx }) => {
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

  createRoom: adminProcedure
    .input(
      z.object({
        name: z.string().min(1),
        type: z.enum(["exam", "surgery", "treatment", "boarding"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [room] = await ctx.db
        .insert(rooms)
        .values({ ...input, practiceId: ctx.practiceId })
        .returning();
      return room!;
    }),

  deleteRoom: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(rooms)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(rooms.id, input.id),
            eq(rooms.practiceId, ctx.practiceId)
          )
        );
      return { success: true };
    }),
});
