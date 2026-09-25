"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  AlertTriangle,
  CheckCircle2,
  Gift,
  Heart,
  Loader2,
  SearchX,
  Settings2,
  Users,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { formatDateYmdToDisplay } from "@/lib/date-display";
import { formatDateTime, localeTagForLanguage } from "@/lib/locale/format";
import { useCurrencyFormatter } from "@/lib/locale/useCurrency";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DataTableFrame,
  EmptyState,
  KpiCard,
  KpiGrid,
  PageHeader,
  PageToolbar,
  SearchField,
  TableSkeleton,
  filterControlClass,
  pageShellClass,
  tableCellClass,
  tableHeadClass,
  tableRowClass,
} from "@/components/layout/page-kit";

type StatusFilter = "all" | "active" | "cancelled";
type Translate = ReturnType<typeof useI18n>["t"];

// Mirror the redeemWellnessBenefit input limits so users are stopped in the
// form instead of receiving a raw validation error from the server.
const BENEFIT_KEY_MAX_LENGTH = 100;
const BENEFIT_NOTES_MAX_LENGTH = 500;
const ENROLLMENT_SEARCH_MAX_LENGTH = 100;

/** Case- and diacritics-insensitive matching ("macka" finds "Mačka"). */
function foldForSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase();
}

/** Rounded share of `part` in `whole`; null when there is nothing to divide by. */
function shareOf(part: number, whole: number): number | null {
  if (!Number.isFinite(part) || !Number.isFinite(whole) || whole <= 0) {
    return null;
  }
  return Math.round((part / whole) * 100);
}

/** Slovak plural forms: 1 zápis · 2–4 zápisy · 0 / 5+ zápisov. */
function enrollmentCountLabel(count: number, t: Translate): string {
  if (count === 1) {
    return t("marketing.wellness.toolbar.countOne", "{count} zápis", { count });
  }
  if ([2, 3, 4].includes(count)) {
    return t("marketing.wellness.toolbar.countFew", "{count} zápisy", { count });
  }
  return t("marketing.wellness.toolbar.countOther", "{count} zápisov", { count });
}

function ownerName(firstName?: string | null, lastName?: string | null): string {
  return [firstName, lastName].filter(Boolean).join(" ");
}

/** Query failure: never let an error masquerade as an empty list. */
function QueryErrorState({
  title,
  onRetry,
}: {
  title: string;
  onRetry: () => void;
}) {
  const { t } = useI18n();
  return (
    <div role="alert">
      <EmptyState
        icon={AlertTriangle}
        title={title}
        className="border-destructive/30 bg-destructive/5 p-6"
        action={{ label: t("marketing.wellness.retry", "Skúsiť znova"), onClick: onRetry }}
      />
    </div>
  );
}

export default function WellnessPage() {
  const { t, locale } = useI18n();
  const formatAmount = useCurrencyFormatter();
  const { data: session } = useSession();
  const utils = trpc.useUtils();

  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState<string | null>(null);
  const [benefitKey, setBenefitKey] = useState("");
  const [benefitNotes, setBenefitNotes] = useState("");
  const [benefitError, setBenefitError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const plansQuery = trpc.wellness.listPlans.useQuery();
  const enrollmentsQuery = trpc.wellness.listEnrollments.useQuery({});

  const plans = plansQuery.data ?? [];
  const enrollments = useMemo(
    () => enrollmentsQuery.data ?? [],
    [enrollmentsQuery.data]
  );

  // Only an enrollment that is still listed and active can be redeemed
  // against; a refetch that cancels or removes it drops the selection.
  const selectedEnrollment =
    enrollments.find(
      (en) => en.enrollmentId === selectedEnrollmentId && en.status !== "cancelled"
    ) ?? null;
  const activeEnrollmentId = selectedEnrollment?.enrollmentId ?? null;

  const redemptionsQuery = trpc.extensions.marketing.listWellnessRedemptions.useQuery(
    { enrollmentId: activeEnrollmentId! },
    { enabled: !!activeEnrollmentId }
  );

  const redeemMutation = trpc.extensions.marketing.redeemWellnessBenefit.useMutation({
    onSuccess: (_redemption, variables) => {
      toast.success(
        t("marketing.wellness.toast.redeemSuccess", "Benefit z balíčka bol úspešne uplatnený.")
      );
      setBenefitKey("");
      setBenefitNotes("");
      // Refresh the enrollment that was actually redeemed against, even if the
      // user selected another row while the request was in flight.
      void utils.extensions.marketing.listWellnessRedemptions.invalidate({
        enrollmentId: variables.enrollmentId,
      });
    },
    onError: (err) => {
      if (err.data?.code === "PRECONDITION_FAILED") {
        // Sympathy Gate: enforced server-side; only the message is localized here.
        toast.error(
          t(
            "marketing.wellness.toast.deceasedBlocked",
            "Benefit nie je možné uplatniť – pacient je evidovaný ako zosnulý."
          )
        );
        return;
      }
      if (err.data?.code === "FORBIDDEN") {
        toast.error(
          t("marketing.wellness.toast.forbidden", "Na uplatnenie benefitu nemáte oprávnenie.")
        );
        return;
      }
      toast.error(t("marketing.wellness.toast.redeemError", "Nepodarilo sa uplatniť benefit."), {
        description: err.message || undefined,
      });
    },
  });

  const selectEnrollment = (enrollmentId: string) => {
    if (enrollmentId === selectedEnrollmentId) return;
    setSelectedEnrollmentId(enrollmentId);
    // Never carry a half-typed benefit over to another patient.
    setBenefitKey("");
    setBenefitNotes("");
    setBenefitError(null);
  };

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
  };

  const handleRedeem = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedBenefitKey = benefitKey.trim();
    if (!selectedEnrollment || !trimmedBenefitKey) {
      const message = t(
        "marketing.wellness.validation.benefitRequired",
        "Zadajte názov čerpaného benefitu."
      );
      setBenefitError(message);
      toast.error(message);
      return;
    }

    setBenefitError(null);
    redeemMutation.mutate({
      enrollmentId: selectedEnrollment.enrollmentId,
      benefitKey: trimmedBenefitKey,
      notes: benefitNotes.trim() || undefined,
    });
  };

  const filteredEnrollments = useMemo(() => {
    const needle = foldForSearch(search.trim());
    return enrollments.filter((en) => {
      if (statusFilter !== "all" && en.status !== statusFilter) return false;
      if (!needle) return true;
      return foldForSearch(
        [en.patientName, en.planName, en.clientFirstName, en.clientLastName]
          .filter(Boolean)
          .join(" ")
      ).includes(needle);
    });
  }, [enrollments, search, statusFilter]);

  const localeTag = localeTagForLanguage(locale);
  const formatCount = (value: number) =>
    new Intl.NumberFormat(localeTag, { maximumFractionDigits: 0 }).format(value);
  const formatPercent = (value: number) =>
    new Intl.NumberFormat(localeTag, {
      style: "percent",
      maximumFractionDigits: 0,
    }).format(value / 100);

  const activeCount = enrollments.filter((en) => en.status === "active").length;
  const cancelledCount = enrollments.filter((en) => en.status === "cancelled").length;
  // 0 enrolled patients → no share at all (never "NaN %").
  const activeShare = shareOf(activeCount, enrollments.length);
  const activePlanCount = plans.filter((plan) => plan.active).length;
  const filtersActive = statusFilter !== "all" || search.trim() !== "";
  const isAdmin = session?.user?.role === "admin";
  const noPatientLabel = t("marketing.wellness.enrollments.noPatient", "Bez priradeného pacienta");

  const kpiValue = (count: number, note?: React.ReactNode) =>
    enrollmentsQuery.isError ? (
      "—"
    ) : enrollmentsQuery.isLoading ? (
      <span
        className="inline-block h-6 w-10 animate-pulse rounded bg-muted/60"
        aria-hidden="true"
      />
    ) : (
      <>
        {formatCount(count)}
        {note ? (
          <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
            {note}
          </span>
        ) : null}
      </>
    );

  return (
    <div className={pageShellClass}>
      <PageHeader
        icon={Heart}
        title={t("marketing.wellness.title", "Wellness plány & programy")}
        subtitle={t(
          "marketing.wellness.subtitle",
          "Preventívne programy kliniky a evidencia čerpania benefitov počas návštevy pacienta. Rešpektuje Sympathy Flow (blokované pre zosnulých pacientov)."
        )}
      />

      {/* Plan catalogue */}
      <section className="space-y-3" aria-labelledby="wellness-plans-heading">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="wellness-plans-heading" className="text-sm font-semibold text-foreground">
            {t("marketing.wellness.plans.heading", "Aktívne preventívne balíčky kliniky")}
          </h2>
          {plans.length > 0 ? (
            <span className="text-xs text-muted-foreground">
              {t("marketing.wellness.plans.activeCount", "{active} z {total} aktívnych", {
                active: activePlanCount,
                total: plans.length,
              })}
            </span>
          ) : null}
        </div>

        {plansQuery.isError ? (
          <QueryErrorState
            title={t("marketing.wellness.plans.loadError", "Wellness plány sa nepodarilo načítať.")}
            onRetry={() => plansQuery.refetch()}
          />
        ) : plansQuery.isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-lg bg-muted/60" />
            ))}
          </div>
        ) : plans.length === 0 ? (
          <EmptyState
            icon={Heart}
            title={t("marketing.wellness.plans.emptyTitle", "Zatiaľ žiadne wellness plány")}
            description={t(
              "marketing.wellness.plans.emptyDesc",
              "Zatiaľ nie sú vytvorené žiadne wellness plány v module nastavení."
            )}
            action={
              isAdmin ? (
                <Button asChild size="sm" variant="outline" className="gap-1.5 text-xs">
                  <Link href="/settings?tab=wellness">
                    <Settings2 className="h-3.5 w-3.5" aria-hidden="true" />
                    {t("marketing.wellness.plans.manage", "Spravovať plány")}
                  </Link>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan) => (
              <article
                key={plan.id}
                className="flex min-w-0 flex-col gap-2 rounded-lg border border-border bg-card p-4 shadow-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3
                    className="min-w-0 truncate text-sm font-semibold text-foreground"
                    title={plan.name}
                  >
                    {plan.name}
                  </h3>
                  <Badge
                    variant={plan.active ? "success" : "secondary"}
                    className="shrink-0 text-[10px]"
                  >
                    {plan.active
                      ? t("marketing.wellness.plans.active", "Aktívny")
                      : t("marketing.wellness.plans.inactive", "Neaktívny")}
                  </Badge>
                </div>
                <p className="line-clamp-2 text-xs text-muted-foreground">
                  {plan.description ||
                    t(
                      "marketing.wellness.plans.defaultDescription",
                      "Komplexný ročný plán preventívnej starostlivosti."
                    )}
                </p>
                <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-2 text-xs">
                  <span className="text-muted-foreground">
                    {plan.billingInterval === "monthly"
                      ? t("marketing.wellness.plans.monthly", "Mesačne")
                      : t("marketing.wellness.plans.annual", "Ročne")}
                  </span>
                  <span className="font-semibold tabular-nums text-foreground">
                    {formatAmount(plan.price)}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <PageToolbar>
        <label htmlFor="wellness-enrollment-search" className="sr-only">
          {t("marketing.wellness.toolbar.searchLabel", "Hľadať vo wellness zápisoch")}
        </label>
        <SearchField
          id="wellness-enrollment-search"
          value={search}
          maxLength={ENROLLMENT_SEARCH_MAX_LENGTH}
          placeholder={t(
            "marketing.wellness.toolbar.searchPlaceholder",
            "Hľadať pacienta, majiteľa alebo balíček…"
          )}
          onChange={setSearch}
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className={filterControlClass}
          aria-label={t("marketing.wellness.toolbar.statusLabel", "Filtrovať podľa stavu")}
        >
          <option value="all">
            {t("marketing.wellness.toolbar.statusAll", "Všetky stavy")}
          </option>
          <option value="active">
            {t("marketing.wellness.toolbar.statusActive", "Aktívne")}
          </option>
          <option value="cancelled">
            {t("marketing.wellness.toolbar.statusCancelled", "Ukončené")}
          </option>
        </select>
        {filtersActive ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 text-xs"
            onClick={clearFilters}
          >
            {t("marketing.wellness.toolbar.clearFilters", "Zrušiť filtre")}
          </Button>
        ) : null}
        <p className="text-xs text-muted-foreground sm:ml-auto" aria-live="polite">
          {enrollmentCountLabel(filteredEnrollments.length, t)}
        </p>
      </PageToolbar>

      <KpiGrid className="sm:grid-cols-3">
        <KpiCard
          label={t("marketing.wellness.kpi.all", "Všetky zápisy")}
          icon={Users}
          value={kpiValue(enrollments.length)}
          active={statusFilter === "all"}
          onClick={() => setStatusFilter("all")}
        />
        <KpiCard
          label={t("marketing.wellness.kpi.active", "Aktívne zápisy")}
          icon={CheckCircle2}
          tone="primary"
          value={kpiValue(
            activeCount,
            activeShare !== null
              ? t("marketing.wellness.kpi.activeShare", "{percent} všetkých zápisov", {
                  percent: formatPercent(activeShare),
                })
              : null
          )}
          active={statusFilter === "active"}
          onClick={() => setStatusFilter("active")}
        />
        <KpiCard
          label={t("marketing.wellness.kpi.cancelled", "Ukončené zápisy")}
          icon={XCircle}
          value={kpiValue(cancelledCount)}
          active={statusFilter === "cancelled"}
          onClick={() => setStatusFilter("cancelled")}
        />
      </KpiGrid>

      {/* Enrollments & redemption split view */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <section
          className="min-w-0 space-y-3 lg:col-span-3"
          aria-labelledby="wellness-enrollments-heading"
        >
          <h2 id="wellness-enrollments-heading" className="text-sm font-semibold text-foreground">
            {t("marketing.wellness.enrollments.heading", "Zapísaní pacienti vo wellness programe")}
          </h2>

          {enrollmentsQuery.isError ? (
            <QueryErrorState
              title={t(
                "marketing.wellness.enrollments.loadError",
                "Wellness zápisy sa nepodarilo načítať."
              )}
              onRetry={() => enrollmentsQuery.refetch()}
            />
          ) : enrollmentsQuery.isLoading ? (
            <div
              role="status"
              aria-label={t("marketing.wellness.enrollments.loading", "Načítavam wellness zápisy...")}
            >
              <TableSkeleton rows={5} cols={4} />
            </div>
          ) : enrollments.length === 0 ? (
            <EmptyState
              icon={Users}
              title={t(
                "marketing.wellness.enrollments.emptyTitle",
                "Žiadny pacient zatiaľ nie je zapísaný vo wellness programe."
              )}
            />
          ) : filteredEnrollments.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title={t("marketing.wellness.enrollments.emptyFilteredTitle", "Filtrom nevyhovuje žiadny zápis")}
              description={t(
                "marketing.wellness.enrollments.emptyFilteredDesc",
                "Upravte vyhľadávanie alebo filter stavu."
              )}
              action={{
                label: t("marketing.wellness.toolbar.clearFilters", "Zrušiť filtre"),
                onClick: clearFilters,
              }}
            />
          ) : (
            <DataTableFrame>
              <table aria-labelledby="wellness-enrollments-heading" className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className={tableHeadClass}>
                      {t("marketing.wellness.enrollments.colPatient", "Pacient")}
                    </th>
                    <th className={tableHeadClass}>
                      {t("marketing.wellness.enrollments.colPlan", "Balíček")}
                    </th>
                    <th className={tableHeadClass}>
                      {t("marketing.wellness.enrollments.colStatus", "Stav")}
                    </th>
                    <th className={cn(tableHeadClass, "text-right")}>
                      <span className="sr-only">
                        {t("marketing.wellness.enrollments.colAction", "Akcia")}
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEnrollments.map((en) => {
                    const isSelected = activeEnrollmentId === en.enrollmentId;
                    const isCancelled = en.status === "cancelled";
                    const owner = ownerName(en.clientFirstName, en.clientLastName);

                    return (
                      <tr
                        key={en.enrollmentId}
                        onClick={isCancelled ? undefined : () => selectEnrollment(en.enrollmentId)}
                        className={cn(
                          tableRowClass,
                          isCancelled ? "bg-muted/20 opacity-60" : "cursor-pointer",
                          isSelected && "bg-primary/5 hover:bg-primary/10"
                        )}
                      >
                        <td className={tableCellClass}>
                          <div className="font-semibold text-foreground">
                            {en.patientName ?? noPatientLabel}
                          </div>
                          {owner ? (
                            <div className="text-muted-foreground">
                              {t("marketing.wellness.enrollments.owner", "Majiteľ: {name}", {
                                name: owner,
                              })}
                            </div>
                          ) : null}
                        </td>
                        <td className={tableCellClass}>
                          <div className="font-medium text-foreground">{en.planName}</div>
                          <div className="text-muted-foreground">
                            {t("marketing.wellness.enrollments.validFrom", "Platnosť od {date}", {
                              date: formatDateYmdToDisplay(en.startDate),
                            })}
                          </div>
                        </td>
                        <td className={tableCellClass}>
                          <Badge
                            variant={isCancelled ? "secondary" : "success"}
                            className="whitespace-nowrap text-[10px]"
                          >
                            {isCancelled
                              ? t("marketing.wellness.enrollments.statusCancelled", "Ukončené")
                              : t("marketing.wellness.enrollments.statusActive", "Aktívny zápis")}
                          </Badge>
                        </td>
                        <td className={cn(tableCellClass, "text-right")}>
                          {!isCancelled ? (
                            <Button
                              type="button"
                              size="sm"
                              variant={isSelected ? "default" : "outline"}
                              aria-pressed={isSelected}
                              className="h-7 gap-1 whitespace-nowrap px-2 text-xs"
                              onClick={(event) => {
                                event.stopPropagation();
                                selectEnrollment(en.enrollmentId);
                              }}
                            >
                              <Gift className="h-3.5 w-3.5" aria-hidden="true" />
                              {isSelected
                                ? t("marketing.wellness.enrollments.selected", "Vybrané")
                                : t("marketing.wellness.enrollments.redeem", "Čerpať benefit")}
                            </Button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </DataTableFrame>
          )}
        </section>

        <section
          className="min-w-0 space-y-3 lg:col-span-2"
          aria-labelledby="wellness-redemption-heading"
        >
          <h2 id="wellness-redemption-heading" className="text-sm font-semibold text-foreground">
            {t("marketing.wellness.redemption.heading", "Čerpanie benefitu")}
          </h2>

          {selectedEnrollment ? (
            <>
              <div className="space-y-4 rounded-lg border border-border bg-card p-4 shadow-xs">
                {/* Name the enrollment being redeemed against so staff never redeem for the wrong patient. */}
                <div className="rounded-md bg-muted/40 px-3 py-2 text-xs">
                  <p className="font-semibold text-foreground">
                    {selectedEnrollment.patientName ?? noPatientLabel}
                  </p>
                  <p className="text-muted-foreground">
                    {[
                      selectedEnrollment.planName,
                      ownerName(selectedEnrollment.clientFirstName, selectedEnrollment.clientLastName),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>

                <form onSubmit={handleRedeem} noValidate className="space-y-3">
                  <div className="space-y-1">
                    <label
                      htmlFor="wellness-benefit-key"
                      className="text-xs font-semibold text-foreground"
                    >
                      {t("marketing.wellness.redemption.benefitLabel", "Názov benefitu *")}
                    </label>
                    <Input
                      id="wellness-benefit-key"
                      value={benefitKey}
                      maxLength={BENEFIT_KEY_MAX_LENGTH}
                      aria-required="true"
                      aria-invalid={benefitError ? true : undefined}
                      aria-describedby={benefitError ? "wellness-benefit-key-error" : undefined}
                      onChange={(e) => {
                        setBenefitKey(e.target.value);
                        if (benefitError) setBenefitError(null);
                      }}
                      placeholder={t(
                        "marketing.wellness.redemption.benefitPlaceholder",
                        "Napr. Bezplatná preventívna prehliadka, Strihanie pazúrikov, Zľava 10% na čistenie zubov"
                      )}
                      className="h-9 text-xs"
                    />
                    {benefitError ? (
                      <p id="wellness-benefit-key-error" className="text-xs text-destructive">
                        {benefitError}
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-1">
                    <label
                      htmlFor="wellness-benefit-notes"
                      className="text-xs font-semibold text-foreground"
                    >
                      {t("marketing.wellness.redemption.notesLabel", "Poznámka lekára / recepcie")}
                    </label>
                    <Input
                      id="wellness-benefit-notes"
                      value={benefitNotes}
                      maxLength={BENEFIT_NOTES_MAX_LENGTH}
                      onChange={(e) => setBenefitNotes(e.target.value)}
                      placeholder={t(
                        "marketing.wellness.redemption.notesPlaceholder",
                        "Napr. vykonané v rámci vyšetrenia"
                      )}
                      className="h-9 text-xs"
                    />
                  </div>

                  <Button
                    type="submit"
                    size="sm"
                    disabled={redeemMutation.isPending}
                    className="w-full gap-1.5 text-xs"
                  >
                    {redeemMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    ) : null}
                    {t("marketing.wellness.redemption.submit", "Potvrdiť uplatnenie benefitu")}
                  </Button>
                </form>
              </div>

              <div className="space-y-2">
                <h3
                  id="wellness-history-heading"
                  className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  {t("marketing.wellness.redemption.historyHeading", "História čerpania pacienta")}
                </h3>

                {redemptionsQuery.isError ? (
                  <QueryErrorState
                    title={t(
                      "marketing.wellness.redemption.historyLoadError",
                      "Históriu čerpania sa nepodarilo načítať."
                    )}
                    onRetry={() => redemptionsQuery.refetch()}
                  />
                ) : redemptionsQuery.isLoading ? (
                  <div
                    role="status"
                    aria-label={t("marketing.wellness.redemption.historyLoading", "Načítavam históriu...")}
                  >
                    <TableSkeleton rows={3} cols={2} />
                  </div>
                ) : !redemptionsQuery.data || redemptionsQuery.data.length === 0 ? (
                  <EmptyState
                    icon={Gift}
                    title={t(
                      "marketing.wellness.redemption.historyEmpty",
                      "Zatiaľ nebol uplatnený žiadny benefit."
                    )}
                    className="p-6"
                  />
                ) : (
                  <DataTableFrame>
                    <table aria-labelledby="wellness-history-heading" className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border bg-muted/50">
                          <th className={tableHeadClass}>
                            {t("marketing.wellness.redemption.colBenefit", "Benefit")}
                          </th>
                          <th className={cn(tableHeadClass, "text-right")}>
                            {t("marketing.wellness.redemption.colRedeemedAt", "Uplatnené")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {redemptionsQuery.data.map((redemption) => (
                          <tr key={redemption.id} className={tableRowClass}>
                            <td className={tableCellClass}>
                              <div className="break-words font-semibold text-foreground">
                                {redemption.benefitKey}
                              </div>
                              {redemption.notes ? (
                                <div className="break-words text-[11px] text-muted-foreground">
                                  {redemption.notes}
                                </div>
                              ) : null}
                            </td>
                            <td
                              className={cn(
                                tableCellClass,
                                "whitespace-nowrap text-right tabular-nums text-muted-foreground"
                              )}
                            >
                              {formatDateTime(redemption.redeemedAt, {
                                timeZone: selectedEnrollment.timezone,
                                language: locale,
                              })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </DataTableFrame>
                )}
              </div>
            </>
          ) : (
            <EmptyState
              icon={Gift}
              title={t("marketing.wellness.redemption.noPatientSelected", "Nevybrali ste žiadneho pacienta")}
              description={t(
                "marketing.wellness.redemption.selectPatientDesc",
                "Kliknite na pacienta v zozname zápisov pre zobrazenie histórie a uplatnenie benefitu."
              )}
            />
          )}
        </section>
      </div>
    </div>
  );
}
