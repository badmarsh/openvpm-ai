import { describe, it, expect } from "vitest";
import {
  buildCanonicalAiAuditEvent,
  computeAiAuditEventHash,
  verifyAiAuditChain,
  GENESIS_PREDECESSOR_HASH,
  CANONICALIZATION_VERSION,
  type AuditChainEventPayload,
  type AuditLogDbRow,
} from "../audit-chain";

// ─── Synthetic identifiers (no real data) ────────────────────────────────────
const PRACTICE_A = "aaaaaaaa-0000-0000-0000-000000000001";
const PRACTICE_B = "bbbbbbbb-0000-0000-0000-000000000002";
const ACTOR_A = "cccccccc-0000-0000-0000-000000000010";
const ACTOR_B = "dddddddd-0000-0000-0000-000000000011";
const ENTITY_A = "eeeeeeee-0000-0000-0000-000000000020";

function makePayload(
  overrides: Partial<AuditChainEventPayload> = {},
): AuditChainEventPayload {
  return {
    actionType: "soap_note_finalized",
    actorId: ACTOR_A,
    actorRole: "veterinarian",
    canonicalizationVersion: CANONICALIZATION_VERSION,
    confirmedAt: "2026-09-09T10:00:00.000Z",
    confirmedContentHash: "b".repeat(64),
    entityId: ENTITY_A,
    entityType: "soap_note",
    originalDraftHash: "a".repeat(64),
    practiceId: PRACTICE_A,
    previousEventHash: null,
    sequenceNumber: 1,
    wasEditedByClinician: true,
    ...overrides,
  };
}

function makeDbRow(
  seq: number,
  practiceId: string,
  payload: AuditChainEventPayload,
  eventHash: string,
  prevHash: string | null,
  overrides: Partial<AuditLogDbRow> = {},
): AuditLogDbRow {
  return {
    id: `${practiceId}-seq${seq}`,
    practiceId,
    sequenceNumber: seq,
    actorId: payload.actorId,
    actorRole: payload.actorRole,
    entityType: payload.entityType,
    entityId: payload.entityId,
    actionType: payload.actionType,
    originalDraftHash: payload.originalDraftHash,
    confirmedContentHash: payload.confirmedContentHash,
    wasEditedByClinician: payload.wasEditedByClinician,
    confirmedAt: new Date(payload.confirmedAt),
    previousEventHash: prevHash,
    eventHash,
    canonicalizationVersion: CANONICALIZATION_VERSION,
    ...overrides,
  };
}

/** Build a valid N-event chain for a given practice. */
function buildValidChain(practiceId: string, length: number): AuditLogDbRow[] {
  const rows: AuditLogDbRow[] = [];
  let prevHash: string | null = null;
  for (let seq = 1; seq <= length; seq++) {
    const payload = makePayload({
      practiceId,
      sequenceNumber: seq,
      previousEventHash: prevHash,
    });
    const hash = computeAiAuditEventHash(payload);
    rows.push(makeDbRow(seq, practiceId, payload, hash, prevHash));
    prevHash = hash;
  }
  return rows;
}

// ─── Canonicalization tests ───────────────────────────────────────────────────
describe("buildCanonicalAiAuditEvent", () => {
  it("produces deterministic output regardless of JS object property insertion order", () => {
    const p1 = makePayload();
    // Construct with deliberately different insertion order
    const p2: AuditChainEventPayload = {
      wasEditedByClinician: p1.wasEditedByClinician,
      previousEventHash: p1.previousEventHash,
      practiceId: p1.practiceId,
      sequenceNumber: p1.sequenceNumber,
      originalDraftHash: p1.originalDraftHash,
      entityType: p1.entityType,
      entityId: p1.entityId,
      confirmedContentHash: p1.confirmedContentHash,
      confirmedAt: p1.confirmedAt,
      canonicalizationVersion: p1.canonicalizationVersion,
      actorRole: p1.actorRole,
      actorId: p1.actorId,
      actionType: p1.actionType,
    };
    expect(buildCanonicalAiAuditEvent(p1)).toBe(buildCanonicalAiAuditEvent(p2));
  });

  it("changes canonical string when actorId changes", () => {
    const base = buildCanonicalAiAuditEvent(makePayload());
    expect(buildCanonicalAiAuditEvent(makePayload({ actorId: ACTOR_B }))).not.toBe(base);
  });

  it("changes canonical string when practiceId changes", () => {
    const base = buildCanonicalAiAuditEvent(makePayload());
    expect(buildCanonicalAiAuditEvent(makePayload({ practiceId: PRACTICE_B }))).not.toBe(base);
  });

  it("changes canonical string when originalDraftHash changes", () => {
    const base = buildCanonicalAiAuditEvent(makePayload());
    expect(buildCanonicalAiAuditEvent(makePayload({ originalDraftHash: "c".repeat(64) }))).not.toBe(base);
  });

  it("changes canonical string when confirmedContentHash changes", () => {
    const base = buildCanonicalAiAuditEvent(makePayload());
    expect(buildCanonicalAiAuditEvent(makePayload({ confirmedContentHash: "d".repeat(64) }))).not.toBe(base);
  });

  it("changes canonical string when wasEditedByClinician changes", () => {
    const base = buildCanonicalAiAuditEvent(makePayload({ wasEditedByClinician: true }));
    expect(buildCanonicalAiAuditEvent(makePayload({ wasEditedByClinician: false }))).not.toBe(base);
  });

  it("changes canonical string when confirmedAt changes", () => {
    const base = buildCanonicalAiAuditEvent(makePayload());
    expect(buildCanonicalAiAuditEvent(makePayload({ confirmedAt: "2026-09-09T11:00:00.000Z" }))).not.toBe(base);
  });

  it("changes canonical string when sequenceNumber changes", () => {
    const base = buildCanonicalAiAuditEvent(makePayload());
    expect(buildCanonicalAiAuditEvent(makePayload({ sequenceNumber: 2 }))).not.toBe(base);
  });

  it("changes canonical string when previousEventHash changes", () => {
    const base = buildCanonicalAiAuditEvent(makePayload());
    expect(buildCanonicalAiAuditEvent(makePayload({ previousEventHash: "e".repeat(64) }))).not.toBe(base);
  });

  it("changes canonical string when actorRole changes", () => {
    const base = buildCanonicalAiAuditEvent(makePayload());
    expect(buildCanonicalAiAuditEvent(makePayload({ actorRole: "admin" }))).not.toBe(base);
  });

  it("changes canonical string when actionType changes", () => {
    const base = buildCanonicalAiAuditEvent(makePayload());
    expect(buildCanonicalAiAuditEvent(makePayload({ actionType: "imaging_confirmed" }))).not.toBe(base);
  });
});

// ─── Chain verification tests ─────────────────────────────────────────────────
describe("verifyAiAuditChain", () => {
  // Valid chains
  describe("valid chains", () => {
    it("passes for an empty event list", () => {
      const result = verifyAiAuditChain([]);
      expect(result.ok).toBe(true);
      expect(result.totalEvents).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it("passes for a valid single-event genesis chain", () => {
      const chain = buildValidChain(PRACTICE_A, 1);
      expect(verifyAiAuditChain(chain).ok).toBe(true);
    });

    it("passes for a valid 5-event chain", () => {
      const chain = buildValidChain(PRACTICE_A, 5);
      expect(verifyAiAuditChain(chain).ok).toBe(true);
    });

    it("passes for two independent practice chains", () => {
      const chainA = buildValidChain(PRACTICE_A, 3);
      const chainB = buildValidChain(PRACTICE_B, 4);
      const result = verifyAiAuditChain([...chainA, ...chainB]);
      expect(result.ok).toBe(true);
      expect(result.practiceResults[PRACTICE_A]?.ok).toBe(true);
      expect(result.practiceResults[PRACTICE_B]?.ok).toBe(true);
    });

    it("verifies chains supplied in random order (sorts internally)", () => {
      const chain = buildValidChain(PRACTICE_A, 4);
      const shuffled = [chain[3]!, chain[1]!, chain[0]!, chain[2]!];
      expect(verifyAiAuditChain(shuffled).ok).toBe(true);
    });
  });

  // Tamper detection — hash field alterations
  describe("tamper detection: altered hash fields", () => {
    it("detects modified originalDraftHash", () => {
      const chain = buildValidChain(PRACTICE_A, 2);
      chain[1]!.originalDraftHash = "f".repeat(64);
      const result = verifyAiAuditChain(chain);
      expect(result.ok).toBe(false);
      expect(result.errors.some((e) => e.type === "HASH_MISMATCH")).toBe(true);
    });

    it("detects modified confirmedContentHash", () => {
      const chain = buildValidChain(PRACTICE_A, 2);
      chain[1]!.confirmedContentHash = "g".repeat(64);
      const result = verifyAiAuditChain(chain);
      expect(result.ok).toBe(false);
    });

    it("detects modified actor (actorId)", () => {
      const chain = buildValidChain(PRACTICE_A, 2);
      chain[1]!.actorId = ACTOR_B;
      const result = verifyAiAuditChain(chain);
      expect(result.ok).toBe(false);
      expect(result.errors.some((e) => e.type === "HASH_MISMATCH")).toBe(true);
    });

    it("detects modified actorRole", () => {
      const chain = buildValidChain(PRACTICE_A, 2);
      chain[1]!.actorRole = "front_desk";
      const result = verifyAiAuditChain(chain);
      expect(result.ok).toBe(false);
      expect(result.errors.some((e) => e.type === "HASH_MISMATCH")).toBe(true);
    });

    it("detects modified practiceId (cross-tenant event injection)", () => {
      const chain = buildValidChain(PRACTICE_A, 2);
      // Move the second event to a different practice — its hash was computed for PRACTICE_A
      chain[1]!.practiceId = PRACTICE_B;
      const result = verifyAiAuditChain(chain);
      // The PRACTICE_B chain has 1 event with a hash computed for PRACTICE_A — mismatch
      expect(result.ok).toBe(false);
    });
  });

  // Tamper detection — structural chain attacks
  describe("tamper detection: structural chain attacks", () => {
    it("detects missing middle event (sequence gap)", () => {
      const chain = buildValidChain(PRACTICE_A, 4);
      chain.splice(1, 1); // remove seq=2
      const result = verifyAiAuditChain(chain);
      expect(result.ok).toBe(false);
      expect(
        result.errors.some(
          (e) => e.type === "SEQUENCE_GAP" || e.type === "PREDECESSOR_MISMATCH",
        ),
      ).toBe(true);
    });

    it("detects reordered events (predecessor chain breaks)", () => {
      const chain = buildValidChain(PRACTICE_A, 4);
      // A real reorder attack: tamper with seq=2 to point its previousEventHash
      // to seq=3's hash instead of seq=1's hash — simulating an adversary who
      // swapped events and updated the previousEventHash pointers incorrectly.
      // The verifier sorts by sequenceNumber, so array position swapping alone
      // is not a valid attack — the actual field values must be tampered.
      const seq3Hash = chain[2]!.eventHash!;
      chain[1]!.previousEventHash = seq3Hash; // points to wrong predecessor
      const result = verifyAiAuditChain(chain);
      expect(result.ok).toBe(false);
      expect(result.errors.some(
        (e) => e.type === "PREDECESSOR_MISMATCH" || e.type === "HASH_MISMATCH"
      )).toBe(true);
    });

    it("detects forged predecessor hash", () => {
      const chain = buildValidChain(PRACTICE_A, 3);
      chain[2]!.previousEventHash = "0".repeat(64);
      const result = verifyAiAuditChain(chain);
      expect(result.ok).toBe(false);
      expect(result.errors.some((e) => e.type === "PREDECESSOR_MISMATCH")).toBe(true);
    });

    it("detects duplicated sequence number", () => {
      const chain = buildValidChain(PRACTICE_A, 3);
      // Clone seq=2 with a different id
      chain.push({ ...chain[1]!, id: "dup-event-id" });
      const result = verifyAiAuditChain(chain);
      expect(result.ok).toBe(false);
      expect(result.errors.some((e) => e.type === "SEQUENCE_DUPLICATE")).toBe(true);
    });
  });

  // Tamper detection — metadata / flag alterations
  describe("tamper detection: metadata alterations", () => {
    it("detects altered wasEditedByClinician (hashes equal but flag says edited)", () => {
      // Build an event where hashes are equal (unedited) but flag is set to true
      const payload = makePayload({
        originalDraftHash: "a".repeat(64),
        confirmedContentHash: "a".repeat(64), // SAME = not edited
        wasEditedByClinician: false,
      });
      const hash = computeAiAuditEventHash(payload);
      const chain: AuditLogDbRow[] = [
        makeDbRow(1, PRACTICE_A, payload, hash, null, {
          wasEditedByClinician: true, // tampered AFTER hash computation
        }),
      ];
      const result = verifyAiAuditChain(chain);
      expect(result.ok).toBe(false);
      expect(result.errors.some((e) => e.type === "HASH_MISMATCH" || e.type === "ALTERED_EDIT_FLAG")).toBe(true);
    });

    it("detects future timestamp beyond clock-skew allowance", () => {
      const chain = buildValidChain(PRACTICE_A, 1);
      const futureMs = Date.now() + 20 * 60 * 1000; // 20 minutes in future
      chain[0]!.confirmedAt = new Date(futureMs);
      // Use a nowMs in the past so the future detection fires
      const result = verifyAiAuditChain(chain, { nowMs: Date.now() - 1000 });
      expect(result.ok).toBe(false);
      expect(result.errors.some((e) => e.type === "FUTURE_TIMESTAMP")).toBe(true);
    });

    it("does NOT flag timestamp within clock-skew allowance (< 5 min)", () => {
      const chain = buildValidChain(PRACTICE_A, 1);
      // 2 minutes in future — within the 5-minute skew window
      const slightFutureMs = Date.now() + 2 * 60 * 1000;
      chain[0]!.confirmedAt = new Date(slightFutureMs);
      // Recompute hash to match the new timestamp
      const payload = makePayload({
        confirmedAt: new Date(slightFutureMs).toISOString(),
      });
      chain[0]!.eventHash = computeAiAuditEventHash(payload);
      const result = verifyAiAuditChain(chain);
      // Should NOT have a FUTURE_TIMESTAMP error (within skew)
      expect(result.errors.filter((e) => e.type === "FUTURE_TIMESTAMP")).toHaveLength(0);
    });

    it("detects invalid canonicalizationVersion", () => {
      const chain = buildValidChain(PRACTICE_A, 1);
      chain[0]!.canonicalizationVersion = 99;
      const result = verifyAiAuditChain(chain);
      expect(result.ok).toBe(false);
      expect(result.errors.some((e) => e.type === "INVALID_CANON_VERSION")).toBe(true);
    });
  });

  // Missing fields (pre-migration / legacy rows)
  describe("missing required chain fields", () => {
    it("reports LEGACY_ROW for pre-chain events without sequenceNumber", () => {
      const chain = buildValidChain(PRACTICE_A, 1);
      chain[0]!.sequenceNumber = null;
      const result = verifyAiAuditChain(chain);
      expect(result.ok).toBe(false);
      expect(result.errors.some((e) => e.type === "LEGACY_ROW")).toBe(true);
    });

    it("reports MISSING_REQUIRED_FIELD for missing actorRole", () => {
      const chain = buildValidChain(PRACTICE_A, 1);
      chain[0]!.actorRole = null;
      const result = verifyAiAuditChain(chain);
      expect(result.ok).toBe(false);
      expect(result.errors.some((e) => e.type === "MISSING_REQUIRED_FIELD")).toBe(true);
    });
  });

  // Multi-tenant isolation
  describe("multi-tenant isolation", () => {
    it("independent practice chains are verified independently", () => {
      const chainA = buildValidChain(PRACTICE_A, 3);
      const chainB = buildValidChain(PRACTICE_B, 3);
      // Tamper only PRACTICE_B
      chainB[1]!.actorId = ACTOR_B;
      const result = verifyAiAuditChain([...chainA, ...chainB]);
      expect(result.practiceResults[PRACTICE_A]?.ok).toBe(true);
      expect(result.practiceResults[PRACTICE_B]?.ok).toBe(false);
      expect(result.ok).toBe(false);
    });
  });
});
