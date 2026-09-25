import { describe, expect, it } from "vitest";
import {
  getVisitCompletionAction,
  requiresPrescriptionInventoryUnitReview,
} from "./visit-completion";

const readyVisit = {
  appointmentStatus: "in_exam",
  hasPatient: true,
  closeoutStatus: "draft",
  stateReady: true,
  linkedSoapCount: 1,
  hasActiveInvoice: true,
  unresolvedWorkCount: 0,
  canCreateSoap: true,
  canManageBilling: true,
  canManageVisit: true,
};

describe("visit completion next action", () => {
  it("quarantines package-priced medication snapshots from quick charging", () => {
    expect(
      requiresPrescriptionInventoryUnitReview({
        description: "Rimadyl 75mg (60ct) — carprofen",
      }),
    ).toBe(true);
    expect(
      requiresPrescriptionInventoryUnitReview({
        description: "Metacam oral suspension (32mL)",
      }),
    ).toBe(true);
    expect(
      requiresPrescriptionInventoryUnitReview({
        description: "Rimadyl 75mg tablet — carprofen",
      }),
    ).toBe(false);
  });

  it("keeps the standard clinic-day sequence explicit", () => {
    expect(
      getVisitCompletionAction({ ...readyVisit, linkedSoapCount: 0 }).target,
    ).toBe("soap");
    expect(
      getVisitCompletionAction({ ...readyVisit, hasActiveInvoice: false })
        .target,
    ).toBe("charge_capture");
    expect(
      getVisitCompletionAction({ ...readyVisit, unresolvedWorkCount: 1 })
        .target,
    ).toBe("reconciliation");
    expect(getVisitCompletionAction(readyVisit).target).toBe("closeout");
  });

  it("moves from signed clinical handoff to checkout", () => {
    const action = getVisitCompletionAction({
      ...readyVisit,
      closeoutStatus: "clinical_finalized",
    });

    expect(action).toMatchObject({
      target: "closeout",
      title: "Complete checkout",
    });
  });

  it("does not suggest a mutation when required state or role is missing", () => {
    expect(
      getVisitCompletionAction({ ...readyVisit, stateReady: false }).target,
    ).toBe("loading");
    expect(
      getVisitCompletionAction({
        ...readyVisit,
        hasActiveInvoice: false,
        canManageBilling: false,
      }).target,
    ).toBe("blocked");
  });

  it("recognizes a completed visit", () => {
    expect(
      getVisitCompletionAction({
        ...readyVisit,
        appointmentStatus: "checked_out",
        closeoutStatus: "completed",
      }).target,
    ).toBe("complete");
  });
});
