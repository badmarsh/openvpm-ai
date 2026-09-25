import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const PAGE = "app/(dashboard)/agent/discharge/page.tsx";

function source(): string {
  return readFileSync(PAGE, "utf8");
}

function pageKitImports(src: string): string {
  const match = src.match(
    /import\s*\{([\s\S]*?)\}\s*from "@\/components\/layout\/page-kit"/,
  );
  return match?.[1] ?? "";
}

describe("agent/discharge page-kit adoption & sympathy gate", () => {
  it("imports the dashboard page-kit primitives and uses pageShellClass rhythm", () => {
    const src = source();
    const imports = pageKitImports(src);
    expect(src).toContain('from "@/components/layout/page-kit"');
    for (const name of [
      "pageShellClass",
      "PageToolbar",
      "DataTableFrame",
      "underlineTabsListClass",
      "underlineTabsTriggerClass",
    ]) {
      expect(imports, `missing ${name} in page-kit import`).toContain(name);
    }
    expect(src).toContain("className={pageShellClass}");
    expect(src).toContain("className={underlineTabsListClass}");
    expect(src).toContain("underlineTabsTriggerClass");
  });

  it("wraps filter rows in PageToolbar and history/medication in DataTableFrame", () => {
    const src = source();
    expect(src).toContain("<PageToolbar>");
    expect(src.match(/<DataTableFrame>/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(src).toContain("</DataTableFrame>");
  });

  it("preserves sympathy gate handling with semantic tokens", () => {
    const src = source();
    // Deceased status check
    expect(src).toContain('status === "deceased"');
    expect(src).toContain("isDeceased");
    // Banner and suppression logging reference
    expect(src).toContain("sympathyFlow");
    expect(src).toContain("deceasedWarning");
    // Semantic tokens: destructive / muted (not warning)
    expect(src).toContain("bg-destructive/10");
    expect(src).toContain("border-destructive");
    // Suppression log reference for audit
    expect(src).toContain("ext_automation_suppression_log");
    // Ensure sympathy gate blocks SMS/marketing
    expect(src).toContain("Sympathy gate");
  });

  it("retains dynamic PDF lazy loading without top-level import", () => {
    const src = source();
    // Must have dynamic import inside handler
    expect(src).toContain('import("@/lib/pdf")');
    expect(src).toContain("generateDischargeInstructions");
    // Must NOT have top-level import from @/lib/pdf
    expect(src).not.toMatch(/from ["']@\/lib\/pdf["']/);
    expect(src).not.toMatch(/import\s+\{\s*generateDischargeInstructions\s*\}\s+from/);
  });

  it("prevents empty medication tables and sanitizes markdown for print", () => {
    const src = source();
    // Empty table guard
    expect(src).toContain("medicationSchedule.length > 0");
    expect(src).toContain("noHomeMedication");
    expect(src).toContain("filter((item) => item.medicationName");
    // Sanitization helpers
    expect(src).toContain("sanitizeMarkdownForDisplay");
    expect(src).toContain("sanitizePrintHtml");
    expect(src).toContain("HTML tag bleeding");
  });

  it("ensures vet approval toggle is prominently positioned before print/email", () => {
    const src = source();
    expect(src).toContain("discharge-clinician-confirm");
    expect(src).toContain("clinicianConfirm");
    expect(src).toContain("Reviewed by clinician");
    // Prominent placement: approval block before action buttons
    // The approval toggle should be in a prominent container with primary border
    expect(src).toContain("border-primary/20");
    expect(src).toContain("bg-primary/5");
    const approvalIdx = src.indexOf("discharge-clinician-confirm");
    // Find a print button after the approval toggle (not the earlier toast in handler)
    const printAfterApproval = src.indexOf('t("discharge.print"', approvalIdx);
    expect(approvalIdx).toBeGreaterThan(-1);
    expect(printAfterApproval).toBeGreaterThan(approvalIdx);
  });

  it("fixes responsive preview modals and print stylesheet for signature blocks", () => {
    const src = source();
    // Responsive: max-h-[70vh] and overflow handling
    expect(src).toContain("max-h-[70vh]");
    expect(src).toContain("overflow-y-auto");
    expect(src).toContain("flex-wrap");
    // Print stylesheet guards signature and footer
    expect(src).toContain("page-break-inside: avoid");
    expect(src).toContain("signature-block");
    expect(src).toContain("clinic-footer");
  });

  it("keeps markdown renderer as dynamic chunk", () => {
    const src = source();
    expect(src).toContain('from "next/dynamic"');
    expect(src).toContain('import("@/components/common/markdown-view")');
    expect(src).toContain("ssr: false");
  });
});
