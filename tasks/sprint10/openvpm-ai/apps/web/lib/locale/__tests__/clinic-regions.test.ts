import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  explicitJurisdictionState,
  hasExplicitPracticeJurisdiction,
  isClinicRegionCode,
} from "../clinic-regions";

describe("clinic jurisdiction evidence", () => {
  it("does not treat a database country default as an explicit choice", () => {
    expect(hasExplicitPracticeJurisdiction({}, "US")).toBe(false);
    expect(
      hasExplicitPracticeJurisdiction(
        {
          onboardingState: {
            jurisdictionCountry: "CA",
            jurisdictionSelectedAt: "2026-08-11T12:00:00.000Z",
          },
        },
        "US",
      ),
    ).toBe(false);
  });

  it("requires a nonblank timestamp and a country marker matching the row", () => {
    const onboardingState = explicitJurisdictionState(
      "IE",
      "registration",
      "2026-08-11T12:00:00.000Z",
    );
    expect(hasExplicitPracticeJurisdiction({ onboardingState }, "IE")).toBe(
      true,
    );
    expect(
      hasExplicitPracticeJurisdiction(
        { onboardingState: { ...onboardingState, jurisdictionSelectedAt: "" } },
        "IE",
      ),
    ).toBe(false);
    expect(isClinicRegionCode("AU")).toBe(true);
    expect(isClinicRegionCode("ZZ")).toBe(false);
  });

  it("keeps registration low-friction while blocking silent jurisdiction defaults", () => {
    const source = readFileSync("app/(auth)/register/page.tsx", "utf8");
    const settingsSource = readFileSync(
      "app/(dashboard)/settings/page.tsx",
      "utf8",
    );
    expect(source).toContain('label={t("auth.register.country", "Clinic country")}');
    expect(source).toContain('auth.register.selectCountry');
    expect(source).toContain('country !== ""');
    expect(source).toContain('country !== "OTHER"');
    expect(source).toContain("supported design-partner rollout");
    expect(settingsSource).toContain("practice.jurisdictionConfirmed &&");
    expect(settingsSource).toContain('country: ClinicRegionCode | ""');
    expect(settingsSource).toContain(
      "if (!isClinicRegionCode(current.country)) return",
    );
  });
});
