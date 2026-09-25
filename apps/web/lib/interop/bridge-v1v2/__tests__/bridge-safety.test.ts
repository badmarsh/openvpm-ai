/**
 * Secure Interop Bridge v1 → v2 — statutory safety gates (Sprint 30).
 * -------------------------------------------------------------------
 *   • Zákon č. 39/2007 Z. z. — AI drafts stay drafted; only a licensed
 *     veterinarian signs, and never over the wire.
 *   • Zákon č. 139/1998 Z. z. — zero AI prefill for ketamín, opioidy,
 *     propofol (and every other controlled substance); manual entry + witness.
 *   • Sympathy Gate — deceased / euthanized patients suppress automated
 *     outreach immediately.
 */
import { describe, expect, it } from "vitest";
import { applyBridgeSafetyGates, scanBridgeControlledSubstanceTerms } from "../safety";

describe("controlled-substance vocabulary", () => {
  it("finds ketamín, opioids and propofol in free text, diacritics included", () => {
    const terms = scanBridgeControlledSubstanceTerms({
      assessment: "Premedikácia Ketamín 10% a následne Propofol i.v.",
      medicationName: "Butorfanol 10 mg/ml",
      notes: "Bez omamných látok",
    });
    const flat = terms.join(" ").toLowerCase();
    expect(flat).toContain("ketamin");
    expect(flat).toContain("propofol");
    expect(flat).toContain("butorfanol");
  });

  it("recognizes the generic opioid vocabulary and stays quiet on safe text", () => {
    expect(
      scanBridgeControlledSubstanceTerms({ note: "Opioidný analgetik" }).length,
    ).toBeGreaterThan(0);
    expect(
      scanBridgeControlledSubstanceTerms({ note: "Amoxicilin 500 mg" }),
    ).toEqual([]);
    expect(scanBridgeControlledSubstanceTerms({ note: "Meloxidyl" })).toEqual([]);
  });
});

describe("clinical draft gate (Zákon 39/2007 Z. z.)", () => {
  it("accepts an AI draft but marks that a veterinarian must sign it", () => {
    const result = applyBridgeSafetyGates({
      messageType: "clinical.soap_note.drafted",
      payload: {
        encounterId: "E-1",
        patientId: "P-1",
        author: "ai",
        status: "draft",
        assessment: "Suspektná gastroenteritída.",
        requiresVetSignoff: true,
      },
    });
    expect(result.blocked).toBe(false);
    expect(result.clinical).toBe(true);
    expect(result.requiresVetSignoff).toBe(true);
    expect(result.statutoryReferences).toContain("Zákon č. 39/2007 Z. z.");
  });

  it("blocks every attempt to pre-sign or auto-finalize clinical content", () => {
    for (const flag of ["autoSign", "autoFinalize", "aiSignature", "skipVetReview"]) {
      const result = applyBridgeSafetyGates({
        messageType: "clinical.soap_note.signed",
        payload: {
          encounterId: "E-1",
          patientId: "P-1",
          status: "signed",
          signedByVetId: "vet-1",
          licenceNumber: "SK-1234",
          signedAt: new Date().toISOString(),
          [flag]: true,
        },
      });
      expect(result.blocked, flag).toBe(true);
      expect(result.blockCode).toBe("clinical_draft_required");
    }
  });

  it("refuses a signature that does not belong to a human veterinarian", () => {
    const result = applyBridgeSafetyGates({
      messageType: "clinical.soap_note.signed",
      payload: {
        encounterId: "E-1",
        patientId: "P-1",
        status: "signed",
        signedByVetId: "ai-assistant",
        licenceNumber: "SK-1234",
        signedAt: new Date().toISOString(),
      },
    });
    expect(result.blocked).toBe(true);
    expect(result.blockCode).toBe("clinical_signoff_missing");
  });
});

describe("controlled substances gate (Zákon 139/1998 Z. z.)", () => {
  it("blocks an AI prefill for ketamín outright", () => {
    const result = applyBridgeSafetyGates({
      messageType: "prescription.created",
      payload: {
        patientId: "P-1",
        medicationName: "Ketamín 10% inj.",
        dosage: "2 mg/kg",
        frequency: "raz",
        durationDays: 1,
        status: "draft",
        aiPrefill: true,
        manualEntry: false,
      },
    });
    expect(result.blocked).toBe(true);
    expect(result.blockCode).toBe("controlled_substance_ai_prefill_forbidden");
    expect(result.controlledSubstance).toBe(true);
    expect(result.controlledSubstanceTerms.length).toBeGreaterThan(0);
    expect(result.statutoryReferences).toContain("Zákon č. 139/1998 Z. z.");
  });

  it("requires manual entry for a propofol prescription", () => {
    const base = {
      patientId: "P-1",
      medicationName: "Propofol 1%",
      dosage: "4 mg/kg",
      frequency: "i.v.",
      durationDays: 1,
      status: "draft" as const,
    };
    const automated = applyBridgeSafetyGates({
      messageType: "prescription.created",
      payload: { ...base, manualEntry: false },
    });
    expect(automated.blocked).toBe(true);
    expect(automated.blockCode).toBe("controlled_substance_manual_entry_required");

    const manual = applyBridgeSafetyGates({
      messageType: "prescription.created",
      payload: { ...base, manualEntry: true },
    });
    expect(manual.blocked).toBe(false);
    expect(manual.controlledSubstance).toBe(true);
    expect(manual.requiresVetSignoff).toBe(true);
  });

  it("requires a witness for administration and disposal of an OPL entry", () => {
    const base = {
      patientId: "P-1",
      substanceName: "Fentanyl",
      quantity: 1,
      unit: "ml",
      ledgerId: "OPL-1",
      administeredAt: new Date().toISOString(),
      aiPrefill: false as const,
      manualEntry: true as const,
    };

    const withoutWitness = applyBridgeSafetyGates({
      messageType: "controlled_substance.dispense",
      payload: { ...base, action: "administered" },
    });
    expect(withoutWitness.blocked).toBe(true);
    expect(withoutWitness.blockCode).toBe("controlled_substance_witness_required");

    const witnessed = applyBridgeSafetyGates({
      messageType: "controlled_substance.dispense",
      payload: { ...base, action: "administered", witnessedBy: "MVDr. Novák" },
    });
    expect(witnessed.blocked).toBe(false);

    // Receipt of stock needs no witness.
    const received = applyBridgeSafetyGates({
      messageType: "controlled_substance.dispense",
      payload: { ...base, action: "received" },
    });
    expect(received.blocked).toBe(false);
  });
});

describe("Sympathy Gate", () => {
  it("refuses an automated reminder for a deceased patient and suppresses it", () => {
    const result = applyBridgeSafetyGates({
      messageType: "appointment.created",
      payload: {
        appointmentId: "A-1",
        patientId: "P-1",
        clientId: "C-1",
        scheduledAt: new Date().toISOString(),
        automatedReminder: true,
      },
      patientStatus: "deceased",
    });
    expect(result.blocked).toBe(true);
    expect(result.blockCode).toBe("sympathy_suppression_required");
    expect(result.sympathySuppressed).toBe(true);
  });

  it("accepts a suppression request and reports it as recorded", () => {
    const result = applyBridgeSafetyGates({
      messageType: "automation.suppression.request",
      payload: {
        patientId: "P-1",
        clientId: "C-1",
        reason: "deceased",
        blockedAction: "journey:post_vaccine.step_2",
      },
      patientStatus: "deceased",
    });
    expect(result.blocked).toBe(false);
    expect(result.sympathySuppressed).toBe(true);
    expect(result.issues.map((issue) => issue.code)).toContain(
      "sympathy_suppression_recorded",
    );
  });

  it("suppresses derived outreach for an active-to-deceased mirror update", () => {
    const result = applyBridgeSafetyGates({
      messageType: "patient.updated",
      payload: {
        patientId: "P-1",
        status: "deceased",
      },
    });
    expect(result.blocked).toBe(false);
    expect(result.sympathySuppressed).toBe(true);
    expect(result.statutoryReferences.join(" ")).toContain("Sympathy Gate");
  });

  it("leaves an active patient untouched", () => {
    const result = applyBridgeSafetyGates({
      messageType: "appointment.created",
      payload: {
        appointmentId: "A-1",
        patientId: "P-1",
        clientId: "C-1",
        scheduledAt: new Date().toISOString(),
        automatedReminder: true,
      },
      patientStatus: "active",
    });
    expect(result.blocked).toBe(false);
    expect(result.sympathySuppressed).toBe(false);
  });
});

describe("imaging attachment guard", () => {
  it("never lets an attachment overwrite patient.photoUrl", () => {
    const result = applyBridgeSafetyGates({
      messageType: "attachment.linked",
      payload: {
        patientId: "P-1",
        fileId: "F-1",
        category: "imaging",
        photoUrl: "https://example.org/x.png",
      },
    });
    expect(result.blocked).toBe(true);
    expect(result.blockCode).toBe("imaging_photo_url_forbidden");
  });
});
