"use client";

import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  clinicalBadgeLabelKey,
  type ClinicalBadgeCode,
  type ImagingModality,
} from "@/lib/imaging/modality";

/**
 * Diagnostic modality badges (Sprint 6).
 *
 * Colour contract: RTG → info/blue, USG → purple, CT → amber, LAB → teal.
 * Each badge carries the full modality name in `title` so a colour-blind or
 * screen-reader user never depends on the hue alone.
 */
const BADGE_CLASS: Record<ClinicalBadgeCode, string> = {
  rtg: "border-info-muted-foreground/30 bg-info-muted text-info-muted-foreground",
  usg: "border-purple-500/30 bg-purple-500/15 text-purple-700 dark:text-purple-300",
  ct: "border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-300",
  lab: "border-teal-500/30 bg-teal-500/15 text-teal-700 dark:text-teal-300",
  endoscopy:
    "border-indigo-500/30 bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  mri: "border-rose-500/30 bg-rose-500/15 text-rose-700 dark:text-rose-300",
  photo: "border-border bg-muted text-muted-foreground",
};

export function modalityBadgeClass(code: ClinicalBadgeCode): string {
  return BADGE_CLASS[code];
}

export function ModalityBadge({
  code,
  className,
}: {
  code: ClinicalBadgeCode;
  className?: string;
}) {
  const { t } = useI18n();
  const label = t(clinicalBadgeLabelKey(code), code.toUpperCase());
  return (
    <span
      title={label}
      data-modality={code}
      className={cn(
        "inline-flex items-center rounded-full border px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide tabular-nums",
        BADGE_CLASS[code],
        className,
      )}
    >
      {label}
    </span>
  );
}

/**
 * Imaging modalities recorded for a patient today plus the LAB chip when lab
 * reports were attached. Renders nothing when there is no evidence.
 */
export function ModalityBadgeRow({
  modalities,
  labReports = 0,
  className,
}: {
  modalities: readonly ImagingModality[];
  labReports?: number;
  className?: string;
}) {
  if (modalities.length === 0 && labReports === 0) return null;
  return (
    <span className={cn("flex flex-wrap items-center gap-1", className)}>
      {modalities.map((code) => (
        <ModalityBadge key={code} code={code} />
      ))}
      {labReports > 0 ? <ModalityBadge code="lab" /> : null}
    </span>
  );
}
