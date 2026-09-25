import { describe, it, expect } from "vitest";
import {
  validateMarketingText,
  validateText,
  autoFix,
  withDisclaimer,
  RX_SUBSTANCES,
} from "@/lib/marketing/validator";

describe("marketing validator", () => {
  it("detects prescription Rx substances including apokver", () => {
    expect(RX_SUBSTANCES).toContain("apokver");
    const report = validateMarketingText({
      text: "Podávame apokver pre psa na alergiu.",
      context: "marketing",
    });
    expect(report.verdict).toBe("block");
    expect(report.canApprove).toBe(false);
    expect(report.findings.some((f) => f.rule === "rx_substance")).toBe(true);
  });

  it("detects bravecto and apoquel", () => {
    const reportBravecto = validateMarketingText({
      text: "Odporúčame Bravecto spot-on pre každého psa.",
      context: "marketing",
    });
    expect(reportBravecto.verdict).toBe("block");

    const reportApoquel = validateMarketingText({
      text: "Liek Apoquel 16mg máme na sklade.",
      context: "marketing",
    });
    expect(reportApoquel.verdict).toBe("block");
  });

  it("passes safe educational content", () => {
    const report = validateMarketingText({
      text: "Pravidelná kontrola chrupu a ultrazvukové čistenie zubného kameňa pomáha predchádzať zápalu ďasien.",
      context: "marketing",
    });
    expect(report.verdict).toBe("pass");
    expect(report.canApprove).toBe(true);
    expect(report.findings.length).toBe(0);
  });

  it("autoFix removes prescription drugs", () => {
    const raw = "Máme skladom Apoquel pre psov. Pravidelné čistenie chrupu je dôležité.";
    const report = validateMarketingText({ text: raw, context: "marketing" });
    const fixed = autoFix(raw, report);
    expect(fixed).not.toContain("Apoquel");
    expect(fixed).toContain("Pravidelné čistenie chrupu");
  });

  it("withDisclaimer properly attaches disclaimer without duplicates", () => {
    const text = "Jesenná starostlivosť o srsť psa.";
    const disclaimer = "Len pre všeobecné informácie o zdraví zvierat.";
    const withDisc = withDisclaimer(text, disclaimer);
    expect(withDisc).toContain(disclaimer);

    // Should not duplicate if already present
    const double = withDisclaimer(withDisc, disclaimer);
    expect(double).toBe(withDisc);
  });
});
