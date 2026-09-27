import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Sprint 32 contract: AI provenance on SOAP finalization (GT-001 / F-04-1).
 * Spec: tasks/sprints/arena-sprint-32-soap-ai-provenance-ledger.md
 *
 * ARMED: every case is `it.fails` until the sprint is implemented. The
 * implementer flips each case to `it(...)` as it becomes true. Done means no
 * `.fails` is left and the file passes (see tasks/WORKFLOW.md).
 *
 * Dynamic imports use a variable specifier so a missing module fails the
 * *case* at runtime instead of breaking collection of the whole file.
 */

const WEB = fileURLToPath(new URL("../../", import.meta.url));
const REPO = join(WEB, "..", "..");
const read = (p: string) => readFileSync(join(WEB, p), "utf8");
const load = (specifier: string) => import(/* @vite-ignore */ specifier);

const PROVENANCE_MODULE = "../../lib/records/soap-ai-provenance";

describe("Sprint 32 · SOAP AI provenance ledger", () => {
  it.fails("1 · schema: ext_soap_ai_provenance exists with the agreed columns", async () => {
    const db = (await import("@openpims/db")) as unknown as Record<string, unknown>;
    const table = db.extSoapAiProvenance as Record<string, unknown> | undefined;
    expect(table).toBeDefined();
    for (const col of [
      "practiceId",
      "patientId",
      "soapNoteId",
      "issuedTo",
      "source",
      "sourceEntityId",
      "modelId",
      "featureKey",
      "draftHash",
      "sectionHashes",
      "consumedAt",
      "auditEventId",
    ]) {
      expect(table, `missing column ${col}`).toHaveProperty(col);
    }
  });

  it.fails("2 · schema: a committed migration creates the table", () => {
    const dir = join(REPO, "packages/db/drizzle");
    const hit = readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .some((f) => readFileSync(join(dir, f), "utf8").includes('CREATE TABLE "ext_soap_ai_provenance"'));
    expect(hit).toBe(true);
  });

  it.fails("3 · classifier: verbatim, edited, manual and removed sections (HTML-insensitive)", async () => {
    const m = await load(PROVENANCE_MODULE);
    const draft = m.hashSoapSections({
      subjective: "Kašeľ 3 dni",
      objective: "T 39,2 °C",
      assessment: "Tracheobronchitída",
      plan: null,
    });
    const result = m.classifySectionProvenance(draft, {
      subjective: "<p>Kašeľ 3 dni</p>",
      objective: "T 39,4 °C, auskultácia bez vedľajších zvukov",
      assessment: "",
      plan: "Kontrola o 5 dní",
    });
    expect(result).toEqual({
      subjective: "ai_verbatim",
      objective: "ai_edited",
      assessment: "ai_removed",
      plan: "manual",
    });
  });

  it.fails("4 · event builder: no receipts means no ledger event (manual SOAP)", async () => {
    const m = await load(PROVENANCE_MODULE);
    expect(m.buildSoapAiFinalizationEvent([], { subjective: "manuálny zápis" })).toBeNull();
  });

  it.fails("5 · event builder: AI receipt yields hashes, edit flag and per-section provenance", async () => {
    const m = await load(PROVENANCE_MODULE);
    const sectionHashes = m.hashSoapSections({ subjective: "A", objective: "B" });
    const event = m.buildSoapAiFinalizationEvent(
      [{ source: "soap_draft", draftHash: m.hashSoapDraft({ subjective: "A", objective: "B" }), sectionHashes }],
      { subjective: "A", objective: "B upravené" },
    );
    expect(event).not.toBeNull();
    expect(event.originalDraftHash).toMatch(/^[a-f0-9]{64}$/);
    expect(event.confirmedContentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(event.wasEditedByClinician).toBe(true);
    expect(event.sections).toMatchObject({ subjective: "ai_verbatim", objective: "ai_edited" });
  });

  it.fails("6 · finalize writes the ledger inside the lifecycle transaction", () => {
    const src = read("lib/records/soap-lifecycle.ts");
    expect(src).toMatch(/import\s*\{[^}]*appendAiAuditEvent[^}]*\}\s*from\s*"@\/lib\/ai\/audit-ledger"/);
    expect(src).toContain("extSoapAiProvenance");
    expect(src).toContain('actionType: "soap_note_finalized"');
    expect(src).toContain("buildSoapAiFinalizationEvent");
  });

  it.fails("7 · ai.draftSoapNote issues a provenance receipt; saveSoapDraft links it", () => {
    const ai = read("server/routers/ai.ts");
    const records = read("server/routers/records.ts");
    expect(ai).toContain("provenanceReceiptId");
    expect(ai).toContain("extSoapAiProvenance");
    expect(records).toMatch(/aiProvenanceReceiptId:\s*z\.string\(\)\.uuid\(\)\.optional\(\)/);
  });

  it.fails("8 · imaging.injectFindingsIntoSoap records an imaging_findings receipt", () => {
    const src = read("server/routers/extensions/imaging.ts");
    const inject = src.slice(src.indexOf("injectFindingsIntoSoap:"), src.indexOf("calculateVhs:"));
    expect(inject).toContain("extSoapAiProvenance");
    expect(inject).toContain('"imaging_findings"');
  });

  it.fails("9 · the new-soap editor sends the receipt with the next save", () => {
    const page = read("app/(dashboard)/records/new-soap/[patientId]/page.tsx");
    expect(page).toContain("provenanceReceiptId");
    expect(page).toContain("aiProvenanceReceiptId");
  });

  it.fails("10 · draft-safety entity types match the ledger (F-20-3)", () => {
    const src = read("lib/ai/draft-safety.ts");
    const decl = src.slice(src.indexOf("export interface AiConfirmationAuditRecord"));
    const entityLine = decl.slice(0, decl.indexOf("\n}")).split("\n").find((l) => l.includes("entityType"));
    expect(entityLine).toBeDefined();
    expect(entityLine).toMatch(/AppendAiAuditEventInput\["entityType"\]|marketing_media/);
  });

  it.fails("11 · docs list which surfaces write to the ledger", () => {
    const doc = join(REPO, "docs/ai-audit-ledger.md");
    expect(existsSync(doc)).toBe(true);
    const text = readFileSync(doc, "utf8");
    expect(text).toMatch(/Surfaces that write/i);
    expect(text).toContain("records.finalizeSoapNote");
  });
});
