"use client";

import Link from "next/link";
import { Clock, Globe, MessageSquare, Star } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";
import {
  KpiGrid,
  KpiCard,
} from "@/components/layout/page-kit";
import { PageSectionHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";

/**
 * Marketing Studio → "Konkurencia & Intel" tab: live reputation summary
 * wired to real reviews/briefs, with a deep link into /vet-intel.
 * No demo clinics, no fake benchmarks — only the practice's own data.
 */
export function CompetitorsSummary() {
  const { t } = useI18n();
  const reviewsQuery = trpc.extensions.marketing.listReviews.useQuery({
    limit: 100,
  });
  const briefsQuery = trpc.extensions.automationContent.listBriefs.useQuery({
    status: "review",
    limit: 50,
  });

  const reviews = reviewsQuery.data ?? [];
  const rated = reviews.filter((r) => typeof r.rating === "number");
  const avg =
    rated.length > 0
      ? rated.reduce((sum, r) => sum + (r.rating ?? 0), 0) / rated.length
      : null;
  const unanswered = reviews.filter((r) => !r.replyText).length;
  const pendingBriefs = briefsQuery.data?.length ?? 0;

  return (
    <div className="space-y-6">
      <PageSectionHeader
        title={t("marketing.competitors.title", "Konkurencia & Intel")}
        subtitle={t(
          "marketing.competitors.summaryDesc",
          "Reputácia kliniky z vlastných dát a prehľad úradných zdrojov.",
        )}
        actions={
          <Link href="/vet-intel">
            <Button size="sm" variant="outline" className="gap-1.5">
              <Globe className="h-3.5 w-3.5" />
              {t("marketing.competitors.openIntel", "Otvoriť Vet Intelligence")}
            </Button>
          </Link>
        }
      />

      <KpiGrid className="sm:grid-cols-3">
        <KpiCard
          label={t("vetIntel.kpi.avgRating", "Priemerné hodnotenie")}
          value={
            avg !== null ? (
              <span className="flex items-center gap-1.5">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                {avg.toFixed(1)}
              </span>
            ) : (
              "—"
            )
          }
          icon={Star}
          tone="primary"
        />
        <KpiCard
          label={t("vetIntel.kpi.unanswered", "Nezodpovedané")}
          value={unanswered}
          icon={MessageSquare}
          tone={unanswered > 0 ? "warning" : undefined}
        />
        <KpiCard
          label={t("vetIntel.kpi.pendingBriefs", "Čaká na schválenie")}
          value={pendingBriefs}
          icon={Clock}
        />
      </KpiGrid>
    </div>
  );
}
