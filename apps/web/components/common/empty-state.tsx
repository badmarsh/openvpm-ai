import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?:
    | {
        label: string;
        onClick: () => void;
        icon?: LucideIcon;
      }
    | React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  const isCustomElement = React.isValidElement(action);
  const actionObj = !isCustomElement && action && typeof action === "object" && "label" in action
    ? (action as { label: string; onClick: () => void; icon?: LucideIcon })
    : null;
  const ActionIcon = actionObj?.icon;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card p-8 text-center",
        className
      )}
    >
      <Icon className="h-10 w-10 text-muted-foreground/50" />
      <p className="mt-3 font-medium text-muted-foreground">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground/70">
          {description}
        </p>
      )}
      {isCustomElement ? (
        <div className="mt-4">{action}</div>
      ) : actionObj ? (
        <Button size="sm" className="mt-4" onClick={actionObj.onClick}>
          {ActionIcon ? <ActionIcon className="mr-2 h-4 w-4" /> : null}
          {actionObj.label}
        </Button>
      ) : null}
    </div>
  );
}
