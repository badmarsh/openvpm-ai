import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createRouter, protectedProcedure, requireRole } from "../trpc";
import {
  runAgent,
  isAgentConfigured,
  AGENT_TOOL_NAMES,
  AgentNotConfiguredError,
} from "@/lib/agent";

const agentProcedure = protectedProcedure.use(
  requireRole("admin", "veterinarian")
);

export const agentRouter = createRouter({
  /** Whether the agent is enabled (API key present) and what it can do. */
  status: protectedProcedure.query(() => ({
    configured: isAgentConfigured(),
    tools: AGENT_TOOL_NAMES,
  })),

  /** Run the OpenVPM Agent against a natural-language instruction. */
  run: agentProcedure
    .input(
      z.object({
        instruction: z.string().min(1).max(2000),
        // Writes (e.g. booking) are opt-in per run and require an explicit flag.
        allowWrites: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await runAgent({
          instruction: input.instruction,
          allowWrites: input.allowWrites,
          context: {
            db: ctx.db,
            practiceId: ctx.practiceId,
            userId: ctx.user.id,
          },
        });
      } catch (e) {
        if (e instanceof AgentNotConfiguredError) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: e.message });
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: e instanceof Error ? e.message : "Agent run failed",
        });
      }
    }),
});
