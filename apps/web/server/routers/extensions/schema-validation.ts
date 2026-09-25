import { z } from "zod";
import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, protectedProcedure, requireRole } from "../../trpc";
import { extSchemaValidationEvents, users } from "@openpims/db";
import {
  contractCount,
  isContractId,
  listContractSummaries,
  validateContract,
  withSchemaValidationFromInput,
} from "@/src/middleware/validation";
import type { SchemaContractId } from "@/src/middleware/validation";

/**
 * Sprint 27 — Schema Validation Middleware.
 *
 * Extension router exposing the VPM input contract registry, validation
 * statistics and the PHI-free audit trail of middleware verdicts, plus an
 * admin/veterinarian playground for dry-run validations.
 */

const viewProcedure = protectedProcedure.use(
  requireRole("admin", "veterinarian"),
);

export const schemaValidationRouter = createRouter({
  /** Master catalog of VPM input contracts (openvpm/schemas mirror). */
  listContracts: viewProcedure.query(() => {
    return listContractSummaries();
  }),

  /** Validation statistics for the KPI grid. */
  stats: viewProcedure
    .input(
      z.object({
        days: z.number().int().min(1).max(365).default(30),
      }),
    )
    .query(async ({ ctx, input }) => {
      const since = new Date(Date.now() - input.days * 86_400_000);

      const rows = await ctx.db
        .select({
          result: extSchemaValidationEvents.result,
          guardrail: extSchemaValidationEvents.guardrail,
          count: sql<number>`count(*)::int`.as("count"),
        })
        .from(extSchemaValidationEvents)
        .where(
          and(
            eq(extSchemaValidationEvents.practiceId, ctx.practiceId),
            isNull(extSchemaValidationEvents.deletedAt),
            gte(extSchemaValidationEvents.createdAt, since),
          ),
        )
        .groupBy(extSchemaValidationEvents.result, extSchemaValidationEvents.guardrail);

      let total = 0;
      let passed = 0;
      let rejected = 0;
      let guardrailBlocks = 0;
      for (const row of rows) {
        const count = Number(row.count) || 0;
        total += count;
        if (row.result === "passed") {
          passed += count;
        } else {
          rejected += count;
          if (row.guardrail) guardrailBlocks += count;
        }
      }

      const passRate = total > 0 ? Math.round((passed / total) * 1000) / 10 : null;

      return {
        days: input.days,
        total,
        passed,
        rejected,
        guardrailBlocks,
        passRate,
        contracts: contractCount(),
      };
    }),

  /** Recent validation events (audit trail), newest first. */
  listEvents: viewProcedure
    .input(
      z.object({
        contractId: z.string().optional(),
        result: z.enum(["passed", "rejected"]).optional(),
        guardrailOnly: z.boolean().default(false),
        limit: z.number().int().min(1).max(200).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(extSchemaValidationEvents.practiceId, ctx.practiceId),
        isNull(extSchemaValidationEvents.deletedAt),
      ];
      if (input.contractId && isContractId(input.contractId)) {
        conditions.push(
          eq(extSchemaValidationEvents.contractId, input.contractId),
        );
      }
      if (input.result) {
        conditions.push(eq(extSchemaValidationEvents.result, input.result));
      }

      const rows = await ctx.db
        .select({
          id: extSchemaValidationEvents.id,
          contractId: extSchemaValidationEvents.contractId,
          schemaVersion: extSchemaValidationEvents.schemaVersion,
          result: extSchemaValidationEvents.result,
          issueCount: extSchemaValidationEvents.issueCount,
          guardrail: extSchemaValidationEvents.guardrail,
          issues: extSchemaValidationEvents.issues,
          origin: extSchemaValidationEvents.origin,
          createdAt: extSchemaValidationEvents.createdAt,
          actorName: users.name,
        })
        .from(extSchemaValidationEvents)
        .leftJoin(
          users,
          eq(users.id, extSchemaValidationEvents.actorUserId),
        )
        .where(and(...conditions))
        .orderBy(desc(extSchemaValidationEvents.createdAt))
        .limit(input.limit);

      return rows.filter((row) => !input.guardrailOnly || Boolean(row.guardrail));
    }),

  /**
   * Playground: dry-run a payload against a contract without persisting it.
   * Returns the full normalized outcome (issues + guardrails).
   */
  validatePayload: viewProcedure
    .input(
      z.object({
        contractId: z.string(),
        payload: z.unknown(),
      }),
    )
    .mutation(({ input }) => {
      if (!isContractId(input.contractId)) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Unknown VPM schema contract: ${input.contractId}`,
        });
      }
      const contractId = input.contractId as SchemaContractId;
      const outcome = validateContract(contractId, input.payload);
      return {
        ok: outcome.ok,
        contractId: outcome.contractId,
        schemaVersion: outcome.schemaVersion,
        result: outcome.result,
        issues: outcome.issues,
        triggeredGuardrails: outcome.triggeredGuardrails,
      };
    }),

  /**
   * Enforced ingestion: the schema validation middleware rejects the call at
   * the tRPC boundary before the resolver runs. Invalid payloads never reach
   * application code; valid ones are acknowledged with the contract verdict.
   */
  submitPayload: viewProcedure
    .use(withSchemaValidationFromInput())
    .input(
      z.object({
        contractId: z.string(),
        payload: z.unknown(),
      }),
    )
    .mutation(({ input }) => {
      return {
        ok: true as const,
        contractId: input.contractId,
        result: "passed" as const,
      };
    }),
});
