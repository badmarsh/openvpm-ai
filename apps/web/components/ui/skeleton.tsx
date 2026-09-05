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
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}
