import { describe, it, expect, vi, beforeEach } from "vitest";
import { enrollInJourney } from "@/lib/autopilot/journey-engine";
import { assertPatientNotDeceased, consentGateCheck } from "@/lib/autopilot/consent-gate";

const PRACTICE_ID = "5c4ebbbc-90e1-457a-87a7-7895f560317d";
const CLIENT_ID = "c1111111-1111-1111-1111-111111111111";
const PATIENT_ID = "p2222222-2222-2222-2222-222222222222";
const JOURNEY_ID = "j3333333-3333-3333-3333-333333333333";
const EVENT_ID = "e4444444-4444-4444-4444-444444444444";

describe("Autopilot Customer Journeys & Event Bus E2E", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("enrollInJourney", () => {
    it("successfully enrolls an eligible client into an active journey", async () => {
      const mockJourney = {
        id: JOURNEY_ID,
        practiceId: PRACTICE_ID,
        journeyKey: "post_visit_followup",
        version: 1,
        isActive: true,
        frequencyCapMaxSteps: 3,
        frequencyCapWindowDays: 30,
        steps: [
          { stepIndex: 0, delayHours: 24, channel: "sms", templateKey: "post_visit_thanks" },
          { stepIndex: 1, delayHours: 72, channel: "sms", templateKey: "post_visit_review_ask" },
        ],
      };

      const insertedRows: any[] = [];

      const mockDb: any = {
        select: vi.fn().mockImplementation(() => ({
          from: vi.fn().mockImplementation(() => ({
            where: vi.fn().mockImplementation(() => ({
              limit: vi.fn().mockResolvedValue([mockJourney]),
            })),
          })),
        })),
        insert: vi.fn().mockImplementation(() => ({
          values: vi.fn().mockImplementation((val) => {
            insertedRows.push(val);
            return {
              onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
            };
          }),
        })),
      };

      await enrollInJourney(
        mockDb,
        CLIENT_ID,
        "post_visit_followup",
        PRACTICE_ID,
        PATIENT_ID,
        EVENT_ID
      );

      expect(mockDb.insert).toHaveBeenCalled();
      expect(insertedRows.length).toBe(1);
      expect(insertedRows[0]).toMatchObject({
        practiceId: PRACTICE_ID,
        clientId: CLIENT_ID,
        patientId: PATIENT_ID,
        journeyId: JOURNEY_ID,
        journeyVersion: 1,
        triggerEventId: EVENT_ID,
        status: "active",
        currentStepIndex: 0,
      });
    });

    it("rejects enrollment when triggeringEventId is missing (durable event audit)", async () => {
      const mockJourney = {
        id: JOURNEY_ID,
        practiceId: PRACTICE_ID,
        journeyKey: "post_visit_followup",
        isActive: true,
      };

      const mockDb: any = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockJourney]),
            }),
          }),
        }),
        insert: vi.fn(),
      };

      await enrollInJourney(
        mockDb,
        CLIENT_ID,
        "post_visit_followup",
        PRACTICE_ID,
        PATIENT_ID,
        undefined // missing event ID
      );

      expect(mockDb.insert).not.toHaveBeenCalled();
    });
  });

  describe("Sympathy Gate Suppression & Slovak Statutory Compliance", () => {
    it("unconditionally blocks communication when patient status is deceased", async () => {
      const mockDb: any = {
        select: vi.fn().mockImplementation(() => ({
          from: vi.fn().mockImplementation(() => ({
            where: vi.fn().mockImplementation(() => ({
              limit: vi.fn().mockResolvedValue([{ status: "deceased" }]),
            })),
          })),
        })),
      };

      const isAlive = await assertPatientNotDeceased(mockDb, PRACTICE_ID, PATIENT_ID);
      expect(isAlive).toBe(false);

      const check = await consentGateCheck(
        mockDb,
        PRACTICE_ID,
        CLIENT_ID,
        PATIENT_ID,
        "marketing_sms"
      );

      expect(check.allowed).toBe(false);
      expect(check.reason).toBe("Patient is deceased");
      expect(check.suppressionType).toBe("deceased_patient");
    });

    it("allows communications when patient is active", async () => {
      const mockDb: any = {
        select: vi.fn().mockImplementation(() => ({
          from: vi.fn().mockImplementation(() => ({
            where: vi.fn().mockImplementation(() => ({
              limit: vi.fn().mockResolvedValue([{ status: "active" }]),
            })),
          })),
        })),
      };

      const check = await consentGateCheck(
        mockDb,
        PRACTICE_ID,
        CLIENT_ID,
        PATIENT_ID,
        "vaccination_reminder"
      );

      expect(check.allowed).toBe(true);
    });

    it("applySympathyGate logs deceased patient suppression to extAutomationSuppressionLog", async () => {
      const { applySympathyGate } = await import("@/lib/marketing/messaging");
      const insertedRows: any[] = [];
      let selectCall = 0;
      const mockDb: any = {
        select: vi.fn().mockImplementation(() => {
          selectCall++;
          const call = selectCall;
          return {
            from: vi.fn().mockImplementation(() => ({
              where: vi.fn().mockImplementation(() => {
                const rows =
                  call === 1
                    ? [{ name: "Luna", status: "deceased" }]
                    : call === 2
                    ? [{ firstName: "Peter", lastName: "Varga" }]
                    : [];
                const p: any = Promise.resolve(rows);
                p.limit = vi.fn().mockResolvedValue(rows);
                return p;
              }),
            })),
          };
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        }),
        insert: vi.fn().mockImplementation((table) => ({
          values: vi.fn().mockImplementation((val) => {
            insertedRows.push({ table, val });
            return Promise.resolve(undefined);
          }),
        })),
      };

      await applySympathyGate(
        mockDb,
        PRACTICE_ID,
        CLIENT_ID,
        PATIENT_ID,
        "automated_vaccine_reminder"
      );

      expect(mockDb.insert).toHaveBeenCalled();
      const suppressionEntry = insertedRows.find(
        (r) => r.val?.suppressionReason === "deceased_patient"
      );
      expect(suppressionEntry).toBeDefined();
      expect(suppressionEntry.val).toMatchObject({
        practiceId: PRACTICE_ID,
        clientId: CLIENT_ID,
        patientId: PATIENT_ID,
        suppressionReason: "deceased_patient",
      });
    }, 15_000);
  });
});
