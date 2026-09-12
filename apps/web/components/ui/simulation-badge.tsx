/**
 * SimulationBadge — yellow warning pill shown when a feature/integration is
 * running in simulation/demo mode and not connected to a live external system.
 *
 * Usage:
 *   <SimulationBadge message="Not connected to ŠVPS SR" />
 *   <SimulationBadge message="CRSZ lookup is simulated" size="sm" />
 */
"use client";

import React from "react";

interface SimulationBadgeProps {
  /** Tooltip / aria-label text describing what is simulated. */
  message: string;
  /** Visual size variant. Defaults to "md". */
  size?: "sm" | "md";
  /** Optional additional CSS classes. */
  className?: string;
}

export function SimulationBadge({
  message,
  size = "md",
  className = "",
}: SimulationBadgeProps) {
  const sizeClasses =
    size === "sm"
      ? "text-xs px-2 py-0.5 gap-1"
      : "text-sm px-2.5 py-1 gap-1.5";

  return (
    <span
      title={message}
      aria-label={message}
      role="status"
      className={[
        "inline-flex items-center rounded-full font-medium",
        "bg-amber-100 text-amber-800 border border-amber-300",
        "dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700",
        sizeClasses,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span aria-hidden="true">⚠️</span>
      <span>Simulation</span>
    </span>
  );
}
