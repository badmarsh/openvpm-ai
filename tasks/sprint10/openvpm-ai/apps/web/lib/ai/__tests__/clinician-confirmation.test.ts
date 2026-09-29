import { describe, it, expect, vi } from "vitest";
import {
  issueClinicianConfirmation,
  consumeClinicianConfirmation,
  assertAndConsumeDirectConfirmation,
  ClinicianConfirmationError,
} from "../clinician-confirmation";

const HASH_DRAFT = "1".repeat(64);
const HASH_CONTENT = "2".repeat(64);
const PRACTICE_ID = "00000000-0000-0000-0000-0000000000aa";
const OTHER_PRACTICE_ID = "00000000-0000-0000-0000-0000000000bb";
const ACTOR_ID = "00000000-0000-0000-0000-000000000001";
const OTHER_ACTOR_ID = "00000000-0000-0000-0000-000000000002";
const ENTITY_ID = "00000000-0000-0000-0000-000000000010";
const CONF_ID = "00000000-0000-0000-0000-000000000099";

function createMockDb(opts?: {
  existingEnvelope?: Record<string, unknown> | null;
  updateSuccess?: boolean;
}) {
  const existing = opts?.existingEnvelope !== undefined ? opts.existingEnvelope : null;
  const updateSuccess = opts?.updateSuccess ?? false;

  const mockDb = {
    insert: vi.fn(() => ({
      values: vi.fn((values: Record<string, unknown>) => ({
        returning: vi.fn(async () => [{ id: CONF_ID, ...values }]),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn((setValues: Record<string, unknown>) => ({
        where: vi.fn(() => ({
          returning: vi.fn(async () =>
            updateSuccess && existing
              ? [{ ...existing, ...setValues, status: "CONSUMED" }]
              : [],
          ),
        })),
      })),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => (existing ? [existing] : [])),
        })),
      })),
    })),
  };

  return mockDb;
}

describe("Clinician Confirmation Service", () => {
  const baseEnvelope = {
    id: CONF_ID,
    practiceId: PRACTICE_ID,
    actorId: ACTOR_ID,
    actorRole: "veterinarian",
    actionType: "imaging.confirmed",
    entityType: "imaging_analysis",
    entityId: ENTITY_ID,
    expectedRevision: 0,
    originalDraftHash: HASH_DRAFT,
    confirmedContentHash: HASH_CONTENT,
    status: "PENDING",
    issuedAt: new Date(Date.now() - 60000),
    expiresAt: new Date(Date.now() + 840000), // +14 minutes
    deletedAt: null,
  };

  const validConsumeInput = {
    confirmationId: CONF_ID,
    practiceId: PRACTICE_ID,
    actorId: ACTOR_ID,
    actorRole: "veterinarian",
    actionType: "imaging.confirmed",
    entityType: "imaging_analysis",
    entityId: ENTITY_ID,
    expectedRevision: 0,
    originalDraftHash: HASH_DRAFT,
    confirmedContentHash: HASH_CONTENT,
  };

  describe("issueClinicianConfirmation", () => {
    it("denies unprivileged role 'front_desk'", async () => {
      const db = createMockDb();
      await expect(
        issueClinicianConfirmation(db as never, {
          ...validConsumeInput,
          actorRole: "front_desk",
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("issues a valid pending envelope with 15-minute default expiry", async () => {
      const db = createMockDb();
      const envelope = await issueClinicianConfirmation(db as never, {
        practiceId: PRACTICE_ID,
        actorId: ACTOR_ID,
        actorRole: "veterinarian",
        actionType: "imaging.confirmed",
        entityType: "imaging_analysis",
        entityId: ENTITY_ID,
        expectedRevision: 0,
        originalDraftHash: HASH_DRAFT,
        confirmedContentHash: HASH_CONTENT,
      });

      expect(envelope.id).toBe(CONF_ID);
      expect(envelope.status).toBe("PENDING");
      expect(envelope.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe("consumeClinicianConfirmation — happy path", () => {
    it("atomically marks status as CONSUMED when all envelope fields match", async () => {
      const db = createMockDb({
        existingEnvelope: baseEnvelope,
        updateSuccess: true,
      });

      const result = await consumeClinicianConfirmation(db as never, validConsumeInput);
      expect(result.status).toBe("CONSUMED");
      expect(result.consumedBy).toBe(ACTOR_ID);
    });
  });

  describe("consumeClinicianConfirmation — replay & expiry resistance", () => {
    it("rejects already-consumed confirmation token with ALREADY_CONSUMED", async () => {
      const db = createMockDb({
        existingEnvelope: { ...baseEnvelope, status: "CONSUMED" },
        updateSuccess: false,
      });

      await expect(
        consumeClinicianConfirmation(db as never, validConsumeInput),
      ).rejects.toMatchObject({
        code: "ALREADY_CONSUMED",
      });
    });

    it("rejects expired confirmation token with EXPIRED", async () => {
      const db = createMockDb({
        existingEnvelope: {
          ...baseEnvelope,
          expiresAt: new Date(Date.now() - 1000), // expired 1 sec ago
        },
        updateSuccess: false,
      });

      await expect(
        consumeClinicianConfirmation(db as never, validConsumeInput),
      ).rejects.toMatchObject({
        code: "EXPIRED",
      });
    });
  });

  describe("consumeClinicianConfirmation — tampering resistance", () => {
    it("rejects cross-tenant confirmation with PRACTICE_MISMATCH", async () => {
      const db = createMockDb({
        existingEnvelope: { ...baseEnvelope, practiceId: OTHER_PRACTICE_ID },
        updateSuccess: false,
      });

      await expect(
        consumeClinicianConfirmation(db as never, validConsumeInput),
      ).rejects.toMatchObject({
        code: "PRACTICE_MISMATCH",
      });
    });

    it("rejects mismatched actor with ACTOR_MISMATCH", async () => {
      const db = createMockDb({
        existingEnvelope: { ...baseEnvelope, actorId: OTHER_ACTOR_ID },
        updateSuccess: false,
      });

      await expect(
        consumeClinicianConfirmation(db as never, validConsumeInput),
      ).rejects.toMatchObject({
        code: "ACTOR_MISMATCH",
      });
    });

    it("rejects mismatched action with ACTION_MISMATCH", async () => {
      const db = createMockDb({
        existingEnvelope: { ...baseEnvelope, actionType: "discharge.saved" },
        updateSuccess: false,
      });

      await expect(
        consumeClinicianConfirmation(db as never, validConsumeInput),
      ).rejects.toMatchObject({
        code: "ACTION_MISMATCH",
      });
    });

    it("rejects mismatched entity with ENTITY_MISMATCH", async () => {
      const db = createMockDb({
        existingEnvelope: { ...baseEnvelope, entityId: "00000000-0000-0000-0000-000000000099" },
        updateSuccess: false,
      });

      await expect(
        consumeClinicianConfirmation(db as never, validConsumeInput),
      ).rejects.toMatchObject({
        code: "ENTITY_MISMATCH",
      });
    });

    it("rejects mismatched revision with REVISION_MISMATCH", async () => {
      const db = createMockDb({
        existingEnvelope: { ...baseEnvelope, expectedRevision: 2 },
        updateSuccess: false,
      });

      await expect(
        consumeClinicianConfirmation(db as never, { ...validConsumeInput, expectedRevision: 0 }),
      ).rejects.toMatchObject({
        code: "REVISION_MISMATCH",
      });
    });

    it("rejects modified draft content hash with DRAFT_MISMATCH", async () => {
      const db = createMockDb({
        existingEnvelope: { ...baseEnvelope, originalDraftHash: "3".repeat(64) },
        updateSuccess: false,
      });

      await expect(
        consumeClinicianConfirmation(db as never, validConsumeInput),
      ).rejects.toMatchObject({
        code: "DRAFT_MISMATCH",
      });
    });

    it("rejects modified confirmed content hash with PAYLOAD_MISMATCH", async () => {
      const db = createMockDb({
        existingEnvelope: { ...baseEnvelope, confirmedContentHash: "4".repeat(64) },
        updateSuccess: false,
      });

      await expect(
        consumeClinicianConfirmation(db as never, validConsumeInput),
      ).rejects.toMatchObject({
        code: "PAYLOAD_MISMATCH",
      });
    });

    it("rejects non-existent confirmation token with NOT_FOUND", async () => {
      const db = createMockDb({
        existingEnvelope: null,
        updateSuccess: false,
      });

      await expect(
        consumeClinicianConfirmation(db as never, validConsumeInput),
      ).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    });
  });

  describe("assertAndConsumeDirectConfirmation", () => {
    it("denies unprivileged role 'technician'", async () => {
      const db = createMockDb();
      await expect(
        assertAndConsumeDirectConfirmation(db as never, {
          practiceId: PRACTICE_ID,
          actorId: ACTOR_ID,
          actorRole: "technician",
          actionType: "soap.confirmed",
          entityType: "soap_note",
          entityId: ENTITY_ID,
          expectedRevision: 0,
          originalDraftHash: HASH_DRAFT,
          confirmedContentHash: HASH_CONTENT,
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("creates an immediately consumed confirmation record inside transaction", async () => {
      const db = createMockDb();
      const consumed = await assertAndConsumeDirectConfirmation(db as never, {
        practiceId: PRACTICE_ID,
        actorId: ACTOR_ID,
        actorRole: "veterinarian",
        actionType: "soap.confirmed",
        entityType: "soap_note",
        entityId: ENTITY_ID,
        expectedRevision: 0,
        originalDraftHash: HASH_DRAFT,
        confirmedContentHash: HASH_CONTENT,
      });

      expect(consumed.status).toBe("CONSUMED");
      expect(consumed.consumedBy).toBe(ACTOR_ID);
    });
  });
});
