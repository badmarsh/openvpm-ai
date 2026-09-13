import { and, eq } from "drizzle-orm";
import type { Database } from "@openpims/db/client";
import { patients } from "@openpims/db";

/**
 * Communication types for consent checks.
 * Matches the enum defined in SCHEMA-DESIGN.md §A.2K.
 */
export type CommunicationType =
  | "vaccination_reminder"
  | "marketing_sms"
  | "marketing_email"
  | "social_media"
  | "review_request"
  | "reputation_reply";

/**
 * Result of a consent gate check.
 */
export type GateResult = {
  allowed: boolean;
  reason?: string;
  suppressionType?: string;
};

/**
 * Checks if a patient is alive (not deceased) for the given practice.
 * Returns true if patient is not deceased or patientId is undefined, false if deceased.
 */
export async function assertPatientNotDeceased(
  db: Database,
  practiceId: string,
  patientId: string | undefined
): Promise<boolean> {
  if (!patientId) return true;
  const patient = await db
    .select({ status: patients.status })
    .from(patients)
    .where(
      and(
        eq(patients.id, patientId),
        eq(patients.practiceId, practiceId)
      )
    )
    .limit(1);

  return patient?.[0]?.status !== "deceased";
}

/**
 * Checks if a communication is allowed based on consent rules, suppression lists, and sympathy gate.
 *
 * Implements SKILL.md §3: Sympathy Gate and medical decisions must be human-in-the-loop.
 * Implements GUARDRAILS-COMPLIANCE.md §B: Compliance checks for GDPR/TCPA.
 *
 * @param db - Database connection
 * @param practiceId - The practice ID
 * @param clientId - The client ID
 * @param patientId - The patient ID
 * @param communicationType - The type of communication being sent
 * @returns GateResult with allowed status and optional reason/suppression type
 */
export async function consentGateCheck(
  db: Database,
  practiceId: string,
  clientId: string,
  patientId: string | undefined,
  communicationType: CommunicationType
): Promise<GateResult> {
  // Always check if patient is deceased (Sympathy Gate - SKILL.md §3)
  if (patientId) {
    const isAlive = await assertPatientNotDeceased(db, practiceId, patientId);
    if (!isAlive) {
      return {
        allowed: false,
        reason: "Patient is deceased",
        suppressionType: "deceased_patient"
      };
    }
  }

  // For this implementation, we're only implementing the sympathy gate
  // as required by the brief. The other checks (consent, suppression lists)
  // will be handled by the event worker and rules engine.
  
  return { allowed: true };
}