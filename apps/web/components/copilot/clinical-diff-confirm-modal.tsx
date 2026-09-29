"use client";

import { useState } from "react";
import { CheckCircle2, FileCheck, ShieldAlert, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfidenceScoreBadge } from "./confidence-score-badge";
import { isControlledSubstanceName } from "@/lib/controlled-substances/policy";
import { useI18n } from "@/lib/i18n";

export interface ClinicalDiffField {
  label: string;
  originalValue?: string | null;
  proposedValue: string;
  confidence?: number;
  isControlledSubstance?: boolean;
}

export interface ClinicalDiffConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (confirmedValues: Record<string, string>) => void;
  patientName: string;
  species?: string;
  sourceTitle: string; // e.g. "Hlasový záznam vyšetrenia (Voice SOAP)" or "PDF Laboratórna správa"
  fields: ClinicalDiffField[];
  /** Only pass when a real model produced the content. */
  modelName?: string;
  /**
   * Only pass when a real model reported a calibrated score. Callers with
   * deterministic extraction must omit it: the gate shows "no score" rather
   * than inventing a number.
   */
  overallConfidence?: number | null;
  /** Overrides the "proposed value" column label (e.g. non-AI extraction). */
  proposedColumnLabel?: string;
}

/**
 * ClinicalDiffConfirmModal — human-in-the-loop clinical confirmation modal.
 *
 * Strict Slovak Veterinary Statutory Safeguards:
 * 1. Zákon 39/2007 Z. z. (§3): Kniha ošetrení (Treatment Diary) vyžaduje podpis veterinára.
 *    AI nesmie priamo zapisovať do klinickej dokumentácie bez autorizácie lekára.
 * 2. Zákon 139/1998 Z. z.: Kontrolované látky (omamné a psychotropné) — NULA AI prefill.
 *    Ak je zistená kontrolovaná látka, pole je zablokované pre AI a vyžaduje manuálne zadanie lekárom.
 *
 * Built on the shared Radix <Dialog>: focus is trapped inside, Escape closes,
 * the page behind is inert for assistive tech and body scroll is locked.
 * Clicking the backdrop is deliberately NOT a dismiss action so a stray click
 * cannot throw away the veterinarian's manual edits — use Escape, Cancel or ✕.
 */
export function ClinicalDiffConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  patientName,
  species,
  sourceTitle,
  fields,
  modelName,
  overallConfidence,
  proposedColumnLabel,
}: ClinicalDiffConfirmModalProps) {
  const { t } = useI18n();
  const [confirmedCheck, setConfirmedCheck] = useState(false);
  const [editedValues, setEditedValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const f of fields) {
      const isControlled =
        Boolean(f.isControlledSubstance) ||
        isControlledSubstanceName(f.proposedValue) ||
        isControlledSubstanceName(f.label);
      if (!isControlled) {
        initial[f.label] = f.proposedValue;
      } else {
        initial[f.label] = ""; // Zero AI prefill for controlled substances (Act 139/1998 Z. z.)
      }
    }
    return initial;
  });

  if (!isOpen) return null;

  const hasControlledSubstance = fields.some(
    (f) =>
      Boolean(f.isControlledSubstance) ||
      isControlledSubstanceName(f.proposedValue) ||
      isControlledSubstanceName(f.label)
  );

  const handleConfirm = () => {
    if (!confirmedCheck) return;
    onConfirm(editedValues);
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <DialogContent
        className="flex max-h-[90vh] w-full max-w-2xl flex-col gap-5 rounded-xl bg-card p-6 shadow-2xl sm:rounded-xl"
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        {/* Header */}
        <div className="border-b pb-3 pr-8">
          <div className="flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-primary" aria-hidden="true" />
            <DialogTitle className="font-bold text-base leading-normal tracking-normal text-foreground">
              {t(
                "copilot.diffModal.title",
                "Autorizácia klinického záznamu (Diff Overenie)"
              )}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground mt-0.5">
            {t("copilot.diffModal.patient", "Pacient:")}{" "}
            <span className="font-semibold text-foreground">{patientName}</span>{" "}
            {species ? `(${species})` : ""} |{" "}
            {t("copilot.diffModal.source", "Zdroj:")} {sourceTitle}
          </DialogDescription>
        </div>

        {/* Confidence & Statutory Status */}
        <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">
              {t("copilot.diffModal.reliability", "Spoľahlivosť extrakcie:")}
            </span>
            {typeof overallConfidence === "number" ? (
              <ConfidenceScoreBadge score={overallConfidence} model={modelName} size="sm" />
            ) : (
              <Badge
                variant="outline"
                className="bg-slate-50 text-slate-700 border-slate-300 text-3xs px-1.5 py-0 gap-1 dark:bg-slate-900/40 dark:text-slate-300"
              >
                <ShieldCheck className="w-3 h-3" />
                {t(
                  "copilot.diffModal.noConfidence",
                  "Bez skóre istoty — skontrolujte každú hodnotu"
                )}
              </Badge>
            )}
          </div>
          <Badge variant="outline" className="bg-blue-50 text-blue-800 border-blue-200 text-3xs">
            {t("copilot.diffModal.statutoryBadge", "Zákon 39/2007 Z. z. autorizácia")}
          </Badge>
        </div>

        {/* Controlled Substance Warning Banner (Zákon 139/1998 Z. z.) */}
        {hasControlledSubstance && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/30 p-3 text-xs"
          >
            <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-1">
              <div className="font-bold text-red-900 dark:text-red-300">
                {t(
                  "copilot.diffModal.controlledWarningTitle",
                  "UPOZORNENIE: Kontrolovaná látka (Zákon 139/1998 Z. z.)"
                )}
              </div>
              <p className="text-red-800 dark:text-red-400 leading-relaxed text-2xs">
                {t(
                  "copilot.diffModal.controlledWarningText",
                  "Pre kontrolované omamné a psychotropné látky (opiáty, sedatíva) je automatické dopĺňanie AI prísne zakázané. Dávku, spôsob podania a spotrebu musí ošetrujúci veterinárny lekár zadať manuálne."
                )}
              </p>
            </div>
          </div>
        )}

        {/* Diff Table */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 space-y-3">
          <div className="rounded-lg border overflow-hidden text-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-muted/50 border-b font-semibold text-muted-foreground text-2xs">
                  <tr>
                    <th className="py-2.5 px-3 w-1/4">
                      {t("copilot.diffModal.colField", "Pole záznamu")}
                    </th>
                    <th className="py-2.5 px-3 w-1/3">
                      {t("copilot.diffModal.colOriginal", "Pôvodná hodnota")}
                    </th>
                    <th className="py-2.5 px-3">
                      {proposedColumnLabel ??
                        t("copilot.diffModal.colProposed", "Navrhovaná hodnota (AI)")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {fields.map((field) => {
                    const isControlled =
                      Boolean(field.isControlledSubstance) ||
                      isControlledSubstanceName(field.proposedValue) ||
                      isControlledSubstanceName(field.label);
                    return (
                      <tr key={field.label} className="hover:bg-muted/10">
                        <td className="py-2.5 px-3 font-medium text-foreground align-top">
                          <div>{field.label}</div>
                          {isControlled && (
                            <Badge variant="destructive" className="text-4xs px-1 py-0 mt-1">
                              {t("copilot.diffModal.controlledBadge", "Kontrolovaná látka")}
                            </Badge>
                          )}
                          {field.confidence != null && (
                            <div className="text-3xs text-muted-foreground mt-0.5">
                              {Math.round(field.confidence * 100)}
                              {t("copilot.diffModal.confidenceSuffix", "% istota")}
                            </div>
                          )}
                        </td>

                        <td className="py-2.5 px-3 text-muted-foreground align-top text-2xs">
                          {field.originalValue ? (
                            field.originalValue
                          ) : (
                            <span className="italic text-muted-foreground/60">
                              {t("copilot.diffModal.emptyValue", "— prázdne —")}
                            </span>
                          )}
                        </td>

                        <td className="py-2.5 px-3 align-top">
                          {isControlled ? (
                            <input
                              type="text"
                              aria-label={field.label}
                              value={editedValues[field.label] ?? ""}
                              onChange={(e) =>
                                setEditedValues({ ...editedValues, [field.label]: e.target.value })
                              }
                              placeholder={t(
                                "copilot.diffModal.controlledInputPlaceholder",
                                "Zadajte dávku a aplikáciu manuálne…"
                              )}
                              className="w-full rounded-md border border-red-300 bg-background px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                            />
                          ) : (
                            <textarea
                              rows={2}
                              aria-label={field.label}
                              value={editedValues[field.label] ?? field.proposedValue}
                              onChange={(e) =>
                                setEditedValues({ ...editedValues, [field.label]: e.target.value })
                              }
                              className="w-full rounded-md border bg-background px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Vet confirmation checkbox & footer */}
        <div className="pt-3 border-t space-y-3">
          <label className="flex items-start gap-2 text-xs text-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={confirmedCheck}
              onChange={(e) => setConfirmedCheck(e.target.checked)}
              className="mt-0.5 rounded border-muted-foreground/40 text-primary focus:ring-primary h-4 w-4"
            />
            <span className="leading-snug">
              {t(
                "copilot.diffModal.statutoryConfirmation",
                "Potvrdzujem správnosť a odbornosť tohto klinického záznamu ako ošetrujúci veterinárny lekár v súlade so Zákonom 39/2007 Z. z. o veterinárnej starostlivosti."
              )}
            </span>
          </label>

          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
              {t("common.cancel", "Zrušiť")}
            </Button>
            <Button
              size="sm"
              disabled={!confirmedCheck}
              onClick={handleConfirm}
              className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
              {t("copilot.diffModal.signAndRecord", "Podpísať & Zapísať do karty pacienta")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
