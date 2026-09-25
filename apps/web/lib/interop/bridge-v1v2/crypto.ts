/**
 * Secure Interop Bridge v1 → v2 — cryptography (Sprint 30).
 * ---------------------------------------------------------
 * Pure `node:crypto` primitives, no I/O:
 *
 *   • AES-256-GCM authenticated encryption for every payload, with the
 *     canonical envelope header bound as additional authenticated data (AAD),
 *   • HMAC-SHA256 envelope signatures with constant-time verification,
 *   • HKDF-SHA256 key derivation from a per-runtime secret (env var or
 *     managed secret), so no long-lived key material is stored in PostgreSQL,
 *   • SHA-256 key fingerprints — the database only ever holds a fingerprint
 *     and a secret *reference*, never the secret itself
 *     (`security/policies/bridge.md`).
 *
 * Fail-closed: every failure path throws a typed {@link BridgeCryptoError};
 * callers quarantine the message and record the audit trail instead of
 * proceeding with untrusted bytes.
 */
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import {
  BRIDGE_AUTH_TAG_BYTES,
  BRIDGE_ENCRYPTION_ALGORITHM,
  BRIDGE_IV_BYTES,
  BRIDGE_KEY_BYTES,
  BRIDGE_NONCE_BYTES,
  BRIDGE_SIGNATURE_ALGORITHM,
  canonicalBridgeJson,
  type BridgeEncryptedPayload,
  type BridgeEnvelopeHeader,
  bridgeEnvelopeAad,
  type BridgeRuntime,
} from "./protocol";

export type BridgeCryptoErrorCode =
  | "invalid_key"
  | "malformed_envelope"
  | "unsupported_algorithm"
  | "auth_failed"
  | "undecryptable_payload";

export class BridgeCryptoError extends Error {
  readonly code: BridgeCryptoErrorCode;

  constructor(code: BridgeCryptoErrorCode, message: string) {
    super(message);
    this.name = "BridgeCryptoError";
    this.code = code;
  }
}

/**
 * Environment variable holding the raw bridge secret for a runtime. The value
 * never reaches the database; operators provision it through the deployment
 * secret store (see `security/policies/bridge.md`).
 */
export function bridgeSecretEnvVar(runtime: BridgeRuntime): string {
  return runtime === "v1"
    ? "OPENVPM_BRIDGE_V1_SECRET"
    : "OPENVPM_BRIDGE_V2_SECRET";
}

/** HKDF info string — separates key material from any other v1/v2 use. */
export function bridgeKeyInfo(runtime: BridgeRuntime, keyId: string): string {
  return `openvpm-interop-bridge:${runtime}:${keyId}`;
}

function assertKeyLength(key: Buffer | Uint8Array): Buffer {
  const buffer = Buffer.isBuffer(key) ? key : Buffer.from(key);
  if (buffer.length !== BRIDGE_KEY_BYTES) {
    throw new BridgeCryptoError(
      "invalid_key",
      `Bridge keys must be ${BRIDGE_KEY_BYTES} bytes (received ${buffer.length}).`,
    );
  }
  return buffer;
}

/**
 * Derives a 256-bit AES/HMAC key from a secret + per-key salt. Deterministic:
 * both runtimes derive the same key from the same triple, and rotating the
 * `keyId` (which is part of `info`) produces a completely different key
 * without touching the secret.
 */
export function deriveBridgeKey(
  secret: string,
  salt: string,
  info: string,
): Buffer {
  if (typeof secret !== "string" || secret.length < 16) {
    throw new BridgeCryptoError(
      "invalid_key",
      "Bridge secret must be a string of at least 16 characters.",
    );
  }
  const derived = hkdfSync(
    "sha256",
    Buffer.from(secret, "utf8"),
    Buffer.from(salt, "utf8"),
    Buffer.from(info, "utf8"),
    BRIDGE_KEY_BYTES,
  );
  return Buffer.from(derived);
}

/** SHA-256 hex digest of the canonical (key-sorted) JSON of a value. */
export function bridgePayloadHash(payload: unknown): string {
  return createHash("sha256")
    .update(canonicalBridgeJson(payload), "utf8")
    .digest("hex");
}

/** SHA-256 hex digest of an arbitrary string. */
export function bridgeSha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/**
 * Non-secret key fingerprint (`sha256:<hex>`), stable across restarts.
 * Stored per key so an operator can confirm which secret a runtime holds
 * without ever exporting it.
 */
export function fingerprintBridgeKey(secret: string): string {
  return `sha256:${createHash("sha256").update(secret, "utf8").digest("hex")}`;
}

/** Constant-time comparison that never leaks length through early return. */
export function safeBridgeEquals(left: string, right: string): boolean {
  const a = Buffer.from(left, "utf8");
  const b = Buffer.from(right, "utf8");
  if (a.length !== b.length) {
    // Still compare against itself so the timing profile stays flat.
    timingSafeEqual(a, a);
    return false;
  }
  return timingSafeEqual(a, b);
}

function toBase64Url(buffer: Buffer): string {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64Url(value: string, field: string): Buffer {
  if (typeof value !== "string" || value.length === 0) {
    throw new BridgeCryptoError(
      "malformed_envelope",
      `Encrypted bridge field "${field}" is missing.`,
    );
  }
  const normalised = value.replace(/-/g, "+").replace(/_/g, "/");
  const buffer = Buffer.from(normalised, "base64");
  if (buffer.length === 0) {
    throw new BridgeCryptoError(
      "malformed_envelope",
      `Encrypted bridge field "${field}" is not valid base64url.`,
    );
  }
  return buffer;
}

export function bridgeBase64UrlEncode(buffer: Buffer): string {
  return toBase64Url(buffer);
}

export function bridgeBase64UrlDecode(value: string): Buffer {
  return fromBase64Url(value, "value");
}

/**
 * Encrypts a payload with AES-256-GCM.
 *
 * `additionalData` must be {@link bridgeEnvelopeAad} of the envelope header:
 * it is authenticated but not encrypted, so a peer cannot re-label the body.
 */
export function encryptBridgePayload(
  payload: unknown,
  key: Buffer | Uint8Array,
  additionalData: string,
  keyId = "",
): BridgeEncryptedPayload {
  const keyBuffer = assertKeyLength(key);
  const plaintext = canonicalBridgeJson(payload);
  const iv = randomBytes(BRIDGE_IV_BYTES);
  const cipher = createCipheriv(BRIDGE_ENCRYPTION_ALGORITHM, keyBuffer, iv, {
    authTagLength: BRIDGE_AUTH_TAG_BYTES,
  });
  cipher.setAAD(Buffer.from(additionalData, "utf8"));
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  return {
    algorithm: BRIDGE_ENCRYPTION_ALGORITHM,
    keyId,
    iv: toBase64Url(iv),
    authTag: toBase64Url(cipher.getAuthTag()),
    ciphertext: toBase64Url(ciphertext),
    byteSize: Buffer.byteLength(plaintext, "utf8"),
  };
}

/**
 * Decrypts and authenticates a payload. Any tampering — ciphertext, IV, auth
 * tag, or the bound envelope header — surfaces as `auth_failed`; a caller
 * must never fall back to raw bytes on this error.
 */
export function decryptBridgePayload(
  encrypted: Pick<
    BridgeEncryptedPayload,
    "algorithm" | "iv" | "authTag" | "ciphertext"
  >,
  key: Buffer | Uint8Array,
  additionalData: string,
): unknown {
  const keyBuffer = assertKeyLength(key);
  if (encrypted.algorithm !== BRIDGE_ENCRYPTION_ALGORITHM) {
    throw new BridgeCryptoError(
      "unsupported_algorithm",
      `Unsupported bridge encryption algorithm "${String(encrypted.algorithm)}".`,
    );
  }

  const iv = fromBase64Url(encrypted.iv, "iv");
  const authTag = fromBase64Url(encrypted.authTag, "authTag");
  const ciphertext = fromBase64Url(encrypted.ciphertext, "ciphertext");
  if (iv.length !== BRIDGE_IV_BYTES) {
    throw new BridgeCryptoError(
      "malformed_envelope",
      `Bridge IV must be ${BRIDGE_IV_BYTES} bytes.`,
    );
  }
  if (authTag.length !== BRIDGE_AUTH_TAG_BYTES) {
    throw new BridgeCryptoError(
      "malformed_envelope",
      `Bridge auth tag must be ${BRIDGE_AUTH_TAG_BYTES} bytes.`,
    );
  }

  try {
    const decipher = createDecipheriv(
      BRIDGE_ENCRYPTION_ALGORITHM,
      keyBuffer,
      iv,
      { authTagLength: BRIDGE_AUTH_TAG_BYTES },
    );
    decipher.setAAD(Buffer.from(additionalData, "utf8"));
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");
    return JSON.parse(plaintext) as unknown;
  } catch (error) {
    if (error instanceof BridgeCryptoError) throw error;
    throw new BridgeCryptoError(
      "auth_failed",
      "Bridge payload failed AES-256-GCM authentication — the envelope was tampered with or the wrong key was used.",
    );
  }
}

/** HMAC-SHA256 signature over the canonical header + payload digest. */
export function signBridgeEnvelope(
  header: BridgeEnvelopeHeader,
  payloadHash: string,
  key: Buffer | Uint8Array,
): string {
  const keyBuffer = assertKeyLength(key);
  const mac = createHmac("sha256", keyBuffer)
    .update(bridgeEnvelopeAad(header), "utf8")
    .update("\n", "utf8")
    .update(payloadHash, "utf8")
    .digest();
  return toBase64Url(mac);
}

/**
 * Verifies an envelope signature in constant time. Returns false for any
 * malformed input — the caller quarantines, it never throws to the peer.
 */
export function verifyBridgeEnvelopeSignature(
  header: BridgeEnvelopeHeader,
  payloadHash: string,
  signature: string,
  key: Buffer | Uint8Array,
): boolean {
  if (typeof signature !== "string" || signature.length === 0) return false;
  let expected: string;
  try {
    expected = signBridgeEnvelope(header, payloadHash, key);
  } catch {
    return false;
  }
  return safeBridgeEquals(expected, signature);
}

/**
 * Rotation-friendly key identifier, e.g. `v2-2026-09-25-3f9c1a`.
 * The id is public (it travels in every envelope) and is part of the HKDF
 * info string, so two ids never share key material.
 */
export function generateBridgeKeyId(
  runtime: BridgeRuntime,
  at: Date = new Date(),
  random?: string,
): string {
  const stamp = at.toISOString().slice(0, 10);
  const suffix = (random ?? randomBytes(3).toString("hex")).slice(0, 6);
  return `${runtime}-${stamp}-${suffix}`;
}

/** 128-bit nonce. Unique per message; the router stores it to block replays. */
export function generateBridgeNonce(at: Date = new Date()): string {
  return `${at.getTime().toString(36)}-${randomBytes(BRIDGE_NONCE_BYTES).toString("hex")}`;
}

/** Message id used for the audit trail (never derived from PHI). */
export function generateBridgeMessageId(at: Date = new Date()): string {
  return `msg_${at.getTime().toString(36)}_${randomBytes(6).toString("hex")}`;
}

/** Signature algorithm pin, exported for the contract UI and tests. */
export const BRIDGE_SIGNATURE_ALGORITHM_NAME = BRIDGE_SIGNATURE_ALGORITHM;
