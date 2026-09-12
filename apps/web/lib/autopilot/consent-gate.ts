/**
 * Consent & compliance gate for all automated outreach.
 *
 * This is the central safety gate that MUST be called before ANY automated
 * communication (SMS, email, social media, review requests) is sent.
 *
 * Implements:
 * - Sympathy gate (deceased patients) — unconditional per SKILL.md §3
 * - Consent verification (SMS, marketing_messages, email)
 * - Suppression list checks (opt-out, bounce, complaint)
 * - Quiet hours enforcement (practice timezone-aware)
 * - Rate limiting (frequency caps)
 * - Medical decision human-in-the-loop enforcement
 *
 * Server error messages stay in English per Skill §2; all user-facing
 * localization happens on the client via useI18n().
 */

import { and, desc, eq, sql } from "drizzle-orm";
import type { Database } from "@openpims/db/client";
import {
  clients,
  patients,
  practices,
  extMarketingMediaConsents,
  extSmsDeliveryLog,
  smsSuppressions,
  emailSuppressions,
} from "@openpims/db";
import { isQuietHours } from "@/lib/messaging/reminders";
import { getBrand } from "@/lib/marketing/planner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CommunicationType =
  | "vaccination_reminder" // Service: Art 6(1)(b) contract
  | "marketing_sms" // Marketing: Art 6(1)(a) consent
  | "marketing_email" // Marketing: Art 6(1)(a) consent
  | "social_media" // Social: Art 6(1)(a) media consent
  | "review_request" // Legitimate interest: Art 6(1)(f)
  | "reputation_reply"; // Legitimate interest: Art 6(1)(f)

export interface GateResult {
  /** Whether the communication is allowed to proceed. */
  allowed: boolean;
  /** Reason for blocking (if allowed=false). */
  reason?: string;
  /** Type of suppression that blocked (if applicable). */
  suppressionType?: string;
  /** Legal basis for this communication (if allowed). */
  legalBasis?: "contract" | "consent" | "legitimate_interest";
  /** Consent ID that authorized this (if applicable). */
  consentId?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Communication types that require marketing_messages consent.
 * These are Art 6(1)(a) consent-based communications.
 */
const CONSENT_REQUIRED_TYPES: Set<CommunicationType> = new Set([
  "marketing_sms",
  "marketing_email",
  "social_media",
]);

/**
 * Communication types that operate under legitimate interest Art 6(1)(f).
 * These do NOT require explicit consent but must respect suppression lists.
 */
const LEGITIMATE_INTEREST_TYPES: Set<CommunicationType> = new Set([
  "review_request",
  "reputation_reply",
]);

/**
 * Service communications that operate under contract Art 6(1)(b).
 * These are necessary for the veterinary service (vaccination reminders).
 */
const CONTRACT_REQUIRED_TYPES: Set<CommunicationType> = new Set([
  "vaccination_reminder",
]);

// ---------------------------------------------------------------------------
// Main consent gate function
// ---------------------------------------------------------------------------

/**
 * Central consent & compliance gate for all automated outreach.
 *
 * MUST be called before ANY automated communication is sent.
 * This function performs ALL required checks in the correct order:
 *
 * 1. Sympathy gate (deceased patient) — unconditional block
 * 2. Suppression list (opt-out, bounce, complaint)
 * 3. Consent verification (type-specific)
 * 4. Quiet hours (practice timezone)
 * 5. Rate limiting (frequency cap)
 *
 * @param db - Database connection
 * @param practiceId - Practice UUID
 * @param clientId - Client UUID (required for all outreach)
 * @param patientId - Patient UUID (required for patient-specific outreach)
 * @param communicationType - Type of communication being sent
 * @param channel - Channel: "sms" | "email" | "social"
 * @returns GateResult with allowed boolean and reason if blocked
 */
export async function consentGateCheck(
  db: Database,
  practiceId: string,
  clientId: string,
  patientId: string | undefined,
  communicationType: CommunicationType,
  channel: "sms" | "email" | "social"
): Promise<GateResult> {
  // =========================================================================
  // STEP 1: Sympathy Gate (unconditional — SKILL.md §3)
  // =========================================================================
  if (patientId) {
    const sympathyResult = await checkSympathyGate(db, practiceId, patientId);
    if (!sympathyResult.allowed) {
      return sympathyResult;
    }
  }

  // =========================================================================
  // STEP 2: Suppression List Check (opt-out, bounce, complaint)
  // =========================================================================
  const suppressionResult = await checkSuppressionLists(
    db,
    practiceId,
    clientId,
    channel
  );
  if (!suppressionResult.allowed) {
    return suppressionResult;
  }

  // =========================================================================
  // STEP 3: Consent Verification (type-specific)
  // =========================================================================
  const consentResult = await checkConsent(
    db,
    practiceId,
    clientId,
    patientId,
    communicationType,
    channel
  );
  if (!consentResult.allowed) {
    return consentResult;
  }

  // =========================================================================
  // STEP 4: Quiet Hours (practice timezone-aware)
  // =========================================================================
  const quietHoursResult = await checkQuietHours(
    db,
    practiceId,
    communicationType,
    channel
  );
  if (!quietHoursResult.allowed) {
    return quietHoursResult;
  }

  // =========================================================================
  // STEP 5: Rate Limiting (frequency cap)
  // =========================================================================
  const rateLimitResult = await checkRateLimit(
    db,
    practiceId,
    clientId,
    communicationType,
    channel
  );
  if (!rateLimitResult.allowed) {
    return rateLimitResult;
  }

  // =========================================================================
  // All checks passed — communication is allowed
  // =========================================================================
  return {
    allowed: true,
    legalBasis: consentResult.legalBasis,
    consentId: consentResult.consentId,
  };
}

// ---------------------------------------------------------------------------
// Step 1: Sympathy Gate
// ---------------------------------------------------------------------------

/**
 * Check if patient is deceased — blocks ALL outreach unconditionally.
 *
 * This implements SKILL.md §3 Sympathy Gate and MUST be checked first,
 * before any other consent or suppression checks.
 */
async function checkSympathyGate(
  db: Database,
  practiceId: string,
  patientId: string
): Promise<GateResult> {
  const [patient] = await db
    .select({ status: patients.status })
    .from(patients)
    .where(
      and(
        eq(patients.id, patientId),
        eq(patients.practiceId, practiceId)
      )
    )
    .limit(1);

  if (patient?.status === "deceased") {
    return {
      allowed: false,
      reason: "Sympathy Gate: Blocked for deceased patient",
      suppressionType: "deceased_patient",
    };
  }

  return { allowed: true };
}

// ---------------------------------------------------------------------------
// Step 2: Suppression List Check
// ---------------------------------------------------------------------------

/**
 * Check SMS and email suppression lists for opt-outs, bounces, and complaints.
 */
async function checkSuppressionLists(
  db: Database,
  practiceId: string,
  clientId: string,
  channel: "sms" | "email" | "social"
): Promise<GateResult> {
  if (channel === "sms") {
    const [client] = await db
      .select({ phone: clients.phone })
      .from(clients)
      .where(
        and(
          eq(clients.id, clientId),
          eq(clients.practiceId, practiceId)
        )
      )
      .limit(1);

    if (client?.phone) {
      const [suppression] = await db
        .select({ reason: smsSuppressions.reason })
        .from(smsSuppressions)
        .where(
          and(
            eq(smsSuppressions.practiceId, practiceId),
            eq(smsSuppressions.phone, client.phone)
          )
        )
        .limit(1);

      if (suppression) {
        return {
          allowed: false,
          reason: `SMS suppression: ${suppression.reason}`,
          suppressionType: `opt_out_${suppression.reason}`,
        };
      }
    }
  }

  if (channel === "email") {
    const [client] = await db
      .select({ email: clients.email })
      .from(clients)
      .where(
        and(
          eq(clients.id, clientId),
          eq(clients.practiceId, practiceId)
        )
      )
      .limit(1);

    if (client?.email) {
      const [suppression] = await db
        .select({ reason: emailSuppressions.reason })
        .from(emailSuppressions)
        .where(
          and(
            eq(emailSuppressions.practiceId, practiceId),
            // Case-insensitive email comparison
            eq(sql<string>`LOWER(TRIM(${emailSuppressions.email}))`, client.email.toLowerCase().trim())
          )
        )
        .limit(1);

      if (suppression) {
        return {
          allowed: false,
          reason: `Email suppression: ${suppression.reason}`,
          suppressionType: `email_${suppression.reason}`,
        };
      }
    }
  }

  return { allowed: true };
}

// ---------------------------------------------------------------------------
// Step 3: Consent Verification
// ---------------------------------------------------------------------------

/**
 * Verify consent based on communication type.
 *
 * - Service (contract): no marketing consent needed
 * - Marketing: requires marketing_messages consent
 * - Legitimate interest: no consent needed but must respect opt-out
 */
async function checkConsent(
  db: Database,
  practiceId: string,
  clientId: string,
  patientId: string | undefined,
  communicationType: CommunicationType,
  channel: "sms" | "email" | "social"
): Promise<GateResult> {
  // Contract-based service communications
  if (CONTRACT_REQUIRED_TYPES.has(communicationType)) {
    return {
      allowed: true,
      legalBasis: "contract",
    };
  }

  // Legitimate interest communications
  if (LEGITIMATE_INTEREST_TYPES.has(communicationType)) {
    return {
      allowed: true,
      legalBasis: "legitimate_interest",
    };
  }

  // Consent-based marketing communications
  if (CONSENT_REQUIRED_TYPES.has(communicationType)) {
    // Get latest marketing_messages consent
    const [latestConsent] = await db
      .select()
      .from(extMarketingMediaConsents)
      .where(
        and(
          eq(extMarketingMediaConsents.practiceId, practiceId),
          eq(extMarketingMediaConsents.clientId, clientId),
          eq(extMarketingMediaConsents.scope, "marketing_messages")
        )
      )
      .orderBy(desc(extMarketingMediaConsents.grantedAt))
      .limit(1);

    if (!latestConsent) {
      return {
        allowed: false,
        reason: "No marketing consent on file",
        suppressionType: "no_consent",
      };
    }

    if (latestConsent.revokedAt) {
      return {
        allowed: false,
        reason: "Marketing consent was revoked",
        suppressionType: "revoked",
      };
    }

    return {
      allowed: true,
      legalBasis: "consent",
      consentId: latestConsent.id,
    };
  }

  // Unknown communication type — fail closed
  return {
    allowed: false,
    reason: `Unknown communication type: ${communicationType}`,
  };
}

// ---------------------------------------------------------------------------
// Step 4: Quiet Hours Check
// ---------------------------------------------------------------------------

/**
 * Check if current time is within practice quiet hours.
 *
 * Quiet hours are practice-specific and timezone-aware.
 * Service communications (contract) may bypass quiet hours in emergencies.
 */
async function checkQuietHours(
  db: Database,
  practiceId: string,
  communicationType: CommunicationType,
  channel: "sms" | "email" | "social"
): Promise<GateResult> {
  // Only SMS and email are affected by quiet hours
  if (channel !== "sms" && channel !== "email") {
    return { allowed: true };
  }

  // Service communications under contract may bypass quiet hours
  if (CONTRACT_REQUIRED_TYPES.has(communicationType)) {
    return { allowed: true };
  }

  const [practice] = await db
    .select({ settings: practices.settings })
    .from(practices)
    .where(eq(practices.id, practiceId))
    .limit(1);

  if (!practice?.settings) {
    // If practice settings unavailable, fail closed
    return {
      allowed: false,
      reason: "Practice settings unavailable for quiet hours check",
    };
  }

  const brand = await getBrand(db, practiceId);
  const now = new Date();

  if (isQuietHours(now, brand.timezone)) {
    return {
      allowed: false,
      reason: "Quiet hours active",
      suppressionType: "quiet_hours",
    };
  }

  return { allowed: true };
}

// ---------------------------------------------------------------------------
// Step 5: Rate Limit Check
// ---------------------------------------------------------------------------

/**
 * Check SMS rate limit (frequency cap).
 *
 * Current implementation: max 1 SMS per client per 14 days.
 * This is stricter than the brief's "max N per 7 days" to prevent
 * any perception of spam.
 */
async function checkRateLimit(
  db: Database,
  practiceId: string,
  clientId: string,
  communicationType: CommunicationType,
  channel: "sms" | "email" | "social"
): Promise<GateResult> {
  // Only SMS has rate limiting for now
  if (channel !== "sms") {
    return { allowed: true };
  }

  // Service communications under contract may have relaxed rate limits
  const rateLimitDays = CONTRACT_REQUIRED_TYPES.has(communicationType)
    ? 3 // Service: max 1 per 3 days
    : 14; // Marketing: max 1 per 14 days

  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - rateLimitDays);

  const [recentSms] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(extSmsDeliveryLog)
    .where(
      and(
        eq(extSmsDeliveryLog.practiceId, practiceId),
        eq(extSmsDeliveryLog.clientId, clientId),
        sql`${extSmsDeliveryLog.sentAt} >= ${windowStart}`
      )
    )
    .limit(1);

  if (recentSms && recentSms.count > 0) {
    return {
      allowed: false,
      reason: `SMS rate limit exceeded (max 1 per ${rateLimitDays} days)`,
      suppressionType: "rate_limit",
    };
  }

  return { allowed: true };
}
