"use client";

import React from "react";
import { CheckCircle2, AlertCircle, AlertTriangle, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface ConfidenceScoreBadgeProps {
  /** Confidence score between 0.0 and 1.0 or 0 and 100. */
  score: number;
  /** Optional model identifier that produced the score. */
  model?: string;
  /** Visual size variant. */
  size?: "sm" | "md";
  /** Optional extra classes. */
  className?: string;
}

/**
 * ConfidenceScoreBadge — standard AI confidence indicator for OpenVPM Data Entry Copilot.
 *
 * Thresholds:
 * - >= 0.92: High confidence (Green) — safe for 1-click confirmation
 * - 0.75 - 0.91: Medium confidence (Amber) — review recommended
 * - < 0.75: Low confidence (Red) — manual entry / detailed check required
 */
export function ConfidenceScoreBadge({
  score,
  model,
  size = "md",
  className = "",
}: ConfidenceScoreBadgeProps) {
  // Normalize score to 0..1 range
  const normalized = score > 1 ? score / 100 : score;
  const percentage = Math.round(normalized * 100);

  let tier: "high" | "medium" | "low" = "low";
  if (normalized >= 0.92) {
    tier = "high";
  } else if (normalized >= 0.75) {
    tier = "medium";
  }

  const badgeConfig = {
    high: {
      label: "Vysoká spoľahlivosť",
      icon: CheckCircle2,
      style: "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300",
    },
    medium: {
      label: "Stredná spoľahlivosť",
      icon: AlertCircle,
      style: "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300",
    },
    low: {
      label: "Nízka spoľahlivosť",
      icon: AlertTriangle,
      style: "bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300",
    },
  }[tier];

  const IconComponent = badgeConfig.icon;
  const isSm = size === "sm";

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      <Badge
        variant="outline"
        className={`${badgeConfig.style} ${
          isSm ? "text-[10px] px-1.5 py-0 gap-1" : "text-xs px-2 py-0.5 gap-1.5 font-medium"
        }`}
        title={`AI model: ${model ?? "Standardný model"} | Skóre istoty: ${percentage}%`}
      >
        <IconComponent className={isSm ? "w-3 h-3" : "w-3.5 h-3.5"} />
        <span>
          {badgeConfig.label} ({percentage}%)
        </span>
      </Badge>

      {model && !isSm && (
        <span className="text-[10px] text-muted-foreground font-mono">
          [{model}]
        </span>
      )}
    </div>
  );
}
