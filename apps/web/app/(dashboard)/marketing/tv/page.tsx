"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/**
 * Legacy route redirect: /marketing/tv -> /waiting-room
 * The TV waiting room display and slide management have been consolidated
 * under the canonical /waiting-room page.
 */
export default function LegacyTvRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/waiting-room");
  }, [router]);

  return (
    <div className="flex h-64 items-center justify-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin text-primary" />
      <span>Presmerovávam do Čakárne...</span>
    </div>
  );
}
