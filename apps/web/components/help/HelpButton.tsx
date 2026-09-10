"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { HelpCircle } from "lucide-react";
import { getHelpContent } from "./help-content";

const HelpModal = dynamic(
  () => import("./HelpModal").then((m) => m.HelpModal),
  { ssr: false },
);

export function HelpButton() {
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
        className="fixed bottom-20 right-4 z-40 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface shadow-lg transition-all hover:bg-accent hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:bottom-6 sm:right-6"
      >
        <HelpCircle className="h-5 w-5 text-muted-foreground" />
      </button>

      {open && (
        <HelpModal content={content} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
