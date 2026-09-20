import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

const TABLE_SKELETON_WIDTHS = ["w-16", "w-20", "w-24", "w-28", "w-32"];

export function PageLoading({ className }: { className?: string }) {
  const { t } = useI18n();
  return (
    <div
      className={cn(
        "flex min-h-[300px] items-center justify-center",
        className
      )}
    >
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">{t("common.loading", "Loading...")}</p>
      </div>
    </div>
  );
}

export function TableSkeleton({
  rows = 5,
  cols = 4,
  className,
}: {
  rows?: number;
  cols?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-xl border border-border/70 bg-card shadow-xs",
        className
      )}
    >
      <div className="border-b border-border/60 bg-muted/30 px-4 py-3">
        <div className="flex items-center gap-4">
          {Array.from({ length: cols }).map((_, i) => (
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
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton
                key={`td-${r}-${c}`}
                className={cn(
                  "h-4",
                  c === 0 ? "w-28" : c === 1 ? "w-24" : c === cols - 1 ? "w-20" : "w-16"
                )}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-lg border border-border bg-card p-4">
          <div className="h-3 w-20 rounded bg-muted" />
          <div className="mt-3 h-6 w-16 rounded bg-muted" />
          <div className="mt-2 h-3 w-28 rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}