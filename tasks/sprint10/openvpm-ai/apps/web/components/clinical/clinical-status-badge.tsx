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
          className={`bg-warning-muted text-warning-muted-foreground border-warning/30 ${
            isSm
              ? "text-[10px] px-1.5 py-0 gap-1 font-medium"
              : "text-xs px-2.5 py-0.5 gap-1.5 font-semibold"
          }`}
          title={t(
            "clinical.status.aiDraftTooltip",
            "AI koncept vygenerovaný modelom. Čaká na explicitnú revíziu a autorizáciu veterinárnym lekárom (Zákon č. 39/2007 Z. z. §3)."
          )}
        >
          <Sparkles className={isSm ? "h-3 w-3 text-warning" : "h-3.5 w-3.5 text-warning"} />
          <span>{t("clinical.status.aiDraft", "AI Koncept (Čaká na autorizáciu)")}</span>
          {formattedScore !== null && (
            <span className="font-mono text-[10px] bg-warning/15 px-1 py-0.2 rounded font-bold">
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
          className={`bg-muted text-muted-foreground border-border ${
            isSm
              ? "text-[10px] px-1.5 py-0 gap-1 font-medium"
              : "text-xs px-2.5 py-0.5 gap-1.5 font-semibold"
          }`}
          title={t(
            "clinical.status.importedTooltip",
            "Hodnoty boli automaticky prepísané z dokumentu alebo prístroja (deterministický parser, žiadny AI model). Vyžadujú kontrolu a potvrdenie veterinárnym lekárom (Zákon č. 39/2007 Z. z. §3)."
          )}
        >
          <FileEdit className={isSm ? "h-3 w-3 text-muted-foreground" : "h-3.5 w-3.5 text-muted-foreground"} />
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
          className={`bg-info-muted text-info-muted-foreground border-info/30 ${
            isSm
              ? "text-[10px] px-1.5 py-0 gap-1 font-medium"
              : "text-xs px-2.5 py-0.5 gap-1.5 font-semibold"
          }`}
          title={t(
            "clinical.status.adminDraftTooltip",
            "Administratívny koncept vytvorený personálom. Doteraz nepodpísaný ošetrujúcim veterinárnym lekárom."
          )}
        >
          <FileEdit className={isSm ? "h-3 w-3 text-info" : "h-3.5 w-3.5 text-info"} />
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
        className={`bg-success-muted text-success-muted-foreground border-success/30 ${
          isSm
            ? "text-[10px] px-1.5 py-0 gap-1 font-medium"
            : "text-xs px-2.5 py-0.5 gap-1.5 font-semibold"
        }`}
        title={t(
          "clinical.status.authorizedTooltip",
          "Platný klinický záznam autorizovaný a podpísaný veterinárnym lekárom v zmysle Zákona č. 39/2007 Z. z. (§3)."
        )}
      >
        <ShieldCheck className={isSm ? "h-3 w-3 text-success" : "h-3.5 w-3.5 text-success"} />
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
