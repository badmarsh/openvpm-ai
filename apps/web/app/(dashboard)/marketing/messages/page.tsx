"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function MarketingMessagesRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/inbox?tab=logs");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[300px]">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}
