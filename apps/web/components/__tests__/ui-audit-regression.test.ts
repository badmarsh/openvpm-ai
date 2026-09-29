import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Regression guard for the Web Interface Guidelines audit of 2026-09-28
 * (docs/audits/ui-audit-2026-09-28.md) and its 2026-09-29 remediation.
 * Every assertion here is a finding that was fixed once and must not regress.
 */

const read = (path: string) => readFileSync(path, "utf8");

const micButton = read("components/field-visits/mic-button.tsx");
const vaccinationForm = read("components/records/vaccination-form-fields.tsx");
const productPicker = read("components/records/prescription-inventory-product-picker.tsx");
const consentSign = read("components/records/consent-sign.tsx");
const documentUpload = read("components/records/patient-document-upload.tsx");
const diffModal = read("components/copilot/clinical-diff-confirm-modal.tsx");
const messagingForm = read("components/settings/messaging-registration-form.tsx");
const soapEditor = read("components/SoapNoteEditor.tsx");
const pageKit = read("components/layout/page-kit.tsx");

describe("icon-only controls have an accessible name", () => {
  it("MicButton pairs its tooltip with an aria-label", () => {
    expect(micButton).toContain("aria-label={label}");
    // title alone is not announced reliably by screen readers.
    expect(micButton).toContain("title={label}");
  });

  it("every SOAP toolbar button is labelled and exposes its pressed state", () => {
    const buttons = soapEditor.match(/<Button[\s\S]*?<\/Button>/g) ?? [];
    expect(buttons.length).toBeGreaterThanOrEqual(6);
    for (const button of buttons) {
      expect(button, button.slice(0, 80)).toContain("aria-label=");
    }
    expect(soapEditor.match(/aria-pressed=/g)?.length).toBeGreaterThanOrEqual(5);
    expect(soapEditor.match(/aria-hidden="true"/g)?.length).toBeGreaterThanOrEqual(6);
  });
});

describe("focus is visible", () => {
  it("gives the TipTap contenteditable the same ring as <Input>", () => {
    expect(soapEditor).toContain("focus-visible:ring-2 focus-visible:ring-ring");
    expect(soapEditor).not.toMatch(/outline-none(?![-\s\S]{0,40}focus-visible)/);
  });
});

describe("forms", () => {
  it("links every vaccination label to its control", () => {
    const labels = vaccinationForm.match(/htmlFor=\{fieldId\("(\w+)"\)\}/g) ?? [];
    const controls = vaccinationForm.match(/id=\{fieldId\("(\w+)"\)\}/g) ?? [];
    expect(labels.length).toBeGreaterThanOrEqual(10);
    expect(controls.length).toBe(labels.length);
    expect(vaccinationForm).toContain("useId()");
  });

  it("ends placeholders with an ellipsis character", () => {
    for (const source of [vaccinationForm, productPicker]) {
      for (const match of source.matchAll(/placeholder=\{?[^}\n]*/g)) {
        if (match[0].includes("…") || match[0].includes("t(")) continue;
        expect(match[0], match[0]).not.toContain("...");
      }
    }
    expect(vaccinationForm).toContain('"e.g. Rabies…"');
    expect(vaccinationForm).toContain('"e.g. Defensor 3…"');
    expect(vaccinationForm).toContain('"e.g. RAB-2026-04…"');
    expect(vaccinationForm).toContain('"e.g. Zoetis…"');
    expect(productPicker).toContain('placeholder="Search inventory by name or SKU…"');
  });

  it("opts clinical free-text fields out of password-manager autofill", () => {
    expect(vaccinationForm.match(/autoComplete="off"/g)?.length).toBeGreaterThanOrEqual(5);
  });

  it("types and autocomplete tokens match the messaging registration fields", () => {
    expect(messagingForm).toContain('type="email"');
    expect(messagingForm).toContain('autoComplete="email"');
    expect(messagingForm).toContain('type="tel"');
    expect(messagingForm).toContain('inputMode="tel"');
    expect(messagingForm).toContain('autoComplete="tel"');
    expect(messagingForm).toContain('autoComplete="postal-code"');
    expect(messagingForm).toContain('type="url"');
    expect(messagingForm).toContain('autoComplete="url"');
  });

  it("labels the document upload selects and file input", () => {
    expect(documentUpload).toContain('aria-label={t("patients.documentsTab.categoryLabel"');
    expect(documentUpload).toContain('aria-label={t("patients.documentsTab.modalityLabel"');
    // The file input sits inside a <label> wrapper, so it has an accessible name.
    const fileLabel = /<label className="min-w-0 flex-1 space-y-1 text-xs font-medium">[\s\S]*?type="file"/;
    expect(documentUpload).toMatch(fileLabel);
  });
});

describe("modals", () => {
  it("build the clinical diff confirmation on the Radix dialog", () => {
    expect(diffModal).toContain('from "@/components/ui/dialog"');
    expect(diffModal).toContain("<DialogTitle");
    expect(diffModal).toContain("overscroll-contain");
    expect(diffModal).not.toMatch(/className="fixed inset-0 z-50/);
  });

  it("keep the consent modal on the Radix primitive with contained scrolling", () => {
    expect(consentSign).toContain('from "@radix-ui/react-dialog"');
    expect(consentSign).toContain("overscroll-contain");
  });
});

describe("animation honours prefers-reduced-motion", () => {
  it("guards the mic listening pulse", () => {
    expect(micButton).toContain("motion-safe:animate-pulse");
    expect(micButton).not.toMatch(/(?<!motion-safe:)animate-pulse/);
  });

  it("guards the shared loading primitives", () => {
    expect(read("components/ui/skeleton.tsx")).toContain("motion-safe:animate-pulse");
    const pulse = read("components/ui/status-pulse-badge.tsx");
    expect(pulse).toContain("motion-safe:animate-pulse");
    expect(pulse).not.toMatch(/(?<!motion-safe:)animate-ping/);
  });

  it("contains overscroll in every overlay primitive", () => {
    for (const primitive of [
      "components/ui/dialog.tsx",
      "components/ui/alert-dialog.tsx",
      "components/ui/sheet.tsx",
      "components/ui/dropdown-menu.tsx",
      "components/ui/popover.tsx",
      "components/ui/command.tsx",
    ]) {
      expect(read(primitive), primitive).toContain("overscroll-contain");
    }
  });
});

describe("search fields", () => {
  it("use type=search and document the autoFocus caveat", () => {
    expect(pageKit).toContain('type="search"');
    expect(pageKit).toMatch(/Desktop-only affordance/);
  });
});

describe("typography scales with the font-size switcher", () => {
  const preset = read("../../packages/config/tailwind.config.ts");

  it("defines sub-xs sizes in rem", () => {
    expect(preset).toContain('"2xs": "0.6875rem"');
    expect(preset).toContain('"3xs": "0.625rem"');
    expect(preset).not.toContain("0.6875px");
  });

  it("leaves no hardcoded pixel font size in the app", () => {
    // Sampled files across the app: `text-[10px]`/`text-[11px]` used to appear
    // ~864 times and ignored html[data-font-scale].
    for (const file of [
      "components/field-visits/mic-button.tsx",
      "components/patients/sections/vaccinations-tab.tsx",
      "app/(auth)/register/page.tsx",
    ]) {
      expect(read(file), file).not.toMatch(/text-\[\d+(?:\.\d+)?px\]/);
    }
    expect(read("components/field-visits/mic-button.tsx")).toContain("text-2xs");
  });
});

describe("large lists are virtualised", () => {
  it("skips rendering offscreen inventory rows", () => {
    expect(productPicker).toContain('contentVisibility: "auto"');
    expect(productPicker).toContain("containIntrinsicSize");
  });
});
