"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, AlertTriangle, Info, ArrowLeft, CheckCircle2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { EvaluatedSafetyAlert } from "@/lib/ai/clinical-guardian";

interface ClinicalGuardianConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  alerts: EvaluatedSafetyAlert[];
  onEditPrescription: () => void;
  onProceedAnyway: () => void;
  isProcessing?: boolean;
}

export function ClinicalGuardianConfirmDialog({
  open,
  onOpenChange,
  alerts,
  onEditPrescription,
  onProceedAnyway,
  isProcessing = false,
}: ClinicalGuardianConfirmDialogProps) {
  const { t } = useI18n();

  if (!alerts || alerts.length === 0) return null;

  const criticalCount = alerts.filter((a) => a.severity === "critical").length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-destructive">
                {t("clinicalGuardian.dialog.title", "Klinický strážca: Zistené riziko kontraindikácie")}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {t(
                  "clinicalGuardian.dialog.subtitle",
                  "Systém identifikoval farmakologické riziko alebo kontraindikáciu podľa klinických pravidiel.",
                )}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="my-3 max-h-[380px] space-y-3 overflow-y-auto pr-1">
          {alerts.map((alert, idx) => (
            <div
              key={idx}
              className={`rounded-lg border p-3.5 text-xs ${
                alert.severity === "critical"
                  ? "border-destructive/40 bg-destructive/5 text-foreground"
                  : "border-amber-500/40 bg-amber-500/5 text-foreground"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  {alert.severity === "critical" ? (
                    <ShieldAlert className="h-4 w-4 text-destructive shrink-0" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                  )}
                  <span className="font-semibold">{alert.title}</span>
                </div>
                <Badge
                  variant={alert.severity === "critical" ? "destructive" : "secondary"}
                  className="text-[10px] uppercase font-bold"
                >
                  {alert.severity === "critical"
                    ? t("clinicalGuardian.severity.critical", "Kritické")
                    : t("clinicalGuardian.severity.warning", "Varovanie")}
                </Badge>
              </div>

              <p className="mt-2 text-muted-foreground leading-relaxed">
                {alert.message}
              </p>

              {alert.suggestedAction && (
                <div className="mt-2 rounded bg-background/80 p-2 text-foreground font-medium">
                  <span className="text-primary font-semibold">
                    {t("clinicalGuardian.dialog.recommendation", "Odporúčanie:")}{" "}
                  </span>
                  {alert.suggestedAction}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="rounded-md bg-muted p-2.5 text-[11px] text-muted-foreground">
          {t(
            "clinicalGuardian.dialog.hitlNotice",
            "Human-in-the-loop (Zákon 39/2007 Z. z.): AI slúži výhradne ako asistent. Konečné klinické rozhodnutie je plne v kompetencii ošetrujúceho veterinárneho lekára.",
          )}
        </div>

        <DialogFooter className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="default"
            onClick={onEditPrescription}
            disabled={isProcessing}
            className="gap-1.5"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("clinicalGuardian.dialog.editPrescription", "Upraviť predpis")}
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={onProceedAnyway}
            disabled={isProcessing}
            className="text-muted-foreground hover:text-foreground"
          >
            <CheckCircle2 className="mr-1.5 h-4 w-4 text-muted-foreground" />
            {t("clinicalGuardian.dialog.proceedAnyway", "Viem o tom, pokračovať")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
