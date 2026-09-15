"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function ContentQueueRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/marketing?tab=queue");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center space-y-2">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
        <p className="text-sm text-muted-foreground">Presmerovávam na Schvaľovací proces…</p>
      </div>
    </div>
  );
}
