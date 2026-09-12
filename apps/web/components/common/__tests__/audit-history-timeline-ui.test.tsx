import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AuditHistoryTimeline } from "../audit-history-timeline";
import type { AuditTimelineEvent } from "@/lib/audit/timeline";

const base: AuditTimelineEvent = {
  id: "00000000-0000-4000-8000-000000000001",
  kind: "clinical_correction",
  occurredAt: "2026-09-01T08:00:00.000Z",
  actorName: "MVDr. Ján Novák",
  actorRole: "veterinarian",
  actorId: "00000000-0000-4000-8000-000000000002",
  ipAddress: "10.0.0.7",
  action: "soap_note.entered_in_error",
  entityType: "soap_note",
  entityId: "00000000-0000-4000-8000-000000000003",
  reason: "Nesprávna dávka v pôvodnom zázname",
  before: "dávka 2,5 mg",
  after: "dávka 2,0 mg",
  eventHash: null,
  previousEventHash: null,
  sequenceNumber: null,
};

describe("AuditHistoryTimeline", () => {
  it("renders the empty state when there are no events", () => {
    const markup = renderToStaticMarkup(
      createElement(AuditHistoryTimeline, { events: [] })
    );
    expect(markup).toContain("Pre tento záznam zatiaľ neexistuje žiadna história.");
  });

  it("renders who/when/what/reason/diff for each event", () => {
    const markup = renderToStaticMarkup(
      createElement(AuditHistoryTimeline, { events: [base] })
    );
    expect(markup).toContain("MVDr. Ján Novák");
    expect(markup).toContain("veterinarian");
    expect(markup).toContain("Oprava záznamu");
    expect(markup).toContain("Nesprávna dávka v pôvodnom zázname");
    expect(markup).toContain("10.0.0.7");
    // Diff: odstránený riadok aj pridaný riadok
    expect(markup).toContain("dávka 2,5 mg");
    expect(markup).toContain("dávka 2,0 mg");
  });

  it("renders the hash-chain seal for AI confirmation events", () => {
    const ai: AuditTimelineEvent = {
      ...base,
      kind: "ai_confirmation",
      eventHash: "a".repeat(64),
      previousEventHash: "b".repeat(64),
      sequenceNumber: 7,
      reason: null,
    };
    const markup = renderToStaticMarkup(
      createElement(AuditHistoryTimeline, { events: [ai] })
    );
    expect(markup).toContain("Pečať:");
    expect(markup).toContain("a".repeat(16));
    expect(markup).toContain("#seq 7");
  });

  it("hides hash-chain details when showHashChain is false", () => {
    const ai: AuditTimelineEvent = {
      ...base,
      kind: "ai_confirmation",
      eventHash: "a".repeat(64),
    };
    const markup = renderToStaticMarkup(
      createElement(AuditHistoryTimeline, {
        events: [ai],
        showHashChain: false,
      })
    );
    expect(markup).not.toContain("Pečať:");
  });
});
