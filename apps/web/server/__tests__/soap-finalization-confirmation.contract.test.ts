import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Sprint 33 contract: the veterinarian's final, attributable click on
 * AI-assisted SOAP notes (owner decision 2026-09-27).
 * Spec: tasks/sprints/arena-sprint-33-soap-ai-vet-confirmation.md
 * Depends on Sprint 32 (ext_soap_ai_provenance receipts).
 *
 * ARMED: every case is `it.fails` until implemented; flip to `it(...)`.
 */

const WEB = fileURLToPath(new URL("../../", import.meta.url));
const read = (p: string) => readFileSync(join(WEB, p), "utf8");
const leaf = (obj: unknown, path: string) =>
  path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), obj);

const GATE_MESSAGE =
  "This SOAP note contains AI-generated content. Review it and confirm as the responsible veterinarian before finalizing.";

describe("Sprint 33 · vet confirmation gate for AI-assisted SOAP", () => {
  it("1 · records.prepareSoapFinalization issues an Option 1 envelope for soap_note", () => {
    const src = read("server/routers/records.ts");
    const proc = src.slice(src.indexOf("prepareSoapFinalization:"));
    expect(src).toContain("prepareSoapFinalization:");
    expect(proc.slice(0, 2500)).toMatch(/requireRole\("admin", "veterinarian"\)/);
    expect(proc.slice(0, 4000)).toContain("issueClinicianConfirmation(");
    expect(proc.slice(0, 4000)).toContain('actionType: "soap_note_finalized"');
    expect(proc.slice(0, 4000)).toContain('entityType: "soap_note"');
  });

  it("2 · finalizeSoapNote accepts the envelope and consumes it in the finalize transaction", () => {
    const records = read("server/routers/records.ts");
    const lifecycle = read("lib/records/soap-lifecycle.ts");
    const finalize = records.slice(records.indexOf("finalizeSoapNote:"), records.indexOf("discardSoapDraft:"));
    expect(finalize).toMatch(/clinicianConfirmed:\s*clinicianConfirmationInput\.optional\(\)/);
    expect(lifecycle).toContain("consumeClinicianConfirmation(");
  });

  it("3 · finalizing AI-assisted content without an envelope fails closed with the agreed message", () => {
    const lifecycle = read("lib/records/soap-lifecycle.ts");
    expect(lifecycle).toContain(GATE_MESSAGE);
    expect(lifecycle).toMatch(/new SoapLifecycleError\(\s*"PRECONDITION_FAILED"/);
  });

  it("4 · getSoapDraft tells the client whether the draft is AI-assisted", () => {
    const records = read("server/routers/records.ts");
    const lifecycle = read("lib/records/soap-lifecycle.ts");
    expect(records + lifecycle).toContain("aiAssisted");
  });

  it("5 · a shared confirmation dialog exists and is used by both finalize callers", () => {
    const dialog = read("components/records/ai-soap-finalize-dialog.tsx");
    expect(dialog).toContain("export function AiSoapFinalizeDialog");
    expect(dialog).toContain('t("soap.aiConfirm.acknowledge"');
    const page = read("app/(dashboard)/records/new-soap/[patientId]/page.tsx");
    const card = read("components/records/ambulatory-soap-card.tsx");
    for (const src of [page, card]) {
      expect(src).toContain("AiSoapFinalizeDialog");
      expect(src).toContain("trpc.records.prepareSoapFinalization.useMutation");
      expect(src).toContain("clinicianConfirmed");
    }
    // pinned by lib/__tests__/soap-editor-ui.test.ts, must survive
    expect(page).toContain("const finalizeMutation = trpc.records.finalizeSoapNote.useMutation()");
  });

  it("6 · the confirm button stays disabled until the vet acknowledges responsibility", () => {
    const dialog = read("components/records/ai-soap-finalize-dialog.tsx");
    expect(dialog).toMatch(/disabled=\{[^}]*!acknowledged/);
  });

  it("7 · i18n: confirmation copy exists in en and sk", () => {
    const en = JSON.parse(read("messages/en.json"));
    const sk = JSON.parse(read("messages/sk.json"));
    for (const key of [
      "soap.aiConfirm.title",
      "soap.aiConfirm.body",
      "soap.aiConfirm.acknowledge",
      "soap.aiConfirm.confirm",
      "soap.aiConfirm.section_ai_verbatim",
      "soap.aiConfirm.section_ai_edited",
      "soap.aiConfirm.section_ai_removed",
      "soap.aiConfirm.section_manual",
    ]) {
      expect(typeof leaf(en, key), `en ${key}`).toBe("string");
      expect(typeof leaf(sk, key), `sk ${key}`).toBe("string");
    }
  });

  it("8 · the protocol doc lists the SOAP path under Option 1", () => {
    const doc = readFileSync(join(WEB, "..", "..", "docs/confirmation-protocol.md"), "utf8");
    expect(doc).toContain("records.prepareSoapFinalization");
  });
});
