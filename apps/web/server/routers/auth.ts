import { z } from "zod";
import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, publicProcedure, protectedProcedure } from "../trpc";
import { users, practices, locations } from "@openpims/db";
import { rateLimit } from "@/lib/rate-limit";
import { seedPractice } from "@/lib/onboarding/defaults";
import { billingEnforced, TRIAL_DAYS } from "@/lib/billing/plans";
import { createAuthToken, consumeAuthToken } from "@/lib/auth-tokens";
import { sendVerificationEmail, sendPasswordResetEmail } from "@/lib/email";

function appBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXTAUTH_URL ??
    "http://localhost:3000"
  );
}

export const authRouter = createRouter({
  register: publicProcedure
    .input(
      z.object({
        name: z.string().min(2),
        email: z.string().email(),
        password: z.string().min(8),
        practiceName: z.string().min(2),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Rate limit by email: 5 registrations per hour
      const { success } = rateLimit({
        key: `register:${input.email}`,
        limit: 5,
        windowMs: 3600000,
      });

      if (!success) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Too many registration attempts. Please try again later.",
        });
      }

      // Check if email already exists
      const [existing] = await ctx.db
        .select()
        .from(users)
        .where(eq(users.email, input.email))
        .limit(1);

      if (existing) {
        throw new Error("Email already registered");
      }

      const passwordHash = await hash(input.password, 10);

      // On the hosted service, start a full-featured trial so the new practice
      // is immediately usable before entering payment. Self-host ignores this.
      const trial = billingEnforced()
        ? {
            billingStatus: "trialing" as const,
            trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000),
          }
        : {};

      // Create practice
      const [practice] = await ctx.db
        .insert(practices)
        .values({
          name: input.practiceName,
          ...trial,
        })
        .returning();

      // Create default location
      const [location] = await ctx.db
        .insert(locations)
        .values({
          practiceId: practice!.id,
          name: "Main Location",
          isPrimary: true,
        })
        .returning();

      // Create admin user
      const [user] = await ctx.db
        .insert(users)
        .values({
          email: input.email,
          passwordHash,
          name: input.name,
          role: "admin",
          practiceId: practice!.id,
        })
        .returning();

      // Seed sensible defaults (appointment types, rooms, starter services) so
      // the new practice is usable immediately. Non-fatal: a seed hiccup must
      // not block signup — the practice still works, just emptier.
      try {
        await seedPractice(ctx.db, {
          practiceId: practice!.id,
          locationId: location?.id ?? null,
        });
      } catch (err) {
        console.error("[register] practice seeding failed:", err);
      }

      // On the hosted service, require email verification before login. Issue a
      // token + send the email. Non-fatal: signup still succeeds. Self-host
      // skips this (frictionless).
      let verificationRequired = false;
      if (billingEnforced()) {
        verificationRequired = true;
        try {
          const token = await createAuthToken({
            userId: user!.id,
            email: user!.email,
            type: "email_verify",
          });
          await sendVerificationEmail({
            to: user!.email,
            name: user!.name,
            verifyUrl: `${appBaseUrl()}/verify-email?token=${token}`,
          });
        } catch (err) {
          console.error("[register] verification email failed:", err);
        }
      }

      return { id: user!.id, email: user!.email, verificationRequired };
    }),

  /** Confirm an email-verification token (hosted). */
  verifyEmail: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const result = await consumeAuthToken(input.token, "email_verify");
      if (!result) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This verification link is invalid or has expired.",
        });
      }
      await ctx.db
        .update(users)
        .set({ emailVerifiedAt: new Date() })
        .where(eq(users.id, result.userId));
      return { ok: true };
    }),

  /** Request a password-reset email. Always succeeds (no account enumeration). */
  requestPasswordReset: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ ctx, input }) => {
      const { success } = rateLimit({
        key: `pwreset:${input.email}`,
        limit: 5,
        windowMs: 3600000,
      });
      if (!success) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Too many requests. Please try again later.",
        });
      }

      const [user] = await ctx.db
        .select({ id: users.id, email: users.email, name: users.name })
        .from(users)
        .where(eq(users.email, input.email))
        .limit(1);

      if (user) {
        try {
          const token = await createAuthToken({
            userId: user.id,
            email: user.email,
            type: "password_reset",
          });
          await sendPasswordResetEmail({
            to: user.email,
            name: user.name,
            resetUrl: `${appBaseUrl()}/reset-password?token=${token}`,
          });
        } catch (err) {
          console.error("[requestPasswordReset] email failed:", err);
        }
      }
      // Generic response regardless of whether the email exists.
      return { ok: true };
    }),

  /** Complete a password reset with a valid token. */
  resetPassword: publicProcedure
    .input(
      z.object({
        token: z.string().min(1),
        password: z.string().min(8),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await consumeAuthToken(input.token, "password_reset");
      if (!result) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This reset link is invalid or has expired.",
        });
      }
      const passwordHash = await hash(input.password, 10);
      await ctx.db
        .update(users)
        .set({ passwordHash })
        .where(eq(users.id, result.userId));
      return { ok: true };
    }),

  me: protectedProcedure.query(async ({ ctx }) => {
    const [user] = await ctx.db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        practiceId: users.practiceId,
        avatarUrl: users.avatarUrl,
      })
      .from(users)
      .where(eq(users.id, ctx.user.id))
      .limit(1);

    return user;
  }),
});
