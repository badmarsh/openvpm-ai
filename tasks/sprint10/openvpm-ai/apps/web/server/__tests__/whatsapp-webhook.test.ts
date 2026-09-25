import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import Twilio from "twilio";
import {
  escapeLikePattern,
  isWhatsAppDedupeKey,
  nonBlankParam,
  normalizeWaNumber,
  phoneDigitsForMatch,
  phoneMatchPattern,
  requestValidationUrls,
  verifyTwilioRequest,
  whatsappDedupeKey,
} from "@/lib/messaging/whatsapp-inbound";

const ROUTE_SOURCE = readFileSync("app/api/webhooks/whatsapp/route.ts", "utf8");

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("normalizeWaNumber (Twilio prefix + E.164)", () => {
  it("strips the whatsapp: prefix and keeps E.164", () => {
    expect(normalizeWaNumber("whatsapp:+421905123456")).toBe("+421905123456");
    expect(normalizeWaNumber("WHATSAPP:+421905123456")).toBe("+421905123456");
  });

  it("normalises Slovak national formats to E.164", () => {
    expect(normalizeWaNumber("whatsapp:0905123456")).toBe("+421905123456");
    expect(normalizeWaNumber("whatsapp:00421905123456")).toBe("+421905123456");
  });

  it("rejects missing or unparseable numbers", () => {
    expect(normalizeWaNumber(undefined)).toBeNull();
    expect(normalizeWaNumber("")).toBeNull();
    expect(normalizeWaNumber("whatsapp:not-a-number")).toBeNull();
    expect(normalizeWaNumber("whatsapp:+")).toBeNull();
  });
});

describe("wildcard-safe phone lookup (SQL injection defence)", () => {
  it("accepts strictly +<digits> and returns the digits", () => {
    expect(phoneDigitsForMatch("+421905123456")).toBe("421905123456");
  });

  it("rejects anything that is not strict E.164", () => {
    expect(phoneDigitsForMatch(null)).toBeNull();
    expect(phoneDigitsForMatch(undefined)).toBeNull();
    expect(phoneDigitsForMatch("")).toBeNull();
    expect(phoneDigitsForMatch("421905123456")).toBeNull();
    // Wildcard smuggling attempts must fail safe.
    expect(phoneDigitsForMatch("%421905123456%")).toBeNull();
    expect(phoneDigitsForMatch("+42190_123456")).toBeNull();
    expect(phoneDigitsForMatch("+421; DROP TABLE clients;--")).toBeNull();
  });

  it("builds a digits-only ILIKE pattern", () => {
    expect(phoneMatchPattern("+421905123456")).toBe("%421905123456%");
    expect(phoneMatchPattern("+42190_123456")).toBeNull();
  });

  it("escapes LIKE wildcards and the escape character itself", () => {
    expect(escapeLikePattern("100%_sure\\now")).toBe("100\\%\\_sure\\\\now");
    expect(escapeLikePattern("421905123456")).toBe("421905123456");
  });
});

describe("idempotency (dedupeKey wa:<sid>)", () => {
  it("derives a stable dedupe key from the Twilio SID", () => {
    expect(whatsappDedupeKey("SM123")).toBe("wa:SM123");
    expect(whatsappDedupeKey("  SM123  ")).toBe("wa:SM123");
  });

  it("returns null for blank SIDs so the webhook fails safe", () => {
    expect(whatsappDedupeKey(null)).toBeNull();
    expect(whatsappDedupeKey(undefined)).toBeNull();
    expect(whatsappDedupeKey("   ")).toBeNull();
  });

  it("is idempotent: the same SID always maps to the same key", () => {
    const first = whatsappDedupeKey("SMabc");
    const retry = whatsappDedupeKey("SMabc");
    expect(first).toBe(retry);
    expect(whatsappDedupeKey("SMother")).not.toBe(first);
  });

  it("detects WhatsApp rows by the wa: prefix", () => {
    expect(isWhatsAppDedupeKey("wa:SM123")).toBe(true);
    expect(isWhatsAppDedupeKey("sms:inbox:uuid")).toBe(false);
    expect(isWhatsAppDedupeKey(null)).toBe(false);
    expect(isWhatsAppDedupeKey(undefined)).toBe(false);
  });

  it("trims optional Twilio params to null when blank", () => {
    expect(nonBlankParam("  hello ")).toBe("hello");
    expect(nonBlankParam("   ")).toBeNull();
    expect(nonBlankParam(undefined)).toBeNull();
  });
});

describe("Twilio signature verification (multi-tenant webhook security)", () => {
  const AUTH_TOKEN = "test-auth-token-1234567890";

  function signedRequest(url: string, params: Record<string, string>, signature: string): Request {
    return new Request(url, {
      method: "POST",
      headers: { "x-twilio-signature": signature },
    });
  }

  it("rejects requests without an auth token or signature", () => {
    vi.stubEnv("TWILIO_AUTH_TOKEN", "");
    const req = signedRequest("https://clinic.example/api/webhooks/whatsapp", {}, "sig");
    expect(verifyTwilioRequest(req, {})).toBe(false);

    vi.stubEnv("TWILIO_AUTH_TOKEN", AUTH_TOKEN);
    const noSig = new Request("https://clinic.example/api/webhooks/whatsapp", { method: "POST" });
    expect(verifyTwilioRequest(noSig, {})).toBe(false);
  });

  it("accepts a valid HMAC signature for the raw request URL (production domain)", () => {
    vi.stubEnv("TWILIO_AUTH_TOKEN", AUTH_TOKEN);
    const url = "https://clinic.example/api/webhooks/whatsapp";
    const params = { From: "whatsapp:+421905123456", Body: "Ahoj", MessageSid: "SM1" };
    const signature = Twilio.getExpectedTwilioSignature(AUTH_TOKEN, url, params);
    expect(verifyTwilioRequest(signedRequest(url, params, signature), params)).toBe(true);
  });

  it("accepts a valid signature for the canonical app URL (reverse-proxy deployments)", () => {
    vi.stubEnv("TWILIO_AUTH_TOKEN", AUTH_TOKEN);
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://public.example");
    // Internal container URL differs from the public URL Twilio signed.
    const internalUrl = "http://localhost:3001/api/webhooks/whatsapp";
    const canonicalUrl = "https://public.example/api/webhooks/whatsapp";
    const params = { From: "whatsapp:+421905123456", Body: "Ahoj", MessageSid: "SM2" };
    const signature = Twilio.getExpectedTwilioSignature(AUTH_TOKEN, canonicalUrl, params);
    expect(verifyTwilioRequest(signedRequest(internalUrl, params, signature), params)).toBe(true);
  });

  it("rejects forged signatures", () => {
    vi.stubEnv("TWILIO_AUTH_TOKEN", AUTH_TOKEN);
    const url = "https://clinic.example/api/webhooks/whatsapp";
    const params = { From: "whatsapp:+421905123456", Body: "Ahoj" };
    expect(verifyTwilioRequest(signedRequest(url, params, "forged-signature"), params)).toBe(false);
  });

  it("offers both raw and canonical URLs as validation candidates", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://public.example");
    const urls = requestValidationUrls(
      new Request("http://internal:3001/api/webhooks/whatsapp", { method: "POST" }),
    );
    expect(urls).toContain("http://internal:3001/api/webhooks/whatsapp");
    expect(urls).toContain("https://public.example/api/webhooks/whatsapp");
  });
});

describe("whatsapp webhook route wiring", () => {
  it("verifies the Twilio signature before processing", () => {
    expect(ROUTE_SOURCE).toContain("verifyTwilioRequest");
    expect(ROUTE_SOURCE).toContain("invalid signature");
    expect(ROUTE_SOURCE).toContain("@/lib/messaging/whatsapp-inbound");
    const libSource = readFileSync("lib/messaging/whatsapp-inbound.ts", "utf8");
    expect(libSource).toContain("Twilio.validateRequest");
  });

  it("matches clients through the wildcard-safe phone pattern", () => {
    expect(ROUTE_SOURCE).toContain("phoneMatchPattern");
    expect(ROUTE_SOURCE).not.toContain('`%${fromWaId.replace("+", "")}`');
  });

  it("persists inbound messages idempotently via dedupeKey", () => {
    expect(ROUTE_SOURCE).toContain("whatsappDedupeKey");
    expect(ROUTE_SOURCE).toContain("dedupeKey");
    expect(ROUTE_SOURCE).toContain("onConflictDoNothing({ target: communications.dedupeKey })");
    expect(ROUTE_SOURCE).toContain("onConflictDoNothing({ target: extWhatsappMessages.twilioSid })");
  });

  it("scopes every write to a practice tenant", () => {
    expect(ROUTE_SOURCE).toContain("withTenant");
    expect(ROUTE_SOURCE).toContain("practiceId");
  });
});
