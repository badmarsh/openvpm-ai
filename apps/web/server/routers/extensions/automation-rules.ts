/**
 * tRPC router for automation rules.
 *
 * Provides CRUD operations for ext_automation_rules.
 */

import { z } from "zod";
import { eq, and, desc, sql } from "drizzle-orm";
import { createRouter, protectedProcedure } from "../../trpc";
import { extAutomationRules } from "@openpims/db";
import type { AutomationRuleCondition, AutomationActionConfig } from "@openpims/db";

export const automationRulesRouter = createRouter({
  /**
   * List rules for current practice.
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const rules = await ctx.db
      .select()
      .from(extAutomationRules)
      .where(eq(extAutomationRules.practiceId, ctx.practiceId))
      .orderBy(extAutomationRules.priority);

    return rules;
  }),

  /**
   * Create a new automation rule.
   */
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        description: z.string().max(1000).optional(),
        triggerEvent: z.string(),
        conditionJson: z.any().optional(), // AutomationRuleCondition
        conditionSql: z.string().max(2000).optional(),
        actionType: z.enum(["create_journey", "send_communication", "create_task", "create_content_brief"]),
        actionJson: z.any(), // AutomationActionConfig
        priority: z.number().int().min(1).max(1000).default(100),
        enabled: z.boolean().default(true),
        ruleKey: z.string().max(100).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [rule] = await ctx.db
        .insert(extAutomationRules)
        .values({
          practiceId: ctx.practiceId,
          name: input.name,
          description: input.description,
          triggerEvent: input.triggerEvent as any,
          conditionJson: input.conditionJson as AutomationRuleCondition,
          conditionSql: input.conditionSql,
          actionType: input.actionType as any,
          actionJson: input.actionJson as AutomationActionConfig,
          priority: input.priority,
          enabled: input.enabled,
          ruleKey: input.ruleKey,
        })
        .returning();

      return rule;
    }),

  /**
   * Update an existing rule.
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().max(1000).optional(),
        conditionJson: z.any().optional(),
        conditionSql: z.string().max(2000).optional(),
        actionType: z.enum(["create_journey", "send_communication", "create_task", "create_content_brief"]).optional(),
        actionJson: z.any().optional(),
        priority: z.number().int().min(1).max(1000).optional(),
        enabled: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;

      const [rule] = await ctx.db
        .select()
        .from(extAutomationRules)
        .where(
          and(
            eq(extAutomationRules.id, id),
            eq(extAutomationRules.practiceId, ctx.practiceId)
          )
        )
        .limit(1);

      if (!rule) {
        throw new Error("Rule not found");
      }

      const [updatedRule] = await ctx.db
        .update(extAutomationRules)
        .set(updates)
        .where(eq(extAutomationRules.id, id))
        .returning();

      return updatedRule;
    }),

  /**
   * Toggle rule enabled/disabled.
   */
  toggle: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        enabled: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [rule] = await ctx.db
        .select()
        .from(extAutomationRules)
        .where(
          and(
            eq(extAutomationRules.id, input.id),
            eq(extAutomationRules.practiceId, ctx.practiceId)
          )
        )
        .limit(1);

      if (!rule) {
        throw new Error("Rule not found");
      }

      const [updatedRule] = await ctx.db
        .update(extAutomationRules)
        .set({ enabled: input.enabled })
        .where(eq(extAutomationRules.id, input.id))
        .returning();

      return updatedRule;
    }),

  /**
   * Delete a rule.
   */
  delete: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [rule] = await ctx.db
        .select()
        .from(extAutomationRules)
        .where(
          and(
            eq(extAutomationRules.id, input.id),
            eq(extAutomationRules.practiceId, ctx.practiceId)
          )
        )
        .limit(1);

      if (!rule) {
        throw new Error("Rule not found");
      }

      await ctx.db
        .delete(extAutomationRules)
        .where(eq(extAutomationRules.id, input.id));

      return { success: true };
    }),
});
