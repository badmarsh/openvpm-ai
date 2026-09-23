import { describe, expect, it } from "vitest";
import {
  EMPTY_VISIT_CONTEXT,
  VISIT_CONTEXT_MAX_LENGTH,
  buildVisitContext,
  latestUsableVitals,
} from "../visit-context";

/**
 * GT-005 (F-04-3): the AI SOAP draft must receive the visit context the
 * clinician can see, and must never receive retracted measurements.
 */

const appointment = {
  typeName: "Preventívna prehliadka",
  startTime: "2026-09-23T09:30:00.000Z",
  doctorName: "MVDr. Anna Nováková",
  locationName: "Ambulancia 1",
  notes: "Kašeľ tretí deň, majiteľ hlási nechutenstvo.",
};

describe("visit context builder", () => {
  it("carries the reason for the visit and today's measurements into the request text", () => {
    const context = buildVisitContext({
      appointment,
      vitals: [
        {
          recordedAt: "2026-09-23T09:35:00.000Z",
          temperatureC: "38.6",
          heartRateBpm: 120,
          respiratoryRateBpm: 24,
          weightKg: "12.4",
        },
      ],
    });

    expect(context.hasContext).toBe(true);
    expect(context.text).toContain(
      "Poznámky / dôvod návštevy: Kašeľ tretí deň, majiteľ hlási nechutenstvo.",
    );
    expect(context.text).toContain("Dnešné merania: Teplota 38.6 \u00b0C");
    expect(context.text).toContain("Tep 120/min");
    expect(context.text).toContain("Dych 24/min");
    expect(context.text).toContain("Hmotnosť 12.4 kg");
    expect(context.text).toContain("Typ termínu: Preventívna prehliadka");
    expect(context.text!.length).toBeLessThanOrEqual(VISIT_CONTEXT_MAX_LENGTH);
  });

  it("exposes the same data as structured items for the pre-draft banner", () => {
    const context = buildVisitContext({
      appointment,
      vitals: [{ temperatureC: 38.6, weightKg: 12.4 }],
    });

    expect(context.items).toEqual([
      { id: "visitType", value: "Preventívna prehliadka" },
      { id: "reason", value: "Kašeľ tretí deň, majiteľ hlási nechutenstvo." },
      { id: "doctor", value: "MVDr. Anna Nováková" },
      { id: "location", value: "Ambulancia 1" },
      { id: "temperatureC", value: "38.6 \u00b0C" },
      { id: "weightKg", value: "12.4 kg" },
    ]);
  });

  it("reports no context when the patient has neither a visit nor today's measurements", () => {
    expect(buildVisitContext({ appointment: null, vitals: [] })).toEqual(
      EMPTY_VISIT_CONTEXT,
    );
    expect(buildVisitContext({ appointment: null, vitals: null }).hasContext).toBe(
      false,
    );
    expect(
      buildVisitContext({ appointment: { notes: "   " }, vitals: null }).text,
    ).toBeNull();
  });

  it("drops measurements marked entered in error instead of using the next one blindly", () => {
    const entries = [
      { temperatureC: 41.2, correctionId: "correction-1" },
      { temperatureC: 38.2 },
    ];

    expect(latestUsableVitals(entries)?.temperatureC).toBe(38.2);
    const context = buildVisitContext({ appointment: null, vitals: entries });
    expect(context.text).toContain("Teplota 38.2 \u00b0C");
    expect(context.text).not.toContain("41.2");
  });

  it("ignores unusable measurements but keeps whatever context is left", () => {
    const context = buildVisitContext({
      appointment: { notes: "Kontrola" },
      vitals: [{ temperatureC: "not-a-number", heartRateBpm: null }],
    });

    expect(context.items).toEqual([{ id: "reason", value: "Kontrola" }]);
    expect(context.text).toBe("Poznámky / dôvod návštevy: Kontrola");
  });

  it("truncates very long front-desk notes to the server bound", () => {
    const context = buildVisitContext({
      appointment: { notes: "x".repeat(VISIT_CONTEXT_MAX_LENGTH * 2) },
      vitals: null,
    });

    expect(context.text).toHaveLength(VISIT_CONTEXT_MAX_LENGTH);
  });
});
