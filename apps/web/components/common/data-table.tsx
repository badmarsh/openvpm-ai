import * as React from "react";
import { cn } from "@/lib/utils";
import {
  PATIENT_SPECIES_EMOJI,
  PATIENT_SPECIES_LABELS,
  type PatientSpecies,
} from "@/lib/patients/species";

/**
 * Shared data-dense table kit.
 *
 * Reference design: the `/encounters` register — a compact, scannable clinical
 * register (species icon first, muted meta line under the primary value,
 * uppercase micro-labels in the header, one row = one patient/one action).
 *
 * Every list in the app (patients, clients, clinical cards, laboratory,
 * pharmacy, stock, billing, …) should be built from these primitives so the
 * clinic reads the same table everywhere.
 *
 * Rules of the style:
 *  - row height stays ~52px; long values are truncated, never wrapped
 *  - the first column always carries the patient identity (species icon + name)
 *  - secondary facts go into a `text-[11px] text-muted-foreground` line
 *  - status is the last text column, actions the last column (right aligned)
 */

/** Outer card: rounded frame + horizontal scroll, no double borders. */
export const DataTableShell = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-xl border border-border bg-card shadow-xs",
      className,
    )}
    {...props}
  />
));
DataTableShell.displayName = "DataTableShell";

/** Horizontal scroll container for the table itself. */
export const DataTableScroll = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("overflow-x-auto", className)} {...props} />
));
DataTableScroll.displayName = "DataTableScroll";

/** The table element — left aligned, border-collapsed like the register. */
export const DataTable = React.forwardRef<
  HTMLTableElement,
  React.TableHTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <table
    ref={ref}
    className={cn("w-full border-collapse text-left text-sm", className)}
    {...props}
  />
));
DataTable.displayName = "DataTable";

export const DataTableHead = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={className} {...props} />
));
DataTableHead.displayName = "DataTableHead";

export const DataTableHeaderRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "border-b border-border bg-muted/30 text-xs font-semibold uppercase tracking-wider text-muted-foreground",
      className,
    )}
    {...props}
  />
));
DataTableHeaderRow.displayName = "DataTableHeaderRow";

export interface DataTableHeadCellProps
  extends React.ThHTMLAttributes<HTMLTableCellElement> {
  align?: "left" | "right" | "center";
}

export const DataTableHeadCell = React.forwardRef<
  HTMLTableCellElement,
  DataTableHeadCellProps
>(({ className, align = "left", ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "whitespace-nowrap px-4 py-3 align-middle font-semibold",
      align === "right" && "text-right",
      align === "center" && "text-center",
      align === "left" && "text-left",
      className,
    )}
    {...props}
  />
));
DataTableHeadCell.displayName = "DataTableHeadCell";

export const DataTableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("divide-y divide-border", className)}
    {...props}
  />
));
DataTableBody.displayName = "DataTableBody";

export interface DataTableRowProps
  extends React.HTMLAttributes<HTMLTableRowElement> {
  /** Adds pointer affordance + keyboard focus ring for clickable rows. */
  interactive?: boolean;
  /** Soft status tint used by live rows (in exam / waiting / alert). */
  tone?: "none" | "active" | "waiting" | "danger";
}

const rowToneStyles: Record<NonNullable<DataTableRowProps["tone"]>, string> = {
  none: "",
  active: "bg-emerald-500/5",
  waiting: "bg-amber-500/5",
  danger: "bg-destructive/5",
};

export const DataTableRow = React.forwardRef<
  HTMLTableRowElement,
  DataTableRowProps
>(({ className, interactive = false, tone = "none", ...props }, ref) => (
  <tr
    ref={ref}
    tabIndex={interactive ? 0 : undefined}
    className={cn(
      "transition-colors hover:bg-muted/40",
      interactive &&
        "cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-inset",
      rowToneStyles[tone],
      className,
    )}
    {...props}
  />
));
DataTableRow.displayName = "DataTableRow";

export interface DataTableCellProps
  extends React.TdHTMLAttributes<HTMLTableCellElement> {
  align?: "left" | "right" | "center";
  /** Monospace, tabular figures — for lab values, doses, money, chip ids. */
  numeric?: boolean;
}

export const DataTableCell = React.forwardRef<
  HTMLTableCellElement,
  DataTableCellProps
>(
  (
    { className, align = "left", numeric = false, ...props },
    ref,
  ) => (
    <td
      ref={ref}
      className={cn(
        "px-4 py-3 align-middle",
        align === "right" && "text-right",
        align === "center" && "text-center",
        numeric && "font-mono tabular-nums",
        className,
      )}
      {...props}
    />
  ),
);
DataTableCell.displayName = "DataTableCell";

/**
 * Species identity mark used as the first element of every patient row.
 * Emoji are intentional: they render identically on every clinic workstation
 * (Windows, macOS, tablets) without shipping an icon font per species.
 */
export interface SpeciesIconProps {
  species?: string | null;
  /** Translated species name; falls back to the canonical English label. */
  label?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const speciesIconSizes: Record<NonNullable<SpeciesIconProps["size"]>, string> =
  {
    sm: "h-6 w-6 text-sm",
    md: "h-7 w-7 text-base",
    lg: "h-9 w-9 text-lg",
  };

export function SpeciesIcon({
  species,
  label,
  size = "md",
  className,
}: SpeciesIconProps) {
  const normalized = (species ?? "other") as PatientSpecies;
  const emoji = PATIENT_SPECIES_EMOJI[normalized] ?? PATIENT_SPECIES_EMOJI.other;
  const speciesLabel = label ?? PATIENT_SPECIES_LABELS[normalized] ?? species;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-lg border border-border/70 bg-muted/50 leading-none",
        speciesIconSizes[size],
        className,
      )}
      title={speciesLabel ?? undefined}
    >
      <span aria-hidden="true">{emoji}</span>
      <span className="sr-only">{speciesLabel}</span>
    </span>
  );
}

/** Name + muted meta line, the identity block of a clinical register row. */
export function IdentityCell({
  icon,
  primary,
  secondary,
  className,
  primaryClassName,
}: {
  icon?: React.ReactNode;
  primary: React.ReactNode;
  secondary?: React.ReactNode;
  className?: string;
  primaryClassName?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      {icon}
      <div className="min-w-0">
        <div
          className={cn(
            "truncate font-medium text-foreground",
            primaryClassName,
          )}
        >
          {primary}
        </div>
        {secondary ? (
          <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {secondary}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Muted single-line fact with an inline icon (doctor, room, phone …). */
export function MetaLine({
  icon,
  children,
  className,
}: {
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs text-muted-foreground",
        className,
      )}
    >
      {icon}
      <span className="truncate">{children}</span>
    </span>
  );
}

/** Compact count chip used in tab labels and section headers. */
export function CountPill({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "accent" | "warning" | "danger" | "success";
  className?: string;
}) {
  const tones: Record<string, string> = {
    neutral: "bg-muted text-muted-foreground",
    accent: "bg-primary/15 text-primary",
    warning: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    danger: "bg-destructive/15 text-destructive",
    success: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  };
  return (
    <span
      className={cn(
        "ml-1 rounded-full px-1.5 py-px text-[10px] font-bold tabular-nums",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Toolbar card that groups register tabs, search and filters. */
export const DataTableToolbar = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex flex-col gap-4 rounded-xl border border-border bg-card/50 p-4 shadow-xs",
      className,
    )}
    {...props}
  />
));
DataTableToolbar.displayName = "DataTableToolbar";

/** Segmented tab strip: same shape on every register page. */
export const DataTableTabs = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    role="tablist"
    className={cn(
      "flex flex-wrap items-center gap-1 rounded-lg border border-border/50 bg-muted/40 p-1",
      className,
    )}
    {...props}
  />
));
DataTableTabs.displayName = "DataTableTabs";

export interface DataTableTabProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  icon?: React.ReactNode;
}

export const DataTableTab = React.forwardRef<
  HTMLButtonElement,
  DataTableTabProps
>(({ className, active = false, icon, children, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    role="tab"
    aria-selected={active}
    className={cn(
      "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
      active
        ? "bg-primary font-semibold text-primary-foreground shadow-xs"
        : "text-muted-foreground hover:bg-muted hover:text-foreground",
      className,
    )}
    {...props}
  >
    {icon}
    {children}
  </button>
));
DataTableTab.displayName = "DataTableTab";

/** Register filter dropdown (status, doctor, species …). */
export const DataTableSelect = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "h-9 rounded-md border border-border bg-background px-2.5 py-1 text-xs text-foreground shadow-xs focus:outline-hidden focus:ring-2 focus:ring-primary",
      className,
    )}
    {...props}
  />
));
DataTableSelect.displayName = "DataTableSelect";

/** Search input for a register toolbar (icon is added by the caller). */
export const DataTableSearchInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    type="text"
    className={cn(
      "h-9 w-full rounded-md border border-border bg-background pl-9 pr-3 text-xs text-foreground shadow-xs placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-primary",
      className,
    )}
    {...props}
  />
));
DataTableSearchInput.displayName = "DataTableSearchInput";
