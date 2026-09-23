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
    badge: "border-success/30 bg-success/10 text-success-muted-foreground",
    dot: "bg-success",
    ping: "bg-success",
    defaultIcon: CheckCircle2,
    defaultLabel: "Online",
  },
  confirmed: {
    badge: "border-success/30 bg-success/10 text-success-muted-foreground",
    dot: "bg-success",
    ping: "bg-success",
    defaultIcon: CheckCircle2,
    defaultLabel: "Potvrdené",
  },
  in_exam: {
    badge: "border-success/30 bg-success/10 text-success-muted-foreground",
    dot: "bg-success",
    ping: "bg-success",
    defaultIcon: Activity,
    defaultLabel: "V ambulancii",
  },
  offline: {
    badge: "border-warning/30 bg-warning/10 text-warning-muted-foreground",
    dot: "bg-warning",
    ping: "bg-warning",
    defaultIcon: WifiOff,
    defaultLabel: "Offline",
  },
  waiting: {
    badge: "border-warning/30 bg-warning/10 text-warning-muted-foreground",
    dot: "bg-warning",
    ping: "bg-warning",
    defaultIcon: Clock,
    defaultLabel: "V čakárni",
  },
  quarantine: {
    badge: "border-warning/40 bg-warning/15 text-warning-muted-foreground",
    dot: "bg-warning",
    ping: "bg-warning",
    defaultIcon: ShieldAlert,
    defaultLabel: "Karanténa",
  },
  rabies: {
    badge: "border-warning/40 bg-warning/15 text-warning-muted-foreground",
    dot: "bg-warning",
    ping: "bg-warning",
    defaultIcon: AlertTriangle,
    defaultLabel: "Besnota",
  },
  urgent: {
    badge: "border-destructive/40 bg-destructive/15 text-destructive animate-pulse",
    dot: "bg-destructive",
    ping: "bg-destructive",
    defaultIcon: AlertTriangle,
    defaultLabel: "Urgentné",
  },
  failed: {
    badge: "border-destructive/30 bg-destructive/10 text-destructive",
    dot: "bg-destructive",
    ping: "bg-destructive",
    defaultIcon: XCircle,
    defaultLabel: "Chyba",
  },
  pending: {
    badge: "border-info/30 bg-info/10 text-info-muted-foreground",
    dot: "bg-info",
    ping: "bg-info",
    defaultIcon: Clock,
    defaultLabel: "Čaká",
  },
  finished: {
    badge: "border-border bg-muted text-muted-foreground",
    dot: "bg-muted-foreground",
    ping: "bg-muted-foreground",
    defaultIcon: CheckCircle2,
    defaultLabel: "Ukončené",
  },
  deceased: {
    badge: "border-border bg-muted/80 text-muted-foreground",
    dot: "bg-muted-foreground",
    ping: "bg-muted-foreground",
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
