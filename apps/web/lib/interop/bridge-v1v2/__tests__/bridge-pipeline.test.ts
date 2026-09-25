/**
 * Secure Interop Bridge v1 → v2 — end-to-end pipeline pins (Sprint 30).
 * ---------------------------------------------------------------------
 * Seal on the v1 side, open on the v2 side. The pipeline must answer
 * `validated` only for a correctly signed, correctly encrypted, schema-valid
 * envelope whose statutory gates pass; everything else is rejected or
 * quarantined with a machine-readable failure code.
 */
import { describe, expect, it } from "vitest";
import {
  bridgeBase64UrlEncode,
  bridgeKeyInfo,
  bridgePayloadHash,
  decryptBridgePayload,
  deriveBridgeKey,
  encryptBridgePayload,
  signBridgeEnvelope,
} from "../crypto";
import {
  BRIDGE_PROTOCOL_VERSION,
  type BridgeEnvelope,
  type BridgeEnvelopeHeader,
  bridgeEnvelopeAad,
} from "../protocol";
import { type BridgeIngestContext, dispatchBridgeMessage, ingestBridgeEnvelope } from "../pipeline";

const SECRET = "integration-bridge-secret-0123456789";
const SALT = "practice-salt";
const KEY_ID = "v1-2026-09-25-abc123";
const NOW = new Date("2026-09-25T10:00:00.000Z");

const context: BridgeIngestContext = {
  receiverRuntime: "v2",
  secret: SECRET,
  salt: SALT,
  keyId: KEY_ID,
  now: NOW,
};

function dispatchedHeartbeat(overrides: { keyId?: string } = {}): BridgeEnvelope {
  const outcome = dispatchBridgeMessage({
    direction: "v1_to_v2",
    messageType: "bridge.heartbeat",
    externalId: "heartbeat-1",
    payload: {
      runtime: "v1",
      at: NOW.toISOString(),
      version: BRIDGE_PROTOCOL_VERSION,
      pendingMessages: 3,
    },
    secret: SECRET,
    salt: SALT,
    keyId: overrides.keyId ?? KEY_ID,
    now: NOW,
  });
  expect(outcome.ok).toBe(true);
  if (!outcome.envelope) throw new Error("envelope missing");
  return outcome.envelope;
}

describe("dispatch", () => {
  it("seals and signs a valid message", () => {
    const envelope = dispatchedHeartbeat();
    expect(envelope.encryption.algorithm).toBe("aes-256-gcm");
    expect(envelope.encryption.keyId).toBe(KEY_ID);
    expect(envelope.payloadHash).toMatch(/^[a-f0-9]{64}$/);
    expect(envelope.signature.length).toBeGreaterThan(10);
    expect(envelope.header.messageType).toBe("bridge.heartbeat");
    // The plaintext never appears in the sealed envelope.
    expect(JSON.stringify(envelope)).not.toContain("pendingMessages");
  });

  it("refuses a message type that is not allowed on the direction", () => {
    const outcome = dispatchBridgeMessage({
      direction: "v2_to_v1",
      messageType: "patient.created",
      externalId: "P-1",
      payload: { patientId: "P-1" },
      secret: SECRET,
      salt: SALT,
      keyId: KEY_ID,
      now: NOW,
    });
    expect(outcome.ok).toBe(false);
    expect(outcome.status).toBe("refused");
    expect(outcome.failureCode).toBe("message_type_not_allowed");
    expect(outcome.envelope).toBeNull();
  });

  it("refuses to seal a payload that violates its contract", () => {
    const outcome = dispatchBridgeMessage({
      direction: "v1_to_v2",
      messageType: "patient.created",
      externalId: "P-1",
      payload: { patientId: "P-1" },
      secret: SECRET,
      salt: SALT,
      keyId: KEY_ID,
      now: NOW,
    });
    expect(outcome.ok).toBe(false);
    expect(outcome.failureCode).toBe("payload_invalid");
  });

  it("refuses to seal an AI-prefilled controlled-substance prescription", () => {
    const outcome = dispatchBridgeMessage({
      direction: "v1_to_v2",
      messageType: "prescription.created",
      externalId: "Rx-1",
      payload: {
        patientId: "P-1",
        medicationName: "Ketamín 10%",
        dosage: "2 mg/kg",
        frequency: "raz",
        durationDays: 1,
        status: "draft",
        aiPrefill: true,
        manualEntry: false,
      },
      secret: SECRET,
      salt: SALT,
      keyId: KEY_ID,
      now: NOW,
    });
    expect(outcome.ok).toBe(false);
    expect(outcome.failureCode).toBe("safety_gate_blocked");
    expect(outcome.gates?.blockCode).toBe(
      "controlled_substance_ai_prefill_forbidden",
    );
  });

  it("refuses an automated reminder for a deceased patient", () => {
    const outcome = dispatchBridgeMessage({
      direction: "v1_to_v2",
      messageType: "appointment.created",
      externalId: "A-1",
      payload: {
        appointmentId: "A-1",
        patientId: "P-1",
        clientId: "C-1",
        scheduledAt: NOW.toISOString(),
        automatedReminder: true,
      },
      secret: SECRET,
      salt: SALT,
      keyId: KEY_ID,
      patientStatus: "deceased",
      now: NOW,
    });
    expect(outcome.ok).toBe(false);
    expect(outcome.gates?.sympathySuppressed).toBe(true);
  });
});

describe("ingest", () => {
  it("accepts a sealed heartbeat and returns a redacted payload", () => {
    const outcome = ingestBridgeEnvelope(dispatchedHeartbeat(), context);
    expect(outcome.status).toBe("validated");
    expect(outcome.failureCode).toBeNull();
    expect(outcome.messageType).toBe("bridge.heartbeat");
    expect(outcome.direction).toBe("v1_to_v2");
    expect(outcome.payload?.version).toBe(BRIDGE_PROTOCOL_VERSION);
    expect(outcome.redactedPayload).toBeTruthy();
    expect(outcome.gates?.blocked).toBe(false);
  });

  it("quarantines tampered ciphertext instead of using it", () => {
    const envelope = dispatchedHeartbeat();
    const tampered: BridgeEnvelope = {
      ...envelope,
      encryption: {
        ...envelope.encryption,
        ciphertext: `${envelope.encryption.ciphertext.slice(0, -2)}AB`,
      },
    };
    const outcome = ingestBridgeEnvelope(tampered, context);
    expect(outcome.status).toBe("quarantined");
    expect(outcome.failureCode).toBe("decryption_failed");
  });

  it("quarantines an envelope re-labelled under another message type", () => {
    const envelope = dispatchedHeartbeat();
    const relabelled: BridgeEnvelope = {
      ...envelope,
      header: { ...envelope.header, messageType: "clinical.soap_note.signed" },
    };
    const outcome = ingestBridgeEnvelope(relabelled, context);
    expect(outcome.status).toBe("quarantined");
    expect(outcome.failureCode).toBe("signature_invalid");
  });

  it("quarantines a payload whose hash no longer matches the signature", () => {
    const envelope = dispatchedHeartbeat();
    const key = deriveBridgeKey(SECRET, SALT, bridgeKeyInfo("v1", KEY_ID));
    const forgedHash = "0".repeat(64);
    const resigned: BridgeEnvelope = {
      ...envelope,
      payloadHash: forgedHash,
      signature: signBridgeEnvelope(envelope.header, forgedHash, key),
    };
    const outcome = ingestBridgeEnvelope(resigned, context);
    expect(outcome.status).toBe("quarantined");
    expect(outcome.failureCode).toBe("payload_hash_mismatch");
  });

  it("rejects a foreign key id without touching the crypto", () => {
    const outcome = ingestBridgeEnvelope(dispatchedHeartbeat({ keyId: "v1-2026-09-25-zzz999" }), context);
    expect(outcome.status).toBe("rejected");
    expect(outcome.failureCode).toBe("unknown_key_id");
  });

  it("rejects a replayed nonce", () => {
    const envelope = dispatchedHeartbeat();
    const outcome = ingestBridgeEnvelope(envelope, {
      ...context,
      seenNonces: [envelope.header.nonce],
    });
    expect(outcome.status).toBe("rejected");
    expect(outcome.failureCode).toBe("replay_detected");
  });

  it("rejects a stale envelope outside the replay window", () => {
    const stale = ingestBridgeEnvelope(dispatchedHeartbeat(), {
      ...context,
      now: new Date("2026-09-25T10:30:00.000Z"),
    });
    expect(stale.status).toBe("rejected");
    expect(stale.failureCode).toBe("stale_timestamp");
  });

  it("rejects a structurally malformed envelope and keeps local ids", () => {
    const outcome = ingestBridgeEnvelope({ hello: "world" }, context);
    expect(outcome.status).toBe("rejected");
    expect(outcome.failureCode).toBe("malformed_envelope");
  });

  it("quarantines a signed payload that violates its contract", () => {
    const header: BridgeEnvelopeHeader = {
      protocolVersion: BRIDGE_PROTOCOL_VERSION,
      messageId: "msg_contract_1",
      correlationId: "corr_contract_1",
      externalId: "P-1",
      direction: "v1_to_v2",
      sourceRuntime: "v1",
      targetRuntime: "v2",
      messageType: "patient.created",
      schemaVersion: "1.0",
      sentAt: NOW.toISOString(),
      nonce: "nonce-contract-1",
      keyId: KEY_ID,
    };
    const key = deriveBridgeKey(SECRET, SALT, bridgeKeyInfo("v1", KEY_ID));
    const aad = bridgeEnvelopeAad(header);
    const brokenPayload = { patientId: "P-1", status: "active", photoUrl: "x" };
    const payloadHash = bridgePayloadHash(brokenPayload);
    const encrypted = encryptBridgePayload(brokenPayload, key, aad, KEY_ID);
    const envelope: BridgeEnvelope = {
      header,
      payloadHash,
      signature: signBridgeEnvelope(header, payloadHash, key),
      encryption: encrypted,
    };

    const outcome = ingestBridgeEnvelope(envelope, context);
    expect(outcome.status).toBe("quarantined");
    expect(outcome.failureCode).toBe("payload_invalid");
  });

  it("quarantines an otherwise valid envelope that trips a safety gate", () => {
    const header: BridgeEnvelopeHeader = {
      protocolVersion: BRIDGE_PROTOCOL_VERSION,
      messageId: "msg_gate_1",
      correlationId: "corr_gate_1",
      externalId: "Rx-9",
      direction: "v1_to_v2",
      sourceRuntime: "v1",
      targetRuntime: "v2",
      messageType: "prescription.created",
      schemaVersion: "1.0",
      sentAt: NOW.toISOString(),
      nonce: "nonce-gate-1",
      keyId: KEY_ID,
    };
    const key = deriveBridgeKey(SECRET, SALT, bridgeKeyInfo("v1", KEY_ID));
    const aad = bridgeEnvelopeAad(header);
    const payload = {
      patientId: "P-1",
      medicationName: "Propofol 1%",
      dosage: "4 mg/kg",
      frequency: "i.v.",
      durationDays: 1,
      status: "draft",
      aiPrefill: true,
      manualEntry: false,
    };
    const payloadHash = bridgePayloadHash(payload);
    const envelope: BridgeEnvelope = {
      header,
      payloadHash,
      signature: signBridgeEnvelope(header, payloadHash, key),
      encryption: encryptBridgePayload(payload, key, aad, KEY_ID),
    };

    const outcome = ingestBridgeEnvelope(envelope, context);
    expect(outcome.status).toBe("quarantined");
    expect(outcome.failureCode).toBe("safety_gate_blocked");
    expect(outcome.gates?.controlledSubstanceTerms.length).toBeGreaterThan(0);
    expect(outcome.redactedPayload).toBeTruthy();
  });

  it("does not leak the plaintext through the ciphertext field on a failed decrypt", () => {
    const envelope = dispatchedHeartbeat();
    const key = deriveBridgeKey(SECRET, SALT, bridgeKeyInfo("v1", KEY_ID));
    // Sanity check: the helper decrypts with the right key, proving the
    // ciphertext is genuinely sealed rather than merely obfuscated.
    expect(decryptBridgePayload(envelope.encryption, key, bridgeEnvelopeAad(envelope.header))).toBeTruthy();
    const outcome = ingestBridgeEnvelope(
      { ...envelope, encryption: { ...envelope.encryption, authTag: bridgeBase64UrlEncode(Buffer.alloc(16)) } },
      context,
    );
    expect(outcome.status).toBe("quarantined");
    expect(outcome.payload).toBeNull();
  });
});
