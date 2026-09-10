import { describe, it, expect, vi } from "vitest";
import { appendAiAuditEvent, AuditLedgerError } from "../audit-ledger";
import { CANONICALIZATION_VERSION, computeAiAuditEventHash } from "../audit-chain";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const HASH_PREV = "9".repeat(64);

function createMockTx(opts?: {
  latestRow?: { sequenceNumber: number | null; eventHash: string | null } | null;
  insertedRow?: Record<string, unknown>;
}) {
  const executedSql: unknown[] = [];
  const latestRow = opts?.latestRow !== undefined ? opts.latestRow : null;

  const mockTx = {
    execute: vi.fn(async (query: unknown) => {
      executedSql.push(query);
      return [];
    }),
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
        returning: vi.fn(async () => [opts?.insertedRow ?? { id: "audit-1", ...values }]),
      })),
    })),
  };

  return { mockTx, executedSql };
}

describe("appendAiAuditEvent", () => {
  const baseInput = {
    practiceId: "00000000-0000-0000-0000-0000000000aa",
    actorId: "00000000-0000-0000-0000-000000000001",
    actorName: "Dr. Veterinarian",
    actorRole: "veterinarian",
    entityType: "soap_note" as const,
    entityId: "00000000-0000-0000-0000-000000000002",
    actionType: "soap.confirmed",
    originalDraftHash: HASH_A,
    confirmedContentHash: HASH_B,
  };

  describe("Fail-closed role & input validation", () => {
    it("denies unprivileged role 'front_desk'", async () => {
      const { mockTx } = createMockTx();
      await expect(
        appendAiAuditEvent(mockTx as never, { ...baseInput, actorRole: "front_desk" }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("denies unprivileged role 'technician'", async () => {
      const { mockTx } = createMockTx();
      await expect(
        appendAiAuditEvent(mockTx as never, { ...baseInput, actorRole: "technician" }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("denies unprivileged role 'viewer'", async () => {
      const { mockTx } = createMockTx();
      await expect(
        appendAiAuditEvent(mockTx as never, { ...baseInput, actorRole: "viewer" }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("denies empty actorRole", async () => {
      const { mockTx } = createMockTx();
      await expect(
        appendAiAuditEvent(mockTx as never, { ...baseInput, actorRole: "" }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("denies missing or whitespace practiceId", async () => {
      const { mockTx } = createMockTx();
      await expect(
        appendAiAuditEvent(mockTx as never, { ...baseInput, practiceId: "  " }),
      ).rejects.toThrowError(AuditLedgerError);
    });

    it("denies invalid originalDraftHash format", async () => {
      const { mockTx } = createMockTx();
      await expect(
        appendAiAuditEvent(mockTx as never, { ...baseInput, originalDraftHash: "short" }),
      ).rejects.toThrowError("originalDraftHash must be a 64-character SHA-256 hex string");
    });

    it("denies invalid confirmedContentHash format", async () => {
      const { mockTx } = createMockTx();
      await expect(
        appendAiAuditEvent(mockTx as never, { ...baseInput, confirmedContentHash: "invalid-hash" }),
      ).rejects.toThrowError("confirmedContentHash must be a 64-character SHA-256 hex string");
    });
  });

  describe("Advisory lock acquisition", () => {
    it("acquires transaction-scoped advisory lock for practiceId", async () => {
      const { mockTx } = createMockTx();
      await appendAiAuditEvent(mockTx as never, baseInput);

      expect(mockTx.execute).toHaveBeenCalledTimes(1);
    });
  });

  describe("Genesis event (sequenceNumber 1)", () => {
    it("assigns sequenceNumber = 1 and previousEventHash = null when ledger is empty", async () => {
      const { mockTx } = createMockTx({ latestRow: null });
      const result = await appendAiAuditEvent(mockTx as never, baseInput);

      expect(result.sequenceNumber).toBe(1);
      expect(result.previousEventHash).toBeNull();
      expect(result.payload.sequenceNumber).toBe(1);
      expect(result.payload.previousEventHash).toBeNull();
      expect(result.eventHash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe("Monotonic sequencing & chaining", () => {
    it("increments sequenceNumber and links to previousEventHash", async () => {
      const { mockTx } = createMockTx({
        latestRow: { sequenceNumber: 42, eventHash: HASH_PREV },
      });

      const result = await appendAiAuditEvent(mockTx as never, baseInput);

      expect(result.sequenceNumber).toBe(43);
      expect(result.previousEventHash).toBe(HASH_PREV);
      expect(result.payload.sequenceNumber).toBe(43);
      expect(result.payload.previousEventHash).toBe(HASH_PREV);
      expect(result.eventHash).toBe(computeAiAuditEventHash(result.payload));
    });

    it("throws CHAIN_BROKEN if existing row lacks sequenceNumber (legacy unsequenced row)", async () => {
      const { mockTx } = createMockTx({
        latestRow: { sequenceNumber: null, eventHash: HASH_PREV },
      });

      await expect(
        appendAiAuditEvent(mockTx as never, baseInput),
      ).rejects.toMatchObject({
        code: "CHAIN_BROKEN",
      });
    });
  });

  describe("Clinician edit detection", () => {
    it("infers wasEditedByClinician = true when hashes differ", async () => {
      const { mockTx } = createMockTx();
      const result = await appendAiAuditEvent(mockTx as never, {
        ...baseInput,
        originalDraftHash: HASH_A,
        confirmedContentHash: HASH_B,
      });

      expect(result.payload.wasEditedByClinician).toBe(true);
    });

    it("infers wasEditedByClinician = false when hashes match", async () => {
      const { mockTx } = createMockTx();
      const result = await appendAiAuditEvent(mockTx as never, {
        ...baseInput,
        originalDraftHash: HASH_A,
        confirmedContentHash: HASH_A,
      });

      expect(result.payload.wasEditedByClinician).toBe(false);
    });

    it("respects explicit wasEditedByClinician flag", async () => {
      const { mockTx } = createMockTx();
      const result = await appendAiAuditEvent(mockTx as never, {
        ...baseInput,
        originalDraftHash: HASH_A,
        confirmedContentHash: HASH_A,
        wasEditedByClinician: true,
      });

      expect(result.payload.wasEditedByClinician).toBe(true);
    });
  });

  describe("Deterministic canonical serialization", () => {
    it("produces identical eventHash for identical inputs and timestamps", async () => {
      const date = new Date("2026-09-09T12:00:00.000Z");
      const { mockTx: tx1 } = createMockTx();
      const { mockTx: tx2 } = createMockTx();

      const result1 = await appendAiAuditEvent(tx1 as never, { ...baseInput, confirmedAt: date });
      const result2 = await appendAiAuditEvent(tx2 as never, { ...baseInput, confirmedAt: date });

      expect(result1.eventHash).toBe(result2.eventHash);
      expect(result1.payload.canonicalizationVersion).toBe(CANONICALIZATION_VERSION);
    });
  });
});
