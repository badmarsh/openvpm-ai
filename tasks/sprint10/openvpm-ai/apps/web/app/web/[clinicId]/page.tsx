"use client";

import { useParams } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { WebsiteRenderer } from "@/components/marketing/website-renderer";

export default function PublicClinicWebsitePage() {
  const params = useParams();
  const clinicId = (params.clinicId as string) ?? "";

  const { data, isLoading, error } = trpc.extensions.marketing.getPublicWebsiteData.useQuery(
    { clinicId },
    { enabled: !!clinicId, refetchOnWindowFocus: false }
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
        <p className="text-sm font-medium text-muted-foreground">Načítavam stránku kliniky...</p>
      </div>
    );
  }

  if (error || !data || !data.practice) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center gap-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <h1 className="text-2xl font-bold">Klinika nebola nájdená</h1>
        <p className="text-sm text-muted-foreground max-w-md">
          Skontrolujte zadanú webovú adresu alebo kontaktujte veterinárnu ambulanciu priamo telefonicky.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Draft notice banner if not published */}
      {!data.isPublished && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2 text-center text-xs font-semibold text-amber-800 dark:text-amber-300">
          ⚠️ Náhľad kliniky: Táto webstránka je v režime konceptu a zatiaľ nie je verejne indexovaná.
        </div>
      )}

      {/* Generic Brand-Kit Themed Website Renderer */}
      <WebsiteRenderer
        sections={data.sections}
        brandKit={data.brandKit}
        contextData={data}
      />
    </div>
  );
}
