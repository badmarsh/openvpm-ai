import { BrandKitTab } from "@/components/settings/brand-kit-tab";

export default function MarketingBrandKitPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5">
          <svg
            className="h-5 w-5 text-primary"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
          </svg>
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Brand Kit Kliniky</h1>
          <p className="text-sm text-muted-foreground">
            Identita kliniky, tón komunikácie, farebná paleta a sociálne siete.
          </p>
        </div>
      </div>
      <BrandKitTab />
    </div>
  );
}
