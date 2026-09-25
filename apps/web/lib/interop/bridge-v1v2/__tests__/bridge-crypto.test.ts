/**
 * Secure Interop Bridge v1 → v2 — cryptography pins (Sprint 30).
 * --------------------------------------------------------------
 * Locks the envelope crypto contract documented in
 * `security/policies/bridge.md`: AES-256-GCM with the canonical header as AAD,
 * HKDF-SHA256 key derivation, HMAC-SHA256 signatures and non-secret
 * fingerprints.
 */
import { describe, expect, it } from "vitest";
import {
  BridgeCryptoError,
  bridgeBase64UrlDecode,
  bridgeBase64UrlEncode,
  bridgeKeyInfo,
  bridgePayloadHash,
  bridgeSha256Hex,
  bridgeSecretEnvVar,
  decryptBridgePayload,
  deriveBridgeKey,
  encryptBridgePayload,
  fingerprintBridgeKey,
  generateBridgeKeyId,
  generateBridgeMessageId,
  generateBridgeNonce,
  safeBridgeEquals,
  signBridgeEnvelope,
  verifyBridgeEnvelopeSignature,
} from "../crypto";
import {
  BRIDGE_KEY_BYTES,
  type BridgeEnvelopeHeader,
  bridgeEnvelopeAad,
  canonicalBridgeJson,
} from "../protocol";

const SECRET = "test-bridge-secret-with-32-characters";
const SALT = "test-bridge-salt";
const KEY_ID = "v1-2026-09-25-abc123";

function header(overrides: Partial<BridgeEnvelopeHeader> = {}): BridgeEnvelopeHeader {
  return {
    protocolVersion: "2026-09-bridge-v1",
    messageId: "msg_test_0001",
    correlationId: "corr_1",
    externalId: "ext_1",
    direction: "v1_to_v2",
    sourceRuntime: "v1",
    targetRuntime: "v2",
    messageType: "bridge.heartbeat",
    schemaVersion: "1.0",
    sentAt: new Date().toISOString(),
    nonce: "nonce-0001",
    keyId: KEY_ID,
    ...overrides,
  };
}

describe("HKDF key derivation", () => {
  it("derives a deterministic 256-bit key from secret + salt + info", () => {
    const key = deriveBridgeKey(SECRET, SALT, bridgeKeyInfo("v1", KEY_ID));
    expect(key).toHaveLength(BRIDGE_KEY_BYTES);
    const again = deriveBridgeKey(SECRET, SALT, bridgeKeyInfo("v1", KEY_ID));
    expect(again.equals(key)).toBe(true);
  });

  it("separates key material per runtime and per key id (rotation)", () => {
    const v1 = deriveBridgeKey(SECRET, SALT, bridgeKeyInfo("v1", KEY_ID));
    const v2 = deriveBridgeKey(SECRET, SALT, bridgeKeyInfo("v2", KEY_ID));
    const rotated = deriveBridgeKey(SECRET, SALT, bridgeKeyInfo("v1", "v1-2026-12-25-ffffff"));
    expect(v1.equals(v2)).toBe(false);
    expect(v1.equals(rotated)).toBe(false);
  });

  it("refuses a secret shorter than the documented minimum", () => {
    expect(() => deriveBridgeKey("short", SALT, "info")).toThrow(BridgeCryptoError);
  });

  it("names the per-runtime secret environment variables", () => {
    expect(bridgeSecretEnvVar("v1")).toBe("OPENVPM_BRIDGE_V1_SECRET");
    expect(bridgeSecretEnvVar("v2")).toBe("OPENVPM_BRIDGE_V2_SECRET");
  });
});

describe("AES-256-GCM payload sealing", () => {
  const key = deriveBridgeKey(SECRET, SALT, bridgeKeyInfo("v1", KEY_ID));
  const aad = bridgeEnvelopeAad(header());

  it("round-trips a payload through encrypt → decrypt", () => {
    const payload = { patientId: "P-1", status: "active", nested: { b: 1, a: 2 } };
    const sealed = encryptBridgePayload(payload, key, aad, KEY_ID);
    expect(sealed.algorithm).toBe("aes-256-gcm");
    expect(sealed.iv).toHaveLength(16); // 12 bytes base64url
    expect(sealed.ciphertext.length).toBeGreaterThan(0);
    expect(decryptBridgePayload(sealed, key, aad)).toEqual(payload);
  });

  it("rejects a re-labelled envelope (AAD is authenticated)", () => {
    const sealed = encryptBridgePayload({ ok: true }, key, aad, KEY_ID);
    const otherAad = bridgeEnvelopeAad(header({ messageType: "patient.created" }));
    expect(() => decryptBridgePayload(sealed, key, otherAad)).toThrow(
      BridgeCryptoError,
    );
  });

  it("detects ciphertext, IV and auth-tag tampering", () => {
    const sealed = encryptBridgePayload({ ok: true }, key, aad, KEY_ID);
    const flip = (value: string) => (value.startsWith("A") ? `B${value.slice(1)}` : `A${value.slice(1)}`);

    expect(() =>
      decryptBridgePayload({ ...sealed, ciphertext: flip(sealed.ciphertext) }, key, aad),
    ).toThrow(/authentication/i);
    expect(() =>
      decryptBridgePayload({ ...sealed, iv: flip(sealed.iv) }, key, aad),
    ).toThrow(BridgeCryptoError);
    expect(() =>
      decryptBridgePayload({ ...sealed, authTag: flip(sealed.authTag) }, key, aad),
    ).toThrow(/authentication/i);
  });

  it("fails closed on an unsupported algorithm or a foreign key", () => {
    const sealed = encryptBridgePayload({ ok: true }, key, aad, KEY_ID);
    expect(() =>
      decryptBridgePayload(
        { ...sealed, algorithm: "aes-128-cbc" as never },
        key,
        aad,
      ),
    ).toThrow(/Unsupported bridge encryption algorithm/);

    const foreign = deriveBridgeKey("another-secret-value-123456", SALT, bridgeKeyInfo("v1", KEY_ID));
    expect(() => decryptBridgePayload(sealed, foreign, aad)).toThrow(BridgeCryptoError);
  });
});

describe("canonical serialisation and digests", () => {
  it("sorts object keys so digests survive harmless refactors", () => {
    expect(canonicalBridgeJson({ b: 1, a: { d: 2, c: 3 } })).toBe(
      canonicalBridgeJson({ a: { c: 3, d: 2 }, b: 1 }),
    );
    expect(canonicalBridgeJson({ a: undefined, b: 1 })).toBe('{"b":1}');
  });

  it("hashes the canonical form of a payload", () => {
    const hash = bridgePayloadHash({ patientId: "P-1" });
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(bridgePayloadHash({ patientId: "P-1", extra: true })).not.toBe(hash);
    expect(bridgeSha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});

describe("HMAC envelope signatures", () => {
  const key = deriveBridgeKey(SECRET, SALT, bridgeKeyInfo("v1", KEY_ID));
  const payloadHash = bridgePayloadHash({ ok: true });

  it("verifies an untampered signature in constant time", () => {
    // sentAt is part of the signed AAD, and header() stamps it with the current
    // clock. Sign and verify the same header instance, or the second call can
    // land in the next millisecond and the untampered signature fails to verify.
    const envelopeHeader = header();
    const signature = signBridgeEnvelope(envelopeHeader, payloadHash, key);
    expect(
      verifyBridgeEnvelopeSignature(envelopeHeader, payloadHash, signature, key),
    ).toBe(true);
    expect(safeBridgeEquals(signature, signature)).toBe(true);
    expect(safeBridgeEquals(signature, `${signature}x`)).toBe(false);
  });

  it("refuses a signature for a different payload, header or key", () => {
    // Hold sentAt constant so each assertion fails for the reason under test
    // rather than because the header was re-stamped with a new timestamp.
    const envelopeHeader = header();
    const signature = signBridgeEnvelope(envelopeHeader, payloadHash, key);
    expect(
      verifyBridgeEnvelopeSignature(
        envelopeHeader,
        bridgePayloadHash({ tampered: 1 }),
        signature,
        key,
      ),
    ).toBe(false);
    expect(
      verifyBridgeEnvelopeSignature(
        header({ direction: "v2_to_v1", sentAt: envelopeHeader.sentAt }),
        payloadHash,
        signature,
        key,
      ),
    ).toBe(false);
    const foreign = deriveBridgeKey("another-secret-value-123456", SALT, bridgeKeyInfo("v1", KEY_ID));
    expect(
      verifyBridgeEnvelopeSignature(envelopeHeader, payloadHash, signature, foreign),
    ).toBe(false);
    expect(
      verifyBridgeEnvelopeSignature(envelopeHeader, payloadHash, "", key),
    ).toBe(false);
  });
});

describe("key fingerprints and identifiers", () => {
  it("publishes a sha256 fingerprint that never contains the secret", () => {
    const fingerprint = fingerprintBridgeKey(SECRET);
    expect(fingerprint).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(fingerprint).not.toContain(SECRET);
    expect(fingerprintBridgeKey(SECRET)).toBe(fingerprint);
    expect(fingerprintBridgeKey(`${SECRET}!`)).not.toBe(fingerprint);
  });

  it("generates rotation-friendly ids, nonces and message ids", () => {
    const at = new Date("2026-09-25T10:00:00.000Z");
    expect(generateBridgeKeyId("v2", at, "3f9c1a")).toBe("v2-2026-09-25-3f9c1a");
    expect(generateBridgeNonce(at)).toMatch(/^[0-9a-z]+-[a-f0-9]{32}$/);
    expect(generateBridgeNonce(at)).not.toBe(generateBridgeNonce(at));
    expect(generateBridgeMessageId(at)).toMatch(/^msg_[0-9a-z]+_[a-f0-9]{12}$/);
  });

  it("round-trips base64url values", () => {
    const encoded = bridgeBase64UrlEncode(Buffer.from("bridge", "utf8"));
    expect(encoded).not.toContain("+");
    expect(encoded).not.toContain("/");
    expect(bridgeBase64UrlDecode(encoded).toString("utf8")).toBe("bridge");
  });
});
