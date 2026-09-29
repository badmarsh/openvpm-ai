"use client";

import React from "react";
import { FlaskConical, ShieldCheck, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";

export interface IntegrationModeBannerProps {
  /** Integration identifier, e.g. "ekasa" | "kvepis" | "sms" */
  module: "ekasa" | "kvepis" | "sms" | string;
  /** Force live or simulation state. If undefined, defaults to detecting process.env.NEXT_PUBLIC_DEMO_MODE */
  isLive?: boolean;
  /** Optional custom detail note */
  customDetail?: string;
  /** Size variant */
  size?: "sm" | "md";
  className?: string;
}

/**
 * IntegrationModeBanner — Displays operational mode for state integrations & external gateways.
 * Transparently indicates to clinic staff whether actions are performed in SIMULATION MODE
 * (no external authorities contacted) or LIVE PRODUCTION (Ostrá prevádzka).
 */
export function IntegrationModeBanner({
  module,
  isLive,
  customDetail,
  size = "md",
  className = "",
}: IntegrationModeBannerProps) {
  const { t } = useI18n();

  // Determine mode: if isLive is provided use it, otherwise check NEXT_PUBLIC_DEMO_MODE
  const isDemoEnv = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  const activeLive = isLive !== undefined ? isLive : !isDemoEnv;

  const isSm = size === "sm";

  if (!activeLive) {
    return (
      <div className={`inline-flex items-center gap-1.5 flex-wrap ${className}`}>
        <Badge
          variant="outline"
          className={`bg-amber-50 text-amber-900 border-amber-300 dark:bg-amber-950/40 dark:text-amber-200 ${
            isSm
              ? "text-[10px] px-2 py-0.5 gap-1 font-semibold"
              : "text-xs px-2.5 py-1 gap-1.5 font-bold"
          }`}
          title={
            customDetail ||
            t(
              "integration.mode.simulationTooltip",
              "Simulačný / pilotný režim. Žiadne finančné ani zákonné dáta neodchádzajú do externých autorít."
            )
          }
        >
          <FlaskConical className={isSm ? "h-3 w-3 text-amber-600" : "h-3.5 w-3.5 text-amber-600"} />
          <span>
            {t(
              "integration.mode.simulationBadge",
              "SIMULAČNÝ REŽIM (Bez odosielania externým autoritám)"
            )}
          </span>
        </Badge>
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-1.5 flex-wrap ${className}`}>
      <Badge
        variant="outline"
        className={`bg-emerald-50 text-emerald-900 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-200 ${
          isSm
            ? "text-[10px] px-2 py-0.5 gap-1 font-semibold"
          : "text-xs px-2.5 py-1 gap-1.5 font-bold"
        }`}
        title={
          customDetail ||
          t(
            "integration.mode.liveTooltip",
            "Ostrá prevádzka. Záznamy sa odosielajú príslušným štátnym autoritám a externým bránam."
          )
        }
      >
        <ShieldCheck className={isSm ? "h-3 w-3 text-emerald-600" : "h-3.5 w-3.5 text-emerald-600"} />
        <span>{t("integration.mode.liveBadge", "OSTRÁ PREVÁDZKA")}</span>
      </Badge>
    </div>
  );
}
