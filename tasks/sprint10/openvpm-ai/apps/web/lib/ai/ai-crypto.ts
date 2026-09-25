import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";

const VERSION = "v1";
const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;

export class AiSettingsEncryptionError extends Error {
  constructor(message = "AI settings encryption is not configured.") {
    super(message);
    this.name = "AiSettingsEncryptionError";
  }
}

function resolveKeyBuffer(): Buffer {
  const explicit = process.env.AI_SETTINGS_ENCRYPTION_KEY?.trim() ||
                   process.env.MESSAGING_REGISTRATION_ENCRYPTION_KEY?.trim();

  if (explicit) {
    try {
      const buf = Buffer.from(explicit, "base64");
      if (buf.length === 32) return buf;
    } catch {
      // Fall through to hash derivation
    }
  }

  // Safe reproducible key derivation from app secret or default dev secret
  const secretSource = process.env.NEXTAUTH_SECRET || "openvpm-dev-ai-settings-default-secret-seed";
  return createHash("sha256").update(secretSource).digest();
}

/**
 * Encrypt a secret API key for at-rest database storage.
 * Output format: v1:<iv>:<tag>:<ciphertext>
 */
export function encryptAiApiKey(plainText: string): string {
  if (!plainText || !plainText.trim()) return "";
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, resolveKeyBuffer(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plainText, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(":");
}

/**
 * Decrypt a stored API key. Never expose the result over client APIs.
 */
export function decryptAiApiKey(encryptedValue: string | null | undefined): string {
  if (!encryptedValue || !encryptedValue.trim()) return "";
  const parts = encryptedValue.split(":");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    // If it's legacy plaintext or unversioned, return as is or error
    if (!encryptedValue.includes(":")) {
      return encryptedValue;
    }
    throw new AiSettingsEncryptionError("Invalid encrypted key format");
  }

  const [, ivB64, tagB64, ciphertextB64] = parts;
  try {
    const iv = Buffer.from(ivB64, "base64url");
    const tag = Buffer.from(tagB64, "base64url");
    const ciphertext = Buffer.from(ciphertextB64, "base64url");

    const decipher = createDecipheriv(ALGORITHM, resolveKeyBuffer(), iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch (err) {
    throw new AiSettingsEncryptionError("Failed to decrypt AI API key");
  }
}

/**
 * Mask an API key for safe UI presentation (e.g. ••••••••abcd).
 */
export function maskApiKey(apiKey: string | null | undefined): string {
  if (!apiKey || !apiKey.trim()) return "";
  const trimmed = apiKey.trim();
  if (trimmed.length <= 4) return "••••";
  const last4 = trimmed.slice(-4);
  return `••••••••${last4}`;
}
