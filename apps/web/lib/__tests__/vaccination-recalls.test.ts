import { describe, expect, it } from "vitest";
import {
  evaluateVaccinationRecallRecipient,
  vaccinationRecallDedupeKey,
  vaccinationRecallPracticeSettings,
  type VaccinationRecallCandidate,
} from "../vaccination-recalls";

const PRACTICE_ID = "00000000-0000-0000-0000-000000000001";
const CLIENT_ID = "00000000-0000-0000-0000-000000000002";
const PATIENT_ID = "00000000-0000-0000-0000-000000000003";

const candidate: VaccinationRecallCandidate = {
  patientId: PATIENT_ID,
  patientName: "Miso",
  clientId: CLIENT_ID,
  clientName: "Ada Lovelace",
  clientEmail: "ada@realclinic.com",
  clientPhone: "+13035550200",
  preferredContactMethod: "sms",
  smsConsent: true,
  emailSuppressionReason: null,
  vaccines: [
    {
      recordId: "00000000-0000-0000-0000-000000000004",
      vaccineName: "Rabies",
      nextDueDate: "2026-06-01",
    },
  ],
};

const livePractice = vaccinationRecallPracticeSettings({});

function evaluate(overrides: Partial<Parameters<typeof evaluateVaccinationRecallRecipient>[0]> = {}) {
  return evaluateVaccinationRecallRecipient({
    practiceId: PRACTICE_ID,
    practiceSettings: livePractice,
    candidate,
    smsSenderAvailable: true,
    smsSuppressedPhones: new Set(),
    quietHours: false,
    ...overrides,
  });
}

describe("vaccination recall eligibility", () => {
  it("routes an opted-in SMS client through the configured texting sender", () => {
    expect(evaluate()).toMatchObject({ status: "eligible", channel: "sms" });
  });

  it("falls back to email without enabling or provisioning a texting sender", () => {
    expect(evaluate({ smsSenderAvailable: false })).toMatchObject({
      status: "eligible",
      channel: "email",
    });
  });

  it("blocks seeded demo and analytics-excluded test practices", () => {
    expect(
      evaluate({
        practiceSettings: vaccinationRecallPracticeSettings({
          demoData: { patientIds: [PATIENT_ID] },
        }),
      })
    ).toMatchObject({ status: "blocked", blockReason: "seeded_demo_data" });
    expect(
      evaluate({
        practiceSettings: vaccinationRecallPracticeSettings({
          analyticsExcluded: true,
        }),
      })
    ).toMatchObject({ status: "blocked", blockReason: "test_practice" });
  });

  it("blocks reserved fixture emails even when a phone appears textable", () => {
    expect(
      evaluate({
        candidate: { ...candidate, clientEmail: "miso@example.com" },
      })
    ).toMatchObject({ status: "blocked", blockReason: "reserved_contact" });
  });

  it("blocks reserved fictional phone numbers even when email appears deliverable", () => {
    expect(
      evaluate({
        candidate: { ...candidate, clientPhone: "+13035550100" },
      })
    ).toMatchObject({ status: "blocked", blockReason: "reserved_contact" });
  });

  it("uses email rather than contacting an SMS-suppressed number", () => {
    expect(
      evaluate({ smsSuppressedPhones: new Set(["+13035550200"]) })
    ).toMatchObject({ status: "eligible", channel: "email" });
  });

  it("blocks a suppressed email when no safe fallback exists", () => {
    expect(
      evaluate({
        candidate: {
          ...candidate,
          clientPhone: null,
          preferredContactMethod: "email",
          smsConsent: false,
          emailSuppressionReason: "complaint",
        },
      })
    ).toMatchObject({ status: "blocked", blockReason: "email_suppressed" });
  });

  it("blocks quiet-hours SMS when no email fallback exists", () => {
    expect(
      evaluate({
        quietHours: true,
        candidate: { ...candidate, clientEmail: null },
      })
    ).toMatchObject({ status: "blocked", blockReason: "quiet_hours" });
  });

  it("marks an exact prior vaccine snapshot as already sent", () => {
    const sentAt = new Date("2026-07-01T18:00:00Z");
    expect(evaluate({ existingSend: { createdAt: sentAt } })).toMatchObject({
      status: "already_sent",
      channel: null,
      lastSentAt: sentAt,
    });
  });
});

describe("vaccination recall idempotency keys", () => {
  it("is stable across vaccine ordering but changes with the overdue snapshot", () => {
    const secondVaccine = {
      recordId: "00000000-0000-0000-0000-000000000005",
      vaccineName: "Bordetella",
      nextDueDate: "2026-06-02",
    };
    const forward = vaccinationRecallDedupeKey(PRACTICE_ID, {
      ...candidate,
      vaccines: [candidate.vaccines[0]!, secondVaccine],
    });
    const reverse = vaccinationRecallDedupeKey(PRACTICE_ID, {
      ...candidate,
      vaccines: [secondVaccine, candidate.vaccines[0]!],
    });
    const changed = vaccinationRecallDedupeKey(PRACTICE_ID, {
      ...candidate,
      vaccines: [{ ...candidate.vaccines[0]!, nextDueDate: "2026-07-01" }],
    });

    expect(forward).toBe(reverse);
    expect(changed).not.toBe(forward);
    expect(forward.length).toBeLessThanOrEqual(160);
  });
});
