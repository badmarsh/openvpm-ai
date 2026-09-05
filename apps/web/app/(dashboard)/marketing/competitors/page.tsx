"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function CompetitorsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/vet-intel?tab=market");
  }, [router]);

  return (
    <div className="p-12 flex flex-col items-center justify-center space-y-3 text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
      <p className="text-sm">Presmerovávam do sekcie Vet Intelligence...</p>
    </div>
  );
}
