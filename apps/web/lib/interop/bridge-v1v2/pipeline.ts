/**
 * Secure Interop Bridge v1 → v2 — ingest & dispatch pipeline (Sprint 30).
 * ----------------------------------------------------------------------
 * One deterministic path in, one out. Both are pure: the router supplies the
 * key material (from the deployment secret store, never from PostgreSQL) and
 * persists the decision the pipeline returns.
 *
 * Ingest order is intentional and non-negotiable:
 *
 *   envelope schema → key id → replay window/nonce → HMAC signature →
 *   AES-256-GCM decryption → payload hash → payload contract →
 *   statutory safety gates
 *
 * A failure at any step stops the chain (`rejected` for structural problems the
 * peer can fix, `quarantined` for anything that authenticated incorrectly or
 * tripped a clinical gate) — untrusted bytes are never handed onward.
 */
import {
  BridgeCryptoError,
  bridgeKeyInfo,
  bridgePayloadHash,
  decryptBridgePayload,
  deriveBridgeKey,
  encryptBridgePayload,
  generateBridgeMessageId,
  generateBridgeNonce,
  signBridgeEnvelope,
  verifyBridgeEnvelopeSignature,
} from "./crypto";
import {
  BRIDGE_PROTOCOL_VERSION,
  BRIDGE_SCHEMA_VERSIONS,
  type BridgeDirection,
  type BridgeEnvelope,
  type BridgeEnvelopeHeader,
  bridgeEnvelopeAad,
  bridgePayloadByteSize,
  bridgeSourceRuntime,
  bridgeTargetRuntime,
  type BridgeMessageType,
  type BridgeRuntime,
  canonicalBridgeJson,
  isBridgeMessageTypeAllowed,
  redactBridgePayload,
} from "./protocol";
import {
  type BridgeFailureCode,
  type BridgePatientStatus,
  type BridgeValidationIssue,
  validateBridgeEnvelope,
  validateBridgePayload,
} from "./validation";
import {
  applyBridgeSafetyGates,
  type BridgeSafetyGateResult,
} from "./safety";

export type BridgeIngestStatus = "validated" | "quarantined" | "rejected";

export interface BridgeIngestContext {
  /** Runtime this process represents — normally the OpenVPM AI "v2" side. */
  receiverRuntime: BridgeRuntime;
  /** Shared secret of the *sending* runtime (deployment secret store). */
  secret: string;
  /** Per-key HKDF salt published alongside the key registry entry. */
  salt: string;
  /** Active key id expected on the envelope; anything else is unknown. */
  keyId: string;
  now?: Date;
  /** Nonces already stored for this practice — blocks replay. */
  seenNonces?: Iterable<string>;
  /** Authoritative patient status resolved locally, if the payload names one. */
  patientStatus?: BridgePatientStatus | null;
}

export interface BridgeIngestOutcome {
  status: BridgeIngestStatus;
  failureCode: BridgeFailureCode | null;
  issues: BridgeValidationIssue[];
  messageId: string | null;
  correlationId: string | null;
  messageType: BridgeMessageType | null;
  direction: BridgeDirection | null;
  keyId: string | null;
  payloadHash: string | null;
  plaintextBytes: number;
  header: BridgeEnvelopeHeader | null;
  payload: Record<string, unknown> | null;
  /** PHI-reduced payload for the operator console and audit log. */
  redactedPayload: unknown | null;
  gates: BridgeSafetyGateResult | null;
}

function normaliseIssues(issues: BridgeValidationIssue[]): BridgeValidationIssue[] {
  return issues.map((issue) => ({ ...issue }));
}

function emptyOutcome(partial: Partial<BridgeIngestOutcome>): BridgeIngestOutcome {
  return {
    status: "rejected",
    failureCode: null,
    issues: [],
    messageId: null,
    correlationId: null,
    messageType: null,
    direction: null,
    keyId: null,
    payloadHash: null,
    plaintextBytes: 0,
    header: null,
    payload: null,
    redactedPayload: null,
    gates: null,
    ...partial,
  };
}

function nonceSet(seen?: Iterable<string>): Set<string> {
  return new Set(seen ?? []);
}

/**
 * Validates, authenticates, decrypts and safety-gates an inbound envelope.
 * Never throws — the caller persists {@link BridgeIngestOutcome}.
 */
export function ingestBridgeEnvelope(
  raw: unknown,
  context: BridgeIngestContext,
): BridgeIngestOutcome {
  const now = context.now ?? new Date();
  const validation = validateBridgeEnvelope(raw, {
    now,
    expectedTarget: context.receiverRuntime,
  });

  if (!validation.ok) {
    return emptyOutcome({
      status: "rejected",
      failureCode: validation.failureCode,
      issues: normaliseIssues(validation.issues),
      messageId: validation.messageId,
      correlationId: validation.correlationId,
    });
  }

  const { envelope, header } = validation;
  const base = {
    messageId: header.messageId,
    correlationId: header.correlationId,
    messageType: header.messageType,
    direction: header.direction,
    keyId: header.keyId,
    payloadHash: envelope.payloadHash,
    header,
    plaintextBytes: envelope.encryption.byteSize,
  };

  if (header.keyId !== context.keyId) {
    return emptyOutcome({
      ...base,
      status: "rejected",
      failureCode: "unknown_key_id",
      issues: [
        {
          path: "header.keyId",
          code: "unknown_key_id",
          message: `Envelope was sealed with key "${header.keyId}", which is not the active key for this endpoint.`,
        },
      ],
    });
  }

  if (nonceSet(context.seenNonces).has(header.nonce)) {
    return emptyOutcome({
      ...base,
      status: "rejected",
      failureCode: "replay_detected",
      issues: [
        {
          path: "header.nonce",
          code: "replay_detected",
          message:
            "Nonce already processed — the envelope is a replay and was refused.",
        },
      ],
    });
  }

  const senderRuntime = bridgeSourceRuntime(header.direction);
  let key: Buffer;
  try {
    key = deriveBridgeKey(
      context.secret,
      context.salt,
      bridgeKeyInfo(senderRuntime, header.keyId),
    );
  } catch (error) {
    return emptyOutcome({
      ...base,
      status: "rejected",
      failureCode: "unknown_key_id",
      issues: [
        {
          path: "header.keyId",
          code: "unknown_key_id",
          message:
            error instanceof BridgeCryptoError
              ? error.message
              : "Bridge key material is not configured for this endpoint.",
        },
      ],
    });
  }

  if (
    !verifyBridgeEnvelopeSignature(
      header,
      envelope.payloadHash,
      envelope.signature,
      key,
    )
  ) {
    return emptyOutcome({
      ...base,
      status: "quarantined",
      failureCode: "signature_invalid",
      issues: [
        {
          path: "signature",
          code: "signature_invalid",
          message:
            "Envelope signature does not verify against the registered bridge key.",
        },
      ],
    });
  }

  let decrypted: unknown;
  try {
    decrypted = decryptBridgePayload(
      envelope.encryption,
      key,
      bridgeEnvelopeAad(header),
    );
  } catch (error) {
    return emptyOutcome({
      ...base,
      status: "quarantined",
      failureCode: "decryption_failed",
      issues: [
        {
          path: "encryption.ciphertext",
          code: "decryption_failed",
          message:
            error instanceof BridgeCryptoError
              ? error.message
              : "Bridge payload could not be decrypted.",
        },
      ],
    });
  }

  const computedHash = bridgePayloadHash(decrypted);
  if (computedHash !== envelope.payloadHash) {
    return emptyOutcome({
      ...base,
      status: "quarantined",
      failureCode: "payload_hash_mismatch",
      issues: [
        {
          path: "payloadHash",
          code: "payload_hash_mismatch",
          message:
            "Decrypted payload does not match the signed payload digest.",
        },
      ],
    });
  }

  const payloadValidation = validateBridgePayload(
    header.messageType,
    decrypted,
  );
  if (!payloadValidation.ok) {
    return emptyOutcome({
      ...base,
      status: "quarantined",
      failureCode: payloadValidation.failureCode,
      issues: normaliseIssues(payloadValidation.issues),
      plaintextBytes: bridgePayloadByteSize(decrypted),
    });
  }

  const gates = applyBridgeSafetyGates({
    messageType: header.messageType,
    payload: payloadValidation.payload,
    patientStatus: context.patientStatus ?? null,
    now,
  });

  if (gates.blocked) {
    return emptyOutcome({
      ...base,
      status: "quarantined",
      failureCode: "safety_gate_blocked",
      issues: gates.issues.map((issue) => ({
        path: issue.path,
        code: issue.code,
        message: issue.message,
      })),
      payload: payloadValidation.payload,
      redactedPayload: redactBridgePayload(payloadValidation.payload),
      gates,
    });
  }

  return emptyOutcome({
    ...base,
    status: "validated",
    failureCode: null,
    issues: gates.issues.map((issue) => ({
      path: issue.path,
      code: issue.code,
      message: issue.message,
    })),
    payload: payloadValidation.payload,
    redactedPayload: redactBridgePayload(payloadValidation.payload),
    gates,
    plaintextBytes: bridgePayloadByteSize(payloadValidation.payload),
  });
}

export interface BridgeDispatchInput {
  direction: BridgeDirection;
  messageType: BridgeMessageType;
  externalId: string;
  correlationId?: string;
  payload: unknown;
  /** Secret of the sending runtime (this endpoint's own key). */
  secret: string;
  salt: string;
  keyId: string;
  messageId?: string;
  nonce?: string;
  now?: Date;
  patientStatus?: BridgePatientStatus | null;
}

export interface BridgeDispatchOutcome {
  ok: boolean;
  status: "sent" | "refused";
  failureCode: BridgeFailureCode | null;
  issues: BridgeValidationIssue[];
  envelope: BridgeEnvelope | null;
  payloadHash: string | null;
  gates: BridgeSafetyGateResult | null;
}

/**
 * Validates, safety-gates, encrypts and signs an outbound message. Refuses to
 * produce an envelope when a statutory gate blocks the payload — the bridge
 * never encrypts something it would have to quarantine on the other side.
 */
export function dispatchBridgeMessage(
  input: BridgeDispatchInput,
): BridgeDispatchOutcome {
  const now = input.now ?? new Date();
  const sourceRuntime = bridgeSourceRuntime(input.direction);
  const targetRuntime = bridgeTargetRuntime(input.direction);

  if (!isBridgeMessageTypeAllowed(input.direction, input.messageType)) {
    return {
      ok: false,
      status: "refused",
      failureCode: "message_type_not_allowed",
      issues: [
        {
          path: "messageType",
          code: "message_type_not_allowed",
          message: `Message type "${input.messageType}" is not allowed on "${input.direction}".`,
        },
      ],
      envelope: null,
      payloadHash: null,
      gates: null,
    };
  }

  const payloadRecord =
    input.payload && typeof input.payload === "object" && !Array.isArray(input.payload)
      ? (input.payload as Record<string, unknown>)
      : {};

  const gates = applyBridgeSafetyGates({
    messageType: input.messageType,
    payload: payloadRecord,
    patientStatus: input.patientStatus ?? null,
    now,
  });

  if (gates.blocked) {
    return {
      ok: false,
      status: "refused",
      failureCode: "safety_gate_blocked",
      issues: gates.issues.map((issue) => ({
        path: issue.path,
        code: issue.code,
        message: issue.message,
      })),
      envelope: null,
      payloadHash: null,
      gates,
    };
  }

  const payloadValidation = validateBridgePayload(input.messageType, input.payload);
  if (!payloadValidation.ok) {
    return {
      ok: false,
      status: "refused",
      failureCode: payloadValidation.failureCode,
      issues: normaliseIssues(payloadValidation.issues),
      envelope: null,
      payloadHash: null,
      gates,
    };
  }

  const header: BridgeEnvelopeHeader = {
    protocolVersion: BRIDGE_PROTOCOL_VERSION,
    messageId: input.messageId ?? generateBridgeMessageId(now),
    correlationId: input.correlationId ?? input.externalId,
    externalId: input.externalId,
    direction: input.direction,
    sourceRuntime,
    targetRuntime,
    messageType: input.messageType,
    schemaVersion: BRIDGE_SCHEMA_VERSIONS[0],
    sentAt: now.toISOString(),
    nonce: input.nonce ?? generateBridgeNonce(now),
    keyId: input.keyId,
  };

  const payloadHash = bridgePayloadHash(payloadValidation.payload);
  const key = deriveBridgeKey(
    input.secret,
    input.salt,
    bridgeKeyInfo(sourceRuntime, input.keyId),
  );
  const encryption = encryptBridgePayload(
    payloadValidation.payload,
    key,
    bridgeEnvelopeAad(header),
    input.keyId,
  );
  const signature = signBridgeEnvelope(header, payloadHash, key);

  return {
    ok: true,
    status: "sent",
    failureCode: null,
    issues: gates.issues.map((issue) => ({
      path: issue.path,
      code: issue.code,
      message: issue.message,
    })),
    envelope: { header, payloadHash, signature, encryption },
    payloadHash,
    gates,
  };
}

/**
 * Serialised envelope for the wire / for `ext_bridge_messages.raw_envelope`.
 * Deterministic so the stored ciphertext blob and its digest are stable.
 */
export function serialiseBridgeEnvelope(envelope: BridgeEnvelope): string {
  return canonicalBridgeJson(envelope);
}

/** Database status a pipeline outcome maps to (`ext_bridge_messages.status`). */
export function bridgeMessageStatusForOutcome(
  outcome: Pick<BridgeIngestOutcome, "status"> | Pick<BridgeDispatchOutcome, "status">,
): string {
  return outcome.status;
}
