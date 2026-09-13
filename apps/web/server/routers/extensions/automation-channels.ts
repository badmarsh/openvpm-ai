/**
 * tRPC router for channel accounts (ext_channel_accounts).
 *
 * Manages OAuth connections and status for social media and review platforms:
 * - Google Business Profile (reviews & updates)
 * - Facebook Page API (posts & reviews)
 * - Instagram Content Publishing API (feed posts)
 * - YouTube Data API (shorts & videos)
 *
 * SECURITY: Access and refresh tokens are encrypted at rest and NEVER exposed via tRPC.
 */

import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, protectedProcedure, requireRole } from "../../trpc";
import {
  extChannelAccounts,
} from "@openpims/db";

const channelProviderSchema = z.enum([
  "google_business",
  "facebook",
  "instagram",
  "youtube",
]);

export const automationChannelsRouter = createRouter({
  /**
   * List all connected channel accounts for the practice.
   * Deliberately omits encrypted tokens from the returned payload.
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const accounts = await ctx.db
      .select({
        id: extChannelAccounts.id,
        practiceId: extChannelAccounts.practiceId,
        provider: extChannelAccounts.provider,
        externalAccountId: extChannelAccounts.externalAccountId,
        displayName: extChannelAccounts.displayName,
        scopesGranted: extChannelAccounts.scopesGranted,
        status: extChannelAccounts.status,
        lastError: extChannelAccounts.lastError,
        tokenExpiresAt: extChannelAccounts.tokenExpiresAt,
        tokenRefreshedAt: extChannelAccounts.tokenRefreshedAt,
        connectedAt: extChannelAccounts.connectedAt,
        disconnectedAt: extChannelAccounts.disconnectedAt,
        publishingQuotaRemaining: extChannelAccounts.publishingQuotaRemaining,
        publishingQuotaFetchedAt: extChannelAccounts.publishingQuotaFetchedAt,
        createdAt: extChannelAccounts.createdAt,
      })
      .from(extChannelAccounts)
      .where(eq(extChannelAccounts.practiceId, ctx.practiceId))
      .orderBy(extChannelAccounts.provider);

    return accounts;
  }),

  /**
   * Connect or mock-connect a channel account.
   */
  connect: protectedProcedure
    .use(requireRole("admin", "veterinarian"))
    .input(
      z.object({
        provider: channelProviderSchema,
        externalAccountId: z.string().min(1).max(255),
        displayName: z.string().min(1).max(255),
        scopes: z.array(z.string()).default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check if account already exists for this provider
      const [existing] = await ctx.db
        .select({ id: extChannelAccounts.id })
        .from(extChannelAccounts)
        .where(
          and(
            eq(extChannelAccounts.practiceId, ctx.practiceId),
            eq(extChannelAccounts.provider, input.provider)
          )
        )
        .limit(1);

      if (existing) {
        const [updated] = await ctx.db
          .update(extChannelAccounts)
          .set({
            externalAccountId: input.externalAccountId,
            displayName: input.displayName,
            scopesGranted: input.scopes,
            status: "connected",
            disconnectedAt: null,
            lastError: null,
            connectedAt: new Date(),
            connectedBy: ctx.user.id,
          })
          .where(eq(extChannelAccounts.id, existing.id))
          .returning();

        return {
          id: updated.id,
          provider: updated.provider,
          displayName: updated.displayName,
          status: updated.status,
        };
      }

      const [created] = await ctx.db
        .insert(extChannelAccounts)
        .values({
          practiceId: ctx.practiceId,
          provider: input.provider,
          externalAccountId: input.externalAccountId,
          displayName: input.displayName,
          scopesGranted: input.scopes,
          status: "connected",
          connectedBy: ctx.user.id,
          connectedAt: new Date(),
          publishingQuotaRemaining: input.provider === "instagram" ? 25 : null,
          publishingQuotaFetchedAt: new Date(),
        })
        .returning();

      return {
        id: created.id,
        provider: created.provider,
        displayName: created.displayName,
        status: created.status,
      };
    }),

  /**
   * Disconnect a channel account (soft revocation).
   */
  disconnect: protectedProcedure
    .use(requireRole("admin", "veterinarian"))
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(extChannelAccounts)
        .set({
          status: "revoked",
          disconnectedAt: new Date(),
        })
        .where(
          and(
            eq(extChannelAccounts.id, input.id),
            eq(extChannelAccounts.practiceId, ctx.practiceId)
          )
        )
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Channel account not found",
        });
      }

      return {
        id: updated.id,
        status: updated.status,
      };
    }),

  /**
   * Test channel connection / refresh quota.
   */
  testConnection: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [account] = await ctx.db
        .select()
        .from(extChannelAccounts)
        .where(
          and(
            eq(extChannelAccounts.id, input.id),
            eq(extChannelAccounts.practiceId, ctx.practiceId)
          )
        )
        .limit(1);

      if (!account) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Channel account not found",
        });
      }

      // Simulate connection check
      const isOk = account.status === "connected";
      return {
        id: account.id,
        provider: account.provider,
        healthy: isOk,
        status: account.status,
        quotaRemaining: account.publishingQuotaRemaining ?? 100,
        checkedAt: new Date(),
      };
    }),
});
