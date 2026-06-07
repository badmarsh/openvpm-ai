import { initTRPC, TRPCError } from "@trpc/server";
import type { Session } from "next-auth";
import { getServerSession } from "next-auth";
import superjson from "superjson";
import { ZodError } from "zod";
import { authOptions } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";
import { db } from "@openpims/db/client";
import type { Database } from "@openpims/db/client";

type UserRole =
  | "admin"
  | "veterinarian"
  | "technician"
  | "front_desk"
  | "viewer";

interface AppSession extends Session {
  user: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    practiceId: string;
  };
}

export type TRPCContext = {
  db: Database;
  session: AppSession | null;
  ip?: string | null;
};

function clientIp(req?: Request): string | null {
  if (!req) return null;
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim().slice(0, 45);
  return req.headers.get("x-real-ip")?.slice(0, 45) ?? null;
}

export async function createTRPCContext(opts?: {
  req?: Request;
}): Promise<TRPCContext> {
  const session = (await getServerSession(authOptions)) as AppSession | null;
  return { db, session, ip: clientIp(opts?.req) };
}

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const createRouter = t.router;
export const publicProcedure = t.procedure;

/** Requires an authenticated session */
export const protectedProcedure = t.procedure.use(
  async ({ ctx, next, type, path, getRawInput }) => {
    if (!ctx.session?.user) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    // Global read-only guard: viewers can run any query but no mutation. This
    // makes the role enforceable everywhere without touching each router.
    if (type === "mutation" && ctx.session.user.role === "viewer") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Your account has read-only (viewer) access.",
      });
    }

    const user = ctx.session.user;
    const result = await next({
      ctx: { session: ctx.session, user, practiceId: user.practiceId },
    });

    // Audit every successful mutation: who changed what, when, from where.
    // Fire-and-forget — never block or fail the request on the audit write.
    if (type === "mutation" && result.ok) {
      const rawInput = await getRawInput().catch(() => undefined);
      void recordAuditLog(ctx.db, {
        practiceId: user.practiceId,
        userId: user.id,
        ip: ctx.ip,
        path,
        rawInput,
        resultData: (result as { data?: unknown }).data,
      });
    }

    return result;
  }
);

/** Requires specific roles */
export function requireRole(...roles: UserRole[]) {
  return t.middleware(async ({ ctx, next }) => {
    if (!ctx.session?.user) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    if (!roles.includes(ctx.session.user.role)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Requires one of: ${roles.join(", ")}`,
      });
    }
    return next({
      ctx: {
        session: ctx.session,
        user: ctx.session.user,
        practiceId: ctx.session.user.practiceId,
      },
    });
  });
}
