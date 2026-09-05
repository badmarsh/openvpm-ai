/**
 * Support session management tRPC router.
 * Handles creating, joining, and ending support sessions.
 */
import { z } from "zod";
import { eq, and, isNull } from "drizzle-orm";
import { createRouter, protectedProcedure } from "../../trpc";
import { extSupportSessions, extSupportSessionAudit } from "@openpims/db";

function generateSessionCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export const supportRouter = createRouter({
  /** Create a new support session (customer initiates) */
  createSession: protectedProcedure.mutation(async ({ ctx }) => {
    const sessionCode = generateSessionCode();
    const [session] = await ctx.db
      .insert(extSupportSessions)
      .values({
        practiceId: ctx.practiceId,
        clientId: null,
        createdBy: ctx.user.id,
        status: "pending",
        sessionCode,
      })
      .returning();

    return { sessionId: session.id, sessionCode: session.sessionCode };
  }),

  /** Get session details by code (agent joins) */
  getSessionByCode: protectedProcedure
    .input(z.object({ code: z.string().length(6) }))
    .query(async ({ ctx, input }) => {
      const [session] = await ctx.db
        .select()
        .from(extSupportSessions)
        .where(
          and(
            eq(extSupportSessions.sessionCode, input.code.toUpperCase()),
            eq(extSupportSessions.practiceId, ctx.practiceId),
            isNull(extSupportSessions.endedAt)
          )
        )
        .limit(1);

      if (!session) {
        return { found: false, session: null };
      }

      return { found: true, session };
    }),

  /** Get session details by ID */
  getSession: protectedProcedure
    .input(z.object({ sessionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [session] = await ctx.db
        .select()
        .from(extSupportSessions)
        .where(
          and(
            eq(extSupportSessions.id, input.sessionId),
            eq(extSupportSessions.practiceId, ctx.practiceId)
          )
        )
        .limit(1);

      return session ?? null;
    }),

  /** Start session (customer begins sharing) */
  startSession: protectedProcedure
    .input(z.object({ sessionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(extSupportSessions)
        .set({
          status: "active",
          startedAt: new Date(),
        })
        .where(
          and(
            eq(extSupportSessions.id, input.sessionId),
            eq(extSupportSessions.practiceId, ctx.practiceId)
          )
        )
        .returning();

      // Audit log
      await ctx.db.insert(extSupportSessionAudit).values({
        sessionId: input.sessionId,
        userId: ctx.user.id,
        role: "customer",
        action: "joined",
      });

      return updated;
    }),

  /** End session */
  endSession: protectedProcedure
    .input(z.object({ sessionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(extSupportSessions)
        .set({
          status: "ended",
          endedAt: new Date(),
        })
        .where(
          and(
            eq(extSupportSessions.id, input.sessionId),
            eq(extSupportSessions.practiceId, ctx.practiceId)
          )
        )
        .returning();

      // Audit log
      await ctx.db.insert(extSupportSessionAudit).values({
        sessionId: input.sessionId,
        userId: ctx.user.id,
        role: "customer",
        action: "ended",
      });

      return updated;
    }),

  /** Check if user is admin/support role */
  checkSupportRole: protectedProcedure.query(({ ctx }) => {
    const isSupport = ctx.user.role === "admin";
    return { isSupport };
  }),
});
