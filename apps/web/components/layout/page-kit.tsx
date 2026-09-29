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
        "flex flex-col gap-3 rounded-lg border border-border bg-card/50 p-3 sm:flex-row sm:flex-wrap sm:items-center",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SearchField({
  id,
  inputRef,
  value,
  onChange,
  placeholder,
  maxLength,
  className,
  inputClassName,
  autoFocus,
  "aria-label": ariaLabel,
}: {
  id?: string;
  inputRef?: React.Ref<HTMLInputElement>;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  maxLength?: number;
  className?: string;
  inputClassName?: string;
  /**
   * Desktop-only affordance: on touch devices auto-focus pops the keyboard
   * over the content before the user asked for it. Callers should gate it on
   * a fine pointer / viewport width, never pass it unconditionally.
   */
  autoFocus?: boolean;
  /**
   * Accessible name. When omitted, instances without an `id` (so no
   * `<label htmlFor>` can exist) fall back to the placeholder; instances with
   * an `id` are expected to have a real label and are left alone so the
   * label keeps precedence in the accessible-name computation.
   */
  "aria-label"?: string;
}) {
  return (
    <div className={cn("relative w-full min-w-48 flex-1 sm:max-w-sm", className)}>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
      />
      {/* type="search" adds a native clear (✕) control in WebKit/Blink; the
          pseudo-element resets keep the field visually identical to the other
          toolbar inputs. */}
      <Input
        id={id}
        ref={inputRef}
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        aria-label={ariaLabel ?? (id ? undefined : placeholder)}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-9 pl-9 text-xs transition-colors duration-200 [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none focus-visible:ring-1 focus-visible:ring-primary/50",
          inputClassName,
        )}
        autoFocus={autoFocus}
      />
    </div>
  );
}

/** Native <select> matching Input/Button sm height. */
export const filterControlClass =
  "h-9 rounded-md border border-input bg-background px-3 text-xs text-foreground shadow-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

export const underlineTabsListClass =
  "inline-flex h-auto w-full justify-start gap-1 rounded-none border-b border-border bg-transparent p-0";

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

export { PageHeader } from "@/components/layout/page-header";
export { EmptyState } from "@/components/common/empty-state";
export { TableSkeleton } from "@/components/common/loading";

export function KpiCard({
  label,
  value,
  icon: IconOrNode,
  tone,
  hint,
  active,
  onClick,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  icon?: React.ReactNode | React.ComponentType<{ className?: string }>;
  tone?: "primary" | "warning" | "destructive" | "muted";
  hint?: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  const iconElement = IconOrNode
    ? React.isValidElement(IconOrNode)
      ? IconOrNode
      : React.createElement(IconOrNode as React.ComponentType<{ className?: string }>, {
          className: cn(
            "h-3.5 w-3.5",
            tone === "primary" && "text-primary",
            tone === "warning" && "text-warning",
            tone === "destructive" && "text-destructive",
          ),
        })
    : null;

  const body = (
    <>
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {iconElement}
        {label}
      </span>
      <span
        className={cn(
          "mt-1 block text-xl font-semibold tabular-nums tracking-tight text-foreground",
          tone === "primary" && "text-primary",
          tone === "warning" && "text-warning",
          tone === "destructive" && "text-destructive",
        )}
      >
        {value}
      </span>
      {hint ? (
        <span className="mt-0.5 block text-[11px] font-medium text-destructive truncate">
          {hint}
        </span>
      ) : null}
    </>
  );
  const classes = cn(
    "rounded-lg border border-border bg-card px-3 py-2 text-left shadow-xs transition-all duration-200 ease-in-out",
    onClick && "hover:border-primary/60 hover:bg-muted/10",
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
