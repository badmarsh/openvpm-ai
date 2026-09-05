import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertEkasaOutboundAllowed,
  isAllowedEkasaApiUrl,
  isEkasaFiscalizationEnabled,
  isPemPrivateKey,
} from "../fiscal";
import { generatePkp, sendToEkasaApi } from "../service";

describe("e-Kasa fiscalization gates", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is disabled unless EKASA_FISCALIZATION_ENABLED=true", () => {
    expect(isEkasaFiscalizationEnabled()).toBe(false);
    vi.stubEnv("EKASA_FISCALIZATION_ENABLED", "true");
    expect(isEkasaFiscalizationEnabled()).toBe(true);
  });

  it("rejects non-HTTPS and non-FR-SR API URLs (SSRF)", () => {
    expect(isAllowedEkasaApiUrl("http://ekasa.financnasprava.sk/oto/api")).toBe(
      false,
    );
    expect(isAllowedEkasaApiUrl("https://169.254.169.254/latest")).toBe(false);
    expect(isAllowedEkasaApiUrl("https://evil.example/oto/api")).toBe(false);
    expect(
      isAllowedEkasaApiUrl("https://ekasa.financnasprava.sk/oto/api"),
    ).toBe(true);
  });

  it("does not treat random base64 as an RSA private key", () => {
    expect(isPemPrivateKey("dGVzdA==")).toBe(false);
    expect(isPemPrivateKey(null)).toBe(false);
  });

  it("does not HMAC-sign with a placeholder secret", () => {
    const pkp = generatePkp({
      dic: "2020293057",
      pokladnicaId: "88812345678900001",
      receiptNumber: "20260904-0001",
      issuedAt: new Date("2026-09-04T12:00:00.000Z"),
      amountTotal: "45.00",
    });
    expect(pkp).toBeNull();
  });

  it("does not call FR SR when fiscalization is off", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const result = await sendToEkasaApi({
      apiUrl: "https://ekasa.financnasprava.sk/oto/api",
      receiptNumber: "20260904-0001",
      dic: "2020293057",
      pokladnicaId: "88812345678900001",
      amountTotal: "45.00",
      amountVat: "8.41",
      paymentMethod: "CASH",
      okp: "ABC",
      pkp: "not-a-real-pkp",
      issuedAt: new Date("2026-09-04T12:00:00.000Z"),
      items: [],
    });
    expect(result.success).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.uid).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain("MOCK-UID");
    fetchSpy.mockRestore();
  });

  it("blocks outbound when the flag is on but the host is not allowlisted", () => {
    vi.stubEnv("EKASA_FISCALIZATION_ENABLED", "true");
    expect(assertEkasaOutboundAllowed("https://evil.example/api")).toMatch(
      /not an allowed/,
    );
  });
});
