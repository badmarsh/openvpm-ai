/**
 * tRPC router for CRM Segments (ext_crm_segments).
 *
 * Provides operations for viewing and managing client segments:
 * - 12 canonical veterinary segments (puppy_kitten, senior_pet, chronic_patient,
 *   vip_clients, churn_risk, unvaccinated_overdue, wellness_enrolled,
 *   dental_attention, post_op_recovery, frequent_flyer, weight_management,
 *   lapsed_inactive)
 * - Real deterministic recompute via lib/autopilot/segmentation-engine
 * - Paginated member drill-down for the marketing UI
 *
 * The segmentation engine enforces the SKILL.md §3 unconditional Sympathy
 * Gate: deceased patients never contribute segment signals and clients whose
 * patients are all deceased are ineligible for every segment.
 */

import { z } from "zod";
import { eq, and, desc, sql, isNull, or, gt } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, protectedProcedure, requireRole } from "../../trpc";
import type { Database } from "@openpims/db/client";
import {
  extCrmSegments,
  extCrmSegmentMemberships,
  clients,
} from "@openpims/db";
import {
  ensureCanonicalSegments,
  recalculateSegments,
} from "@/lib/autopilot/segmentation-engine";

export const crmSegmentsRouter = createRouter({
  /**
   * List all segments for current practice.
   *
   * Idempotently materializes the 12 canonical system segments on first read
   * so the /marketing/automations "Segmenty" tab always shows the full set.
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    await ensureCanonicalSegments(
      ctx.db as unknown as Database,
      ctx.practiceId,
    );

    const segments = await ctx.db
      .select()
      .from(extCrmSegments)
      .where(
        and(
          eq(extCrmSegments.practiceId, ctx.practiceId),
          isNull(extCrmSegments.deletedAt),
        ),
      )
      .orderBy(desc(extCrmSegments.isSystem), extCrmSegments.name);

    return segments.map((s) => ({
      ...s,
      enabled: s.isActive,
    }));
  }),

  /**
   * Get single segment detail.
   */
  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [segment] = await ctx.db
        .select()
        .from(extCrmSegments)
        .where(
          and(
            eq(extCrmSegments.id, input.id),
            eq(extCrmSegments.practiceId, ctx.practiceId)
          )
        )
        .limit(1);

      if (!segment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Segment not found",
        });
      }

      return segment;
    }),

  /**
   * Toggle segment active status.
   */
  toggle: protectedProcedure
    .use(requireRole("admin", "veterinarian"))
    .input(
      z.object({
        id: z.string().uuid(),
        isActive: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(extCrmSegments)
        .set({
          isActive: input.isActive,
        })
        .where(
          and(
            eq(extCrmSegments.id, input.id),
            eq(extCrmSegments.practiceId, ctx.practiceId)
          )
        )
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Segment not found",
        });
      }

      return {
        id: updated.id,
        name: updated.name,
        isActive: updated.isActive,
        enabled: updated.isActive,
      };
    }),

  /**
   * Recalculate ALL 12 canonical segments (materialize + membership diff).
   */
  recalculateAll: protectedProcedure
    .use(requireRole("admin", "veterinarian"))
    .mutation(async ({ ctx }) => {
      const report = await ctx.db.transaction(async (tx) =>
        recalculateSegments(tx as unknown as Database, ctx.practiceId),
      );

      return {
        recalculatedAt: report.recalculatedAt,
        totalMembers: report.totalMembers,
        segmentCount: report.segments.length,
        segments: report.segments.map((s) => ({
          segmentKey: s.segmentKey,
          segmentId: s.segmentId,
          memberCount: s.memberCount,
          added: s.added,
          removed: s.removed,
        })),
      };
    }),

  /**
   * Recompute a single segment's membership via the real engine.
   */
  recompute: protectedProcedure
    .use(requireRole("admin", "veterinarian"))
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [segment] = await ctx.db
        .select()
        .from(extCrmSegments)
        .where(
          and(
            eq(extCrmSegments.id, input.id),
            eq(extCrmSegments.practiceId, ctx.practiceId)
          )
        )
        .limit(1);

      if (!segment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Segment not found",
        });
      }

      const report = await ctx.db.transaction(async (tx) =>
        recalculateSegments(tx as unknown as Database, ctx.practiceId, {
          onlySegmentKeys: [segment.segmentKey],
        }),
      );

      const result = report.segments.find(
        (s) => s.segmentKey === segment.segmentKey,
      );

      return {
        id: segment.id,
        memberCount: result?.memberCount ?? 0,
        lastRefreshedAt: result?.lastRefreshedAt ?? new Date(),
      };
    }),

  /**
   * Paginated drill-down of clients currently in a segment.
   * Excludes staff-opted-out and expired memberships and clients whose
   * patients are all deceased (defense-in-depth sympathy gate).
   */
  getSegmentMembers: protectedProcedure
    .input(
      z.object({
        segmentKey: z
          .string()
          .trim()
          .regex(/^[a-z][a-z0-9_]{1,62}$/, "Invalid segment key"),
        limit: z.number().int().min(1).max(200).default(50),
        offset: z.number().int().min(0).max(100_000).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const [segment] = await ctx.db
        .select({ id: extCrmSegments.id, segmentKey: extCrmSegments.segmentKey, name: extCrmSegments.name })
        .from(extCrmSegments)
        .where(
          and(
            eq(extCrmSegments.practiceId, ctx.practiceId),
            eq(extCrmSegments.segmentKey, input.segmentKey),
            isNull(extCrmSegments.deletedAt),
          )
        )
        .limit(1);

      if (!segment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Segment not found",
        });
      }

      const now = new Date();
      const activeMembership = and(
        eq(extCrmSegmentMemberships.practiceId, ctx.practiceId),
        eq(extCrmSegmentMemberships.segmentId, segment.id),
        eq(extCrmSegmentMemberships.isManuallyExcluded, false),
        isNull(extCrmSegmentMemberships.deletedAt),
        isNull(clients.deletedAt),
        or(
          isNull(extCrmSegmentMemberships.expiresAt),
          gt(extCrmSegmentMemberships.expiresAt, now),
        ),
        // Defense-in-depth Sympathy Gate (SKILL.md §3): never surface a
        // client whose patients are all deceased in a marketing drill-down.
        sql`exists (
          select 1 from patients
          where patients.practice_id = ${ctx.practiceId}
            and patients.client_id = ${clients.id}
            and patients.deleted_at is null
            and patients.status is distinct from 'deceased'
        )`,
      );

      const [countRow] = await ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(extCrmSegmentMemberships)
        .innerJoin(
          clients,
          eq(extCrmSegmentMemberships.clientId, clients.id),
        )
        .where(activeMembership);

      const members = await ctx.db
        .select({
          clientId: clients.id,
          firstName: clients.firstName,
          lastName: clients.lastName,
          email: clients.email,
          phone: clients.phone,
          city: clients.city,
          enrolledAt: extCrmSegmentMemberships.enrolledAt,
          enrollmentReason: extCrmSegmentMemberships.enrollmentReason,
        })
        .from(extCrmSegmentMemberships)
        .innerJoin(
          clients,
          eq(extCrmSegmentMemberships.clientId, clients.id),
        )
        .where(activeMembership)
        .orderBy(clients.lastName, clients.firstName)
        .limit(input.limit)
        .offset(input.offset);

      return {
        segmentKey: segment.segmentKey,
        segmentName: segment.name,
        total: countRow?.count ?? 0,
        members: members.map((m) => ({
          ...m,
          displayName: `${m.firstName ?? ""} ${m.lastName ?? ""}`.trim(),
        })),
      };
    }),
});
