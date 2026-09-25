"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { StatusPulseBadge } from "@/components/ui/status-pulse-badge";
import { useI18n } from "@/lib/i18n";
import { PATIENT_SPECIES_EMOJI } from "@/lib/patients/species";
import { cn } from "@/lib/utils";

const speciesEmoji: Record<string, string> = PATIENT_SPECIES_EMOJI;

type PatientStickyRailProps = {
  name: string;
  species: string | null;
  status: string;
  allergies: { allergen: string; severity: string }[];
  latestWeight: string;
  ambulatoryEnabled: boolean;
  /** Ref to the element whose bottom edge triggers sticky show/hide */
  sentinelRef: React.RefObject<HTMLElement | null>;
};

export function PatientStickyRail({
  name,
  species,
  status,
  allergies,
  latestWeight,
  ambulatoryEnabled,
  sentinelRef,
}: PatientStickyRailProps) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // Show sticky rail when the patient header card scrolls out of view
        setVisible(!entry.isIntersecting);
      },
      { threshold: 0 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [sentinelRef]);

  const severeAllergies = allergies.filter((a) => a.severity === "severe");
  const hasAllergies = allergies.length > 0;

  return (
    <div
      aria-hidden={!visible}
      className={cn(
        "sticky top-14 z-30 -mx-4 border-b border-border/60 bg-background/95 backdrop-blur-sm px-4 py-2 transition-all duration-200 sm:-mx-6 sm:px-6",
        visible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none -translate-y-full opacity-0",
      )}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {/* Patient identity */}
        <div className="flex items-center gap-2">
          <span className="text-lg" aria-hidden="true">
            {speciesEmoji[species ?? "other"] ?? "\uD83D\uDC3E"}
          </span>
          <span className="font-heading text-sm font-bold tracking-tight text-foreground">
            {name}
          </span>
          <StatusPulseBadge
            variant={
              status === "deceased"
                ? "deceased"
                : status === "inactive"
                  ? "offline"
                  : "online"
            }
            label={
              status === "deceased"
                ? t("patients.status.deceased", "Deceased")
                : status === "inactive"
                  ? t("patients.status.inactive", "Inactive")
                  : t("patients.status.active", "Active")
            }
            size="sm"
          />
        </div>

        {/* Allergy alert */}
        {hasAllergies && (
          <div
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium",
              severeAllergies.length > 0
                ? "bg-destructive/10 text-destructive"
                : "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
            )}
          >
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>
              {t("patients.stickyRail.allergies", "Allergies")}: {allergies.map((a) => a.allergen).join(", ")}
            </span>
          </div>
        )}

        {/* Weight */}
        {ambulatoryEnabled && latestWeight && (
          <span className="text-xs text-muted-foreground">
            {t("patients.stickyRail.weight", "Weight")}: {latestWeight}
          </span>
        )}
      </div>
    </div>
  );
}
