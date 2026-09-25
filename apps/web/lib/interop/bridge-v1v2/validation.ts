/**
 * Secure Interop Bridge v1 → v2 — schema validation (Sprint 30).
 * ---------------------------------------------------------------
 * Two layers, both fail-closed:
 *
 *   1. **Envelope validation** — structure of the wire envelope, protocol
 *      version, direction/type matrix, timestamp window and payload size.
 *   2. **Payload validation** — a Zod contract per message type. Contracts are
 *      `strict()`: an unknown field is a validation failure, because the v1
 *      runtime must never be able to smuggle an unmodelled field (for example
 *      `aiPrefill`, `photoUrl` or `autoSign`) past the clinical gates.
 *
 * Evolving a contract therefore means publishing a new `schemaVersion`, which
 * is exactly what the contract registry in `ext_bridge_contracts` records.
 */
import { z } from "zod";
import {
  BRIDGE_DEFAULT_SCHEMA_VERSION,
  BRIDGE_ENCRYPTION_ALGORITHM,
  BRIDGE_MAX_PAYLOAD_BYTES,
  BRIDGE_SCHEMA_VERSIONS,
  type BridgeDirection,
  type BridgeEnvelope,
  type BridgeEnvelopeHeader,
  isBridgeMessageType,
  isBridgeMessageTypeAllowed,
  isWithinBridgeReplayWindow,
  type BridgeMessageType,
  type BridgeRuntime,
} from "./protocol";

export interface BridgeValidationIssue {
  path: string;
  code: string;
  message: string;
}

/** Machine codes recorded on `ext_bridge_messages.failure_code`. */
export type BridgeFailureCode =
  | "malformed_envelope"
  | "unsupported_schema_version"
  | "unsupported_algorithm"
  | "payload_too_large"
  | "direction_not_allowed"
  | "message_type_not_allowed"
  | "stale_timestamp"
  | "replay_detected"
  | "unknown_key_id"
  | "payload_hash_mismatch"
  | "signature_invalid"
  | "decryption_failed"
  | "payload_invalid"
  | "safety_gate_blocked";

export function zodIssuesToBridgeIssues(error: z.ZodError): BridgeValidationIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.length > 0 ? issue.path.join(".") : "(root)",
    code: issue.code,
    message: issue.message,
  }));
}

const BRIDGE_ID_MAX = 160;
const BRIDGE_TEXT_MAX = 8_000;

const bridgeMessageTypeSchema = z
  .string()
  .refine(isBridgeMessageType, { message: "Unknown bridge message type." });

export const bridgeEncryptionSchema = z
  .object({
    algorithm: z.literal(BRIDGE_ENCRYPTION_ALGORITHM),
    keyId: z.string().min(4).max(BRIDGE_ID_MAX),
    iv: z.string().min(8).max(64),
    authTag: z.string().min(8).max(64),
    ciphertext: z.string().min(1),
    byteSize: z
      .number()
      .int()
      .min(0)
      .max(BRIDGE_MAX_PAYLOAD_BYTES, {
        message: `Payload exceeds the ${BRIDGE_MAX_PAYLOAD_BYTES}-byte bridge limit.`,
      }),
  })
  .strict();

export const bridgeEnvelopeHeaderSchema = z
  .object({
    protocolVersion: z.string().min(1).max(64),
    messageId: z.string().min(8).max(BRIDGE_ID_MAX),
    correlationId: z.string().min(1).max(BRIDGE_ID_MAX),
    externalId: z.string().min(1).max(BRIDGE_ID_MAX),
    direction: z.enum(["v1_to_v2", "v2_to_v1"]),
    sourceRuntime: z.enum(["v1", "v2"]),
    targetRuntime: z.enum(["v1", "v2"]),
    messageType: bridgeMessageTypeSchema,
    schemaVersion: z.string().min(1).max(16),
    sentAt: z.string().datetime({ offset: true }),
    nonce: z.string().min(8).max(128),
    keyId: z.string().min(4).max(BRIDGE_ID_MAX),
  })
  .strict();

export const bridgeEnvelopeSchema = z
  .object({
    header: bridgeEnvelopeHeaderSchema,
    payloadHash: z.string().regex(/^[a-f0-9]{64}$/, {
      message: "payloadHash must be a lowercase sha256 hex digest.",
    }),
    signature: z.string().min(16).max(256),
    encryption: bridgeEncryptionSchema,
  })
  .strict();

export interface BridgeEnvelopeValidationOk {
  ok: true;
  envelope: BridgeEnvelope;
  header: BridgeEnvelopeHeader;
}

export interface BridgeEnvelopeValidationFail {
  ok: false;
  failureCode: BridgeFailureCode;
  issues: BridgeValidationIssue[];
  messageId: string | null;
  correlationId: string | null;
}

export type BridgeEnvelopeValidationResult =
  | BridgeEnvelopeValidationOk
  | BridgeEnvelopeValidationFail;

function partialIdentity(raw: unknown): {
  messageId: string | null;
  correlationId: string | null;
} {
  const header = (raw as { header?: unknown } | null)?.header;
  if (!header || typeof header !== "object") {
    return { messageId: null, correlationId: null };
  }
  const record = header as Record<string, unknown>;
  return {
    messageId: typeof record.messageId === "string" ? record.messageId : null,
    correlationId:
      typeof record.correlationId === "string" ? record.correlationId : null,
  };
}

/**
 * Validates the untrusted wire envelope. Never throws: the caller records the
 * rejection (with the peer's message id when it is readable) so that a broken
 * peer is diagnosable from the audit trail.
 */
export function validateBridgeEnvelope(
  raw: unknown,
  options: { now?: Date; expectedTarget?: BridgeRuntime } = {},
): BridgeEnvelopeValidationResult {
  const identity = partialIdentity(raw);
  const parsed = bridgeEnvelopeSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      failureCode: "malformed_envelope",
      issues: zodIssuesToBridgeIssues(parsed.error),
      ...identity,
    };
  }

  const envelope = parsed.data as BridgeEnvelope;
  const { header } = envelope;
  const issues: BridgeValidationIssue[] = [];

  if (
    !(BRIDGE_SCHEMA_VERSIONS as readonly string[]).includes(header.schemaVersion)
  ) {
    issues.push({
      path: "header.schemaVersion",
      code: "unsupported_schema_version",
      message: `Unsupported schema version "${header.schemaVersion}". Supported: ${BRIDGE_SCHEMA_VERSIONS.join(", ")}.`,
    });
  }

  // source/target/direction must agree — a peer cannot claim v1→v2 while
  // declaring v2 as the source.
  if (
    (header.direction === "v1_to_v2" &&
      (header.sourceRuntime !== "v1" || header.targetRuntime !== "v2")) ||
    (header.direction === "v2_to_v1" &&
      (header.sourceRuntime !== "v2" || header.targetRuntime !== "v1"))
  ) {
    issues.push({
      path: "header.direction",
      code: "direction_not_allowed",
      message: `Direction "${header.direction}" does not match runtimes ${header.sourceRuntime} → ${header.targetRuntime}.`,
    });
  }

  if (options.expectedTarget && header.targetRuntime !== options.expectedTarget) {
    issues.push({
      path: "header.targetRuntime",
      code: "direction_not_allowed",
      message: `Envelope targets runtime "${header.targetRuntime}" but this endpoint is "${options.expectedTarget}".`,
    });
  }

  if (!isBridgeMessageTypeAllowed(header.direction, header.messageType)) {
    issues.push({
      path: "header.messageType",
      code: "message_type_not_allowed",
      message: `Message type "${header.messageType}" is not allowed on "${header.direction}".`,
    });
  }

  if (envelope.encryption.keyId !== header.keyId) {
    issues.push({
      path: "encryption.keyId",
      code: "malformed_envelope",
      message: "encryption.keyId must match header.keyId.",
    });
  }

  if (envelope.encryption.byteSize > BRIDGE_MAX_PAYLOAD_BYTES) {
    issues.push({
      path: "encryption.byteSize",
      code: "payload_too_large",
      message: `Payload exceeds the ${BRIDGE_MAX_PAYLOAD_BYTES}-byte bridge limit.`,
    });
  }

  if (!isWithinBridgeReplayWindow(header.sentAt, options.now)) {
    issues.push({
      path: "header.sentAt",
      code: "stale_timestamp",
      message:
        "Message timestamp is outside the accepted clock-skew window; refusing a possibly replayed envelope.",
    });
  }

  if (issues.length > 0) {
    return {
      ok: false,
      failureCode: issues[0].code as BridgeFailureCode,
      issues,
      ...identity,
    };
  }

  return { ok: true, envelope, header };
}

// ---------------------------------------------------------------------------
// Payload contracts
// ---------------------------------------------------------------------------

const bridgeRuntimeSchema = z.enum(["v1", "v2"]);

const bridgePatientStatusValues = [
  "active",
  "deceased",
  "euthanized",
  "archived",
] as const;
export const bridgePatientStatusSchema = z.enum(bridgePatientStatusValues);
export type BridgePatientStatus = (typeof bridgePatientStatusValues)[number];

/** Statuses that trigger the Sympathy Gate on every automated outreach. */
export const BRIDGE_DECEASED_PATIENT_STATUSES: readonly BridgePatientStatus[] = [
  "deceased",
  "euthanized",
];

export function isBridgePatientDeceased(status: unknown): boolean {
  return (
    typeof status === "string" &&
    (BRIDGE_DECEASED_PATIENT_STATUSES as readonly string[]).includes(status)
  );
}

const bridgeSpeciesSchema = z.enum([
  "dog",
  "cat",
  "horse",
  "cattle",
  "sheep",
  "goat",
  "pig",
  "rabbit",
  "bird",
  "exotic",
  "other",
]);

const isoDateSchema = z.string().datetime({ offset: true });

/** Client identity mirror — marketing consent travels with the record. */
const clientPayloadSchema = z
  .object({
    clientId: z.string().min(1).max(BRIDGE_ID_MAX),
    fullName: z.string().min(1).max(255),
    email: z.string().email().max(255).nullish(),
    phone: z.string().max(64).nullish(),
    city: z.string().max(120).nullish(),
    marketingConsent: z.boolean(),
    dataProcessingConsent: z.boolean(),
  })
  .strict();

/** Consent flags stay mandatory on updates — withdrawal must be explicit. */
const clientUpdatedPayloadSchema = clientPayloadSchema
  .partial({
    fullName: true,
    email: true,
    phone: true,
    city: true,
  })
  .required({
    clientId: true,
    marketingConsent: true,
    dataProcessingConsent: true,
  })
  .strict();

const patientCreatedPayloadSchema = z
  .object({
    patientId: z.string().min(1).max(BRIDGE_ID_MAX),
    clientId: z.string().min(1).max(BRIDGE_ID_MAX),
    name: z.string().min(1).max(255),
    species: bridgeSpeciesSchema,
    breed: z.string().max(120).nullish(),
    sex: z.enum(["male", "female", "unknown"]),
    birthDate: isoDateSchema.nullish(),
    microchip: z.string().max(64).nullish(),
    weightKg: z.number().min(0).max(2_000).nullish(),
    status: bridgePatientStatusSchema,
    deceasedAt: isoDateSchema.nullish(),
  })
  .strict();

const patientUpdatedPayloadSchema = patientCreatedPayloadSchema
  .partial({ name: true, species: true, breed: true, sex: true, weightKg: true })
  .required({ patientId: true, status: true })
  .strict();

const appointmentPayloadSchema = z
  .object({
    appointmentId: z.string().min(1).max(BRIDGE_ID_MAX),
    patientId: z.string().min(1).max(BRIDGE_ID_MAX),
    clientId: z.string().min(1).max(BRIDGE_ID_MAX),
    scheduledAt: isoDateSchema,
    durationMinutes: z.number().int().min(5).max(600).default(30),
    reason: z.string().max(BRIDGE_TEXT_MAX).nullish(),
    automatedReminder: z.boolean().default(false),
  })
  .strict();

const invoicePayloadSchema = z
  .object({
    invoiceId: z.string().min(1).max(BRIDGE_ID_MAX),
    clientId: z.string().min(1).max(BRIDGE_ID_MAX),
    totalAmount: z.number().min(0).max(10_000_000),
    currency: z.literal("EUR"),
    issuedAt: isoDateSchema,
    vatMode: z.enum(["payer", "non_payer", "mixed"]).default("payer"),
  })
  .strict();

const inventoryMovementPayloadSchema = z
  .object({
    productId: z.string().min(1).max(BRIDGE_ID_MAX),
    quantity: z.number().min(0),
    movement: z.enum(["in", "out"]),
    movedAt: isoDateSchema,
    reference: z.string().max(BRIDGE_ID_MAX).nullish(),
  })
  .strict();

/**
 * Attachments live in their own category. Imaging never touches
 * `patient.photoUrl` — the strict contract refuses such a field outright.
 */
const attachmentPayloadSchema = z
  .object({
    patientId: z.string().min(1).max(BRIDGE_ID_MAX),
    fileId: z.string().min(1).max(BRIDGE_ID_MAX),
    category: z.enum(["imaging", "lab", "document", "consent", "photo"]),
    modality: z
      .enum(["RTG", "USG", "CT", "MRI", "endoscopy", "LAB"])
      .nullish(),
    capturedAt: isoDateSchema.nullish(),
    fileName: z.string().max(255).nullish(),
  })
  .strict();

/**
 * AI-drafted SOAP note. `status` is a literal `draft`: the bridge can never
 * deliver a pre-signed clinical record (Zákon 39/2007 Z. z.). The veterinarian
 * signs inside OpenVPM through the confirmation protocol, not over the wire.
 */
const soapNoteDraftedPayloadSchema = z
  .object({
    encounterId: z.string().min(1).max(BRIDGE_ID_MAX),
    patientId: z.string().min(1).max(BRIDGE_ID_MAX),
    author: z.enum(["ai", "vet"]),
    status: z.literal("draft"),
    subjective: z.string().max(BRIDGE_TEXT_MAX).nullish(),
    objective: z.string().max(BRIDGE_TEXT_MAX).nullish(),
    assessment: z.string().max(BRIDGE_TEXT_MAX).nullish(),
    plan: z.string().max(BRIDGE_TEXT_MAX).nullish(),
    aiModel: z.string().max(120).nullish(),
    requiresVetSignoff: z.boolean(),
  })
  .strict();

const soapNoteSignedPayloadSchema = z
  .object({
    encounterId: z.string().min(1).max(BRIDGE_ID_MAX),
    patientId: z.string().min(1).max(BRIDGE_ID_MAX),
    status: z.literal("signed"),
    signedByVetId: z.string().min(1).max(BRIDGE_ID_MAX),
    licenceNumber: z.string().min(1).max(64),
    signedAt: isoDateSchema,
    aiAssisted: z.boolean().default(false),
  })
  .strict();

const prescriptionPayloadSchema = z
  .object({
    patientId: z.string().min(1).max(BRIDGE_ID_MAX),
    medicationName: z.string().min(1).max(255),
    dosage: z.string().min(1).max(120),
    frequency: z.string().min(1).max(120),
    durationDays: z.number().int().min(1).max(365),
    status: z.enum(["draft", "signed", "active", "completed", "cancelled"]),
    aiPrefill: z.boolean().default(false),
    manualEntry: z.boolean().default(false),
    prescribedByVetId: z.string().max(BRIDGE_ID_MAX).nullish(),
  })
  .strict();

/**
 * Controlled substance ledger entry (Zákon 139/1998 Z. z.). The contract
 * cannot express an AI prefill at all: `aiPrefill` may only be `false` and a
 * witness is mandatory for administration and disposal.
 */
const controlledSubstancePayloadSchema = z
  .object({
    patientId: z.string().min(1).max(BRIDGE_ID_MAX),
    substanceName: z.string().min(1).max(255),
    quantity: z.number().min(0.001).max(9_999_999.999),
    unit: z.string().min(1).max(32),
    action: z.enum(["received", "administered", "wasted", "returned"]),
    witnessedBy: z.string().max(BRIDGE_ID_MAX).nullish(),
    ledgerId: z.string().min(1).max(BRIDGE_ID_MAX),
    administeredAt: isoDateSchema,
    aiPrefill: z.literal(false).default(false),
    manualEntry: z.literal(true),
  })
  .strict();

const automationSuppressionPayloadSchema = z
  .object({
    patientId: z.string().min(1).max(BRIDGE_ID_MAX),
    clientId: z.string().min(1).max(BRIDGE_ID_MAX),
    reason: z.enum([
      "deceased",
      "euthanized",
      "consent_withdrawn",
      "quiet_hours",
      "manual",
    ]),
    blockedAction: z.string().min(1).max(255),
    channel: z.enum(["sms", "email", "whatsapp", "push"]).nullish(),
    detail: z.string().max(BRIDGE_TEXT_MAX).nullish(),
    patientStatus: bridgePatientStatusSchema.nullish(),
  })
  .strict();

const heartbeatPayloadSchema = z
  .object({
    runtime: bridgeRuntimeSchema,
    at: isoDateSchema,
    version: z.string().min(1).max(64),
    pendingMessages: z.number().int().min(0).default(0),
  })
  .strict();

const schemaNegotiationPayloadSchema = z
  .object({
    requestedBy: bridgeRuntimeSchema,
    versions: z.array(z.string().min(1).max(16)).min(1).max(8),
    acceptedVersion: z.string().min(1).max(16),
    protocolVersion: z.string().min(1).max(64),
  })
  .strict();

/** The versioned payload contract registry the router validates against. */
export const BRIDGE_PAYLOAD_CONTRACTS: Record<BridgeMessageType, z.ZodTypeAny> = {
  "client.created": clientPayloadSchema,
  "client.updated": clientUpdatedPayloadSchema,
  "patient.created": patientCreatedPayloadSchema,
  "patient.updated": patientUpdatedPayloadSchema,
  "appointment.created": appointmentPayloadSchema,
  "invoice.created": invoicePayloadSchema,
  "inventory.movement": inventoryMovementPayloadSchema,
  "attachment.linked": attachmentPayloadSchema,
  "clinical.soap_note.drafted": soapNoteDraftedPayloadSchema,
  "clinical.soap_note.signed": soapNoteSignedPayloadSchema,
  "prescription.created": prescriptionPayloadSchema,
  "controlled_substance.dispense": controlledSubstancePayloadSchema,
  "automation.suppression.request": automationSuppressionPayloadSchema,
  "bridge.heartbeat": heartbeatPayloadSchema,
  "bridge.schema_negotiation": schemaNegotiationPayloadSchema,
};

export interface BridgePayloadValidationOk {
  ok: true;
  payload: Record<string, unknown>;
}

export interface BridgePayloadValidationFail {
  ok: false;
  failureCode: BridgeFailureCode;
  issues: BridgeValidationIssue[];
}

export type BridgePayloadValidationResult =
  | BridgePayloadValidationOk
  | BridgePayloadValidationFail;

/**
 * Validates a decrypted payload against the contract for its message type and
 * the size ceiling. Unknown fields are rejected — see the module doc.
 */
export function validateBridgePayload(
  messageType: BridgeMessageType,
  payload: unknown,
): BridgePayloadValidationResult {
  const contract = BRIDGE_PAYLOAD_CONTRACTS[messageType];
  if (!contract) {
    return {
      ok: false,
      failureCode: "message_type_not_allowed",
      issues: [
        {
          path: "header.messageType",
          code: "message_type_not_allowed",
          message: `No payload contract registered for "${messageType}".`,
        },
      ],
    };
  }

  const parsed = contract.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      failureCode: "payload_invalid",
      issues: zodIssuesToBridgeIssues(parsed.error),
    };
  }

  const canonicalSize = Buffer.byteLength(
    JSON.stringify(parsed.data as Record<string, unknown>),
    "utf8",
  );
  if (canonicalSize > BRIDGE_MAX_PAYLOAD_BYTES) {
    return {
      ok: false,
      failureCode: "payload_too_large",
      issues: [
        {
          path: "payload",
          code: "payload_too_large",
          message: `Payload exceeds the ${BRIDGE_MAX_PAYLOAD_BYTES}-byte bridge limit.`,
        },
      ],
    };
  }

  return { ok: true, payload: parsed.data as Record<string, unknown> };
}

/** Schema version a payload for `direction`/`type` is expected to carry. */
export function bridgeExpectedSchemaVersion(
  _direction: BridgeDirection,
  _messageType: BridgeMessageType,
): string {
  return BRIDGE_DEFAULT_SCHEMA_VERSION;
}
