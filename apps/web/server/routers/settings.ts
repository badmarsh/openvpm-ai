import { z } from "zod";
import { randomUUID } from "crypto";
import { eq, and, isNull, inArray } from "drizzle-orm";
import { hash } from "bcryptjs";
import { TRPCError } from "@trpc/server";
import { createRouter, protectedProcedure, requireRole } from "../trpc";
import {
  practices,
  users,
  appointmentTypes,
  rooms,
  clients,
  patients,
  appointments,
  soapNotes,
  vaccinationRecords,
  problemList,
  invoices,
  invoiceItems,
} from "@openpims/db";
import { regionDefaults } from "@/lib/locale/format";
import { alertOps } from "@/lib/alerts";
import { syncPracticeSubscriptionQuantities } from "@/lib/billing/subscription-sync";
import { seedDemoData } from "@/lib/onboarding/defaults";
import { createAuthToken } from "@/lib/auth-tokens";
import { sendStaffInviteEmail } from "@/lib/email";
import { appBaseUrl, exposeAuthLinksForPreview } from "@/lib/app-url";

const adminProcedure = protectedProcedure.use(requireRole("admin"));

async function syncBillingAfterStaffChange(
  db: Parameters<typeof syncPracticeSubscriptionQuantities>[0]["db"],
  practiceId: string
): Promise<void> {
  try {
    await syncPracticeSubscriptionQuantities({ db, practiceId });
  } catch (err) {
    await alertOps(
      "Staff billing sync crashed",
      `practice=${practiceId}: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

interface PracticeSettings {
  onboardingCompletedAt?: string | null;
  demoData?: {
    clientIds: string[];
    patientIds: string[];
    appointmentIds: string[];
    soapNoteIds?: string[];
    vaccinationIds?: string[];
    problemIds?: string[];
    invoiceIds?: string[];
    invoiceItemIds?: string[];
  };
  onboardingDraft?: {
    logoName?: string;
    brandColor?: string;
    teamMembers?: Array<{
      name: string;
      email: string;
      role: "veterinarian" | "technician" | "front_desk" | "viewer";
    }>;
  };
  /** Live brand accent color (set in settings; logo lives in practices.logoUrl). */
  brandColor?: string;
  /** In-app value tour + finish-setup card progress. */
  onboardingState?: {
    tourStatus?: "not_started" | "in_progress" | "completed" | "skipped";
    lastStepId?: string | null;
    setupDismissed?: boolean;
  };
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
        // Branding. logoUrl is a real column; brandColor lives in settings.
        logoUrl: z.string().optional(),
        brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // brandColor isn't a column — merge it into practices.settings without
      // clobbering other keys.
      const { brandColor, ...columns } = input;
      const patch: Record<string, unknown> = { ...columns };
      // When the country changes, fill in any region fields the caller didn't
      // explicitly set (currency/tax) with that country's sensible defaults.
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
      if (brandColor !== undefined) {
        const [practice] = await ctx.db
          .select({ settings: practices.settings })
          .from(practices)
          .where(eq(practices.id, ctx.practiceId))
          .limit(1);
        const settings = (practice?.settings ?? {}) as PracticeSettings;
        patch.settings = { ...settings, brandColor: brandColor.toLowerCase() };
      }
      const [updated] = await ctx.db
        .update(practices)
        .set(patch)
        .where(eq(practices.id, ctx.practiceId))
        .returning();
      return updated!;
    }),

  // ── Branding ──────────────────────────────────────────────

  /** Practice name, logo, and accent color — readable by any authenticated role. */
  getBranding: protectedProcedure.query(async ({ ctx }) => {
    const [practice] = await ctx.db
      .select({
        name: practices.name,
        logoUrl: practices.logoUrl,
        settings: practices.settings,
      })
      .from(practices)
      .where(eq(practices.id, ctx.practiceId))
      .limit(1);
    const settings = (practice?.settings ?? {}) as PracticeSettings;
    return {
      name: practice?.name ?? null,
      logoUrl: practice?.logoUrl ?? null,
      brandColor: settings.brandColor ?? null,
    };
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
      onboardingDraft: settings.onboardingDraft ?? null,
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

  /** Read the in-app value-tour + finish-setup progress. */
  getOnboardingState: adminProcedure.query(async ({ ctx }) => {
    const [practice] = await ctx.db
      .select({ settings: practices.settings })
      .from(practices)
      .where(eq(practices.id, ctx.practiceId))
      .limit(1);
    const settings = (practice?.settings ?? {}) as PracticeSettings;
    return (
      settings.onboardingState ?? {
        tourStatus: "not_started" as const,
        lastStepId: null,
        setupDismissed: false,
      }
    );
  }),

  /** Persist tour progress (resume / skip / complete). */
  setTourStatus: adminProcedure
    .input(
      z.object({
        status: z.enum(["not_started", "in_progress", "completed", "skipped"]),
        lastStepId: z.string().nullish(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [practice] = await ctx.db
        .select({ settings: practices.settings })
        .from(practices)
        .where(eq(practices.id, ctx.practiceId))
        .limit(1);
      const settings = (practice?.settings ?? {}) as PracticeSettings;
      const onboardingState = {
        ...(settings.onboardingState ?? {}),
        tourStatus: input.status,
        lastStepId:
          input.lastStepId ?? settings.onboardingState?.lastStepId ?? null,
      };
      await ctx.db
        .update(practices)
        .set({ settings: { ...settings, onboardingState } })
        .where(eq(practices.id, ctx.practiceId));
      return { ok: true };
    }),

  /** Dismiss the dashboard "finish setup" card. */
  dismissSetup: adminProcedure.mutation(async ({ ctx }) => {
    const [practice] = await ctx.db
      .select({ settings: practices.settings })
      .from(practices)
      .where(eq(practices.id, ctx.practiceId))
      .limit(1);
    const settings = (practice?.settings ?? {}) as PracticeSettings;
    const onboardingState = {
      ...(settings.onboardingState ?? {}),
      setupDismissed: true,
    };
    await ctx.db
      .update(practices)
      .set({ settings: { ...settings, onboardingState } })
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
      // Soft-delete the clinical and billing records first, then the
      // appointments/patients/clients they hang off of.
      if (demo.invoiceItemIds?.length) {
        await ctx.db
          .update(invoiceItems)
          .set({ deletedAt: now })
          .where(inArray(invoiceItems.id, demo.invoiceItemIds));
      }
      if (demo.invoiceIds?.length) {
        await ctx.db
          .update(invoices)
          .set({ deletedAt: now })
          .where(
            and(
              eq(invoices.practiceId, ctx.practiceId),
              inArray(invoices.id, demo.invoiceIds)
            )
          );
      }
      if (demo.problemIds?.length) {
        await ctx.db
          .update(problemList)
          .set({ deletedAt: now })
          .where(
            and(
              eq(problemList.practiceId, ctx.practiceId),
              inArray(problemList.id, demo.problemIds)
            )
          );
      }
      if (demo.vaccinationIds?.length) {
        await ctx.db
          .update(vaccinationRecords)
          .set({ deletedAt: now })
          .where(
            and(
              eq(vaccinationRecords.practiceId, ctx.practiceId),
              inArray(vaccinationRecords.id, demo.vaccinationIds)
            )
          );
      }
      if (demo.soapNoteIds?.length) {
        await ctx.db
          .update(soapNotes)
          .set({ deletedAt: now })
          .where(
            and(
              eq(soapNotes.practiceId, ctx.practiceId),
              inArray(soapNotes.id, demo.soapNoteIds)
            )
          );
      }
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

  /** Add the sample clients, pets, and visits back. No-op if already present. */
  reseedDemoData: adminProcedure.mutation(async ({ ctx }) => {
    const [practice] = await ctx.db
      .select({ settings: practices.settings })
      .from(practices)
      .where(eq(practices.id, ctx.practiceId))
      .limit(1);
    const settings = (practice?.settings ?? {}) as PracticeSettings;
    if (settings.demoData) return { ok: true, alreadyPresent: true };
    const demoData = await seedDemoData(ctx.db, { practiceId: ctx.practiceId });
    await ctx.db
      .update(practices)
      .set({ settings: { ...settings, demoData } })
      .where(eq(practices.id, ctx.practiceId));
    return { ok: true, alreadyPresent: false };
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
      await syncBillingAfterStaffChange(ctx.db, ctx.practiceId);
      return user!;
    }),

  /**
   * Invite a staff member by email. Creates the user with an unguessable
   * placeholder password (passwordHash is NOT NULL) and an unverified email,
   * then emails an "invite" link to set their password via /accept-invite.
   */
  inviteStaff: adminProcedure
    .input(
      z.object({
        email: z.string().email(),
        name: z.string().optional(),
        role: z.enum([
          "admin",
          "veterinarian",
          "technician",
          "front_desk",
          "viewer",
        ]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const email = input.email.trim().toLowerCase();

      const [existing] = await ctx.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A user with that email already exists.",
        });
      }

      // Derive a display name from the email local-part when not provided.
      const name =
        input.name?.trim() ||
        (() => {
          const local = email.split("@")[0] ?? "";
          const words = local
            .split(/[._-]+/)
            .filter(Boolean)
            .map((w) => w[0]!.toUpperCase() + w.slice(1));
          return words.join(" ") || "Team Member";
        })();

      // Unguessable placeholder — replaced when the invite is accepted.
      const passwordHash = await hash(`invite:${randomUUID()}:${randomUUID()}`, 10);

      const [user] = await ctx.db
        .insert(users)
        .values({
          email,
          name,
          role: input.role,
          passwordHash,
          emailVerifiedAt: null,
          practiceId: ctx.practiceId,
        })
        .returning({
          id: users.id,
          email: users.email,
          name: users.name,
          role: users.role,
        });

      const token = await createAuthToken({
        userId: user!.id,
        email: user!.email,
        type: "invite",
        db: ctx.db,
      });
      const inviteUrl = `${appBaseUrl()}/accept-invite?token=${token}`;

      const [practice] = await ctx.db
        .select({ name: practices.name })
        .from(practices)
        .where(eq(practices.id, ctx.practiceId))
        .limit(1);

      try {
        await sendStaffInviteEmail({
          to: user!.email,
          inviterName: ctx.user.name,
          practiceName: practice?.name ?? "OpenVPM",
          inviteUrl,
        });
      } catch (err) {
        console.error("[inviteStaff] email failed:", err);
      }

      await syncBillingAfterStaffChange(ctx.db, ctx.practiceId);

      return {
        ok: true,
        inviteUrl: exposeAuthLinksForPreview() ? inviteUrl : undefined,
      };
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
      await syncBillingAfterStaffChange(ctx.db, ctx.practiceId);
      return { success: true };
    }),

  restoreUser: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(users)
        .set({ deletedAt: null })
        .where(and(eq(users.id, input.id), eq(users.practiceId, ctx.practiceId)));
      await syncBillingAfterStaffChange(ctx.db, ctx.practiceId);
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
