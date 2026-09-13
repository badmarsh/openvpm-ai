/**
 * Journey engine v1 for automation.
 *
 * Manages multi-step client journeys (enrollment, step execution, pause/resume/cancel).
 *
 * Architecture:
 * - enrollInJourney: enrolls a client in a journey
 * - advanceJourney: advances enrollment to next step
 * - Each step: waits for availableAt, evaluates branch condition, executes action, moves to next step
 *
 * See ARCHITECTURE-RESEARCH.md §D for full design.
 */

import { and, eq, desc, sql, isNull, lte } from "drizzle-orm";
import type { Database } from "@openpims/db/client";
import {
  extAutomationJourneys,
  extAutomationEnrollments,
  extAutomationStepExecutions,
  extAutomationEnrollmentStatusEnum,
  extAutomationStepStatusEnum,
  type AutomationJourneyStep,
} from "@openpims/db";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type JourneyEnrollment = typeof extAutomationEnrollments.$inferSelect;
export type JourneyStep = AutomationJourneyStep;

// ---------------------------------------------------------------------------
// Main enrollment function
// ---------------------------------------------------------------------------

/**
 * Enroll a client in a journey.
 *
 * @param db - Database connection
 * @param clientId - Client to enroll
 * @param journeyKey - Journey key (e.g. "vaccination_recall")
 * @param practiceId - Practice UUID
 * @returns void
 */
export async function enrollInJourney(
  db: Database,
  clientId: string,
  journeyKey: string,
  practiceId: string,
  patientId?: string,
  triggeringEventId?: string
): Promise<void> {
  // Find journey by key
  const [journey] = await db
    .select()
    .from(extAutomationJourneys)
    .where(
      and(
        eq(extAutomationJourneys.practiceId, practiceId),
        eq(extAutomationJourneys.journeyKey, journeyKey),
        eq(extAutomationJourneys.isActive, true)
      )
    )
    .limit(1);

  if (!journey) {
    console.warn(`[journey-engine] Journey not found: ${journeyKey}`);
    return;
  }

  // Check enrollment cap
  if (journey.frequencyCapMaxSteps) {
    const windowDays = journey.frequencyCapWindowDays ?? 30;
    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - windowDays);

    const [enrollmentCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(extAutomationEnrollments)
      .where(
        and(
          eq(extAutomationEnrollments.practiceId, practiceId),
          eq(extAutomationEnrollments.clientId, clientId),
          eq(extAutomationEnrollments.journeyId, journey.id),
          sql`${extAutomationEnrollments.createdAt} >= ${windowStart}`
        )
      )
      .limit(1);

    if (enrollmentCount && enrollmentCount.count >= journey.frequencyCapMaxSteps) {
      console.log(
        `[journey-engine] Client ${clientId} already at enrollment cap for journey ${journeyKey}`
      );
      return;
    }
  }

  if (!triggeringEventId) {
    console.warn(
      `[journey-engine] Cannot enroll in journey ${journeyKey} without triggerEventId`
    );
    return;
  }

  await db
    .insert(extAutomationEnrollments)
    .values({
      practiceId,
      clientId,
      patientId,
      journeyId: journey.id,
      journeyVersion: journey.version,
      triggerEventId: triggeringEventId,
      status: "active",
      currentStepIndex: 0,
    })
    .onConflictDoNothing();
}

// ---------------------------------------------------------------------------
// Journey advancement
// ---------------------------------------------------------------------------

/**
 * Advance all active enrollments that are ready for their next step.
 *
 * This is called by the event worker after processing events.
 *
 * @param db - Database connection
 * @param clientId - Optional: advance only this client's enrollments
 * @param practiceId - Optional: filter by practice
 */
export async function advanceJourney(
  db: Database,
  clientId?: string,
  practiceId?: string
): Promise<void> {
  const now = new Date();

  // Find enrollments ready for advancement
  const whereClauses = [
    eq(extAutomationEnrollments.status, "active" as const),
    isNull(extAutomationEnrollments.deletedAt),
  ];

  if (clientId) {
    whereClauses.push(eq(extAutomationEnrollments.clientId, clientId));
  }

  if (practiceId) {
    whereClauses.push(eq(extAutomationEnrollments.practiceId, practiceId));
  }

  const enrollments = await db
    .select()
    .from(extAutomationEnrollments)
    .where(and(...whereClauses));

  for (const enrollment of enrollments) {
    try {
      await advanceSingleEnrollment(db, enrollment, now);
    } catch (error) {
      console.error(
        `[journey-engine] Failed to advance enrollment ${enrollment.id}:`,
        error
      );
    }
  }
}

/**
 * Advance a single enrollment to its next step.
 */
async function advanceSingleEnrollment(
  db: Database,
  enrollment: JourneyEnrollment,
  now: Date
): Promise<void> {
  // Load journey
  const [journey] = await db
    .select()
    .from(extAutomationJourneys)
    .where(eq(extAutomationJourneys.id, enrollment.journeyId))
    .limit(1);

  if (!journey) {
    console.warn(
      `[journey-engine] Journey ${enrollment.journeyId} not found for enrollment ${enrollment.id}`
    );
    return;
  }

  const steps = journey.steps as JourneyStep[];
  const currentStepIndex = enrollment.currentStepIndex;

  if (currentStepIndex >= steps.length) {
    // Journey completed
    await completeJourney(db, enrollment);
    return;
  }

  const currentStep = steps[currentStepIndex];

  // Execute current step
  await executeJourneyStep(db, enrollment, currentStep, now);

  // Move to next step
  const nextStep = steps[currentStepIndex + 1];
  if (nextStep) {
    // Calculate next step available time
    const nextAvailableAt = new Date(now);
    if (nextStep.delayHours) {
      nextAvailableAt.setHours(nextAvailableAt.getHours() + nextStep.delayHours);
    }

    await db
      .update(extAutomationEnrollments)
      .set({
        currentStepIndex: currentStepIndex + 1,
        lastStepExecutedAt: now,
      })
      .where(eq(extAutomationEnrollments.id, enrollment.id));
  } else {
    // No more steps - journey completed
    await completeJourney(db, enrollment);
  }
}

/**
 * Execute a single journey step.
 */
async function executeJourneyStep(
  db: Database,
  enrollment: JourneyEnrollment,
  step: JourneyStep,
  now: Date
): Promise<void> {
  const [stepExecution] = await db
    .insert(extAutomationStepExecutions)
    .values({
      practiceId: enrollment.practiceId,
      enrollmentId: enrollment.id,
      stepIndex: step.index,
      scheduledAt: now,
      status: "executing",
    })
    .returning();

  try {
    switch (step.kind) {
      case "wait":
        // Wait step - no action, just delay
        await markStepComplete(db, stepExecution.id, "done");
        break;

      case "send":
        // Send communication step
        await executeSendStep(db, enrollment, step, stepExecution.id, now);
        break;

      case "task":
        // Create staff task step
        await executeTaskStep(db, enrollment, step, stepExecution.id, now);
        break;

      case "content_brief":
        // Create content brief step
        await executeContentBriefStep(db, enrollment, step, stepExecution.id, now);
        break;

      case "condition":
        // Branch condition step
        await executeConditionStep(db, enrollment, step, stepExecution.id);
        break;

      case "exit":
        // Exit journey
        await exitJourney(db, enrollment, step.exitOnSuppression?.join(", "));
        break;

      default:
        console.warn(
          `[journey-engine] Unknown step kind: ${step.kind}`
        );
        await markStepComplete(db, stepExecution.id, "skipped", "Unknown step kind");
    }
  } catch (error) {
    await markStepComplete(
      db,
      stepExecution.id,
      "failed",
      error instanceof Error ? error.message : "Unknown error"
    );
    throw error;
  }
}

/**
 * Execute a "send" step (SMS/email communication).
 */
async function executeSendStep(
  db: Database,
  enrollment: JourneyEnrollment,
  step: JourneyStep,
  stepExecutionId: string,
  now: Date
): Promise<void> {
  // This would integrate with ext_marketing_message_logs
  // For now, placeholder - actual implementation in TASK-6
  console.log(
    `[journey-engine] Send step for enrollment ${enrollment.id}, template: ${step.templateKey}`
  );

  await markStepComplete(db, stepExecutionId, "done");
}

/**
 * Execute a "task" step (staff task creation).
 */
async function executeTaskStep(
  db: Database,
  enrollment: JourneyEnrollment,
  step: JourneyStep,
  stepExecutionId: string,
  now: Date
): Promise<void> {
  // This would integrate with ext_marketing_staff_tasks
  console.log(
    `[journey-engine] Task step for enrollment ${enrollment.id}, kind: ${step.taskKind}`
  );

  await markStepComplete(db, stepExecutionId, "done");
}

/**
 * Execute a "content_brief" step.
 */
async function executeContentBriefStep(
  db: Database,
  enrollment: JourneyEnrollment,
  step: JourneyStep,
  stepExecutionId: string,
  now: Date
): Promise<void> {
  // This would integrate with ext_content_briefs
  console.log(
    `[journey-engine] Content brief step for enrollment ${enrollment.id}, pillar: ${step.pillarKey}`
  );

  await markStepComplete(db, stepExecutionId, "done");
}

/**
 * Execute a "condition" step (branch evaluation).
 */
async function executeConditionStep(
  db: Database,
  enrollment: JourneyEnrollment,
  step: JourneyStep,
  stepExecutionId: string
): Promise<void> {
  // Evaluate branch condition from whenJson
  // For now, placeholder - actual implementation needs event payload access
  console.log(
    `[journey-engine] Condition step for enrollment ${enrollment.id}`
  );

  await markStepComplete(db, stepExecutionId, "done");
}

/**
 * Mark a step execution as complete.
 */
async function markStepComplete(
  db: Database,
  stepExecutionId: string,
  status: "done" | "skipped" | "failed",
  outcomeReason?: string
): Promise<void> {
  const updateData: Record<string, any> = {
    status: status as any,
  };
  if (status === "done") {
    updateData.executedAt = new Date();
  } else if (status === "skipped") {
    updateData.skippedAt = new Date();
    updateData.skipReason = outcomeReason;
  } else if (status === "failed") {
    updateData.failureReason = outcomeReason;
  }

  await db
    .update(extAutomationStepExecutions)
    .set(updateData)
    .where(eq(extAutomationStepExecutions.id, stepExecutionId));
}

/**
 * Mark journey as completed.
 */
async function completeJourney(
  db: Database,
  enrollment: JourneyEnrollment
): Promise<void> {
  await db
    .update(extAutomationEnrollments)
    .set({
      status: "completed",
      exitReason: "Journey completed successfully",
    })
    .where(eq(extAutomationEnrollments.id, enrollment.id));
}

/**
 * Exit journey early (e.g. due to suppression).
 */
async function exitJourney(
  db: Database,
  enrollment: JourneyEnrollment,
  reason?: string
): Promise<void> {
  await db
    .update(extAutomationEnrollments)
    .set({
      status: "exited",
      exitReason: reason,
    })
    .where(eq(extAutomationEnrollments.id, enrollment.id));
}

// ---------------------------------------------------------------------------
// Pause/Resume/Cancel
// ---------------------------------------------------------------------------

/**
 * Pause an active enrollment.
 */
export async function pauseJourney(
  db: Database,
  enrollmentId: string,
  practiceId: string
): Promise<void> {
  await db
    .update(extAutomationEnrollments)
    .set({
      status: "paused",
    })
    .where(
      and(
        eq(extAutomationEnrollments.id, enrollmentId),
        eq(extAutomationEnrollments.practiceId, practiceId)
      )
    );
}

/**
 * Resume a paused enrollment.
 */
export async function resumeJourney(
  db: Database,
  enrollmentId: string,
  practiceId: string
): Promise<void> {
  await db
    .update(extAutomationEnrollments)
    .set({
      status: "active",
    })
    .where(
      and(
        eq(extAutomationEnrollments.id, enrollmentId),
        eq(extAutomationEnrollments.practiceId, practiceId)
      )
    );
}

/**
 * Cancel an enrollment permanently.
 */
export async function cancelJourney(
  db: Database,
  enrollmentId: string,
  practiceId: string,
  reason: string
): Promise<void> {
  await db
    .update(extAutomationEnrollments)
    .set({
      status: "exited",
      exitReason: reason,
    })
    .where(
      and(
        eq(extAutomationEnrollments.id, enrollmentId),
        eq(extAutomationEnrollments.practiceId, practiceId)
      )
    );
}
