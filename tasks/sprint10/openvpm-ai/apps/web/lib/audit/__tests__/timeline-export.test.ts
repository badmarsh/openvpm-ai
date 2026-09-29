import { describe, expect, it } from "vitest";
import { diffLines, stringifyForDiff, type AuditTimelineEvent } from "../timeline";
import { buildAuditCsv, buildAuditManifest } from "../export";

const event: AuditTimelineEvent = {
  id: "00000000-0000-4000-8000-000000000001",
  kind: "ai_confirmation",
  occurredAt: "2026-09-01T08:00:00.000Z",
  actorName: "MVDr. Ján Novák",
  actorRole: "veterinarian",
  actorId: "00000000-0000-4000-8000-000000000002",
  ipAddress: "10.0.0.7",
  action: "soap_note_finalized",
  entityType: "soap_note",
  entityId: "00000000-0000-4000-8000-000000000003",
  reason: "Lekár upravil AI návrh pred potvrdením",
  before: { originalDraftHash: "abc" },
  after: { confirmedContentHash: "def" },
  eventHash: "00".repeat(32),
  previousEventHash: null,
  sequenceNumber: 1,
};

describe("diffLines", () => {
  it("detects a single changed line between shared context", () => {
    const lines = diffLines("riadok A\nriadok B\nriadok C", "riadok A\nriadok X\nriadok C");
    expect(lines).toEqual([
      { type: "context", text: "riadok A" },
      { type: "remove", text: "riadok B" },
      { type: "add", text: "riadok X" },
      { type: "context", text: "riadok C" },
    ]);
  });

  it("returns empty diff for identical strings", () => {
    const lines = diffLines("a\nb", "a\nb");
    expect(lines.filter((l) => l.type !== "context")).toHaveLength(0);
  });

  it("stringifies non-string values for display", () => {
    expect(stringifyForDiff({ a: 1 })).toBe('{\n  "a": 1\n}');
    expect(stringifyForDiff("text")).toBe("text");
    expect(stringifyForDiff(null)).toBe("");
  });
});

describe("buildAuditCsv", () => {
  it("emits a BOM-prefixed, semicolon-delimited CSV with a header", () => {
    const csv = buildAuditCsv([event]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain('"id";"kind";"occurred_at";"actor_name"');
    expect(csv).toContain("soap_note_finalized");
    expect(csv).toContain("MVDr. Ján Novák");
  });

  it("escapes embedded quotes", () => {
    const withQuote: AuditTimelineEvent = {
      ...event,
      reason: 'dôvod s "úvodzovkami"',
    };
    const csv = buildAuditCsv([withQuote]);
    expect(csv).toContain('"dôvod s ""úvodzovkami"""');
  });
});

describe("buildAuditManifest", () => {
  it("produces stable SHA-256 sums for CSV and JSON", () => {
    const csv = buildAuditCsv([event]);
    const json = JSON.stringify([event]);
    const manifest = buildAuditManifest({ events: [event], csv, json });

    expect(manifest.hashAlgorithm).toBe("sha256");
    expect(manifest.sha256Csv).toMatch(/^[0-9a-f]{64}$/);
    expect(manifest.sha256Json).toMatch(/^[0-9a-f]{64}$/);
    expect(manifest.eventCount).toBe(1);

    // Determinizmus — rovnaký vstup, rovnaký odtlačok
    const again = buildAuditManifest({ events: [event], csv, json });
    expect(again.sha256Csv).toBe(manifest.sha256Csv);
    expect(again.sha256Json).toBe(manifest.sha256Json);
  });

  it("changes the digest when the payload changes", () => {
    const csv = buildAuditCsv([event]);
    const json = JSON.stringify([event]);
    const a = buildAuditManifest({ events: [event], csv, json });
    const b = buildAuditManifest({ events: [event], csv, json: "[]" });
    expect(a.sha256Json).not.toBe(b.sha256Json);
  });
});
