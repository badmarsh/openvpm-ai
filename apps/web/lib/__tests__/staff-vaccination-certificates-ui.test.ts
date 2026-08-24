import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const patientPage = readFileSync(
  "app/(dashboard)/patients/[id]/page.tsx",
  "utf8",
);
const recordsPage = readFileSync("app/(dashboard)/records/page.tsx", "utf8");
const vaccinationForm = readFileSync(
  "components/records/vaccination-form-fields.tsx",
  "utf8",
);
const router = readFileSync("server/routers/records.ts", "utf8");

describe("staff vaccination certificates", () => {
  it("prepares fresh server-authorized data before lazily loading PDF code", () => {
    const downloadSection = patientPage.slice(
      patientPage.indexOf("async function downloadCertificate"),
      patientPage.indexOf(
        "if (error)",
        patientPage.indexOf("async function downloadCertificate"),
      ),
    );
    const prepareAt = downloadSection.indexOf("prepareCertificate.mutateAsync");
    const readyAt = downloadSection.indexOf("if (!certificate.ready)");
    const importAt = downloadSection.indexOf('await import("@/lib/pdf")');
    expect(prepareAt).toBeGreaterThan(0);
    expect(readyAt).toBeGreaterThan(prepareAt);
    expect(importAt).toBeGreaterThan(readyAt);
    expect(downloadSection).not.toMatch(/from ["']@\/lib\/pdf["']/);
    expect(downloadSection).toContain("crypto.randomUUID()");
    expect(downloadSection).toContain(
      "generateVaccinationHistoryCertificatePdf",
    );
    expect(downloadSection).toContain(
      "generateRabiesVaccinationCertificatePdf",
    );
  });

  it("fails rabies issuance closed and excludes corrected records", () => {
    expect(router).toContain("prepareVaccinationCertificate");
    expect(router).toContain("ready: warnings.length === 0");
    expect(router).toContain('warnings.push("owner address")');
    expect(router).toContain('warnings.push("microchip or rabies tag number")');
    expect(router).toContain('warnings.push("current patient weight")');
    expect(router).toContain('warnings.push("veterinarian license number")');
    expect(router).toContain("isNull(clinicalRecordCorrections.id)");
    expect(patientPage).toContain("Complete these details before issuing");
  });

  it("requires audited reasons for certificate-detail corrections", () => {
    expect(router).toContain("updateVaccinationCertificateDetails");
    expect(router).toContain('action: "certificate_details_updated"');
    expect(router).toContain("before:");
    expect(router).toContain("after: patch");
    expect(router).toContain("expectedUpdatedAt");
    expect(patientPage).toContain(
      "Reason for change (required, at least 10 characters)",
    );
    expect(patientPage).toContain("Save audited changes");
  });

  it("captures complete rabies product and veterinarian details at entry", () => {
    expect(recordsPage).toContain("isVaccinationFormValid(vaccinationForm)");
    expect(vaccinationForm).toContain("Product expiration *");
    expect(vaccinationForm).toContain("Dose type *");
    expect(vaccinationForm).toContain("Licensed duration *");
    expect(vaccinationForm).toContain("Supervising veterinarian *");
    expect(vaccinationForm).toContain("license missing");
    expect(vaccinationForm).toContain("Boolean(form.nextDueDate)");
  });
});
