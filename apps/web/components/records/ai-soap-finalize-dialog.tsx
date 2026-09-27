"use client";

import { useEffect, useId, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useI18n } from "@/lib/i18n";
import type {
  SectionProvenance,
  SoapSectionProvenance,
} from "@/lib/records/soap-ai-provenance";

/** Section order mirrors SOAP_SECTION_KEYS (value import would pull node:crypto client-side). */
const SECTION_ORDER = ["subjective", "objective", "assessment", "plan"] as const;

type SectionKey = (typeof SECTION_ORDER)[number];

const PROVENANCE_BADGE_VARIANT: Record<
  SectionProvenance,
  "info" | "secondary" | "outline" | "success"
> = {
  ai_verbatim: "info",
  ai_edited: "secondary",
  ai_removed: "outline",
  manual: "success",
};

export function AiSoapFinalizeDialog({
  open,
  sections,
  onConfirm,
  onCancel,
  pending = false,
}: {
  open: boolean;
  /** Per-section provenance from prepareSoapFinalization (hashes only, no text). */
  sections: SoapSectionProvenance;
  onConfirm: () => void;
  onCancel: () => void;
  pending?: boolean;
}) {
  const { t } = useI18n();
  const checkboxId = useId();
  const [acknowledged, setAcknowledged] = useState(false);

  // A fresh confirmation act every time the dialog opens or a re-prepare
  // swaps in a new envelope: the checkbox must never carry over.
  useEffect(() => {
    setAcknowledged(false);
  }, [open, sections]);

  const visibleSections = SECTION_ORDER.filter(
    (key): key is SectionKey => sections[key] !== undefined,
  );

  const sectionLabel = (key: SectionKey): string => {
    switch (key) {
      case "subjective":
        return t("soap.subjective", "Subjective");
      case "objective":
        return t("soap.objective", "Objective");
      case "assessment":
        return t("soap.assessment", "Assessment");
      case "plan":
        return t("soap.plan", "Plan");
    }
  };

  const provenanceLabel = (provenance: SectionProvenance): string => {
    switch (provenance) {
      case "ai_verbatim":
        return t("soap.aiConfirm.section_ai_verbatim", "AI text, unchanged");
      case "ai_edited":
        return t(
          "soap.aiConfirm.section_ai_edited",
          "AI text, edited by clinician",
        );
      case "ai_removed":
        return t("soap.aiConfirm.section_ai_removed", "AI text, removed");
      case "manual":
        return t("soap.aiConfirm.section_manual", "Written manually");
    }
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("soap.aiConfirm.title", "Confirm AI-assisted content")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t(
              "soap.aiConfirm.body",
              "This note contains AI-generated text. Review each section, then confirm as the attending veterinarian to finalize it.",
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <ul className="space-y-1.5 rounded-lg border border-border bg-card p-3">
          {visibleSections.map((key) => {
            const provenance = sections[key] as SectionProvenance;
            return (
              <li
                key={key}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="font-medium">{sectionLabel(key)}</span>
                <Badge variant={PROVENANCE_BADGE_VARIANT[provenance]}>
                  {provenanceLabel(provenance)}
                </Badge>
              </li>
            );
          })}
        </ul>
        <label
          htmlFor={checkboxId}
          className="flex cursor-pointer items-start gap-2.5 text-sm"
        >
          <Checkbox
            id={checkboxId}
            checked={acknowledged}
            disabled={pending}
            onCheckedChange={setAcknowledged}
            className="mt-0.5"
          />
          <span>
            {t("soap.aiConfirm.acknowledge", "I reviewed this content and take responsibility for it as the attending veterinarian.")}
          </span>
        </label>
        <AlertDialogFooter>
          <AlertDialogCancel
            disabled={pending}
            onClick={onCancel}
            className="h-8 px-3 text-xs"
          >
            {t("soap.aiConfirm.cancel", "Cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={pending || !acknowledged}
            onClick={(event) => {
              // Radix closes on Action by default; prevent that so the parent
              // keeps the dialog open with `pending` until finalize settles.
              event.preventDefault();
              onConfirm();
            }}
            className="h-8 px-3 text-xs"
          >
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {t("soap.aiConfirm.confirm", "Confirm and finalize")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
