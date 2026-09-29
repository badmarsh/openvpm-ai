import { describe, expect, it } from "vitest";
import { encryptAiApiKey, decryptAiApiKey, maskApiKey } from "../ai-crypto";

describe("ai-crypto", () => {
  it("encrypts and decrypts API key accurately", () => {
    const rawKey = "sk-proj-test-1234567890abcdefghijklmnopqrstuvwxyz";
    const encrypted = encryptAiApiKey(rawKey);

    expect(encrypted).toContain("v1:");
    expect(encrypted).not.toContain(rawKey);

    const decrypted = decryptAiApiKey(encrypted);
    expect(decrypted).toBe(rawKey);
  });

  it("handles empty or blank keys gracefully", () => {
    expect(encryptAiApiKey("")).toBe("");
    expect(decryptAiApiKey("")).toBe("");
    expect(decryptAiApiKey(null)).toBe("");
    expect(decryptAiApiKey(undefined)).toBe("");
  });

  it("masks API key properly for UI display", () => {
    expect(maskApiKey("sk-aliproxy-secret-abcdef1234")).toBe("••••••••1234");
    expect(maskApiKey("short")).toBe("••••••••hort");
    expect(maskApiKey("1234")).toBe("••••");
    expect(maskApiKey("")).toBe("");
    expect(maskApiKey(null)).toBe("");
  });

  it("fails safely on corrupted ciphertext", () => {
    const rawKey = "sk-valid-key";
    const encrypted = encryptAiApiKey(rawKey);
    const corrupted = encrypted.slice(0, -4) + "XXXX";

    expect(() => decryptAiApiKey(corrupted)).toThrow();
  });
});
