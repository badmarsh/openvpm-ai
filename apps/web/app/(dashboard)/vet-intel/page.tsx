"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowUpRight,
  Clock,
  Landmark,
  Loader2,
  MessageSquare,
  Radar,
  Star,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";
import {
  pageShellClass,
  PageHeader,
  DataTableFrame,
  KpiGrid,
  KpiCard,
  underlineTabsListClass,
  underlineTabsTriggerClass,
  tableHeadClass,
  tableCellClass,
  tableRowClass,
  EmptyState,
} from "@/components/layout/page-kit";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateToDisplay } from "@/lib/date-display";
import { cn } from "@/lib/utils";

type VetIntelTab = "overview" | "reputation" | "official";

const OFFICIAL_PORTALS = [
  {
    key: "svps",
    url: "https://www.svps.sk/",
    nameKey: "vetIntel.official.svpsName",
    nameFallback: "ŠVPS SR",
    descKey: "vetIntel.official.svpsDesc",
    descFallback:
      "Štátna veterinárna a potravinová správa — vestníky, nákazová situácia, registrácie.",
  },
  {
    key: "kvl",
    url: "https://www.kvlsr.sk/",
    nameKey: "vetIntel.official.kvlName",
    nameFallback: "KVL SR",
    descKey: "vetIntel.official.kvlDesc",
    descFallback:
      "Komora veterinárnych lekárov SR — stavovské predpisy, register SVL, CRSZ.",
  },
  {
    key: "slovlex",
    url: "https://www.slov-lex.sk/",
    nameKey: "vetIntel.official.slovlexName",
    nameFallback: "Slov-Lex",
    descKey: "vetIntel.official.slovlexDesc",
    descFallback: "Zbierka zákonov SR — úplné znenia právnych predpisov.",
  },
] as const;

function platformLabel(
  platform: string | null,
  t: (key: string, fallback: string) => string,
): string {
  if (platform === "google") return "Google";
  if (platform === "facebook") return "Facebook";
  if (platform === "internal")
    return t("vetIntel.table.platformInternal", "Interná");
  return platform || "—";
}

function SentimentBadge({
  sentiment,
}: {
  sentiment: string | null;
}) {
  const { t } = useI18n();
  const key = sentiment ?? "unknown";
  const label =
    key === "positive"
      ? t("vetIntel.sentiment.positive", "Pozitívne")
      : key === "neutral"
        ? t("vetIntel.sentiment.neutral", "Neutrálne")
        : key === "negative"
          ? t("vetIntel.sentiment.negative", "Negatívne")
          : key === "mixed"
            ? t("vetIntel.sentiment.mixed", "Zmiešané")
            : t("vetIntel.sentiment.unknown", "Nezatriedené");
  return (
    <Badge
      variant={
        key === "positive"
          ? "default"
          : key === "negative"
            ? "destructive"
            : key === "neutral"
              ? "secondary"
              : "outline"
      }
      className={cn(
        "text-[11px]",
        key === "positive" && "bg-emerald-600 hover:bg-emerald-600",
        key === "mixed" &&
          "border-amber-300 text-amber-700 dark:text-amber-300",
      )}
    >
      {label}
    </Badge>
  );
}

function VetIntelContent() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const initialTab: VetIntelTab =
    tabParam === "reputation" || tabParam === "official"
      ? tabParam
      : "overview";
  const [activeTab, setActiveTab] = useState<VetIntelTab>(initialTab);

  const reviewsQuery = trpc.extensions.marketing.listReviews.useQuery({
    limit: 100,
  });
  const briefsQuery = trpc.extensions.automationContent.listBriefs.useQuery({
    status: "review",
    limit: 50,
  });
  const channelsQuery = trpc.extensions.automationChannels.list.useQuery();
  const journeysQuery = trpc.extensions.automationJourneys.list.useQuery();

  const reviews = useMemo(() => reviewsQuery.data ?? [], [reviewsQuery.data]);

  const stats = useMemo(() => {
    const rated = reviews.filter(
      (r) => typeof r.rating === "number" && r.rating !== null,
    );
    const avg =
      rated.length > 0
        ? rated.reduce((sum, r) => sum + (r.rating ?? 0), 0) / rated.length
        : null;
    const unanswered = reviews.filter((r) => !r.replyText);
    const sentimentCounts: Record<string, number> = {};
    const platformCounts: Record<string, number> = {};
    for (const r of reviews) {
      const s = r.sentimentLabel ?? "unknown";
      sentimentCounts[s] = (sentimentCounts[s] ?? 0) + 1;
      const p = r.platform ?? "unknown";
      platformCounts[p] = (platformCounts[p] ?? 0) + 1;
    }
    return { avg, ratedCount: rated.length, unanswered, sentimentCounts, platformCounts };
  }, [reviews]);

  const recentReviews = useMemo(() => reviews.slice(0, 10), [reviews]);
  const pendingBriefs = briefsQuery.data?.length ?? 0;
  const connectedChannels = useMemo(
    () => (channelsQuery.data ?? []).filter((c) => c.status === "connected"),
    [channelsQuery.data],
  );
  const activeJourneys = useMemo(
    () => (journeysQuery.data ?? []).filter((j) => j.isActive).length,
    [journeysQuery.data],
  );

  return (
    <div className={pageShellClass}>
      <PageHeader
        icon={Radar}
        title={t("vetIntel.pageTitle", "Vet Intelligence")}
        subtitle={t(
          "vetIntel.hubSubtitle",
          "Centrálny prehľad reputácie, obsahu a úradných zdrojov kliniky.",
        )}
        actions={
          <Link href="/marketing/reviews">
            <Button size="sm" variant="outline" className="gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" />
              {t("vetIntel.overview.openReviews", "Otvoriť recenzie")}
            </Button>
          </Link>
        }
      />

      <KpiGrid>
        <KpiCard
          label={t("vetIntel.kpi.avgRating", "Priemerné hodnotenie")}
          value={
            stats.avg !== null ? (
              <span className="flex items-center gap-1.5">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                {stats.avg.toFixed(1)}
              </span>
            ) : (
              "—"
            )
          }
          icon={Star}
          tone="primary"
        />
        <KpiCard
          label={t("vetIntel.kpi.totalReviews", "Recenzie celkom")}
          value={reviews.length}
          icon={MessageSquare}
        />
        <KpiCard
          label={t("vetIntel.kpi.unanswered", "Nezodpovedané")}
          value={stats.unanswered.length}
          icon={AlertCircle}
          tone={stats.unanswered.length > 0 ? "warning" : undefined}
        />
        <KpiCard
          label={t("vetIntel.kpi.pendingBriefs", "Čaká na schválenie")}
          value={pendingBriefs}
          icon={Clock}
        />
      </KpiGrid>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as VetIntelTab)}
        className="w-full space-y-6"
      >
        <TabsList className={underlineTabsListClass}>
          <TabsTrigger value="overview" className={underlineTabsTriggerClass}>
            <Radar className="h-4 w-4" />
            <span>{t("vetIntel.tabs.overview", "Prehľad")}</span>
          </TabsTrigger>
          <TabsTrigger value="reputation" className={underlineTabsTriggerClass}>
            <Star className="h-4 w-4" />
            <span>{t("vetIntel.tabs.reputation", "Reputácia")}</span>
          </TabsTrigger>
          <TabsTrigger value="official" className={underlineTabsTriggerClass}>
            <Landmark className="h-4 w-4" />
            <span>{t("vetIntel.tabs.official", "Úradné zdroje")}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-0 space-y-6">
          <DataTableFrame>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className={tableHeadClass}>
                    {t("vetIntel.table.reviewer", "Autor")}
                  </th>
                  <th className={tableHeadClass}>
                    {t("vetIntel.table.platform", "Platforma")}
                  </th>
                  <th className={tableHeadClass}>
                    {t("vetIntel.table.rating", "Hodnotenie")}
                  </th>
                  <th className={tableHeadClass}>
                    {t("vetIntel.table.sentiment", "Sentiment")}
                  </th>
                  <th className={tableHeadClass}>
                    {t("vetIntel.table.received", "Prijatá")}
                  </th>
                  <th className={tableHeadClass}>
                    {t("vetIntel.table.reply", "Odpoveď")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {reviewsQuery.isLoading ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-12 text-center text-muted-foreground"
                    >
                      <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-primary" />
                      <span>
                        {t("vetIntel.loading", "Načítavam Vet Intelligence...")}
                      </span>
                    </td>
                  </tr>
                ) : recentReviews.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8">
                      <EmptyState
                        icon={MessageSquare}
                        title={t(
                          "vetIntel.overview.emptyTitle",
                          "Zatiaľ žiadne recenzie",
                        )}
                        description={t(
                          "vetIntel.overview.emptyDesc",
                          "Recenzie z Google a Facebooku sa tu zobrazia po prvom importe alebo synchronizácii.",
                        )}
                      />
                    </td>
                  </tr>
                ) : (
                  recentReviews.map((review) => (
                    <tr key={review.id} className={tableRowClass}>
                      <td className={tableCellClass}>
                        <span className="font-semibold text-foreground">
                          {review.reviewerName ||
                            t("vetIntel.table.anonymous", "Anonym")}
                        </span>
                      </td>
                      <td className={tableCellClass}>
                        <Badge variant="outline" className="text-[11px]">
                          {platformLabel(review.platform, t)}
                        </Badge>
                      </td>
                      <td className={tableCellClass}>
                        <span className="font-mono tabular-nums">
                          {typeof review.rating === "number"
                            ? `${review.rating} / 5`
                            : "—"}
                        </span>
                      </td>
                      <td className={tableCellClass}>
                        <SentimentBadge sentiment={review.sentimentLabel} />
                      </td>
                      <td className={tableCellClass}>
                        <span className="font-mono tabular-nums text-muted-foreground">
                          {formatDateToDisplay(review.receivedAt)}
                        </span>
                      </td>
                      <td className={tableCellClass}>
                        {review.replyText ? (
                          <Badge
                            variant="secondary"
                            className="text-[11px] text-emerald-700 dark:text-emerald-300"
                          >
                            {t("vetIntel.overview.replyDone", "Zodpovedané")}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[11px]">
                            {t("vetIntel.overview.replyMissing", "Bez odpovede")}
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </DataTableFrame>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-border bg-card p-4 shadow-xs">
              <p className="text-xs font-semibold">
                {t("vetIntel.ops.briefs", "Návrhy čakajúce na lekára")}
              </p>
              <p className="mt-1 text-xl font-semibold tabular-nums">
                {pendingBriefs}
              </p>
              <Link
                href="/marketing?tab=queue"
                className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                {t("vetIntel.ops.openQueue", "Otvoriť schvaľovanie")}
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="rounded-lg border border-border bg-card p-4 shadow-xs">
              <p className="text-xs font-semibold">
                {t("vetIntel.ops.channels", "Pripojené kanály")}
              </p>
              <p className="mt-1 text-xl font-semibold tabular-nums">
                {connectedChannels.length}
              </p>
              <Link
                href="/marketing/automations?tab=channels"
                className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                {t("vetIntel.ops.manageChannels", "Spravovať kanály")}
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="rounded-lg border border-border bg-card p-4 shadow-xs">
              <p className="text-xs font-semibold">
                {t("vetIntel.ops.journeys", "Aktívne cesty")}
              </p>
              <p className="mt-1 text-xl font-semibold tabular-nums">
                {activeJourneys}
              </p>
              <Link
                href="/automations"
                className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                {t("vetIntel.ops.openAutomations", "Otvoriť automatizácie")}
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="reputation" className="mt-0 space-y-6">
          <div className="rounded-lg border border-border bg-card p-4 shadow-xs">
            <p className="text-xs font-semibold">
              {t("vetIntel.reputation.title", "Sentiment podľa platforiem")}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {t(
                "vetIntel.reputation.desc",
                "Rozdelenie posledných 100 recenzií podľa sentimentu a zdroja.",
              )}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(stats.sentimentCounts).map(([key, count]) => (
                <span
                  key={key}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2 py-1 text-xs"
                >
                  <SentimentBadge sentiment={key} />
                  <span className="font-mono tabular-nums font-semibold">
                    {count}
                  </span>
                </span>
              ))}
              {Object.keys(stats.sentimentCounts).length === 0 && (
                <span className="text-xs text-muted-foreground">
                  {t("vetIntel.overview.emptyTitle", "Zatiaľ žiadne recenzie")}
                </span>
              )}
            </div>
          </div>

          <DataTableFrame>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className={tableHeadClass}>
                    {t("vetIntel.table.reviewer", "Autor")}
                  </th>
                  <th className={tableHeadClass}>
                    {t("vetIntel.table.platform", "Platforma")}
                  </th>
                  <th className={tableHeadClass}>
                    {t("vetIntel.table.rating", "Hodnotenie")}
                  </th>
                  <th className={tableHeadClass}>
                    {t("vetIntel.table.received", "Prijatá")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {stats.unanswered.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8">
                      <EmptyState
                        icon={MessageSquare}
                        title={t(
                          "vetIntel.reputation.empty",
                          "Všetky recenzie majú odpoveď.",
                        )}
                      />
                    </td>
                  </tr>
                ) : (
                  stats.unanswered.slice(0, 20).map((review) => (
                    <tr key={review.id} className={tableRowClass}>
                      <td className={tableCellClass}>
                        <span className="font-semibold text-foreground">
                          {review.reviewerName ||
                            t("vetIntel.table.anonymous", "Anonym")}
                        </span>
                      </td>
                      <td className={tableCellClass}>
                        <Badge variant="outline" className="text-[11px]">
                          {platformLabel(review.platform, t)}
                        </Badge>
                      </td>
                      <td className={tableCellClass}>
                        <span className="font-mono tabular-nums">
                          {typeof review.rating === "number"
                            ? `${review.rating} / 5`
                            : "—"}
                        </span>
                      </td>
                      <td className={tableCellClass}>
                        <span className="font-mono tabular-nums text-muted-foreground">
                          {formatDateToDisplay(review.receivedAt)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </DataTableFrame>
        </TabsContent>

        <TabsContent value="official" className="mt-0 space-y-6">
          <div className="rounded-lg border border-border bg-card p-4 shadow-xs">
            <p className="text-xs font-semibold">
              {t("vetIntel.official.title", "Úradné zdroje a registre")}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {t(
                "vetIntel.official.desc",
                "Priame odkazy na štátne a stavovské portály. Automatické sledovanie vestníkov sa pripravuje — zatiaľ otvárajte zdroje ručne.",
              )}
            </p>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
              {OFFICIAL_PORTALS.map((portal) => (
                <a
                  key={portal.key}
                  href={portal.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group rounded-lg border border-border bg-background p-3 transition-colors hover:border-primary/40"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold">
                      {t(portal.nameKey, portal.nameFallback)}
                    </span>
                    <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground transition-colors group-hover:text-primary" />
                  </span>
                  <span className="mt-1 block text-[11px] leading-relaxed text-muted-foreground">
                    {t(portal.descKey, portal.descFallback)}
                  </span>
                </a>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4 shadow-xs">
            <p className="text-xs font-semibold">
              {t("vetIntel.official.internalTitle", "Interné registre")}
            </p>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background p-3">
                <div>
                  <p className="text-xs font-semibold">
                    {t("vetIntel.official.statutory", "Zákonné registre")}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {t(
                      "vetIntel.official.statutoryDesc",
                      "Besnota, ošetrenia, ochranné lehoty, omamné látky a protokoly.",
                    )}
                  </p>
                </div>
                <Link href="/statutory">
                  <Button size="sm" variant="outline">
                    {t("vetIntel.official.openInternal", "Otvoriť")}
                  </Button>
                </Link>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background p-3">
                <div>
                  <p className="text-xs font-semibold">
                    {t("vetIntel.official.kvepis", "KVEPIS podania")}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {t(
                      "vetIntel.official.kvepisDesc",
                      "Hlásenia a podania na ŠVPS cez KVEPIS.",
                    )}
                  </p>
                </div>
                <Link href="/statutory/kvepis">
                  <Button size="sm" variant="outline">
                    {t("vetIntel.official.openInternal", "Otvoriť")}
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function VetIntelPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[400px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <VetIntelContent />
    </Suspense>
  );
}
