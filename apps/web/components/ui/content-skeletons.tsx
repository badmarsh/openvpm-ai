import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Bespoke skeleton for data tables that guarantees 0 layout shift (CLS = 0).
 */
export function TableSkeleton({
  rows = 5,
  columns = 6,
  className,
}: {
  rows?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <div className={cn("w-full overflow-hidden rounded-xl border border-border/70 bg-card shadow-xs", className)}>
      <div className="border-b border-border/60 bg-muted/30 px-4 py-3">
        <div className="flex items-center gap-4">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton
              key={`th-${i}`}
              className={cn("h-3.5", i === 0 ? "w-24" : i === 1 ? "w-20" : "w-16")}
            />
          ))}
        </div>
      </div>
      <div className="divide-y divide-border/40">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={`tr-${r}`} className="flex items-center gap-4 px-4 py-3.5">
            {Array.from({ length: columns }).map((_, c) => (
              <Skeleton
                key={`td-${r}-${c}`}
                className={cn(
                  "h-4",
                  c === 0 ? "w-28 font-mono" : c === 1 ? "w-24" : c === 2 ? "w-16" : c === columns - 1 ? "w-20 ml-auto" : "w-16"
                )}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Bespoke skeleton for the Clinical SOAP Timeline in Records.
 */
export function RecordsTimelineSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-4", className)}>
      {/* Patient header card skeleton */}
      <div className="rounded-xl border border-border/70 bg-card p-4 shadow-xs">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-3.5 w-48" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-24 rounded-lg" />
            <Skeleton className="h-9 w-28 rounded-lg" />
          </div>
        </div>
      </div>

      {/* Filter / tabs bar */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 w-28 rounded-lg" />
        <Skeleton className="h-9 w-28 rounded-lg" />
        <Skeleton className="h-9 w-28 rounded-lg" />
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>

      {/* Structured SOAP Note cards */}
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-border/70 bg-card p-5 shadow-xs space-y-4"
        >
          <div className="flex items-center justify-between border-b border-border/50 pb-3">
            <div className="flex items-center gap-2.5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-28 rounded-md" />
            </div>
            <Skeleton className="h-4 w-32" />
          </div>

          {/* Quick vitals strip */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 rounded-lg bg-muted/20 p-2.5">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
          </div>

          {/* S-O-A-P blocks */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            <div className="rounded-lg border border-border/40 p-3 space-y-2">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
            </div>
            <div className="rounded-lg border border-border/40 p-3 space-y-2">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
            </div>
            <div className="rounded-lg border border-border/40 p-3 space-y-2">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3 w-full" />
            </div>
            <div className="rounded-lg border border-border/40 p-3 space-y-2">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-5/6" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Bespoke skeleton for the Patient Hero Header on `/patients/[id]`.
 */
export function PatientHeaderSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-border/70 bg-card p-6 shadow-xs", className)}>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-start gap-4">
          <Skeleton className="h-16 w-16 rounded-2xl shrink-0" />
          <div className="space-y-2 min-w-0">
            <div className="flex items-center gap-2.5">
              <Skeleton className="h-7 w-44" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-5 w-16 rounded-md" />
              <Skeleton className="h-5 w-24 rounded-md" />
              <Skeleton className="h-5 w-20 rounded-md" />
              <Skeleton className="h-5 w-28 rounded-md" />
            </div>
            <div className="flex items-center gap-3 pt-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-36" />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 md:self-start">
          <Skeleton className="h-9 w-28 rounded-lg" />
          <Skeleton className="h-9 w-32 rounded-lg" />
          <Skeleton className="h-9 w-20 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

/**
 * Bespoke skeleton for Patient Snapshot quick-strip.
 */
export function PatientSnapshotSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4", className)}>
      <div className="flex items-center justify-between mb-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3.5 w-24" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Bespoke skeleton for e-Kasa Receipts Table.
 */
export function EkasaReceiptsSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Skeleton className="h-7 w-16 rounded-full" />
          <Skeleton className="h-7 w-20 rounded-full" />
          <Skeleton className="h-7 w-20 rounded-full" />
          <Skeleton className="h-7 w-20 rounded-full" />
        </div>
        <Skeleton className="h-7 w-20 rounded-lg" />
      </div>
      <TableSkeleton rows={8} columns={8} />
    </div>
  );
}

/**
 * Bespoke skeleton for the e-Kasa Monospace Thermal Receipt Preview Drawer.
 */
export function ThermalReceiptSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("w-full max-w-sm mx-auto rounded-sm border border-border bg-card p-6 shadow-md space-y-4 font-mono", className)}>
      <div className="text-center space-y-2">
        <Skeleton className="h-4 w-36 mx-auto" />
        <Skeleton className="h-3 w-48 mx-auto" />
        <Skeleton className="h-3 w-32 mx-auto" />
      </div>
      <div className="border-t border-b border-border py-3 space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/4" />
      </div>
      <div className="space-y-2">
        <div className="flex justify-between">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-16" />
        </div>
        <div className="flex justify-between">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-20" />
        </div>
      </div>
      <div className="pt-2 text-center space-y-2">
        <Skeleton className="h-28 w-28 mx-auto rounded-md" />
        <Skeleton className="h-3 w-40 mx-auto" />
      </div>
    </div>
  );
}
