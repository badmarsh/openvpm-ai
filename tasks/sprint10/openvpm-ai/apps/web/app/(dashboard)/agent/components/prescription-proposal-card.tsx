"use client";

import { useState } from "react";
import { AlertTriangle, Check, Loader2, Pill } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

type PrescriptionProposal = {
  confirmationId: string;
  prescriptionId: string;
  patientId: string;
  medicationName: string;
  dosage: string;
  frequency: string;
  instructions?: string | null;
  startDate: string;
  expiresAt?: string;
};

function asProposal(result: unknown): PrescriptionProposal | null {
  if (!result || typeof result !== "object") return null;
  const candidate = result as Record<string, unknown>;
  if (candidate.status !== "pending_confirmation") return null;
  const required = [
    "confirmationId",
    "prescriptionId",
    "patientId",
    "medicationName",
    "dosage",
    "frequency",
    "startDate",
  ] as const;
  if (required.some((key) => typeof candidate[key] !== "string")) return null;
  return {
    confirmationId: candidate.confirmationId as string,
    prescriptionId: candidate.prescriptionId as string,
    patientId: candidate.patientId as string,
    medicationName: candidate.medicationName as string,
    dosage: candidate.dosage as string,
    frequency: candidate.frequency as string,
    instructions: (candidate.instructions as string | null) ?? null,
    startDate: candidate.startDate as string,
    expiresAt:
      candidate.expiresAt instanceof Date
        ? candidate.expiresAt.toISOString()
        : typeof candidate.expiresAt === "string"
          ? candidate.expiresAt
          : undefined,
  };
}

/**
 * Human-in-the-loop confirmation for prescriptions proposed by the AI agent.
 *
 * The agent tool never writes a prescription: it returns a pending proposal
 * bound to a one-time confirmation envelope. Only the veterinarian shown here
 * can materialise it, and only through `agent.savePrescription`, which consumes
 * that envelope in the same transaction as the INSERT. Controlled substances
 * are refused server-side and never reach this card.
 */
export function PrescriptionProposalCard({
  toolName,
  result,
}: {
  toolName: string;
  result: unknown;
}) {
  const { t } = useI18n();
  const [saved, setSaved] = useState(false);

  const save = trpc.agent.savePrescription.useMutation({
    onSuccess: () => {
      setSaved(true);
      toast.success(
        t(
          "agent.prescription.saved",
          "Recept bol vystavený a zapísaný do karty pacienta.",
        ),
      );
    },
    onError: (error) => {
      const message = error.message ?? "";
      if (/EXPIRED|EXPIRED_TOKEN|already been consumed|renewed/i.test(message)) {
        toast.error(
          t(
            "agent.prescription.expired",
            "Platnosť potvrdenia vypršala alebo už bol recept vystavený. Spustite asistenta znova.",
          ),
        );
        return;
      }
      if (/controlled|OPL|kontrolovan/i.test(message)) {
        toast.error(
          t(
            "agent.prescription.controlledBlocked",
            "Kontrolované látky nie je možné vystaviť cez AI asistenta. Použite predpisový formulár.",
          ),
        );
        return;
      }
      toast.error(
        message ||
          t("agent.prescription.saveFailed", "Recept sa nepodarilo vystaviť."),
      );
    },
  });

  if (toolName !== "create_prescription") return null;
  const proposal = asProposal(result);
  if (!proposal) return null;

  if (saved) {
    return (
      <div className="mt-2 rounded-md border border-success/30 bg-success/10 p-2.5 text-[11px] text-success">
        <div className="flex items-center gap-1.5 font-medium">
          <Check className="h-3.5 w-3.5" />
          {t("agent.prescription.savedShort", "Recept vystavený po potvrdení lekárom")}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-md border border-warning/40 bg-warning/10 p-2.5 text-[11px]">
      <div className="flex items-center gap-1.5 font-semibold text-warning-muted-foreground">
        <Pill className="h-3.5 w-3.5" />
        {t(
          "agent.prescription.pendingTitle",
          "Návrh receptu — vyžaduje potvrdenie lekára",
        )}
      </div>
      <dl className="mt-2 space-y-1 text-foreground">
        <div className="flex gap-2">
          <dt className="w-20 shrink-0 text-muted-foreground">
            {t("agent.prescription.medication", "Liek")}
          </dt>
          <dd className="font-medium">{proposal.medicationName}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-20 shrink-0 text-muted-foreground">
            {t("agent.prescription.dosage", "Dávka")}
          </dt>
          <dd>{proposal.dosage}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-20 shrink-0 text-muted-foreground">
            {t("agent.prescription.frequency", "Frekvencia")}
          </dt>
          <dd>{proposal.frequency}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-20 shrink-0 text-muted-foreground">
            {t("agent.prescription.startDate", "Od")}
          </dt>
          <dd className="tabular-nums">{proposal.startDate}</dd>
        </div>
        {proposal.instructions ? (
          <div className="flex gap-2">
            <dt className="w-20 shrink-0 text-muted-foreground">
              {t("agent.prescription.instructions", "Poznámka")}
            </dt>
            <dd>{proposal.instructions}</dd>
          </div>
        ) : null}
      </dl>
      <div className="mt-2 flex items-start gap-1.5 text-[10px] text-muted-foreground">
        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
        <span>
          {t(
            "agent.prescription.consentNotice",
            "Vystavením potvrdzujete, že ste recept skontrolovali a preberáte za neho klinickú zodpovednosť.",
          )}
        </span>
      </div>
      <Button
        type="button"
        size="sm"
        className="mt-2 h-8 text-[11px]"
        disabled={save.isPending}
        onClick={() =>
          save.mutate({
            confirmationId: proposal.confirmationId,
            prescriptionId: proposal.prescriptionId,
            patientId: proposal.patientId,
            medicationName: proposal.medicationName,
            dosage: proposal.dosage,
            frequency: proposal.frequency,
            instructions: proposal.instructions ?? undefined,
            startDate: proposal.startDate,
          })
        }
      >
        {save.isPending ? (
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
        ) : (
          <Check className="mr-1.5 h-3.5 w-3.5" />
        )}
        {t("agent.prescription.confirm", "Potvrdiť a vystaviť recept")}
      </Button>
    </div>
  );
}
