export type VisitCompletionTarget =
  | "patient"
  | "soap"
  | "charge_capture"
  | "reconciliation"
  | "closeout"
  | "complete"
  | "blocked"
  | "loading";

export type VisitCompletionAction = {
  target: VisitCompletionTarget;
  title: string;
  description: string;
};

export function getVisitCompletionAction(input: {
  appointmentStatus: string;
  hasPatient: boolean;
  closeoutStatus: string | null | undefined;
  stateReady: boolean;
  linkedSoapCount: number | undefined;
  hasActiveInvoice: boolean;
  unresolvedWorkCount: number | undefined;
  canCreateSoap: boolean;
  canManageBilling: boolean;
  canManageVisit: boolean;
}): VisitCompletionAction {
  if (
    input.appointmentStatus === "checked_out" ||
    input.closeoutStatus === "completed"
  ) {
    return {
      target: "complete",
      title: "Visit complete",
      description:
        "Clinical handoff, billing disposition, and checkout are recorded.",
    };
  }

  if (!input.hasPatient) {
    return {
      target: "patient",
      title: "Attach the patient",
      description:
        "Confirm the patient and client before documenting clinical care.",
    };
  }

  if (input.appointmentStatus !== "in_exam") {
    return {
      target: "blocked",
      title: "Start the exam",
      description:
        "Use the visit status action above before documenting or billing this visit.",
    };
  }

  if (!input.stateReady) {
    return {
      target: "loading",
      title: "Confirming visit state",
      description:
        "OpenVPM is verifying documentation, invoices, and performed work before suggesting the next action.",
    };
  }

  const clinicalRecordComplete =
    (input.linkedSoapCount ?? 0) > 0 ||
    input.closeoutStatus === "clinical_finalized";

  if (!clinicalRecordComplete) {
    return input.canCreateSoap
      ? {
          target: "soap",
          title: "Document the clinical visit",
          description:
            "Write and finalize the SOAP note, or record a bounded documentation exception for an exempt visit.",
        }
      : {
          target: "blocked",
          title: "Clinical documentation needs a veterinarian",
          description:
            "A veterinarian or administrator must complete the SOAP note or documented exception.",
        };
  }

  if (!input.hasActiveInvoice) {
    return input.canManageBilling
      ? {
          target: "charge_capture",
          title: "Capture the visit charges",
          description:
            "Add performed services and dispensed products, then save the visit-linked draft invoice.",
        }
      : {
          target: "blocked",
          title: "Billing needs the front desk",
          description:
            "An administrator or front desk teammate must capture charges or document the no-charge disposition.",
        };
  }

  if ((input.unresolvedWorkCount ?? 0) > 0) {
    return input.canManageVisit
      ? {
          target: "reconciliation",
          title: "Reconcile performed work",
          description:
            "Link each performed item to its saved invoice line or record an attributable exception.",
        }
      : {
          target: "blocked",
          title: "Performed work needs reconciliation",
          description:
            "A visit teammate must link each performed item to billing or record an attributable exception.",
        };
  }

  if (input.closeoutStatus !== "clinical_finalized") {
    return input.canManageVisit
      ? {
          target: "closeout",
          title: "Finalize the owner handoff",
          description:
            "Confirm instructions, prescriptions, and follow-up before signing the durable discharge record.",
        }
      : {
          target: "blocked",
          title: "Owner handoff needs a clinical teammate",
          description:
            "A permitted teammate must finish and finalize the discharge instructions.",
        };
  }

  return input.canManageVisit
    ? {
        target: "closeout",
        title: "Complete checkout",
        description:
          "Confirm payment or pay-later disposition and record how the owner received the handoff.",
      }
    : {
        target: "blocked",
        title: "Checkout needs an authorized teammate",
        description:
          "A permitted teammate must record the billing disposition and owner handoff.",
      };
}
