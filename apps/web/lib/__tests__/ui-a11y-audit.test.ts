import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Regression guard for the Web Interface Guidelines / impeccable audit sweep.
 * Follows the repo convention of source-level assertions (no DOM renderer in
 * the vitest environment).
 */
function source(path: string): string {
  return readFileSync(path, "utf8");
}

const en = JSON.parse(readFileSync("messages/en.json", "utf8")) as Record<string, unknown>;
const sk = JSON.parse(readFileSync("messages/sk.json", "utf8")) as Record<string, unknown>;

function resolveLeaf(dict: Record<string, unknown>, key: string): unknown {
  let node: unknown = dict;
  for (const part of key.split(".")) {
    if (node === null || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}

function* leaves(node: unknown, prefix = ""): Generator<[string, string]> {
  if (typeof node === "string") {
    yield [prefix, node];
    return;
  }
  if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      yield* leaves(v, prefix ? `${prefix}.${k}` : k);
    }
  }
}

describe("ClinicalDiffConfirmModal — statutory gate is a real dialog", () => {
  const src = source("components/copilot/clinical-diff-confirm-modal.tsx");

  it("is built on the shared Radix Dialog (focus trap, Escape, aria wiring)", () => {
    expect(src).toContain('from "@/components/ui/dialog"');
    expect(src).toMatch(/<Dialog\s+open=\{isOpen\}/);
    expect(src).toContain("<DialogTitle");
    expect(src).toContain("<DialogDescription");
    // No hand-rolled overlay left behind.
    expect(src).not.toContain('className="fixed inset-0');
  });

  it("does not dismiss on backdrop click so manual vet edits survive a stray click", () => {
    expect(src).toContain("onPointerDownOutside={(event) => event.preventDefault()}");
  });

  it("labels every inline edit control and announces the controlled-substance banner", () => {
    expect(src.match(/aria-label=\{field\.label\}/g)?.length).toBe(2);
    expect(src).toContain('role="alert"');
  });

  it("keeps the scroll region self-contained", () => {
    expect(src).toContain("overscroll-contain");
  });
});

describe("ConsentSign — modal keyboard & focus contract", () => {
  const src = source("components/records/consent-sign.tsx");

  it("uses Radix Dialog primitives at the z-[90] layer", () => {
    expect(src).toContain('import * as DialogPrimitive from "@radix-ui/react-dialog"');
    expect(src).toContain("<DialogPrimitive.Root");
    expect(src).toContain("<DialogPrimitive.Title");
    expect(src).toContain("<DialogPrimitive.Close");
    expect(src).toContain("z-[90]");
    expect(src).toContain("overscroll-contain");
    expect(src).not.toContain('role="dialog"');
  });
});

describe("Icon-only buttons expose an accessible name", () => {
  it("MicButton mirrors its tooltip into aria-label and respects reduced motion", () => {
    const src = source("components/field-visits/mic-button.tsx");
    expect(src).toContain("aria-label={label}");
    // The tooltip is delivered via the shared TooltipHint (Radix, focusable)
    // instead of an unreliable native title attribute.
    expect(src).toContain("TooltipHint");
    expect(src).toContain("content={label}");
    expect(src).toContain('aria-pressed={state === "listening"}');
    expect(src).toContain("motion-safe:animate-pulse");
    expect(src).not.toMatch(/(?<!motion-safe:)animate-pulse/);
    expect(src).toContain("focus-visible:ring-2");
  });

  it("SoapNoteEditor toolbar buttons are labelled, translated and toggleable", () => {
    const src = source("components/SoapNoteEditor.tsx");
    expect(src).toContain('role="toolbar"');
    for (const key of [
      "soap.editor.toolbar",
      "soap.editor.bold",
      "soap.editor.italic",
      "soap.editor.underline",
      "soap.editor.bulletList",
      "soap.editor.orderedList",
      "soap.editor.clearFormatting",
      "soap.editor.placeholder",
    ]) {
      expect(src).toContain(`"${key}"`);
      expect(typeof resolveLeaf(en, key), `en ${key}`).toBe("string");
      expect(typeof resolveLeaf(sk, key), `sk ${key}`).toBe("string");
    }
    expect(src.match(/aria-pressed=\{editor\.isActive\(/g)?.length).toBe(5);
    // Contenteditable surface must show a keyboard focus ring.
    expect(src).not.toContain("focus:outline-none");
    expect(src).toContain("focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset");
  });
});

describe("Forms — labels, ids and autocomplete", () => {
  it("VaccinationFormFields wires every <label> to its control via htmlFor/id", () => {
    const src = source("components/records/vaccination-form-fields.tsx");
    expect(src).toContain("useId()");
    const labels = src.match(/htmlFor=\{fieldId\("(\w+)"\)\}/g) ?? [];
    const ids = src.match(/\bid=\{fieldId\("(\w+)"\)\}/g) ?? [];
    expect(labels.length).toBe(10);
    expect(ids.length).toBe(10);
    // No orphan labels remain.
    expect(src).not.toMatch(/<label className=/);
  });

  it("MessagingRegistrationForm passes HTML autocomplete tokens", () => {
    const src = source("components/settings/messaging-registration-form.tsx");
    for (const token of [
      "organization",
      "given-name",
      "family-name",
      "email",
      "tel",
      "street-address",
      "address-level2",
      "address-level1",
      "postal-code",
      "url",
    ]) {
      expect(src, token).toContain(`autoComplete="${token}"`);
    }
  });

  it("SearchField is a semantic search input with an accessible name", () => {
    const src = source("components/layout/page-kit.tsx");
    expect(src).toContain('type="search"');
    expect(src).toContain("aria-label={ariaLabel ?? (id ? undefined : placeholder)}");
    expect(src).toContain('enterKeyHint="search"');
  });
});

describe("Typography — ellipsis character", () => {
  it("dictionaries use the typographic ellipsis, never three periods", () => {
    for (const [dictName, dict] of [
      ["en", en],
      ["sk", sk],
    ] as const) {
      const offenders = [...leaves(dict)].filter(([, v]) => v.includes("..."));
      expect(offenders, `${dictName}.json: ${offenders.map(([k]) => k).join(", ")}`).toEqual([]);
    }
  });

  it("t() fallbacks in the audited components use the typographic ellipsis", () => {
    for (const path of [
      "components/records/vaccination-form-fields.tsx",
      "components/records/prescription-inventory-product-picker.tsx",
      "components/records/patient-document-upload.tsx",
      "components/records/consent-sign.tsx",
      "components/copilot/clinical-diff-confirm-modal.tsx",
      "components/SoapNoteEditor.tsx",
    ]) {
      expect(source(path), path).not.toMatch(/[\p{L}\p{N})]\.\.\.["'`]/u);
    }
  });
});

describe("impeccable — visual tells removed", () => {
  it("message-log KPI numbers share one text color", () => {
    const src = source("components/communications/message-logs-view.tsx");
    expect(src).not.toContain("text-2xl font-bold text-purple-700");
    expect(src.match(/text-2xl font-bold text-foreground/g)?.length).toBe(4);
  });

  it("clinical-claim callouts no longer use the thick side-tab border", () => {
    const src = source("components/marketing/veterinarian-review-modal.tsx");
    expect(src).not.toContain("border-l-4");
  });
});
