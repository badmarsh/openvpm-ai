"use client";

import React, { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileCheck,
  ShieldAlert,
  Edit3,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfidenceScoreBadge } from "./confidence-score-badge";
import { isControlledSubstanceName } from "@/lib/controlled-substances/policy";

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
  modelName?: string;
  overallConfidence?: number;
}

/**
 * ClinicalDiffConfirmModal — human-in-the-loop clinical confirmation modal.
 *
 * Strict Slovak Veterinary Statutory Safeguards:
 * 1. Zákon 39/2007 Z. z. (§3): Kniha ošetrení (Treatment Diary) vyžaduje podpis veterinára.
 *    AI nesmie priamo zapisovať do klinickej dokumentácie bez autorizácie lekára.
 * 2. Zákon 139/1998 Z. z.: Kontrolované látky (omamné a psychotropné) — NULA AI prefill.
 *    Ak je zistená kontrolovaná látka, pole je zablokované pre AI a vyžaduje manuálne zadanie lekárom.
 */
export function ClinicalDiffConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  patientName,
  species,
  sourceTitle,
  fields,
  modelName = "OpenVPM Copilot AI",
  overallConfidence = 0.88,
}: ClinicalDiffConfirmModalProps) {
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
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border rounded-xl max-w-2xl w-full p-6 space-y-5 shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between border-b pb-3">
          <div>
            <div className="flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-primary" />
              <h2 className="font-bold text-base text-foreground">
                Autorizácia klinického záznamu (Diff Overenie)
              </h2>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Pacient: <span className="font-semibold text-foreground">{patientName}</span> {species ? `(${species})` : ""} | Zdroj: {sourceTitle}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Confidence & Statutory Status */}
        <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Spoľahlivosť extrakcie:</span>
            <ConfidenceScoreBadge score={overallConfidence} model={modelName} size="sm" />
          </div>
          <Badge variant="outline" className="bg-blue-50 text-blue-800 border-blue-200 text-[10px]">
            Zákon 39/2007 Z. z. autorizácia
          </Badge>
        </div>

        {/* Controlled Substance Warning Banner (Zákon 139/1998 Z. z.) */}
        {hasControlledSubstance && (
          <div className="flex items-start gap-3 rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/30 p-3 text-xs">
            <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold text-red-900 dark:text-red-300">
                UPOZORNENIE: Kontrolovaná látka (Zákon 139/1998 Z. z.)
              </div>
              <p className="text-red-800 dark:text-red-400 leading-relaxed text-[11px]">
                Pre kontrolované omamné a psychotropné látky (opiáty, sedatíva) je automatické dopĺňanie AI prísne zakázané. Dávku, spôsob podania a spotrebu musí ošetrujúci veterinárny lekár zadať manuálne.
              </p>
            </div>
          </div>
        )}

        {/* Diff Table */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-3">
          <div className="rounded-lg border overflow-hidden text-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-muted/50 border-b font-semibold text-muted-foreground text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3 w-1/4">Pole záznamu</th>
                    <th className="py-2.5 px-3 w-1/3">Pôvodná hodnota</th>
                    <th className="py-2.5 px-3">Navrhovaná hodnota (AI)</th>
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
                            <Badge variant="destructive" className="text-[9px] px-1 py-0 mt-1">
                              Kontrolovaná látka
                            </Badge>
                          )}
                          {field.confidence != null && (
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              {Math.round(field.confidence * 100)}% istota
                            </div>
                          )}
                        </td>

                        <td className="py-2.5 px-3 text-muted-foreground align-top text-[11px]">
                          {field.originalValue ? field.originalValue : <span className="italic text-muted-foreground/60">— prázdne —</span>}
                        </td>

                        <td className="py-2.5 px-3 align-top">
                          {isControlled ? (
                            <input
                              type="text"
                              value={editedValues[field.label] ?? ""}
                              onChange={(e) =>
                                setEditedValues({ ...editedValues, [field.label]: e.target.value })
                              }
                              placeholder="Zadajte dávku a aplikáciu manuálne..."
                              className="w-full rounded-md border border-red-300 bg-background px-2 py-1 text-xs focus:ring-1 focus:ring-red-500"
                            />
                          ) : (
                            <textarea
                              rows={2}
                              value={editedValues[field.label] ?? field.proposedValue}
                              onChange={(e) =>
                                setEditedValues({ ...editedValues, [field.label]: e.target.value })
                              }
                              className="w-full rounded-md border bg-background px-2 py-1 text-xs focus:ring-1 focus:ring-primary"
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
              Potvrdzujem správnosť a odbornosť tohto klinického záznamu ako ošetrujúci veterinárny lekár v súlade so Zákonom 39/2007 Z. z. o veterinárnej starostlivosti.
            </span>
          </label>

          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
              Zrušiť
            </Button>
            <Button
              size="sm"
              disabled={!confirmedCheck}
              onClick={handleConfirm}
              className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Podpísať & Zapísať do karty pacienta
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
