"use client";

import React from "react";
import {
  Sparkles,
  FileEdit,
  ShieldCheck,
  CheckCircle2,
  Brain,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";
import { ConfidenceScoreBadge } from "@/components/copilot/confidence-score-badge";

export type ClinicalRecordTier =
  | "ai_draft" // AI Koncept (Čaká na autorizáciu)
  | "administrative_draft" // Administratívny koncept
  | "imported_draft" // Automaticky prepísané z dokumentu / prístroja (bez AI modelu)
  | "authorized"; // Autorizované lekárom (Podpísané)

export interface ClinicalStatusBadgeProps {
  status: ClinicalRecordTier;
  confidenceScore?: number | null; // 0..1 or 0..100
  doctorName?: string | null;
  signedAt?: Date | string | null;
  size?: "sm" | "md";
  className?: string;
}

/**
 * ClinicalStatusBadge — Unified visual indicator for veterinary clinical entries.
 * Strictly separates:
 * 1. AI Drafts (Amber + Sparkles + Confidence %)
 * 2. Administrative drafts by staff (Neutral Blue + FileEdit)
 * 3. Authorized & Signed records by KVL Veterinarian (Emerald + ShieldCheck + Doctor name + Timestamp)
 * in compliance with Slovak Veterinary Act (Zákon č. 39/2007 Z. z. §3).
 */
export function ClinicalStatusBadge({
  status,
  confidenceScore,
  doctorName,
  signedAt,
  size = "md",
  className = "",
}: ClinicalStatusBadgeProps) {
  const { t } = useI18n();
  const isSm = size === "sm";

  if (status === "ai_draft") {
    const formattedScore =
      confidenceScore != null
        ? Math.round((confidenceScore > 1 ? confidenceScore / 100 : confidenceScore) * 100)
        : null;

    return (
      <div className={`inline-flex items-center gap-1.5 flex-wrap ${className}`}>
        <Badge
          variant="outline"
          className={`bg-amber-50 text-amber-900 border-amber-300 dark:bg-amber-950/40 dark:text-amber-200 ${
            isSm
              ? "text-[10px] px-1.5 py-0 gap-1 font-medium"
              : "text-xs px-2.5 py-0.5 gap-1.5 font-semibold"
          }`}
          title={t(
            "clinical.status.aiDraftTooltip",
            "AI koncept vygenerovaný modelom. Čaká na explicitnú revíziu a autorizáciu veterinárnym lekárom (Zákon č. 39/2007 Z. z. §3)."
          )}
        >
          <Sparkles className={isSm ? "h-3 w-3 text-amber-600" : "h-3.5 w-3.5 text-amber-600"} />
          <span>{t("clinical.status.aiDraft", "AI Koncept (Čaká na autorizáciu)")}</span>
          {formattedScore !== null && (
            <span className="font-mono text-[10px] bg-amber-200/60 dark:bg-amber-800/40 px-1 py-0.2 rounded font-bold">
              {formattedScore}%
            </span>
          )}
        </Badge>
      </div>
    );
  }

  if (status === "imported_draft") {
    return (
      <div className={`inline-flex items-center gap-1.5 flex-wrap ${className}`}>
        <Badge
          variant="outline"
          className={`bg-slate-50 text-slate-800 border-slate-300 dark:bg-slate-900/40 dark:text-slate-200 ${
            isSm
              ? "text-[10px] px-1.5 py-0 gap-1 font-medium"
              : "text-xs px-2.5 py-0.5 gap-1.5 font-semibold"
          }`}
          title={t(
            "clinical.status.importedTooltip",
            "Hodnoty boli automaticky prepísané z dokumentu alebo prístroja (deterministický parser, žiadny AI model). Vyžadujú kontrolu a potvrdenie veterinárnym lekárom (Zákon č. 39/2007 Z. z. §3)."
          )}
        >
          <FileEdit className={isSm ? "h-3 w-3 text-slate-600" : "h-3.5 w-3.5 text-slate-600"} />
          <span>{t("clinical.status.imported", "Importované (nepotvrdené lekárom)")}</span>
        </Badge>
      </div>
    );
  }

  if (status === "administrative_draft") {
    return (
      <div className={`inline-flex items-center gap-1.5 flex-wrap ${className}`}>
        <Badge
          variant="outline"
          className={`bg-sky-50 text-sky-900 border-sky-300 dark:bg-sky-950/40 dark:text-sky-200 ${
            isSm
              ? "text-[10px] px-1.5 py-0 gap-1 font-medium"
              : "text-xs px-2.5 py-0.5 gap-1.5 font-semibold"
          }`}
          title={t(
            "clinical.status.adminDraftTooltip",
            "Administratívny koncept vytvorený personálom. Doteraz nepodpísaný ošetrujúcim veterinárnym lekárom."
          )}
        >
          <FileEdit className={isSm ? "h-3 w-3 text-sky-600" : "h-3.5 w-3.5 text-sky-600"} />
          <span>{t("clinical.status.adminDraft", "Administratívny koncept")}</span>
        </Badge>
      </div>
    );
  }

  // Authorized / Signed by KVL Doctor
  const formattedDate = signedAt
    ? new Date(signedAt).toLocaleString("sk-SK", {
        day: "numeric",
        month: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className={`inline-flex items-center gap-1.5 flex-wrap ${className}`}>
      <Badge
        variant="outline"
        className={`bg-emerald-50 text-emerald-900 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-200 ${
          isSm
            ? "text-[10px] px-1.5 py-0 gap-1 font-medium"
            : "text-xs px-2.5 py-0.5 gap-1.5 font-semibold"
        }`}
        title={t(
          "clinical.status.authorizedTooltip",
          "Platný klinický záznam autorizovaný a podpísaný veterinárnym lekárom v zmysle Zákona č. 39/2007 Z. z. (§3)."
        )}
      >
        <ShieldCheck className={isSm ? "h-3 w-3 text-emerald-600" : "h-3.5 w-3.5 text-emerald-600"} />
        <span>{t("clinical.status.authorized", "Autorizované lekárom (Podpísané)")}</span>
        {doctorName && (
          <span className="font-normal opacity-90">
            · {doctorName}
          </span>
        )}
        {formattedDate && (
          <span className="font-mono text-[10px] opacity-75">
            ({formattedDate})
          </span>
        )}
      </Badge>
    </div>
  );
}
