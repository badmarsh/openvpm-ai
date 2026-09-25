import { and, eq, isNull } from "drizzle-orm";
import type { Database } from "@openpims/db/client";
import { patients, clients, extMarketingMediaConsents } from "@openpims/db";

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
        eq(patients.practiceId, practiceId),
        isNull(patients.deletedAt)
      )
    )
    .limit(1);

  return patient?.[0]?.status !== "deceased";
}

/**
 * Checks if a communication is allowed based on consent rules, suppression lists, and sympathy gate.
 *
 * Implements SKILL.md §3: Sympathy Gate and medical decisions must be human-in-the-loop.
 * Implements GUARDRAILS-COMPLIANCE.md §B & Slovak statutory electronic marketing rules (Zákon č. 452/2021 Z. z. & GDPR).
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
  // 1. Always check if patient is deceased (Sympathy Gate - SKILL.md §3)
  if (patientId) {
    const isAlive = await assertPatientNotDeceased(db, practiceId, patientId);
    if (!isAlive) {
      return {
        allowed: false,
        reason: "Patient is deceased",
        suppressionType: "deceased_patient",
      };
    }
  }

  // 2. Marketing consent gate (GDPR & Zákon č. 452/2021 Z. z. § 116)
  // Direct marketing outreach requires opt-in consent before dispatch.
  if (communicationType === "marketing_sms") {
    const [client] = await db
      .select({ smsConsent: clients.smsConsent })
      .from(clients)
      .where(
        and(
          eq(clients.id, clientId),
          eq(clients.practiceId, practiceId),
          isNull(clients.deletedAt)
        )
      )
      .limit(1);

    if (!client || !client.smsConsent) {
      return {
        allowed: false,
        reason: "Klient neudelil marketingový súhlas na SMS komunikáciu.",
        suppressionType: "opt_out",
      };
    }
  }

  if (communicationType === "marketing_email") {
    const [consent] = await db
      .select({ id: extMarketingMediaConsents.id })
      .from(extMarketingMediaConsents)
      .where(
        and(
          eq(extMarketingMediaConsents.practiceId, practiceId),
          eq(extMarketingMediaConsents.clientId, clientId),
          eq(extMarketingMediaConsents.scope, "marketing_messages"),
          isNull(extMarketingMediaConsents.revokedAt),
          isNull(extMarketingMediaConsents.deletedAt)
        )
      )
      .limit(1);

    if (!consent) {
      return {
        allowed: false,
        reason: "Klient neudelil marketingový súhlas na e-mailovú komunikáciu.",
        suppressionType: "opt_out",
      };
    }
  }

  return { allowed: true };
}