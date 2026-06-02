import { z } from "zod";
import { eq, and, isNull, desc } from "drizzle-orm";
import { createRouter, protectedProcedure, requireRole } from "../trpc";
import { apiKeys } from "@openpims/db";
import { generateApiKey, API_SCOPES } from "@/lib/api-auth";

const adminProcedure = protectedProcedure.use(requireRole("admin"));

export const apiKeysRouter = createRouter({
  list: adminProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        keyPrefix: apiKeys.keyPrefix,
        scopes: apiKeys.scopes,
        lastUsedAt: apiKeys.lastUsedAt,
        createdAt: apiKeys.createdAt,
      })
      .from(apiKeys)
      .where(
        and(eq(apiKeys.practiceId, ctx.practiceId), isNull(apiKeys.deletedAt))
      )
      .orderBy(desc(apiKeys.createdAt));
  }),

  create: adminProcedure
    .input(
      z.object({
        name: z.string().min(1).max(128),
        scopes: z.array(z.enum(API_SCOPES)).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { raw, prefix, hash } = await generateApiKey();

      const [created] = await ctx.db
        .insert(apiKeys)
        .values({
          practiceId: ctx.practiceId,
          name: input.name,
          scopes: input.scopes,
          keyPrefix: prefix,
          keyHash: hash,
        })
        .returning({
          id: apiKeys.id,
          name: apiKeys.name,
          keyPrefix: apiKeys.keyPrefix,
          scopes: apiKeys.scopes,
          createdAt: apiKeys.createdAt,
        });

      // The raw key is returned exactly once and never persisted in plaintext.
      return { ...created!, key: raw };
    }),

  revoke: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [revoked] = await ctx.db
        .update(apiKeys)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(apiKeys.id, input.id),
            eq(apiKeys.practiceId, ctx.practiceId),
            isNull(apiKeys.deletedAt)
          )
        )
        .returning({ id: apiKeys.id });

      if (!revoked) throw new Error("API key not found");
      return { success: true as const };
    }),
});
