import { describe, expect, it } from "vitest";
import {
  inboundSmsOptInEvidence,
  phoneNumbersMatchForConsent,
  SMS_CONSENT_DISCLOSURE,
  SMS_INBOUND_OPT_IN,
} from "../consent";

describe("SMS consent evidence policy", () => {
  it("keeps a versioned source alongside the exact disclosure snapshot", () => {
    expect(SMS_CONSENT_DISCLOSURE.version).toBe("v1");
    expect(SMS_CONSENT_DISCLOSURE.source).toContain(
      SMS_CONSENT_DISCLOSURE.version
    );
    expect(SMS_CONSENT_DISCLOSURE.snapshot).toContain(
      "appointment reminders"
    );
    expect(SMS_CONSENT_DISCLOSURE.snapshot).toContain(
      "Consent is not a condition of purchase"
    );
    expect(SMS_CONSENT_DISCLOSURE.snapshot).toContain("Reply STOP");
    expect(SMS_CONSENT_DISCLOSURE.snapshot).toContain("HELP for help");
  });

  it("records carrier-keyword opt-in evidence under its own versioned source", () => {
    expect(SMS_INBOUND_OPT_IN.source).toContain(SMS_INBOUND_OPT_IN.version);
    expect(inboundSmsOptInEvidence("START")).toContain('keyword "START"');
    expect(inboundSmsOptInEvidence("START")).toContain("Reply STOP");
    expect(inboundSmsOptInEvidence("START")).toContain("HELP for help");
  });

  it("treats formatting-only edits as the same valid destination", () => {
    expect(
      phoneNumbersMatchForConsent("+1 555 555 0123", "(555) 555-0123")
    ).toBe(true);
  });

  it("does not collapse unrelated invalid values into one null identity", () => {
    expect(phoneNumbersMatchForConsent("12345", "67890")).toBe(false);
    expect(phoneNumbersMatchForConsent("12345", " 12345 ")).toBe(true);
    expect(phoneNumbersMatchForConsent("", null)).toBe(true);
  });
});
