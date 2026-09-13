import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  consentGateCheck,
  assertPatientNotDeceased,
  type CommunicationType,
} from "../consent-gate";

describe("Autopilot Consent Gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("assertPatientNotDeceased", () => {
    it("returns true when patientId is undefined", async () => {
      const mockDb = { select: vi.fn() };
      const result = await assertPatientNotDeceased(
        mockDb as any,
        "practice-1",
        undefined
      );
      expect(result).toBe(true);
      expect(mockDb.select).not.toHaveBeenCalled();
    });

    it("returns true when patient is active", async () => {
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ status: "active" }]),
            }),
          }),
        }),
      };
      const result = await assertPatientNotDeceased(
        mockDb as any,
        "practice-1",
        "patient-1"
      );
      expect(result).toBe(true);
    });

    it("returns false when patient status is deceased", async () => {
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ status: "deceased" }]),
            }),
          }),
        }),
      };
      const result = await assertPatientNotDeceased(
        mockDb as any,
        "practice-1",
        "patient-1"
      );
      expect(result).toBe(false);
    });

    it("returns true when patient record is not found (fallback)", async () => {
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      };
      const result = await assertPatientNotDeceased(
        mockDb as any,
        "practice-1",
        "patient-missing"
      );
      expect(result).toBe(true);
    });
  });

  describe("consentGateCheck", () => {
    const commTypes: CommunicationType[] = [
      "vaccination_reminder",
      "marketing_sms",
      "marketing_email",
      "social_media",
      "review_request",
      "reputation_reply",
    ];

    it.each(commTypes)(
      "allows outreach for %s when patient is not deceased and consent is active",
      async (commType) => {
        const mockDb = {
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([{ id: "consent-1", status: "active", smsConsent: true }]),
              }),
            }),
          }),
        };

        const result = await consentGateCheck(
          mockDb as any,
          "practice-1",
          "client-1",
          "patient-1",
          commType
        );

        expect(result).toEqual({ allowed: true });
      }
    );

    it.each(commTypes)(
      "unconditionally blocks %s when patient is deceased (Sympathy Gate - SKILL.md §3)",
      async (commType) => {
        const mockDb = {
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([{ status: "deceased" }]),
              }),
            }),
          }),
        };

        const result = await consentGateCheck(
          mockDb as any,
          "practice-1",
          "client-1",
          "patient-1",
          commType
        );

        expect(result).toEqual({
          allowed: false,
          reason: "Patient is deceased",
          suppressionType: "deceased_patient",
        });
      }
    );

    it("blocks marketing_sms when client has not given SMS consent (GDPR)", async () => {
      let callCount = 0;
      const mockDb = {
        select: vi.fn().mockImplementation(() => {
          callCount++;
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue(
                  callCount === 1
                    ? [{ status: "active" }] // patient alive
                    : [{ smsConsent: false }] // client without SMS consent
                ),
              }),
            }),
          };
        }),
      };

      const result = await consentGateCheck(
        mockDb as any,
        "practice-1",
        "client-1",
        "patient-1",
        "marketing_sms"
      );

      expect(result).toEqual({
        allowed: false,
        reason: "Klient neudelil marketingový súhlas na SMS komunikáciu.",
        suppressionType: "opt_out",
      });
    });

    it("blocks marketing_email when client has no marketing media consent (GDPR)", async () => {
      let callCount = 0;
      const mockDb = {
        select: vi.fn().mockImplementation(() => {
          callCount++;
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue(
                  callCount === 1
                    ? [{ status: "active" }] // patient alive
                    : [] // no marketing consent record
                ),
              }),
            }),
          };
        }),
      };

      const result = await consentGateCheck(
        mockDb as any,
        "practice-1",
        "client-1",
        "patient-1",
        "marketing_email"
      );

      expect(result).toEqual({
        allowed: false,
        reason: "Klient neudelil marketingový súhlas na e-mailovú komunikáciu.",
        suppressionType: "opt_out",
      });
    });

    it("allows non-marketing communication when no patientId is provided", async () => {
      const mockDb = { select: vi.fn() };
      const result = await consentGateCheck(
        mockDb as any,
        "practice-1",
        "client-1",
        undefined,
        "vaccination_reminder"
      );

      expect(result).toEqual({ allowed: true });
    });
  });
});
