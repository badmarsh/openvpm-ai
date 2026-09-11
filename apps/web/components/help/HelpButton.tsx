"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { HelpCircle } from "lucide-react";
import { getHelpContent } from "./help-content";
import { cn } from "@/lib/utils";

const HelpModal = dynamic(
  () => import("./HelpModal").then((m) => m.HelpModal),
  { ssr: false },
);

interface HelpButtonProps {
  /** className forwarded to the trigger button */
  className?: string;
}

export function HelpButton({ className }: HelpButtonProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const content = getHelpContent(pathname ?? "/");

  // Don't render if no help content for this route
  if (!content) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Otvoriť pomocníka"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-md border border-input bg-background shadow-xs transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 group",
          className,
        )}
      >
        <HelpCircle className="h-4 w-4 text-sky-600 dark:text-sky-400 fill-sky-500/15 group-hover:text-sky-500 dark:group-hover:text-sky-300 transition-colors" />
      </button>

      {open && (
        <HelpModal content={content} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
