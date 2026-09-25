/**
 * Secure Interop Bridge v1 → v2 — schema validation pins (Sprint 30).
 * ------------------------------------------------------------------
 * The bridge accepts nothing it cannot model: envelope structure, direction ↔
 * type matrix, replay window and a strict per-type payload contract. These
 * tests are the executable specification of that claim.
 */
import { describe, expect, it } from "vitest";
import {
  BRIDGE_PAYLOAD_CONTRACTS,
  bridgeEnvelopeSchema,
  bridgePatientStatusSchema,
  isBridgePatientDeceased,
  validateBridgeEnvelope,
  validateBridgePayload,
} from "../validation";
import {
  BRIDGE_ALLOWED_MESSAGE_TYPES,
  BRIDGE_DEFAULT_SCHEMA_VERSION,
  BRIDGE_MAX_PAYLOAD_BYTES,
  BRIDGE_MESSAGE_TYPES,
  BRIDGE_PROTOCOL_VERSION,
  BRIDGE_SCHEMA_VERSIONS,
  bridgeEnvelopeAad,
  isBridgeMessageType,
  isBridgeMessageTypeAllowed,
  isWithinBridgeReplayWindow,
} from "../protocol";

const NOW = new Date("2026-09-25T10:00:00.000Z");
const KEY_ID = "v1-2026-09-25-abc123";

function rawEnvelope(overrides: Record<string, unknown> = {}) {
  return {
    header: {
      protocolVersion: BRIDGE_PROTOCOL_VERSION,
      messageId: "msg_0001",
      correlationId: "corr_0001",
      externalId: "v1-patient-42",
      direction: "v1_to_v2",
      sourceRuntime: "v1",
      targetRuntime: "v2",
      messageType: "patient.created",
      schemaVersion: BRIDGE_DEFAULT_SCHEMA_VERSION,
      sentAt: NOW.toISOString(),
      nonce: "nonce-0001",
      keyId: KEY_ID,
    },
    payloadHash: "a".repeat(64),
    signature: "signature-value-0123456789",
    encryption: {
      algorithm: "aes-256-gcm",
      keyId: KEY_ID,
      iv: "AAAAAAAAAAAAAAAA",
      authTag: "AAAAAAAAAAAAAAAAAAAAAA",
      ciphertext: "AAAA",
      byteSize: 128,
    },
    ...overrides,
  };
}

describe("message catalogue", () => {
  it("pins the protocol version, schema versions and the catalogue size", () => {
    expect(BRIDGE_PROTOCOL_VERSION).toBe("2026-09-bridge-v1");
    expect(BRIDGE_SCHEMA_VERSIONS).toContain(BRIDGE_DEFAULT_SCHEMA_VERSION);
    expect(BRIDGE_MESSAGE_TYPES.length).toBe(15);
    expect(isBridgeMessageType("patient.created")).toBe(true);
    expect(isBridgeMessageType("patient.teleported")).toBe(false);
  });

  it("defines a strict payload contract for every message type", () => {
    for (const type of BRIDGE_MESSAGE_TYPES) {
      expect(BRIDGE_PAYLOAD_CONTRACTS[type], type).toBeDefined();
    }
    expect(Object.keys(BRIDGE_PAYLOAD_CONTRACTS)).toHaveLength(
      BRIDGE_MESSAGE_TYPES.length,
    );
  });

  it("keeps the v1 → v2 mirror narrow and the v2 → v1 control plane narrower", () => {
    expect(BRIDGE_ALLOWED_MESSAGE_TYPES.v1_to_v2).toContain("patient.created");
    expect(BRIDGE_ALLOWED_MESSAGE_TYPES.v2_to_v1).not.toContain("patient.created");
    expect(BRIDGE_ALLOWED_MESSAGE_TYPES.v2_to_v1).not.toContain(
      "clinical.soap_note.drafted",
    );
    expect(isBridgeMessageTypeAllowed("v1_to_v2", "patient.created")).toBe(true);
    expect(isBridgeMessageTypeAllowed("v2_to_v1", "patient.created")).toBe(false);
  });
});

describe("envelope validation", () => {
  it("accepts a well-formed v1 → v2 envelope", () => {
    const result = validateBridgeEnvelope(rawEnvelope(), { now: NOW });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.header.messageType).toBe("patient.created");
      expect(bridgeEnvelopeSchema.safeParse(rawEnvelope()).success).toBe(true);
    }
  });

  it("rejects a malformed envelope and still reports the peer's ids", () => {
    const result = validateBridgeEnvelope(
      { header: { messageId: "msg_0001", correlationId: "corr_0001" } },
      { now: NOW },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failureCode).toBe("malformed_envelope");
      expect(result.messageId).toBe("msg_0001");
      expect(result.issues.length).toBeGreaterThan(0);
    }
  });

  it("rejects an unknown message type and an unsupported schema version", () => {
    const unknownType = rawEnvelope({
      header: { ...rawEnvelope().header, messageType: "patient.teleported" },
    });
    const unknownResult = validateBridgeEnvelope(unknownType, { now: NOW });
    expect(unknownResult.ok).toBe(false);
    if (!unknownResult.ok) expect(unknownResult.failureCode).toBe("malformed_envelope");

    const oldSchema = rawEnvelope({
      header: { ...rawEnvelope().header, schemaVersion: "0.9" },
    });
    const schemaResult = validateBridgeEnvelope(oldSchema, { now: NOW });
    expect(schemaResult.ok).toBe(false);
    if (!schemaResult.ok) {
      expect(schemaResult.failureCode).toBe("unsupported_schema_version");
    }
  });

  it("enforces the direction ↔ runtime agreement", () => {
    const swapped = rawEnvelope({
      header: {
        ...rawEnvelope().header,
        direction: "v1_to_v2",
        sourceRuntime: "v2",
        targetRuntime: "v1",
      },
    });
    const result = validateBridgeEnvelope(swapped, { now: NOW });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failureCode).toBe("direction_not_allowed");
  });

  it("enforces the direction ↔ message-type matrix", () => {
    const wrongDirection = rawEnvelope({
      header: {
        ...rawEnvelope().header,
        direction: "v2_to_v1",
        sourceRuntime: "v2",
        targetRuntime: "v1",
        messageType: "patient.created",
      },
    });
    const result = validateBridgeEnvelope(wrongDirection, { now: NOW });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failureCode).toBe("message_type_not_allowed");
  });

  it("refuses an envelope addressed to the other runtime", () => {
    const result = validateBridgeEnvelope(rawEnvelope(), {
      now: NOW,
      expectedTarget: "v1",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failureCode).toBe("direction_not_allowed");
  });

  it("refuses stale and far-future timestamps (replay window)", () => {
    const stale = rawEnvelope({
      header: { ...rawEnvelope().header, sentAt: "2026-09-25T09:40:00.000Z" },
    });
    const staleResult = validateBridgeEnvelope(stale, { now: NOW });
    expect(staleResult.ok).toBe(false);
    if (!staleResult.ok) expect(staleResult.failureCode).toBe("stale_timestamp");

    const future = rawEnvelope({
      header: { ...rawEnvelope().header, sentAt: "2026-09-25T10:05:00.000Z" },
    });
    expect(validateBridgeEnvelope(future, { now: NOW }).ok).toBe(false);
    expect(isWithinBridgeReplayWindow(NOW.toISOString(), NOW)).toBe(true);
    expect(isWithinBridgeReplayWindow("not-a-date", NOW)).toBe(false);
  });

  it("refuses a key id mismatch between header and encryption block", () => {
    const mismatched = rawEnvelope({
      encryption: {
        ...rawEnvelope().encryption,
        keyId: "v1-2026-09-25-other1",
      },
    });
    expect(validateBridgeEnvelope(mismatched, { now: NOW }).ok).toBe(false);
  });

  it("binds the header into the AAD deterministically", () => {
    const header = rawEnvelope().header as never;
    expect(bridgeEnvelopeAad(header)).toBe(bridgeEnvelopeAad(header));
    expect(bridgeEnvelopeAad(header)).toContain(BRIDGE_PROTOCOL_VERSION);
  });
});

describe("payload contracts", () => {
  it("accepts a patient mirror record", () => {
    const result = validateBridgePayload("patient.created", {
      patientId: "P-1",
      clientId: "C-1",
      name: "Rex",
      species: "dog",
      sex: "male",
      status: "active",
    });
    expect(result.ok).toBe(true);
  });

  it("refuses unknown fields anywhere in a payload (fail closed)", () => {
    const result = validateBridgePayload("patient.created", {
      patientId: "P-1",
      clientId: "C-1",
      name: "Rex",
      species: "dog",
      sex: "male",
      status: "active",
      photoUrl: "https://evil.example/x.png",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failureCode).toBe("payload_invalid");
  });

  it("keeps AI SOAP notes drafted — a pre-signed payload cannot cross", () => {
    const signed = validateBridgePayload("clinical.soap_note.drafted", {
      encounterId: "E-1",
      patientId: "P-1",
      author: "ai",
      status: "signed",
      requiresVetSignoff: true,
    });
    expect(signed.ok).toBe(false);

    const drafted = validateBridgePayload("clinical.soap_note.drafted", {
      encounterId: "E-1",
      patientId: "P-1",
      author: "ai",
      status: "draft",
      assessment: "Suspektná piometra.",
      requiresVetSignoff: true,
    });
    expect(drafted.ok).toBe(true);
  });

  it("cannot express an AI prefill on a controlled-substance ledger entry", () => {
    const base = {
      patientId: "P-1",
      substanceName: "Ketamín 10%",
      quantity: 1.5,
      unit: "ml",
      action: "administered" as const,
      witnessedBy: "MVDr. Novák",
      ledgerId: "OPL-1",
      administeredAt: NOW.toISOString(),
      manualEntry: true as const,
    };

    expect(validateBridgePayload("controlled_substance.dispense", base).ok).toBe(true);
    expect(
      validateBridgePayload("controlled_substance.dispense", {
        ...base,
        aiPrefill: true,
      }).ok,
    ).toBe(false);
    expect(
      validateBridgePayload("controlled_substance.dispense", {
        ...base,
        manualEntry: false,
      }).ok,
    ).toBe(false);
  });

  it("keeps imaging attachments out of patient.photoUrl", () => {
    const result = validateBridgePayload("attachment.linked", {
      patientId: "P-1",
      fileId: "F-1",
      category: "imaging",
      modality: "RTG",
      photoUrl: "https://example.org/rex.png",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a payload that exceeds the size ceiling", () => {
    const result = validateBridgePayload("clinical.soap_note.drafted", {
      encounterId: "E-1",
      patientId: "P-1",
      author: "vet",
      status: "draft",
      plan: "x".repeat(BRIDGE_MAX_PAYLOAD_BYTES + 1),
      requiresVetSignoff: false,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failureCode).toBe("payload_invalid");
  });

  it("validates a heartbeat and a schema negotiation", () => {
    expect(
      validateBridgePayload("bridge.heartbeat", {
        runtime: "v1",
        at: NOW.toISOString(),
        version: BRIDGE_PROTOCOL_VERSION,
      }).ok,
    ).toBe(true);
    expect(
      validateBridgePayload("bridge.schema_negotiation", {
        requestedBy: "v2",
        versions: ["1.0"],
        acceptedVersion: BRIDGE_DEFAULT_SCHEMA_VERSION,
        protocolVersion: BRIDGE_PROTOCOL_VERSION,
      }).ok,
    ).toBe(true);
  });
});

describe("patient status vocabulary", () => {
  it("recognizes deceased and euthanized patients", () => {
    expect(bridgePatientStatusSchema.safeParse("deceased").success).toBe(true);
    expect(isBridgePatientDeceased("deceased")).toBe(true);
    expect(isBridgePatientDeceased("euthanized")).toBe(true);
    expect(isBridgePatientDeceased("active")).toBe(false);
    expect(isBridgePatientDeceased(undefined)).toBe(false);
  });
});
