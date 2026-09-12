import { describe, it, expect, vi, beforeEach } from "vitest";
import { eq, and, lte } from "drizzle-orm";
import { envFlagEnabled } from "@/lib/env-bool";

// Mock external dependencies
vi.mock("@/lib/sms-dispatch", () => ({
  sendSms: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/lib/messaging/reminders", () => ({
  isQuietHours: vi.fn().mockReturnValue(false),
}));

vi.mock("@/lib/env-bool", () => ({
  envFlagEnabled: vi.fn().mockReturnValue(false), // Default: demo mode OFF
}));

vi.mock("@/lib/marketing/planner", () => ({
  getBrand: vi.fn().mockResolvedValue({
    name: "Test Clinic",
    phone: "+421123456789",
    timezone: "Europe/Bratislava",
    quietHoursStart: 20,
    quietHoursEnd: 8,
    bookingUrl: "https://example.com/book",
    reviewUrl: "https://example.com/review",
    defaultLanguage: "sk",
    marketingRateLimitDays: 7,
  }),
}));

import { processQueue, applySympathyGate, isQuiet } from "../messaging";
import { smsRateLimitOk, MAX_MARKETING_SMS_PER_WINDOW } from "../sms-rate-limit";
import { sendSms } from "@/lib/sms-dispatch";
import { sendEmail } from "@/lib/email";
import { isQuietHours } from "@/lib/messaging/reminders";
import {
  extMarketingMessageLogs,
  extSmsDeliveryLog,
  patients,
  clients,
} from "@openpims/db";

describe("Phase 0 Fixes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("FIX-1: processQueue sends real messages", () => {
    function createMockDb(overrides: {
      queuedMessages: any[];
      clientContact: { phone?: string; email?: string; smsConsent?: boolean };
      patientStatus: string;
    }) {
      const updateChain = {
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      };
      const insertChain = {
        values: vi.fn().mockResolvedValue(undefined),
      };

      // Track call order for select()
      let selectCallCount = 0;
      const selectFn = vi.fn(() => {
        selectCallCount++;
        const callNum = selectCallCount;

        if (callNum === 1) {
          // getBrand (mocked via module mock) + queued messages
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue(overrides.queuedMessages),
                }),
              }),
            }),
          };
        } else if (callNum === 2) {
          // Patient status lookup (sympathy gate)
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([
                  { status: overrides.patientStatus },
                ]),
              }),
            }),
          };
        } else if (callNum === 3) {
          // Client lookup for consent check
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([
                  { smsConsent: overrides.clientContact.smsConsent ?? true },
                ]),
              }),
            }),
          };
        } else if (callNum === 4) {
          // extMarketingMediaConsents lookup
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([]), // No consent records
                }),
              }),
            }),
          };
        } else if (callNum === 5) {
          // ExtSmsDeliveryLog lookup for rate limit - returns array directly (no .limit())
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([{ count: 0 }]),
            }),
          };
        } else if (callNum === 6) {
          // Client contact lookup (phone/email)
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([overrides.clientContact]),
              }),
            }),
          };
        }
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        };
      });

      return {
        select: selectFn,
        update: vi.fn().mockReturnValue(updateChain),
        insert: vi.fn().mockReturnValue(insertChain),
      };
    }

    it("calls sendSms for SMS channel messages", async () => {
      const mockDb = createMockDb({
        queuedMessages: [
          {
            id: "msg-1",
            clientId: "client-1",
            patientId: "patient-1",
            channel: "sms",
            bodyRendered: "Test message",
            status: "queued",
            legalBasis: "consent",
            scheduledFor: new Date(Date.now() - 1000),
          },
        ],
        clientContact: { phone: "+421900123456", email: "test@example.com", smsConsent: true },
        patientStatus: "alive",
      });

      const result = await processQueue(mockDb as any, "practice-1");

      expect(sendSms).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "+421900123456",
          body: "Test message",
          practiceId: "practice-1",
          clientId: "client-1",
        })
      );
      expect(result.sent).toBe(1);
    });

    it("calls sendEmail for email channel messages", async () => {
      const mockDb = createMockDb({
        queuedMessages: [
          {
            id: "msg-2",
            clientId: "client-2",
            patientId: "patient-2",
            channel: "email",
            bodyRendered: "Test email",
            subject: "Test Subject",
            status: "queued",
            legalBasis: "consent",
            scheduledFor: new Date(Date.now() - 1000),
          },
        ],
        clientContact: { phone: "+421900123456", email: "test@example.com", smsConsent: true },
        patientStatus: "alive",
      });

      const result = await processQueue(mockDb as any, "practice-1");

      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "test@example.com",
          subject: "Test Subject",
        })
      );
      expect(result.sent).toBe(1);
    });
  });

  describe("FIX-3: applySympathyGate unconditional blocking", () => {
    it("blocks ALL queued messages regardless of legalBasis", async () => {
      const updateChain = {
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      };
      const insertChain = {
        values: vi.fn().mockResolvedValue(undefined),
      };

      let selectCallCount = 0;
      const mockDb = {
        select: vi.fn(() => {
          selectCallCount++;
          const callNum = selectCallCount;

          if (callNum === 1) {
            // Patient lookup
            return {
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([
                    { name: "Rex", status: "deceased" },
                  ]),
                }),
              }),
            };
          } else if (callNum === 2) {
            // Client lookup
            return {
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([
                    { firstName: "Ján", lastName: "Novák" },
                  ]),
                }),
              }),
            };
          } else {
            // Queued messages with different legalBasis
            return {
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([
                  {
                    id: "msg-1",
                    templateKey: "vaccine_due",
                    legalBasis: "contract", // Not consent!
                  },
                  {
                    id: "msg-2",
                    templateKey: "thank_you",
                    legalBasis: "consent",
                  },
                  {
                    id: "msg-3",
                    templateKey: "marketing_blast",
                    legalBasis: "contract", // Not in SYMPATHY_BLOCKED!
                  },
                ]),
              }),
            };
          }
        }),
        update: vi.fn().mockReturnValue(updateChain),
        insert: vi.fn().mockReturnValue(insertChain),
      };

      const result = await applySympathyGate(
        mockDb as any,
        "practice-1",
        "client-1",
        "patient-1",
        "test_trigger"
      );

      // Should block ALL 3 messages, not just consent-based or SYMPATHY_BLOCKED ones
      expect(result.blocked).toBe(3);
      // update is called 3 times for messages + 1 time for careReminders auto-dismiss
      expect(mockDb.update).toHaveBeenCalledTimes(4);
    });

    it("blocks messages even for legalBasis: 'contract'", async () => {
      const updateChain = {
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      };
      const insertChain = {
        values: vi.fn().mockResolvedValue(undefined),
      };

      let selectCallCount = 0;
      const mockDb = {
        select: vi.fn(() => {
          selectCallCount++;
          const callNum = selectCallCount;

          if (callNum === 1) {
            return {
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([
                    { name: "Max", status: "deceased" },
                  ]),
                }),
              }),
            };
          } else if (callNum === 2) {
            return {
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([
                    { firstName: "Anna", lastName: "Sýkorová" },
                  ]),
                }),
              }),
            };
          } else {
            // Single message with contract legalBasis
            return {
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([
                  {
                    id: "msg-contract",
                    templateKey: "appointment_reminder",
                    legalBasis: "contract",
                  },
                ]),
              }),
            };
          }
        }),
        update: vi.fn().mockReturnValue(updateChain),
        insert: vi.fn().mockReturnValue(insertChain),
      };

      const result = await applySympathyGate(
        mockDb as any,
        "practice-1",
        "client-1",
        "patient-1",
        "appointment_booked"
      );

      expect(result.blocked).toBe(1);
    });
  });

  describe("FIX-4: isQuiet uses timezone-aware check", () => {
    it("uses isQuietHours when timezone is available", () => {
      const now = new Date("2026-09-12T22:00:00Z");
      const brand = {
        name: "Test Clinic",
        timezone: "Europe/Bratislava",
        quietHoursStart: 20,
        quietHoursEnd: 8,
      } as any;

      isQuiet(now, brand);

      expect(isQuietHours).toHaveBeenCalledWith(now, "Europe/Bratislava");
    });

    it("falls back to server-local when timezone is null", () => {
      const now = new Date("2026-09-12T22:00:00Z");
      const brand = {
        name: "Test Clinic",
        timezone: null,
        quietHoursStart: 20,
        quietHoursEnd: 8,
      } as any;

      const result = isQuiet(now, brand);

      // Should not call isQuietHours when timezone is null
      expect(isQuietHours).not.toHaveBeenCalled();
      // Result should be based on server-local time (22:00 is in quiet hours 20-8)
      expect(result).toBe(true);
    });
  });

  describe("FIX-5: smsRateLimitOk allows max-N messages", () => {
    it("allows messages when count < MAX_MARKETING_SMS_PER_WINDOW", async () => {
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 2 }]), // 2 < 3
          }),
        }),
      };

      const result = await smsRateLimitOk(
        mockDb as any,
        "practice-1",
        "client-1",
        7
      );

      expect(result).toBe(true);
    });

    it("blocks messages when count >= MAX_MARKETING_SMS_PER_WINDOW", async () => {
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 3 }]), // 3 >= 3
          }),
        }),
      };

      const result = await smsRateLimitOk(
        mockDb as any,
        "practice-1",
        "client-1",
        7
      );

      expect(result).toBe(false);
    });

    it("MAX_MARKETING_SMS_PER_WINDOW is 3 (not 1)", () => {
      expect(MAX_MARKETING_SMS_PER_WINDOW).toBe(3);
    });

    it("allows 3 messages then blocks 4th", async () => {
      // First 3 messages should pass
      for (let count = 0; count < 3; count++) {
        const mockDb = {
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([{ count }]),
            }),
          }),
        };

        const result = await smsRateLimitOk(
          mockDb as any,
          "practice-1",
          "client-1",
          7
        );
        expect(result).toBe(true);
      }

      // 4th message should be blocked
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 3 }]),
          }),
        }),
      };

      const result = await smsRateLimitOk(
        mockDb as any,
        "practice-1",
        "client-1",
        7
      );
      expect(result).toBe(false);
    });
  });

  describe("Safety: Demo mode blocks all outbound delivery", () => {
    it("processQueue returns early when NEXT_PUBLIC_DEMO_MODE=true", async () => {
      vi.mocked(envFlagEnabled).mockReturnValue(true);

      const mockDb = {
        select: vi.fn(),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockResolvedValue(undefined),
        }),
      };

      const result = await processQueue(mockDb as any, "practice-1");

      // Should return immediately without any DB queries
      expect(mockDb.select).not.toHaveBeenCalled();
      expect(result.sent).toBe(0);
      expect(result.suppressed).toBe(0);
    });

    it("processQueue proceeds normally when NEXT_PUBLIC_DEMO_MODE=false", async () => {
      vi.mocked(envFlagEnabled).mockReturnValue(false);

      // Mock db with all required queries
      let selectCallCount = 0;
      const mockDb = {
        select: vi.fn(() => {
          selectCallCount++;
          const callNum = selectCallCount;

          if (callNum === 1) {
            return {
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  orderBy: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([
                      {
                        id: "msg-1",
                        clientId: "client-1",
                        patientId: "patient-1",
                        channel: "sms",
                        bodyRendered: "Test message",
                        status: "queued",
                        legalBasis: "consent",
                        scheduledFor: new Date(Date.now() - 1000),
                      },
                    ]),
                  }),
                }),
              }),
            };
          } else if (callNum === 2) {
            return {
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([{ status: "alive" }]),
                }),
              }),
            };
          } else if (callNum === 3) {
            return {
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([{ smsConsent: true }]),
                }),
              }),
            };
          } else if (callNum === 4) {
            return {
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  orderBy: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([]),
                  }),
                }),
              }),
            };
          } else if (callNum === 5) {
            return {
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([{ count: 0 }]),
              }),
            };
          } else if (callNum === 6) {
            return {
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([
                    { phone: "+421900123456", email: "test@example.com" },
                  ]),
                }),
              }),
            };
          }
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          };
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockResolvedValue(undefined),
        }),
      };

      const result = await processQueue(mockDb as any, "practice-1");

      // Should proceed with normal processing
      expect(mockDb.select).toHaveBeenCalled();
      expect(result.sent).toBe(1);
    });
  });
});
