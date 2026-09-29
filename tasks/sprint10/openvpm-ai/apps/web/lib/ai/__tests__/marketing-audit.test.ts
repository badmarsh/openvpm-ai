import { describe, it, expect, vi } from "vitest";
import { appendAiAuditEvent } from "../audit-ledger";
import { computeAiAuditEventHash } from "../audit-chain";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const HASH_PREV = "8".repeat(64);

function createMockTx(opts?: {
  latestRow?: { sequenceNumber: number | null; eventHash: string | null } | null;
  insertedRow?: Record<string, unknown>;
}) {
  const latestRow = opts?.latestRow !== undefined ? opts.latestRow : null;
  const mockTx = {
    execute: vi.fn(async () => []),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn(async () => (latestRow ? [latestRow] : [])),
          })),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn((values: Record<string, unknown>) => ({
        returning: vi.fn(async () => [opts?.insertedRow ?? { id: "audit-mkt-1", ...values }]),
      })),
    })),
  };

  return { mockTx };
}

describe("Marketing AI Audit Ledger & Role Boundaries (F4 & F7)", () => {
  const baseMarketingInput = {
    practiceId: "00000000-0000-0000-0000-0000000000aa",
    actorId: "00000000-0000-0000-0000-000000000002",
    actorName: "Marketing Receptionist",
    actorRole: "front_desk",
    entityType: "marketing_content" as const,
    entityId: "00000000-0000-0000-0000-000000000003",
    actionType: "marketing.post.generated",
    originalDraftHash: HASH_A,
    confirmedContentHash: HASH_A,
  };

  describe("Role authorization for marketing entities", () => {
    it("allows 'front_desk' for marketing_content", async () => {
      const { mockTx } = createMockTx();
      const result = await appendAiAuditEvent(mockTx as never, baseMarketingInput);

      expect(result.sequenceNumber).toBe(1);
      expect(result.payload.entityType).toBe("marketing_content");
      expect(result.payload.actorRole).toBe("front_desk");
    });

    it("allows 'front_desk' for marketing_media", async () => {
      const { mockTx } = createMockTx();
      const result = await appendAiAuditEvent(mockTx as never, {
        ...baseMarketingInput,
        entityType: "marketing_media" as const,
        actionType: "marketing.image.generated",
      });

      expect(result.sequenceNumber).toBe(1);
      expect(result.payload.entityType).toBe("marketing_media");
      expect(result.payload.actorRole).toBe("front_desk");
    });

    it("allows 'veterinarian' for marketing_content and marketing_media", async () => {
      const { mockTx } = createMockTx();
      const res1 = await appendAiAuditEvent(mockTx as never, {
        ...baseMarketingInput,
        actorRole: "veterinarian",
      });
      expect(res1.payload.actorRole).toBe("veterinarian");

      const res2 = await appendAiAuditEvent(mockTx as never, {
        ...baseMarketingInput,
        entityType: "marketing_media" as const,
        actorRole: "veterinarian",
      });
      expect(res2.payload.actorRole).toBe("veterinarian");
    });

    it("allows 'admin' for marketing_content and marketing_media", async () => {
      const { mockTx } = createMockTx();
      const result = await appendAiAuditEvent(mockTx as never, {
        ...baseMarketingInput,
        actorRole: "admin",
      });
      expect(result.payload.actorRole).toBe("admin");
    });

    it("denies unprivileged role 'technician' for marketing entities", async () => {
      const { mockTx } = createMockTx();
      await expect(
        appendAiAuditEvent(mockTx as never, {
          ...baseMarketingInput,
          actorRole: "technician",
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("denies 'service_agent' for marketing audit append directly", async () => {
      const { mockTx } = createMockTx();
      await expect(
        appendAiAuditEvent(mockTx as never, {
          ...baseMarketingInput,
          actorRole: "service_agent",
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("denies 'viewer' for marketing entities", async () => {
      const { mockTx } = createMockTx();
      await expect(
        appendAiAuditEvent(mockTx as never, {
          ...baseMarketingInput,
          actorRole: "viewer",
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
  });

  describe("Clinical partition preservation (fail-closed)", () => {
    it("STRICTLY DENIES 'front_desk' for clinical entity 'soap_note'", async () => {
      const { mockTx } = createMockTx();
      await expect(
        appendAiAuditEvent(mockTx as never, {
          ...baseMarketingInput,
          entityType: "soap_note" as const,
          actionType: "soap.confirmed",
          actorRole: "front_desk",
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("STRICTLY DENIES 'front_desk' for clinical entity 'prescription'", async () => {
      const { mockTx } = createMockTx();
      await expect(
        appendAiAuditEvent(mockTx as never, {
          ...baseMarketingInput,
          entityType: "prescription" as const,
          actionType: "prescription.confirmed",
          actorRole: "front_desk",
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("STRICTLY DENIES 'front_desk' for clinical entity 'discharge_report'", async () => {
      const { mockTx } = createMockTx();
      await expect(
        appendAiAuditEvent(mockTx as never, {
          ...baseMarketingInput,
          entityType: "discharge_report" as const,
          actionType: "discharge.confirmed",
          actorRole: "front_desk",
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("STRICTLY DENIES 'front_desk' for clinical entity 'imaging_analysis'", async () => {
      const { mockTx } = createMockTx();
      await expect(
        appendAiAuditEvent(mockTx as never, {
          ...baseMarketingInput,
          entityType: "imaging_analysis" as const,
          actionType: "imaging.confirmed",
          actorRole: "front_desk",
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
  });

  describe("Cryptographic Hash-chain integrity for marketing entries", () => {
    it("advances sequence number and maintains sha256 previousEventHash link", async () => {
      const { mockTx } = createMockTx({
        latestRow: { sequenceNumber: 10, eventHash: HASH_PREV },
      });

      const result = await appendAiAuditEvent(mockTx as never, {
        ...baseMarketingInput,
        originalDraftHash: HASH_A,
        confirmedContentHash: HASH_B,
      });

      expect(result.sequenceNumber).toBe(11);
      expect(result.previousEventHash).toBe(HASH_PREV);
      expect(result.payload.sequenceNumber).toBe(11);
      expect(result.payload.previousEventHash).toBe(HASH_PREV);
      expect(result.payload.wasEditedByClinician).toBe(true);
      expect(result.eventHash).toBe(computeAiAuditEventHash(result.payload));
      expect(result.eventHash).toMatch(/^[a-f0-9]{64}$/);
    });
  });
});
