"use client";

import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  SOAP_SECTION_KEYS,
  type SoapSectionKey,
  type SoapSectionProvenance,
  type SectionProvenance,
} from "@/lib/records/soap-ai-provenance";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const SECTION_LABEL_KEYS: Record<SoapSectionKey, string> = {
  subjective: "soap.subjective",
  objective: "soap.objective",
  assessment: "soap.assessment",
  plan: "soap.plan",
};

const PROVENANCE_LABEL_KEYS: Record<SectionProvenance, string> = {
  ai_verbatim: "soap.aiConfirm.section_ai_verbatim",
  ai_edited: "soap.aiConfirm.section_ai_edited",
  ai_removed: "soap.aiConfirm.section_ai_removed",
  manual: "soap.aiConfirm.section_manual",
};

/**
 * Sprint 33 (owner decision 2026-09-27): the veterinarian's final,
 * attributable click on AI-assisted SOAP content. The dialog lists the
 * per-section provenance from the confirmation envelope (no draft text),
 * and the confirm button stays disabled until the vet explicitly
 * acknowledges responsibility for the content.
 *
 * AlertDialog semantics: rendered with `role="alertdialog"` and outside
 * clicks are ignored, so the vet must choose confirm or cancel explicitly.
 */
export function AiSoapFinalizeDialog({
  open,
  sections,
  onConfirm,
  onCancel,
  pending,
}: {
  open: boolean;
  sections: SoapSectionProvenance;
  onConfirm: () => void;
  onCancel: () => void;
  pending?: boolean;
}) {
  const { t } = useI18n();
  const [acknowledged, setAcknowledged] = useState(false);

  // A fresh envelope always starts unacknowledged.
  useEffect(() => {
    if (open) setAcknowledged(false);
  }, [open]);

  const listedSections = SOAP_SECTION_KEYS.filter((key) => sections[key]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        if (!next) onCancel();
      }}
    >
      <DialogContent
        role="alertdialog"
        className="sm:max-w-[560px]"
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle>
                {t("soap.aiConfirm.title", "Confirm AI-assisted SOAP note")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "soap.aiConfirm.body",
                  "This SOAP note contains AI-generated content. Review the origin of each section, then confirm as the responsible veterinarian."
                )}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {listedSections.length > 0 ? (
          <ul className="space-y-1.5 rounded-lg border border-border bg-muted/20 p-3">
            {listedSections.map((key) => {
              const provenance = sections[key];
              if (!provenance) return null;
              const isAi = provenance !== "manual";
              return (
                <li
                  key={key}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="font-medium">
                    {t(SECTION_LABEL_KEYS[key], key)}
                  </span>
                  <span
                    className={cn(
                      "text-xs",
                      isAi
                        ? "font-medium text-primary"
                        : "text-muted-foreground"
                    )}
                  >
                    {t(PROVENANCE_LABEL_KEYS[provenance], provenance)}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : null}

        <label
          htmlFor="ai-soap-acknowledge"
          className="flex items-start gap-2.5 rounded-lg border border-border bg-background p-3 text-sm"
        >
          <Checkbox
            id="ai-soap-acknowledge"
            checked={acknowledged}
            disabled={pending}
            onCheckedChange={(checked) => setAcknowledged(checked)}
            className="mt-0.5"
          />
          <span>
            {t("soap.aiConfirm.acknowledge", "I reviewed this content and take responsibility for it as the attending veterinarian.")}
          </span>
        </label>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={pending}
          >
            {t("soap.aiConfirm.cancel", "Cancel")}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onConfirm}
            disabled={pending || !acknowledged}
          >
            {t("soap.aiConfirm.confirm", "Confirm and finalize")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
