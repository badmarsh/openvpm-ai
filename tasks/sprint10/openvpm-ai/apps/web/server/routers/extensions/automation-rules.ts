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

    return rules.map((r) => ({
      ...r,
      enabled: r.isActive,
    }));
  }),

  /**
   * Create a new automation rule.
   */
  create: protectedProcedure
    .input(
      z.object({
        ruleKey: z.string().max(100).optional(),
        name: z.string().min(1).max(255),
        description: z.string().max(1000).optional(),
        triggerEventType: z.string(),
        conditionJson: z.any().optional(),
        delayHours: z.number().int().min(0).default(0),
        actionType: z.enum([
          "create_journey",
          "send_communication",
          "create_task",
          "create_content_brief",
        ]),
        actionConfig: z.any().optional(),
        priority: z.number().int().min(1).max(1000).default(100),
        isActive: z.boolean().default(true),
        enabled: z.boolean().optional(),
        legalBasis: z.string().default("contract"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const active = input.enabled !== undefined ? input.enabled : input.isActive;
      const key =
        input.ruleKey ??
        `rule_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

      const [rule] = await ctx.db
        .insert(extAutomationRules)
        .values({
          practiceId: ctx.practiceId,
          ruleKey: key,
          name: input.name,
          description: input.description ?? "",
          triggerEventType: input.triggerEventType as any,
          conditionJson: (input.conditionJson ?? {}) as AutomationRuleCondition,
          delayHours: input.delayHours,
          actionType: input.actionType as any,
          actionConfig: (input.actionConfig ?? {}) as AutomationActionConfig,
          priority: input.priority,
          isActive: active,
          legalBasis: input.legalBasis,
          createdBy: ctx.user?.id ?? null,
        })
        .returning();

      return {
        ...rule,
        enabled: rule.isActive,
      };
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
        delayHours: z.number().int().min(0).optional(),
        actionType: z
          .enum([
            "create_journey",
            "send_communication",
            "create_task",
            "create_content_brief",
          ])
          .optional(),
        actionConfig: z.any().optional(),
        priority: z.number().int().min(1).max(1000).optional(),
        isActive: z.boolean().optional(),
        enabled: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, enabled, isActive, ...updates } = input;
      const active = enabled !== undefined ? enabled : isActive;

      const [updatedRule] = await ctx.db
        .update(extAutomationRules)
        .set({
          ...updates,
          ...(active !== undefined ? { isActive: active } : {}),
        })
        .where(
          and(
            eq(extAutomationRules.id, id),
            eq(extAutomationRules.practiceId, ctx.practiceId)
          )
        )
        .returning();

      if (!updatedRule) {
        throw new Error("Rule not found");
      }

      return {
        ...updatedRule,
        enabled: updatedRule.isActive,
      };
    }),

  /**
   * Toggle rule enabled/disabled.
   */
  toggle: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        enabled: z.boolean().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const active =
        input.enabled !== undefined
          ? input.enabled
          : (input.isActive ?? true);

      const [updatedRule] = await ctx.db
        .update(extAutomationRules)
        .set({ isActive: active })
        .where(
          and(
            eq(extAutomationRules.id, input.id),
            eq(extAutomationRules.practiceId, ctx.practiceId)
          )
        )
        .returning();

      if (!updatedRule) {
        throw new Error("Rule not found");
      }

      return {
        ...updatedRule,
        enabled: updatedRule.isActive,
      };
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
