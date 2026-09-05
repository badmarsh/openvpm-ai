// Deterministické doručovanie správ (M4) – transakčné správy a automatizácie.
import { and, desc, eq, gt, isNull, lte } from "drizzle-orm";
import type { Database } from "@openpims/db/client";
import {
  clients,
  patients,
  practices,
  extMarketingMediaConsents,
  extMarketingMessageLogs,
  extMarketingMessageTemplates,
  extMarketingAutomationRules,
  extMarketingStaffTasks,
  extMarketingHandouts,
  extMarketingRecallSchedules,
  extSmsDeliveryLog,
} from "@openpims/db";
import { getBrand, type ClinicBrand } from "./planner";
import { smsRateLimitOk } from "./sms-rate-limit";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
const iso = (d: Date) => d.toISOString().slice(0, 10);

export const SYMPATHY_BLOCKED = new Set([
  "vaccine_due",
  "review_request",
  "thank_you",
  "postop_check",
  "marketing_blast",
]);

export interface TriggerRule {
  key: string;
  offsetMinutes: number;
  relativeTo?: "event" | "appointment";
}

export const TRIGGERS: Record<string, TriggerRule[]> = {
  appointment_booked: [
    { key: "booking_confirmation", offsetMinutes: 0 },
    { key: "appointment_reminder", offsetMinutes: -24 * 60, relativeTo: "appointment" },
  ],
  visit_completed: [
    { key: "thank_you", offsetMinutes: 2 * 60 },
    { key: "review_request", offsetMinutes: 24 * 60 },
  ],
  vaccine_due: [
    { key: "vaccine_due", offsetMinutes: 0 },
    { key: "vaccine_due", offsetMinutes: 11 * 24 * 60 },
  ],
  appointment_no_show: [{ key: "noshow_rebook", offsetMinutes: 2 * 60 }],
  payment_failed: [{ key: "payment_failed", offsetMinutes: 0 }],
  surgery_completed: [{ key: "postop_check", offsetMinutes: 24 * 60 }],
  wellness_enrolled: [{ key: "wellness_welcome", offsetMinutes: 60 }],
  dental_detected: [
    { key: "dental_education", offsetMinutes: 7 * 24 * 60 },
    { key: "dental_recall", offsetMinutes: 21 * 24 * 60 },
  ],
  senior_milestone: [
    { key: "senior_wellness_invite", offsetMinutes: 2 * 24 * 60 },
  ],
};

export function renderTemplate(body: string, vars: Record<string, string>): string {
  return body
    .replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_, k: string) => vars[k] ?? "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function isQuiet(now: Date, brand: ClinicBrand): boolean {
  const h = now.getHours();
  const start = brand.quietHoursStart ?? 20;
  const end = brand.quietHoursEnd ?? 8;
  if (start > end) {
    return h >= start || h < end;
  }
  return h >= start && h < end;
}

export function nextAllowedTime(now: Date, brand: ClinicBrand): Date {
  const d = new Date(now);
  const end = brand.quietHoursEnd ?? 8;
  const start = brand.quietHoursStart ?? 20;
  const setToEnd = (x: Date, addDays: number) => {
    const y = new Date(x);
    y.setDate(y.getDate() + addDays);
    y.setHours(end, 1, 0, 0);
    return y;
  };
  const h = d.getHours();
  if (start > end) {
    if (h >= start) return setToEnd(d, 1);
    if (h < end) return setToEnd(d, 0);
  } else if (h >= start && h < end) {
    return setToEnd(d, 0);
  }
  return d;
}

export async function createMessagesForTrigger(
  db: Database | any,
  practiceId: string,
  input: {
    triggerKey: string;
    clientId: string;
    patientId?: string;
    eventId: string;
    appointmentAt?: Date;
    service?: string;
  }
): Promise<number> {
  const brand = await getBrand(db, practiceId);
  const [cl] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.id, input.clientId), eq(clients.practiceId, practiceId)))
    .limit(1);
  if (!cl) return 0;

  // Sympathy Gate check: if patient is deceased, trigger sympathy gate
  if (input.patientId) {
    const [patient] = await db
      .select({ status: patients.status, name: patients.name })
      .from(patients)
      .where(and(eq(patients.id, input.patientId), eq(patients.practiceId, practiceId)))
      .limit(1);

    if (patient?.status === "deceased") {
      await applySympathyGate(
        db,
        practiceId,
        input.clientId,
        input.patientId,
        input.triggerKey
      );
      return 0;
    }
  }

  // Rate limit check for SMS
  const rateLimitOk = await smsRateLimitOk(db, practiceId, input.clientId, brand.marketingRateLimitDays);
  if (!rateLimitOk) {
    return 0;
  }

  const rules = TRIGGERS[input.triggerKey] ?? [];
  const now = new Date();
  let created = 0;

  // Check disabled automation rules for the practice
  const disabledRules = await db
    .select({ key: extMarketingAutomationRules.key })
    .from(extMarketingAutomationRules)
    .where(
      and(
        eq(extMarketingAutomationRules.practiceId, practiceId),
        eq(extMarketingAutomationRules.enabled, false)
      )
    );
  const disabledSet = new Set(disabledRules.map((r: { key: string }) => r.key));

  for (const rule of rules) {
    if (disabledSet.has(rule.key)) continue;

    const tpl = await pickTemplate(db, practiceId, rule.key, "sk", brand);
    if (!tpl) continue;

    let scheduledFor =
      rule.relativeTo === "appointment" && input.appointmentAt
        ? new Date(input.appointmentAt.getTime() + rule.offsetMinutes * 60_000)
        : new Date(now.getTime() + rule.offsetMinutes * 60_000);

    if (scheduledFor.getTime() < now.getTime() - 60_000) {
      scheduledFor = new Date(now.getTime() + 60 * 60_000);
    }
    if (isQuiet(scheduledFor, brand)) {
      scheduledFor = nextAllowedTime(scheduledFor, brand);
    }

    const vars = await templateVars(db, practiceId, brand, cl, input);
    const finalBody =
      rule.key === "review_request"
        ? renderTemplate(tpl.body, { ...vars, booking_url: brand.reviewUrl })
        : renderTemplate(tpl.body, vars);

    const idempotencyKey = `${input.eventId}:${rule.key}:${cl.id}:${rule.offsetMinutes}`;

    const [ins] = await db
      .insert(extMarketingMessageLogs)
      .values({
        practiceId,
        clientId: cl.id,
        patientId: input.patientId ?? null,
        templateId: tpl.id,
        templateKey: rule.key,
        templateVersion: tpl.version,
        legalBasis: tpl.legalBasis,
        channel: tpl.channel,
        language: tpl.language,
        bodyRendered: finalBody,
        triggerKey: input.triggerKey,
        status: "queued",
        idempotencyKey,
        scheduledFor,
      })
      .onConflictDoNothing({ target: extMarketingMessageLogs.idempotencyKey })
      .returning({ id: extMarketingMessageLogs.id });

    if (ins && rule.key === "postop_check") {
      const withUrl = renderTemplate(tpl.body, {
        ...vars,
        checkin_url: `${APP_URL}/postop/${ins.id}`,
      });
      await db
        .update(extMarketingMessageLogs)
        .set({ bodyRendered: withUrl })
        .where(eq(extMarketingMessageLogs.id, ins.id));
    }

    created++;
  }

  return created;
}

const DEFAULT_TRIGGER_TEMPLATES: Record<
  string,
  Record<string, { channel: string; subject?: string; body: string }>
> = {
  dental_education: {
    sk: {
      channel: "sms",
      body: "Dobry den {{client_name}}, pri poslednom vysetreni sme u {{pet_name}} zaznamenali zacinajuci zubny kamen. Precitajte si, ako spravne cistit zubky a predchadzat zapalu dasien: {{handout_url}} Vasa {{clinic_name}}",
    },
    en: {
      channel: "sms",
      body: "Hello {{client_name}}, during the recent visit we noted dental tartar on {{pet_name}}. Learn tips on home dental hygiene and oral health: {{handout_url}} Your {{clinic_name}}",
    },
  },
  dental_recall: {
    sk: {
      channel: "sms",
      body: "Zdravime {{client_name}}! Chceli by sme sa opytat na zubky pacienta {{pet_name}}. Radi vam ponukneme bezplatnu kontrolu chrupu a ultrazvukove cistenie. Objednajte sa online: {{booking_url}} {{clinic_name}}",
    },
    en: {
      channel: "sms",
      body: "Hi {{client_name}}, checking in on {{pet_name}}'s teeth! We'd love to invite you for a dental check and ultrasonic cleaning. Book online: {{booking_url}} {{clinic_name}}",
    },
  },
  senior_wellness_invite: {
    sk: {
      channel: "sms",
      body: "Vazeny/a {{client_name}}, {{pet_name}} vstupuje do zlateho veku seniora. Preventivne vysetrenie krvi a organovych funkcii dokaze zachytit skryte ochorenia vcas. Radi vas privitame: {{booking_url}} {{clinic_name}}",
    },
    en: {
      channel: "sms",
      body: "Dear {{client_name}}, {{pet_name}} is entering the senior golden age. Preventive blood screening helps catch conditions early. Book a senior checkup: {{booking_url}} {{clinic_name}}",
    },
  },
};

async function pickTemplate(
  db: Database | any,
  practiceId: string,
  key: string,
  lang: string,
  brand: ClinicBrand
) {
  const rows = await db
    .select()
    .from(extMarketingMessageTemplates)
    .where(
      and(
        eq(extMarketingMessageTemplates.practiceId, practiceId),
        eq(extMarketingMessageTemplates.key, key),
        eq(extMarketingMessageTemplates.isActive, true)
      )
    );
  if (!rows.length) {
    const fallback = DEFAULT_TRIGGER_TEMPLATES[key]?.[lang] ?? DEFAULT_TRIGGER_TEMPLATES[key]?.["sk"];
    if (fallback) {
      return {
        id: `default_${key}_${lang}`,
        key,
        channel: fallback.channel,
        subject: fallback.subject ?? null,
        body: fallback.body,
        language: lang,
      };
    }
    return undefined;
  }
  return (
    rows.find((t: any) => t.language === lang) ??
    rows.find((t: any) => t.language === brand.defaultLanguage) ??
    rows[0]
  );
}

async function templateVars(
  db: Database | any,
  practiceId: string,
  brand: ClinicBrand,
  cl: any,
  input: { appointmentAt?: Date; service?: string; patientId?: string }
): Promise<Record<string, string>> {
  let handoutUrl = `${APP_URL}/h/po-zakroku`;
  if (input.service) {
    const hs = await db
      .select()
      .from(extMarketingHandouts)
      .where(
        and(
          eq(extMarketingHandouts.practiceId, practiceId),
          eq(extMarketingHandouts.isPublic, true)
        )
      )
      .limit(1);
    if (hs[0]) handoutUrl = `${APP_URL}/h/${hs[0].slug}`;
  }

  let petName = "";
  if (input.patientId) {
    const [p] = await db
      .select({ name: patients.name })
      .from(patients)
      .where(eq(patients.id, input.patientId))
      .limit(1);
    petName = p?.name ?? "";
  }

  const clientName = `${cl.firstName ?? ""} ${cl.lastName ?? ""}`.trim();
  const appt = input.appointmentAt ?? new Date();
  const token = Buffer.from(`${cl.id}:${practiceId}`).toString("base64");

  return {
    client_name: clientName,
    pet_name: petName,
    date: iso(appt),
    time: `${String(appt.getHours()).padStart(2, "0")}:${String(appt.getMinutes()).padStart(2, "0")}`,
    clinic: brand.name,
    phone: brand.phone,
    booking_url: brand.bookingUrl,
    handout_url: handoutUrl,
    checkin_url: `${APP_URL}/postop`,
    unsubscribe_url: `${APP_URL}/odhlasenie?token=${token}`,
  };
}

export async function processQueue(
  db: Database | any,
  practiceId: string
): Promise<{ sent: number; suppressed: number }> {
  const brand = await getBrand(db, practiceId);
  const now = new Date();
  const due = await db
    .select()
    .from(extMarketingMessageLogs)
    .where(
      and(
        eq(extMarketingMessageLogs.practiceId, practiceId),
        eq(extMarketingMessageLogs.status, "queued"),
        lte(extMarketingMessageLogs.scheduledFor, now)
      )
    )
    .orderBy(extMarketingMessageLogs.scheduledFor)
    .limit(100);

  let sent = 0;
  let suppressed = 0;

  for (const m of due) {
    if (isQuiet(now, brand)) {
      await db
        .update(extMarketingMessageLogs)
        .set({ scheduledFor: nextAllowedTime(now, brand), status: "queued" })
        .where(eq(extMarketingMessageLogs.id, m.id));
      continue;
    }

    // Sympathy gate check before send
    if (m.patientId) {
      const [p] = await db
        .select({ status: patients.status })
        .from(patients)
        .where(eq(patients.id, m.patientId))
        .limit(1);
      if (p?.status === "deceased" && (m.legalBasis === "consent" || SYMPATHY_BLOCKED.has(m.templateKey))) {
        await db
          .update(extMarketingMessageLogs)
          .set({ status: "blocked_sympathy" })
          .where(eq(extMarketingMessageLogs.id, m.id));
        suppressed++;
        continue;
      }
    }

    if (m.legalBasis === "consent") {
      const hasConsent = await marketingConsentOk(db, practiceId, m.clientId);
      if (!hasConsent) {
        await db
          .update(extMarketingMessageLogs)
          .set({ status: "suppressed_no_consent" })
          .where(eq(extMarketingMessageLogs.id, m.id));
        suppressed++;
        continue;
      }

      const rateLimitPassed = await smsRateLimitOk(db, practiceId, m.clientId, brand.marketingRateLimitDays);
      if (!rateLimitPassed) {
        await db
          .update(extMarketingMessageLogs)
          .set({ status: "suppressed_rate" })
          .where(eq(extMarketingMessageLogs.id, m.id));
        suppressed++;
        continue;
      }
    }

    // Delivered
    await db
      .update(extMarketingMessageLogs)
      .set({ status: "delivered", sentAt: now })
      .where(eq(extMarketingMessageLogs.id, m.id));

    // Write to unified delivery log
    await db.insert(extSmsDeliveryLog).values({
      practiceId,
      clientId: m.clientId,
      source: "marketing",
      sourceRecordId: m.id,
      sentAt: now,
    });

    sent++;
  }

  return { sent, suppressed };
}

export async function applySympathyGate(
  db: Database | any,
  practiceId: string,
  clientId: string,
  patientId?: string,
  service?: string
): Promise<{ blocked: number }> {
  // 1. Check patient status
  let petName = "pacient";
  if (patientId) {
    const [patient] = await db
      .select({ name: patients.name, status: patients.status })
      .from(patients)
      .where(and(eq(patients.id, patientId), eq(patients.practiceId, practiceId)))
      .limit(1);
    if (patient?.name) {
      petName = patient.name;
    }
  }

  const [client] = await db
    .select({ firstName: clients.firstName, lastName: clients.lastName })
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.practiceId, practiceId)))
    .limit(1);

  const clientName = client ? `${client.firstName ?? ""} ${client.lastName ?? ""}`.trim() : "Klient";

  // Block queued messages
  const queued = await db
    .select({
      id: extMarketingMessageLogs.id,
      templateKey: extMarketingMessageLogs.templateKey,
      legalBasis: extMarketingMessageLogs.legalBasis,
    })
    .from(extMarketingMessageLogs)
    .where(
      and(
        eq(extMarketingMessageLogs.practiceId, practiceId),
        eq(extMarketingMessageLogs.clientId, clientId),
        eq(extMarketingMessageLogs.status, "queued")
      )
    );

  let blocked = 0;
  for (const m of queued) {
    if (m.legalBasis === "consent" || SYMPATHY_BLOCKED.has(m.templateKey)) {
      await db
        .update(extMarketingMessageLogs)
        .set({ status: "blocked_sympathy" })
        .where(eq(extMarketingMessageLogs.id, m.id));
      blocked++;
    }
  }

  // 2. Insert condolence staff task
  await db.insert(extMarketingStaffTasks).values({
    practiceId,
    clientId,
    kind: "condolence",
    title: `Kondolencia: ${clientName} (${petName})`,
    detail: `Zablokované marketingové správy (${blocked}). Vytvorené z dôvodu: ${service ?? "úmrtie pacienta"}.`,
    status: "open",
  });

  // 3. Write to extSmsDeliveryLog with source: "marketing"
  await db.insert(extSmsDeliveryLog).values({
    practiceId,
    clientId,
    source: "marketing",
    sourceRecordId: `sympathy_blocked_${patientId ?? clientId}`,
    sentAt: new Date(),
  });

  return { blocked };
}

export async function schedulePostopCheckIn(
  db: Database | any,
  practiceId: string,
  clientId: string,
  patientId: string
): Promise<void> {
  // Check if postVisitHandoutEnabled is active in recall schedules
  const [schedule] = await db
    .select()
    .from(extMarketingRecallSchedules)
    .where(eq(extMarketingRecallSchedules.practiceId, practiceId))
    .limit(1);

  if (schedule && !schedule.postVisitHandoutEnabled) {
    return;
  }

  // Verify patient is not deceased
  const [patient] = await db
    .select({ status: patients.status })
    .from(patients)
    .where(and(eq(patients.id, patientId), eq(patients.practiceId, practiceId)))
    .limit(1);

  if (patient?.status === "deceased") {
    await applySympathyGate(db, practiceId, clientId, patientId, "postop_check_blocked");
    return;
  }

  await createMessagesForTrigger(db, practiceId, {
    triggerKey: "surgery_completed",
    clientId,
    patientId,
    eventId: `discharge_${Date.now()}`,
  });
}

async function marketingConsentOk(
  db: Database | any,
  practiceId: string,
  clientId: string
): Promise<boolean> {
  if (!clientId) return false;
  const [client] = await db
    .select({ smsConsent: clients.smsConsent })
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.practiceId, practiceId)))
    .limit(1);

  if (!client?.smsConsent) {
    return false;
  }

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
    return client.smsConsent;
  }

  return !latestConsent.revokedAt;
}

/**
 * Scans SOAP clinical notes or diagnosis for dental tartar / calculus cues and schedules dental recall
 */
export async function detectAndTriggerDentalRecall(
  db: Database | any,
  practiceId: string,
  clientId: string,
  patientId: string,
  clinicalText: string
): Promise<boolean> {
  const dentalRegex = /zubn.*kame[ňn]|tartar|calculus|parodont|gingivit|čisten.*zub/i;
  if (!dentalRegex.test(clinicalText)) return false;

  const [patient] = await db
    .select({ status: patients.status })
    .from(patients)
    .where(and(eq(patients.id, patientId), eq(patients.practiceId, practiceId)))
    .limit(1);

  if (patient?.status === "deceased") {
    await applySympathyGate(db, practiceId, clientId, patientId, "dental_recall_blocked");
    return false;
  }

  const count = await createMessagesForTrigger(db, practiceId, {
    triggerKey: "dental_detected",
    clientId,
    patientId,
    eventId: `dental_${patientId}_${Date.now()}`,
  });

  return count > 0;
}

/**
 * Checks if patient has reached senior age threshold (7+ dogs, 8+ cats) and triggers wellness invite
 */
export async function checkAndTriggerSeniorMilestone(
  db: Database | any,
  practiceId: string,
  clientId: string,
  patientId: string
): Promise<boolean> {
  const [patient] = await db
    .select({ status: patients.status, dob: patients.dob, species: patients.species })
    .from(patients)
    .where(and(eq(patients.id, patientId), eq(patients.practiceId, practiceId)))
    .limit(1);

  if (!patient || !patient.dob || patient.status === "deceased") return false;

  const birthDate = new Date(patient.dob);
  const now = new Date();
  const ageYears = (now.getTime() - birthDate.getTime()) / (365.25 * 24 * 3600 * 1000);

  const speciesLower = (patient.species || "").toLowerCase();
  const isFeline = speciesLower.includes("fel") || speciesLower.includes("cat") || speciesLower.includes("mačk");
  const threshold = isFeline ? 8 : 7;

  if (ageYears < threshold) return false;

  const count = await createMessagesForTrigger(db, practiceId, {
    triggerKey: "senior_milestone",
    clientId,
    patientId,
    eventId: `senior_${patientId}_${now.getFullYear()}`,
  });

  return count > 0;
}

