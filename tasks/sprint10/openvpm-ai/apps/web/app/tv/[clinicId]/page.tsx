"use client";

import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { TvPlayer } from "@/components/marketing/tv-player";
import { Loader2, AlertCircle } from "lucide-react";

export default function WaitingRoomTvPage() {
  const params = useParams();
  const clinicId = (params.clinicId as string) ?? "";

  const { data, isLoading, error } = trpc.extensions.marketing.getPublicTvSlides.useQuery(
    { clinicId },
    { enabled: !!clinicId, refetchInterval: 60_000 }
  );

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-[#090d0b] text-white flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-10 h-10 text-emerald-400 animate-spin" />
        <p className="text-sm font-medium tracking-wide text-white/70">
          Pripravujem informačný panel čakárne...
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="fixed inset-0 bg-[#090d0b] text-white flex flex-col items-center justify-center p-6 text-center space-y-3">
        <AlertCircle className="w-12 h-12 text-rose-400" />
        <h1 className="text-xl font-bold">Klinika nebola nájdená</h1>
        <p className="text-sm text-white/60 max-w-md">
          Skontrolujte prosím zadaný odkaz obrazovky alebo sa prihláste do administrácie kliniky.
        </p>
      </div>
    );
  }

  return (
    <TvPlayer
      slides={data.slides}
      practiceName={data.practice?.name ?? "Veterinárna ambulancia"}
      practicePhone={data.practice?.phone}
    />
  );
}
