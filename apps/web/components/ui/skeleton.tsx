import { cn } from "@/lib/utils";

/**
 * Skeleton placeholder for loading states.
 * Use instead of hand-rolled animate-pulse divs.
 */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted/70 dark:bg-muted/40", className)}
      {...props}
    />
  );
}

export {
  TableSkeleton,
  RecordsTimelineSkeleton,
  PatientHeaderSkeleton,
  PatientSnapshotSkeleton,
  EkasaReceiptsSkeleton,
  ThermalReceiptSkeleton,
} from "./content-skeletons";
