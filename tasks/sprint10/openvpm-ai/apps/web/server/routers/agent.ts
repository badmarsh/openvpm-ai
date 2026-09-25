import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, eq, isNull } from "drizzle-orm";
import {
  createRouter,
  protectedProcedure,
  requireFeature,
  requireRole,
} from "../trpc";
import { practices } from "@openpims/db";
import type { Database } from "@openpims/db/client";
import {
  runAgent,
  isAgentConfigured,
  AGENT_TOOL_NAMES,
  AgentNotConfiguredError,
  AgentBillingAccessError,
  AgentPracticeNotFoundError,
  AgentRateLimitedError,
  AgentRecoveryHoldError,
} from "@/lib/agent";
import { AGENT_INSTRUCTION_MAX_LENGTH } from "@/lib/agent/policy";
import {
  PrescriptionProposalError,
  createConfirmedPrescription,
} from "@/lib/records/prescription-proposal";
import { billingEnforced } from "@/lib/billing/plans";
import { readHostedAiAccess } from "@/lib/billing/ai-access";
import {
  resolvePracticeLanguageModel,
  getPracticeAiConfig,
} from "@/lib/ai/ai-config-resolver";

export { AGENT_INSTRUCTION_MAX_LENGTH } from "@/lib/agent/policy";

// The OpenVPM Agent is a Cloud feature on hosted; unrestricted on self-host.
const agentProcedure = protectedProcedure
  .use(requireRole("admin", "veterinarian"))
  .use(requireFeature("agent"));

type AgentContext = {
  db: Database;
  practiceId: string;
};

function activePracticeWhere(practiceId: string) {
  return and(eq(practices.id, practiceId), isNull(practices.deletedAt));
}

function practiceNotFound(): TRPCError {
  return new TRPCError({ code: "NOT_FOUND", message: "Practice not found" });
}

async function assertActivePractice(ctx: AgentContext) {
  const [practice] = await ctx.db
    .select({ id: practices.id })
    .from(practices)
    .where(activePracticeWhere(ctx.practiceId))
    .limit(1);

  if (!practice) {
    throw practiceNotFound();
  }
}

export const agentRouter = createRouter({
  /** Whether the agent is enabled (API key present) and what it can do. */
  status: protectedProcedure.query(async ({ ctx }) => {
    const hosted = billingEnforced();
    const access = await readHostedAiAccess(ctx.db, ctx.practiceId, {
      enforced: hosted,
    });
    if (!access) throw practiceNotFound();

    const practiceConfig = await getPracticeAiConfig(ctx.db, ctx.practiceId);
    const hasPracticeAi = Boolean(
      practiceConfig &&
        practiceConfig.isActive &&
        (practiceConfig.geminiIsActive ||
          practiceConfig.openaiIsActive ||
          practiceConfig.alibabaIsActive),
    );

    return {
      configured: hasPracticeAi || isAgentConfigured(),
      // Hosted users get a friendly "unavailable" message when unconfigured;
      // self-host admins get env-var instructions they can act on.
      hosted,
      canUseAi: access.allowed,
      needsBillingSetup: access.reason === "billing_setup_required",
      accessMessage: access.message,
      tools: AGENT_TOOL_NAMES,
    };
  }),

  /** Run the OpenVPM Agent against a natural-language instruction. */
  run: agentProcedure
    .input(
      z.object({
        instruction: z.string().trim().min(1).max(AGENT_INSTRUCTION_MAX_LENGTH),
        // Writes (e.g. booking) are opt-in per run and require an explicit flag.
        allowWrites: z.boolean().default(false),
        // Enable deep thinking / clinical consilium mode (e.g. Gemini 3.1 Pro)
        deepThinking: z.boolean().default(false).optional(),
        // Prior turns (oldest first) for multi-turn chat. Bounded to keep the
        // prompt small; the client sends a trailing window of the conversation.
        history: z
          .array(
            z.object({
              role: z.enum(["user", "assistant"]),
              content: z
                .string()
                .trim()
                .min(1)
                .max(8000),
            }),
          )
          .max(20)
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertActivePractice(ctx);
      if (input.allowWrites) {
        console.info(
          `[audit:agent_writes_enabled] Practice: ${ctx.practiceId}, User: ${ctx.user.id} (${ctx.session.user.role}), Instruction length: ${input.instruction.length}`,
        );
      }
      try {
        let practiceLanguageModel: any = undefined;
        try {
          practiceLanguageModel = await resolvePracticeLanguageModel(
            ctx.db,
            ctx.practiceId,
            input.deepThinking ? "deepThinking" : "assistant",
          );
        } catch (err) {
          // Log resolution errors but do NOT re-throw; the outer catch handles
          // agent-specific errors (rate limits, practice not found, etc.) and
          // runAgent falls back gracefully when no practice model is resolved.
          console.warn(
            "[agent.run] Practice language model resolution fallback:",
            err instanceof Error ? err.message : err,
          );
        }

        return await runAgent({
          instruction: input.instruction,
          allowWrites: input.allowWrites,
          history: input.history,
          model: practiceLanguageModel,
          context: {
            db: ctx.db,
            practiceId: ctx.practiceId,
            userId: ctx.user.id,
            // AgentToolContext.userRole drives the fail-closed tool-level
            // assertAgentRole() checks; without it every role-gated tool
            // denies with "an authenticated role is required".
            userRole: ctx.session.user.role,
            postCommitEffect: ctx.postCommitEffect,
          },
        });
      } catch (e) {
        if (e instanceof AgentBillingAccessError) {
          throw new TRPCError({ code: "FORBIDDEN", message: e.message });
        }
        if (e instanceof AgentNotConfiguredError) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: e.message,
          });
        }
        if (e instanceof AgentRateLimitedError) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: e.message,
          });
        }
        if (e instanceof AgentRecoveryHoldError) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: e.message,
          });
        }
        if (e instanceof AgentPracticeNotFoundError) {
          throw practiceNotFound();
        }
        console.error("[agent.run] Agent execution error:", e);
        const rawMsg = e instanceof Error ? e.message : "Agent run failed";
        let clientMsg = rawMsg;
        if (
          rawMsg.includes("Service Unavailable") ||
          rawMsg.includes("Proxy service is currently disabled") ||
          rawMsg.includes("ECONNREFUSED")
        ) {
          clientMsg =
            "AI Proxy služba nie je spustená (port 8045 - Service Unavailable). Prosím otvorte aplikáciu Antigravity Tools a zapnite v nej Proxy službu.";
        } else if (
          rawMsg.includes("很抱歉") ||
          rawMsg.includes("调取实时信息") ||
          rawMsg.includes("格式异常") ||
          rawMsg.includes("-online") ||
          rawMsg.includes("联网模式")
        ) {
          clientMsg =
            "AI asistent zaznamenal dočasnú chybu pri formátovaní odpovede z proxy modelu. Skúste prosím otázku zopakovať.";
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: clientMsg,
        });
      }
    }),

  /**
   * Writes the prescription proposed by the `create_prescription` agent tool,
   * after a veterinarian confirmed it in the UI. The one-time confirmation
   * envelope issued during preparation is consumed here, in the same
   * transaction as the INSERT, so a proposal can only ever be materialised
   * once and only by the clinician it was issued to. Controlled substances are
   * refused (zero AI prefill).
   */
  savePrescription: agentProcedure
    .input(
      z.object({
        confirmationId: z.string().uuid(),
        prescriptionId: z.string().uuid(),
        patientId: z.string().uuid(),
        medicationName: z.string().trim().min(1).max(255),
        dosage: z.string().trim().min(1).max(128),
        frequency: z.string().trim().min(1).max(128),
        instructions: z.string().max(2000).optional(),
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertActivePractice(ctx);
      try {
        return await createConfirmedPrescription(ctx.db, {
          practiceId: ctx.practiceId,
          actorId: ctx.user.id,
          actorName: ctx.user.name ?? ctx.user.email ?? "Clinician",
          actorRole: ctx.session.user.role,
          confirmationId: input.confirmationId,
          prescriptionId: input.prescriptionId,
          draft: {
            patientId: input.patientId,
            medicationName: input.medicationName,
            dosage: input.dosage,
            frequency: input.frequency,
            instructions: input.instructions ?? null,
            startDate: input.startDate,
          },
        });
      } catch (error) {
        if (error instanceof PrescriptionProposalError) {
          const code =
            error.code === "FORBIDDEN"
              ? "FORBIDDEN"
              : error.code === "NOT_FOUND"
                ? "NOT_FOUND"
                : error.code === "CONFLICT"
                  ? "CONFLICT"
                  : "PRECONDITION_FAILED";
          throw new TRPCError({ code, message: error.message });
        }
        throw error;
      }
    }),
});
