"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { TableScroll } from "@/components/common/table-scroll";

/** Page body: one vertical rhythm. */
export const pageShellClass = "space-y-6";

/** Toolbar / filter row inside a quiet card. */
export function PageToolbar({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-border bg-card/50 p-3 shadow-xs sm:flex-row sm:flex-wrap sm:items-center",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder,
  maxLength,
  className,
  inputClassName,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  maxLength?: number;
  className?: string;
  inputClassName?: string;
}) {
  return (
    <div className={cn("relative w-full min-w-48 flex-1 sm:max-w-sm", className)}>
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={cn("h-9 pl-9 text-xs", inputClassName)}
      />
    </div>
  );
}

/** Native <select> matching Input/Button sm height. */
export const filterControlClass =
  "h-9 rounded-md border border-input bg-background px-3 text-xs text-foreground shadow-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

export const underlineTabsListClass =
  "inline-flex h-auto w-full max-w-lg gap-0 rounded-none border-b bg-transparent p-0";

export const underlineTabsTriggerClass =
  "gap-1.5 rounded-none border-b-2 border-transparent px-3 py-2.5 text-xs shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none";

export const tableHeadClass =
  "h-9 px-3 py-2 text-left align-middle text-[11px] font-semibold uppercase tracking-wider text-muted-foreground";

export const tableCellClass = "px-3 py-2 align-middle text-xs";

export const tableRowClass =
  "border-b border-border last:border-0 transition-colors hover:bg-muted/30";

export function DataTableFrame({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-border bg-card shadow-xs",
        className,
      )}
    >
      <TableScroll className="border-0">{children}</TableScroll>
    </div>
  );
}

export function KpiGrid({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("grid grid-cols-2 gap-3 sm:grid-cols-4", className)}>
      {children}
    </div>
  );
}

export function KpiCard({
  label,
  value,
  icon,
  active,
  onClick,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  icon?: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  const body = (
    <>
      <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="mt-1 block text-xl font-semibold tabular-nums tracking-tight text-foreground">
        {value}
      </span>
    </>
  );
  const classes = cn(
    "rounded-lg border border-border bg-card px-3 py-2 text-left shadow-xs",
    onClick && "transition-colors hover:border-primary/40",
    active && "border-primary bg-primary/5",
    className,
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={classes}>
        {body}
      </button>
    );
  }
  return <div className={classes}>{body}</div>;
}
