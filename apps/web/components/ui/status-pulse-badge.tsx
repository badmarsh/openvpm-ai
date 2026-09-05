import * as React from "react";
import { cn } from "@/lib/utils";
import { Heart, ShieldAlert, AlertTriangle, CheckCircle2, Clock, WifiOff, XCircle, Activity } from "lucide-react";

export type StatusPulseVariant =
  | "online"
  | "offline"
  | "confirmed"
  | "failed"
  | "pending"
  | "waiting"
  | "in_exam"
  | "finished"
  | "deceased"
  | "quarantine"
  | "rabies"
  | "urgent"
  | "neutral";

export interface StatusPulseBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: StatusPulseVariant;
  status?: StatusPulseVariant;
  pulse?: boolean;
  label?: React.ReactNode;
  icon?: React.ElementType;
  size?: "sm" | "md";
}

const variantStyles: Record<
  StatusPulseVariant,
  {
    badge: string;
    dot: string;
    ping: string;
    defaultIcon?: React.ElementType;
    defaultLabel?: string;
  }
> = {
  online: {
    badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 dark:border-emerald-500/20",
    dot: "bg-emerald-500",
    ping: "bg-emerald-400",
    defaultIcon: CheckCircle2,
    defaultLabel: "Online",
  },
  confirmed: {
    badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 dark:border-emerald-500/20",
    dot: "bg-emerald-500",
    ping: "bg-emerald-400",
    defaultIcon: CheckCircle2,
    defaultLabel: "Potvrdené",
  },
  in_exam: {
    badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 dark:border-emerald-500/20",
    dot: "bg-emerald-500",
    ping: "bg-emerald-400",
    defaultIcon: Activity,
    defaultLabel: "V ambulancii",
  },
  offline: {
    badge: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 dark:border-amber-500/20",
    dot: "bg-amber-500",
    ping: "bg-amber-400",
    defaultIcon: WifiOff,
    defaultLabel: "Offline",
  },
  waiting: {
    badge: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 dark:border-amber-500/20",
    dot: "bg-amber-500",
    ping: "bg-amber-400",
    defaultIcon: Clock,
    defaultLabel: "V čakárni",
  },
  quarantine: {
    badge: "border-amber-600/40 bg-amber-500/15 text-amber-800 dark:text-amber-200 dark:border-amber-500/30",
    dot: "bg-amber-600",
    ping: "bg-amber-500",
    defaultIcon: ShieldAlert,
    defaultLabel: "Karanténa",
  },
  rabies: {
    badge: "border-amber-600/40 bg-amber-500/15 text-amber-800 dark:text-amber-200 dark:border-amber-500/30",
    dot: "bg-amber-600",
    ping: "bg-amber-500",
    defaultIcon: AlertTriangle,
    defaultLabel: "Besnota",
  },
  urgent: {
    badge: "border-rose-500/40 bg-rose-500/15 text-rose-800 dark:text-rose-200 dark:border-rose-500/30 animate-pulse",
    dot: "bg-rose-600",
    ping: "bg-rose-500",
    defaultIcon: AlertTriangle,
    defaultLabel: "Urgentné",
  },
  failed: {
    badge: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300 dark:border-red-500/20",
    dot: "bg-red-500",
    ping: "bg-red-400",
    defaultIcon: XCircle,
    defaultLabel: "Chyba",
  },
  pending: {
    badge: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300 dark:border-blue-500/20",
    dot: "bg-blue-500",
    ping: "bg-blue-400",
    defaultIcon: Clock,
    defaultLabel: "Čaká",
  },
  finished: {
    badge: "border-slate-300/60 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
    dot: "bg-slate-400 dark:bg-slate-500",
    ping: "bg-slate-400",
    defaultIcon: CheckCircle2,
    defaultLabel: "Ukončené",
  },
  deceased: {
    badge: "border-slate-400/50 bg-slate-100/90 text-slate-700 dark:border-slate-700/80 dark:bg-slate-900/90 dark:text-slate-300 shadow-xs",
    dot: "bg-slate-400 dark:bg-slate-500",
    ping: "bg-slate-400",
    defaultIcon: Heart,
    defaultLabel: "Zosnulý (In Memoriam)",
  },
  neutral: {
    badge: "border-border bg-muted/50 text-muted-foreground",
    dot: "bg-muted-foreground",
    ping: "bg-muted-foreground",
    defaultLabel: "Neaktívne",
  },
};

export function StatusPulseBadge({
  variant,
  status,
  pulse = true,
  label,
  icon: CustomIcon,
  size = "sm",
  className,
  children,
  ...props
}: StatusPulseBadgeProps) {
  const effectiveVariant = variant ?? status ?? "neutral";
  const config = variantStyles[effectiveVariant] ?? variantStyles.neutral;
  const Icon = CustomIcon ?? config.defaultIcon;
  const displayText = label ?? children ?? config.defaultLabel;
  const shouldPulse = pulse && effectiveVariant !== "finished" && effectiveVariant !== "neutral" && effectiveVariant !== "deceased";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium transition-all select-none",
        size === "sm" ? "px-2.5 py-0.5 text-xs" : "px-3 py-1 text-xs",
        config.badge,
        className
      )}
      {...props}
    >
      {/* Ambient Pulsing Dot */}
      <span className="relative flex h-2 w-2 shrink-0 items-center justify-center">
        {shouldPulse && (
          <span
            className={cn(
              "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
              config.ping
            )}
          />
        )}
        <span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", config.dot)} />
      </span>

      {Icon && <Icon className="h-3 w-3 shrink-0 opacity-85" aria-hidden="true" />}
      {displayText && <span>{displayText}</span>}
    </span>
  );
}
