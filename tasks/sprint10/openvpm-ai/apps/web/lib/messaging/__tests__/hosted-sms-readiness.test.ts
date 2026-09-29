import { afterEach, describe, expect, it, vi } from "vitest";
import {
  hostedSmsConfigurationDiagnostics,
  hostedSmsCredentialIssueCount,
} from "../hosted-sms-readiness";

afterEach(() => vi.unstubAllEnvs());

describe("hosted SMS readiness diagnostics", () => {
  it("identifies the exact malformed secret component without exposing values", () => {
    vi.stubEnv("MESSAGING_PROVIDER", "telnyx");
    vi.stubEnv("TELNYX_API_KEY", "legacy-key");
    vi.stubEnv("TELNYX_PUBLIC_KEY", Buffer.alloc(32, 1).toString("base64"));
    vi.stubEnv(
      "MESSAGING_REGISTRATION_ENCRYPTION_KEY",
      Buffer.alloc(32, 2).toString("base64"),
    );

    const status = hostedSmsConfigurationDiagnostics();
    expect(status).toMatchObject({
      providerIsTelnyx: true,
      apiKeyShapeValid: false,
      webhookPublicKeyShapeValid: true,
      registrationEncryptionKeyShapeValid: true,
      inboundEnabled: false,
      rolloutIntended: false,
    });
    expect(hostedSmsCredentialIssueCount()).toBe(1);
    expect(JSON.stringify(status)).not.toContain("legacy-key");
  });

  it("accepts valid Telnyx API keys starting with KEY (including KEY01 and KEY_)", () => {
    vi.stubEnv("MESSAGING_PROVIDER", "telnyx");
    vi.stubEnv(
      "TELNYX_API_KEY",
      "KEY01_MOCK_TEST_KEY_FOR_UNIT_TEST_ONLY_12345",
    );
    vi.stubEnv("TELNYX_PUBLIC_KEY", Buffer.alloc(32, 1).toString("base64"));
    vi.stubEnv(
      "MESSAGING_REGISTRATION_ENCRYPTION_KEY",
      Buffer.alloc(32, 2).toString("base64"),
    );

    const status = hostedSmsConfigurationDiagnostics();
    expect(status.apiKeyShapeValid).toBe(true);
    expect(hostedSmsCredentialIssueCount()).toBe(0);
  });

  it("requires exact one-practice and one-location pilot scopes", () => {
    vi.stubEnv("MESSAGING_PROVISIONING_ENABLED", "true");
    vi.stubEnv(
      "MESSAGING_PROVISIONING_PRACTICE_IDS",
      "00000000-0000-4000-8000-000000000001",
    );
    vi.stubEnv(
      "MESSAGING_SENDING_PRACTICE_IDS",
      "00000000-0000-4000-8000-000000000001",
    );
    vi.stubEnv("MESSAGING_SENDING_LOCATION_IDS", "not-a-uuid");
    vi.stubEnv("MESSAGING_INBOUND_ENABLED", "true");

    expect(hostedSmsConfigurationDiagnostics()).toMatchObject({
      provisioningEnabled: true,
      rolloutIntended: true,
      provisioningScopeExact: true,
      sendingScopeExact: false,
      inboundEnabled: true,
      provisioningPracticeScopeCount: 1,
      sendingPracticeScopeCount: 1,
      sendingLocationScopeCount: 1,
    });
  });
});
