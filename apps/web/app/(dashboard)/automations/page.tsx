"use client";

import { useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Zap,
  GitBranch,
  Users,
  Send,
  Heart,
  Plus,
  Play,
  Pause,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Bot,
  Loader2,
  Trash2,
  Edit2,
  AlertCircle,
  FileText,
  Mail,
  Smartphone,
  CheckCircle2,
  Search,
  ArrowRight,
  Info,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";
import {
  pageShellClass,
  PageHeader,
  PageToolbar,
  SearchField,
  filterControlClass,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { formatDateTimeToDisplay } from "@/lib/date-display";
import { ClinicalAutomationsView } from "@/components/automations/clinical-automations-view";
import { AiAgentsView } from "@/components/automations/ai-agents-view";
import type { AutomationJourneyStep } from "@openpims/db";

const TRIGGER_OPTIONS = [
  "visit_completed",
  "vaccine_due",
  "appointment_booked",
  "appointment_reminder",
  "appointment_no_show",
  "surgery_completed",
  "wellness_enrolled",
  "inactive_recall",
  "dental_detected",
  "patient_deceased",
] as const;

function getJourneyStatus(journey: {
  isActive: boolean;
  steps: unknown;
}): "active" | "paused" | "draft" {
  const steps = Array.isArray(journey.steps) ? journey.steps : [];
  if (steps.length === 0) return "draft";
  return journey.isActive ? "active" : "paused";
}

function AutomationsContent() {
  const { t } = useI18n();
  const utils = trpc.useUtils();
  const searchParams = useSearchParams();

  // Tab state with deep-link support
  const urlTab = searchParams.get("tab");
  const initialTab =
    urlTab === "clinical"
      ? "clinical"
      : urlTab === "ai-agents"
        ? "ai-agents"
        : urlTab === "suppression"
          ? "suppression"
          : "journeys";

  const [activeTab, setActiveTab] = useState(initialTab);

  // Filters for Journey List
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Filters for Suppression Log Panel
  const [suppressionSearch, setSuppressionSearch] = useState("");
  const [suppressionReasonFilter, setSuppressionReasonFilter] = useState("all");

  // Queries
  const journeysQuery = trpc.extensions.automationJourneys.list.useQuery();
  const enrollmentsQuery = trpc.extensions.automationEnrollments.list.useQuery({
    limit: 500,
  });
  const eventsQuery = trpc.extensions.automationEvents.list.useQuery({
    limit: 500,
  });
  const suppressionMetricsQuery =
    trpc.extensions.automationSuppression.getMetrics.useQuery();
  const suppressionLogsQuery =
    trpc.extensions.automationSuppression.listLogs.useQuery({
      limit: 100,
      reason: (suppressionReasonFilter === "all"
        ? "all"
        : suppressionReasonFilter) as any,
    });

  // Mutations
  const createJourneyMutation =
    trpc.extensions.automationJourneys.create.useMutation();
  const updateJourneyMutation =
    trpc.extensions.automationJourneys.update.useMutation();

  // Rule Builder modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingJourneyId, setEditingJourneyId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formKey, setFormKey] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formTrigger, setFormTrigger] = useState("visit_completed");
  const [formCapDays, setFormCapDays] = useState(14);
  const [formCapMax, setFormCapMax] = useState(3);
  const [formSteps, setFormSteps] = useState<AutomationJourneyStep[]>([]);

  // Computed KPI Metrics
  const activeJourneysCount = useMemo(() => {
    return (journeysQuery.data ?? []).filter((j) => j.isActive).length;
  }, [journeysQuery.data]);

  const enrolledPatientsCount = useMemo(() => {
    return enrollmentsQuery.data?.length ?? 0;
  }, [enrollmentsQuery.data]);

  const sentThisWeekCount = useMemo(() => {
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return (eventsQuery.data ?? []).filter((e) => {
      const occurred = new Date(e.occurredAt).getTime();
      return (
        occurred >= oneWeekAgo &&
        (e.status === "processed" || e.status === "pending")
      );
    }).length;
  }, [eventsQuery.data]);

  const sympathyGateCount = suppressionMetricsQuery.data?.sympathyBlocks ?? 0;

  // Enrollment counts per journey
  const enrollmentCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const en of enrollmentsQuery.data ?? []) {
      if (en.journeyId) {
        map[en.journeyId] = (map[en.journeyId] ?? 0) + 1;
      }
    }
    return map;
  }, [enrollmentsQuery.data]);

  // Filtered journeys
  const filteredJourneys = useMemo(() => {
    let list = journeysQuery.data ?? [];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (j) =>
          j.name.toLowerCase().includes(q) ||
          (j.description && j.description.toLowerCase().includes(q)) ||
          j.triggerEventType.toLowerCase().includes(q) ||
          j.journeyKey.toLowerCase().includes(q),
      );
    }
    if (typeFilter !== "all") {
      list = list.filter((j) => j.triggerEventType === typeFilter);
    }
    if (statusFilter !== "all") {
      list = list.filter((j) => getJourneyStatus(j) === statusFilter);
    }
    return list;
  }, [journeysQuery.data, searchQuery, typeFilter, statusFilter]);

  // Filtered suppression logs
  const filteredSuppressionLogs = useMemo(() => {
    let list = suppressionLogsQuery.data ?? [];
    if (suppressionSearch.trim()) {
      const q = suppressionSearch.toLowerCase().trim();
      list = list.filter((log) => {
        const clientName = `${log.clientFirstName ?? ""} ${log.clientLastName ?? ""}`.toLowerCase();
        const patientName = (log.patientName ?? "").toLowerCase();
        const action = (log.blockedAction ?? "").toLowerCase();
        const detail = (log.detail ?? "").toLowerCase();
        return (
          clientName.includes(q) ||
          patientName.includes(q) ||
          action.includes(q) ||
          detail.includes(q)
        );
      });
    }
    return list;
  }, [suppressionLogsQuery.data, suppressionSearch]);

  // Handlers for Rule Builder Modal
  const openCreateModal = () => {
    setEditingJourneyId(null);
    setFormName("");
    setFormKey(`journey_${Date.now()}`);
    setFormDesc("");
    setFormTrigger("visit_completed");
    setFormCapDays(14);
    setFormCapMax(3);
    setFormSteps([
      {
        index: 0,
        kind: "send",
        label: t("automations.triggers.visit_completed", "Ukončenie vyšetrenia"),
        delayHours: 0,
        channel: "sms",
        legalBasis: "contract",
      },
    ]);
    setIsModalOpen(true);
  };

  const openEditModal = (journey: (typeof filteredJourneys)[number]) => {
    setEditingJourneyId(journey.id);
    setFormName(journey.name);
    setFormKey(journey.journeyKey);
    setFormDesc(journey.description ?? "");
    setFormTrigger(journey.triggerEventType);
    setFormCapDays(journey.frequencyCapWindowDays ?? 14);
    setFormCapMax(journey.frequencyCapMaxSteps ?? 3);
    const steps = Array.isArray(journey.steps)
      ? (journey.steps as AutomationJourneyStep[])
      : [];
    setFormSteps(steps.length > 0 ? steps : []);
    setIsModalOpen(true);
  };

  const handleToggleJourney = (journey: { id: string; isActive: boolean }) => {
    updateJourneyMutation.mutate(
      {
        id: journey.id,
        isActive: !journey.isActive,
      },
      {
        onSuccess: () => {
          utils.extensions.automationJourneys.list.invalidate();
          toast.success(
            journey.isActive
              ? t("automations.table.pause", "Pozastaviť")
              : t("automations.table.activate", "Aktivovať"),
          );
        },
        onError: (err) => {
          toast.error(err.message);
        },
      },
    );
  };

  const handleAddStep = () => {
    const nextIdx = formSteps.length;
    setFormSteps([
      ...formSteps,
      {
        index: nextIdx,
        kind: "send",
        label: `${t("automations.builder.stepNumber", "Krok {num}", { num: nextIdx + 1 })}`,
        delayHours: nextIdx === 0 ? 0 : 24,
        channel: "sms",
        legalBasis: "contract",
      },
    ]);
  };

  const handleRemoveStep = (idx: number) => {
    const updated = formSteps
      .filter((_, i) => i !== idx)
      .map((s, i) => ({ ...s, index: i }));
    setFormSteps(updated);
  };

  const handleStepChange = (
    idx: number,
    field: keyof AutomationJourneyStep,
    value: unknown,
  ) => {
    setFormSteps(
      formSteps.map((s, i) => (i === idx ? { ...s, [field]: value } : s)),
    );
  };

  const handleSaveJourney = () => {
    if (!formName.trim()) return;

    if (editingJourneyId) {
      updateJourneyMutation.mutate(
        {
          id: editingJourneyId,
          name: formName.trim(),
          description: formDesc.trim() || undefined,
          steps: formSteps,
          frequencyCapWindowDays: formCapDays,
          frequencyCapMaxSteps: formCapMax,
        },
        {
          onSuccess: () => {
            utils.extensions.automationJourneys.list.invalidate();
            toast.success(
              t(
                "automations.builder.journeyUpdated",
                "Zákaznícka cesta bola úspešne aktualizovaná",
              ),
            );
            setIsModalOpen(false);
          },
          onError: (err) => {
            toast.error(err.message);
          },
        },
      );
    } else {
      createJourneyMutation.mutate(
        {
          name: formName.trim(),
          journeyKey: formKey.trim() || `journey_${Date.now()}`,
          description: formDesc.trim() || undefined,
          triggerEventType: formTrigger,
          steps: formSteps,
          frequencyCapWindowDays: formCapDays,
          frequencyCapMaxSteps: formCapMax,
        },
        {
          onSuccess: () => {
            utils.extensions.automationJourneys.list.invalidate();
            toast.success(
              t(
                "automations.builder.journeyCreated",
                "Zákaznícka cesta bola úspešne vytvorená",
              ),
            );
            setIsModalOpen(false);
          },
          onError: (err) => {
            toast.error(err.message);
          },
        },
      );
    }
  };

  return (
    <div className={pageShellClass}>
      {/* Header */}
      <PageHeader
        icon={Zap}
        title={t("automations.pageTitle", "Automatizácie")}
        subtitle={t(
          "automations.pageSubtitle",
          "Pravidlá pre automatickú komunikáciu s klientmi",
        )}
      />

      {/* Underline Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
        <TabsList className={underlineTabsListClass}>
          <TabsTrigger value="journeys" className={underlineTabsTriggerClass}>
            <GitBranch className="h-4 w-4" />
            <span>{t("automations.tabs.journeys", "CRM Cesty & Automatizácie")}</span>
          </TabsTrigger>
          <TabsTrigger value="suppression" className={underlineTabsTriggerClass}>
            <Heart className="h-4 w-4" />
            <span>
              {t("automations.tabs.suppression", "Audit potlačenia & Sympathy Gate")}
            </span>
          </TabsTrigger>
          <TabsTrigger value="clinical" className={underlineTabsTriggerClass}>
            <ShieldCheck className="h-4 w-4" />
            <span>{t("automations.tabs.clinical", "Klinický strážca")}</span>
          </TabsTrigger>
          <TabsTrigger value="ai-agents" className={underlineTabsTriggerClass}>
            <Bot className="h-4 w-4" />
            <span>{t("automations.tabs.aiAgents", "AI Agenti & Workflow")}</span>
          </TabsTrigger>
        </TabsList>

        {/* 1. JOURNEYS TAB */}
        <TabsContent value="journeys" className="mt-0 space-y-6">
          {/* KPI Grid */}
          <KpiGrid>
            <KpiCard
              label={t("automations.kpi.activeJourneys", "Aktívne cesty")}
              value={activeJourneysCount}
              icon={GitBranch}
              tone="primary"
            />
            <KpiCard
              label={t("automations.kpi.enrolledPatients", "Zaradení pacienti")}
              value={enrolledPatientsCount}
              icon={Users}
            />
            <KpiCard
              label={t("automations.kpi.sentThisWeek", "Odoslané tento týždeň")}
              value={sentThisWeekCount}
              icon={Send}
            />
            <KpiCard
              label={t("automations.kpi.suppressedSympathy", "Potlačené Sympathy Gate")}
              value={sympathyGateCount}
              icon={Heart}
              tone="destructive"
              hint={t("automations.kpi.sympathyHint", "Zákon 39/2007 Z. z. – úmrtie")}
            />
          </KpiGrid>

          {/* Page Toolbar */}
          <PageToolbar>
            <SearchField
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder={t(
                "automations.filters.searchPlaceholder",
                "Hľadať cesty podľa názvu alebo popisu...",
              )}
            />

            <select
              className={filterControlClass}
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              aria-label={t("automations.filters.allTypes", "Všetky typy udalostí")}
            >
              <option value="all">
                {t("automations.filters.allTypes", "Všetky typy udalostí")}
              </option>
              {TRIGGER_OPTIONS.map((trig) => (
                <option key={trig} value={trig}>
                  {t(`automations.triggers.${trig}`, trig)}
                </option>
              ))}
            </select>

            <select
              className={filterControlClass}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label={t("automations.filters.allStatuses", "Všetky stavy")}
            >
              <option value="all">
                {t("automations.filters.allStatuses", "Všetky stavy")}
              </option>
              <option value="active">
                {t("automations.status.active", "Aktívna")}
              </option>
              <option value="paused">
                {t("automations.status.paused", "Pozastavená")}
              </option>
              <option value="draft">
                {t("automations.status.draft", "Koncept")}
              </option>
            </select>

            <span className="text-xs text-muted-foreground ml-auto tabular-nums">
              {filteredJourneys.length}{" "}
              {t("automations.table.stepsCount", "{count} ciest", {
                count: filteredJourneys.length,
              })}
            </span>

            <Button size="sm" onClick={openCreateModal}>
              <Plus className="h-4 w-4 mr-1.5" />
              <span>{t("automations.builder.newJourneyBtn", "Nová cesta")}</span>
            </Button>
          </PageToolbar>

          {/* Journey List DataTableFrame */}
          <DataTableFrame>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className={tableHeadClass}>
                    {t("automations.table.journeyName", "Názov cesty")}
                  </th>
                  <th className={tableHeadClass}>
                    {t("automations.table.trigger", "Spúšťacia udalosť")}
                  </th>
                  <th className={tableHeadClass}>
                    {t("automations.table.status", "Stav")}
                  </th>
                  <th className={tableHeadClass}>
                    {t("automations.table.enrollments", "Zaradení")}
                  </th>
                  <th className={tableHeadClass}>
                    {t("automations.table.lastTriggered", "Posledné spustenie")}
                  </th>
                  <th className={tableHeadClass}>
                    {t("automations.table.actions", "Akcie")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {journeysQuery.isLoading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-muted-foreground">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
                      <span>{t("automations.table.loading", "Načítavam zákaznícke cesty...")}</span>
                    </td>
                  </tr>
                ) : filteredJourneys.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8">
                      <EmptyState
                        icon={GitBranch}
                        title={t("automations.table.noJourneys", "Žiadne nakonfigurované cesty")}
                        description={t(
                          "automations.table.noJourneysDesc",
                          "Vytvorte svoju prvú zákaznícku cestu alebo upravte filtre.",
                        )}
                        action={
                          <Button size="sm" onClick={openCreateModal}>
                            <Plus className="h-3.5 w-3.5 mr-1.5" />
                            <span>{t("automations.empty.action", "Nová cesta")}</span>
                          </Button>
                        }
                      />
                    </td>
                  </tr>
                ) : (
                  filteredJourneys.map((journey) => {
                    const status = getJourneyStatus(journey);
                    const steps = (journey.steps as AutomationJourneyStep[]) || [];
                    const isToggling =
                      updateJourneyMutation.isPending &&
                      updateJourneyMutation.variables?.id === journey.id;

                    return (
                      <tr
                        key={journey.id}
                        className={tableRowClass}
                        onClick={() => openEditModal(journey)}
                      >
                        <td className={tableCellClass}>
                          <div className="flex items-start gap-2.5">
                            <GitBranch className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                            <div>
                              <div className="font-semibold text-foreground">
                                {journey.name}
                              </div>
                              {journey.description ? (
                                <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                                  {journey.description}
                                </p>
                              ) : null}
                              <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                                {t("automations.table.frequencyCap", "Limit: {max} / {days}d", {
                                  max: journey.frequencyCapMaxSteps,
                                  days: journey.frequencyCapWindowDays,
                                })}{" "}
                                · {steps.length}{" "}
                                {t("automations.table.stepsCount", "{count} krokov", {
                                  count: steps.length,
                                })}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className={tableCellClass}>
                          <Badge variant="outline" className="font-mono text-[11px]">
                            {t(`automations.triggers.${journey.triggerEventType}`, journey.triggerEventType)}
                          </Badge>
                        </td>

                        <td className={tableCellClass}>
                          {status === "active" ? (
                            <Badge variant="default" className="text-[11px]">
                              {t("automations.status.active", "Aktívna")}
                            </Badge>
                          ) : status === "paused" ? (
                            <Badge variant="secondary" className="text-[11px]">
                              {t("automations.status.paused", "Pozastavená")}
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-[11px] border-dashed text-muted-foreground"
                            >
                              {t("automations.status.draft", "Koncept")}
                            </Badge>
                          )}
                        </td>

                        <td className={tableCellClass}>
                          <span className="font-mono tabular-nums text-foreground">
                            {enrollmentCounts[journey.id] ?? 0}
                          </span>
                        </td>

                        <td className={tableCellClass}>
                          <span className="font-mono tabular-nums text-muted-foreground">
                            {formatDateTimeToDisplay(journey.updatedAt || journey.createdAt)}
                          </span>
                        </td>

                        <td className={tableCellClass}>
                          <div
                            className="flex items-center gap-1.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button
                              size="sm"
                              variant={journey.isActive ? "outline" : "default"}
                              className="h-7 px-2 text-xs"
                              disabled={isToggling}
                              onClick={() => handleToggleJourney(journey)}
                            >
                              {journey.isActive ? (
                                <>
                                  <Pause className="h-3 w-3 mr-1" />
                                  <span>{t("automations.table.pause", "Pozastaviť")}</span>
                                </>
                              ) : (
                                <>
                                  <Play className="h-3 w-3 mr-1" />
                                  <span>{t("automations.table.activate", "Aktivovať")}</span>
                                </>
                              )}
                            </Button>

                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              onClick={() => openEditModal(journey)}
                              title={t("automations.table.edit", "Upraviť")}
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </DataTableFrame>
        </TabsContent>

        {/* 2. SUPPRESSION LOG PANEL TAB (READ-ONLY) */}
        <TabsContent value="suppression" className="mt-0 space-y-6">
          {/* Sympathy Gate & Legal Protection Card */}
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 shadow-xs">
            <div className="flex items-start gap-3">
              <Heart className="h-5 w-5 text-destructive shrink-0 mt-0.5 fill-destructive/20" />
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-foreground">
                    {t(
                      "automations.suppression.title",
                      "Auditný denník potlačených správ & Sympathy Gate",
                    )}
                  </h3>
                  <Badge variant="outline" className="border-destructive/30 text-destructive text-[10px]">
                    Zákon 39/2007 Z. z.
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t(
                    "automations.suppression.subtitle",
                    "Zákonná ochrana klientov a etické blokovanie správ (Zákon 39/2007 Z. z., GDPR Čl. 9).",
                  )}
                </p>
                <p className="text-[11px] font-medium text-destructive">
                  {t(
                    "automations.suppression.readOnlyNotice",
                    "Záznamy potlačenia sú striktne na čítanie pre účely auditovateľnosti a zákonného dozoru.",
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Suppression Toolbar */}
          <PageToolbar>
            <SearchField
              value={suppressionSearch}
              onChange={setSuppressionSearch}
              placeholder={t(
                "automations.filters.searchSuppression",
                "Hľadať v záznamoch potlačenia...",
              )}
            />

            <select
              className={filterControlClass}
              value={suppressionReasonFilter}
              onChange={(e) => setSuppressionReasonFilter(e.target.value)}
              aria-label={t(
                "automations.filters.allReasons",
                "Všetky dôvody potlačenia",
              )}
            >
              <option value="all">
                {t("automations.filters.allReasons", "Všetky dôvody potlačenia")}
              </option>
              <option value="deceased_patient">
                {t(
                  "automations.suppression.reasons.deceased_patient",
                  "Sympathy Gate (Zosnulý pacient)",
                )}
              </option>
              <option value="quiet_hours">
                {t(
                  "automations.suppression.reasons.quiet_hours",
                  "Nočný kľud (20:00 - 08:00)",
                )}
              </option>
              <option value="frequency_cap">
                {t(
                  "automations.suppression.reasons.frequency_cap",
                  "Prekročený frekvenčný limit",
                )}
              </option>
              <option value="no_consent">
                {t(
                  "automations.suppression.reasons.no_consent",
                  "Chýba marketingový súhlas",
                )}
              </option>
              <option value="sms_rate_limit">
                {t(
                  "automations.suppression.reasons.sms_rate_limit",
                  "Prekročený SMS limit (1 správa / 14d)",
                )}
              </option>
              <option value="recovery_hold">
                {t(
                  "automations.suppression.reasons.recovery_hold",
                  "Pooperačný kľudový režim",
                )}
              </option>
              <option value="manual_block">
                {t(
                  "automations.suppression.reasons.manual_block",
                  "Manuálne zablokované personálom",
                )}
              </option>
            </select>

            <span className="text-xs text-muted-foreground ml-auto tabular-nums">
              {filteredSuppressionLogs.length}{" "}
              {t("automations.table.stepsCount", "{count} záznamov", {
                count: filteredSuppressionLogs.length,
              })}
            </span>
          </PageToolbar>

          {/* Read-only Suppression DataTableFrame */}
          <DataTableFrame>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className={tableHeadClass}>
                    {t("automations.suppression.colPatient", "Pacient & Klient")}
                  </th>
                  <th className={tableHeadClass}>
                    {t("automations.suppression.colReason", "Dôvod potlačenia")}
                  </th>
                  <th className={tableHeadClass}>
                    {t("automations.suppression.colSuppressedAt", "Čas potlačenia")}
                  </th>
                  <th className={tableHeadClass}>
                    {t(
                      "automations.suppression.colAction",
                      "Blokovaná akcia / Kanál",
                    )}
                  </th>
                  <th className={tableHeadClass}>
                    {t("automations.suppression.colStatus", "Stav potlačenia")}
                  </th>
                  <th className={tableHeadClass}>
                    {t("automations.suppression.colDetail", "Auditný detail")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {suppressionLogsQuery.isLoading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-muted-foreground">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
                      <span>{t("automations.suppression.loading", "Načítavam auditné záznamy...")}</span>
                    </td>
                  </tr>
                ) : filteredSuppressionLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8">
                      <EmptyState
                        icon={ShieldCheck}
                        title={t(
                          "automations.suppression.emptyTitle",
                          "Žiadne záznamy potlačenia",
                        )}
                        description={t(
                          "automations.suppression.emptyDescription",
                          "Neboli zaznamenané žiadne potlačené správy ani zlyhania sympathy gate.",
                        )}
                      />
                    </td>
                  </tr>
                ) : (
                  filteredSuppressionLogs.map((log) => {
                    const isDeceased = log.suppressionReason === "deceased_patient";

                    return (
                      <tr key={log.id} className={tableRowClass}>
                        <td className={tableCellClass}>
                          <div className="font-medium text-foreground">
                            {log.patientName ? (
                              <span>
                                {log.patientName}
                                {log.patientSpecies ? (
                                  <span className="text-muted-foreground font-normal ml-1">
                                    ({log.patientSpecies})
                                  </span>
                                ) : null}
                              </span>
                            ) : (
                              "—"
                            )}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {log.clientFirstName || log.clientLastName
                              ? `${log.clientFirstName ?? ""} ${log.clientLastName ?? ""}`.trim()
                              : "—"}
                          </div>
                        </td>

                        <td className={tableCellClass}>
                          {isDeceased ? (
                            <Badge
                              variant="destructive"
                              className="gap-1 bg-destructive/15 text-destructive border-destructive/30 hover:bg-destructive/20 text-[11px]"
                            >
                              <Heart className="h-3 w-3 fill-current" />
                              <span>
                                {t(
                                  "automations.suppression.reasons.deceased_patient",
                                  "Sympathy Gate (Zosnulý)",
                                )}
                              </span>
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[11px]">
                              {t(
                                `automations.suppression.reasons.${log.suppressionReason}`,
                                log.suppressionReason,
                              )}
                            </Badge>
                          )}
                        </td>

                        <td className={tableCellClass}>
                          <span className="font-mono tabular-nums text-muted-foreground">
                            {formatDateTimeToDisplay(log.blockedAt)}
                          </span>
                        </td>

                        <td className={tableCellClass}>
                          <div className="font-mono text-xs text-foreground">
                            {log.blockedAction}
                          </div>
                          {log.channelAttempted ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] uppercase font-mono mt-0.5"
                            >
                              {log.channelAttempted}
                            </Badge>
                          ) : null}
                        </td>

                        <td className={tableCellClass}>
                          {log.clearedAt ? (
                            <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              {t("automations.suppression.cleared", "Odblokované")}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <ShieldAlert className="h-3.5 w-3.5 text-destructive" />
                              {t(
                                "automations.suppression.activeHold",
                                "Aktívne potlačené",
                              )}
                            </span>
                          )}
                        </td>

                        <td className={tableCellClass}>
                          <span className="text-[11px] text-muted-foreground line-clamp-2 max-w-xs">
                            {log.detail || "—"}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </DataTableFrame>
        </TabsContent>

        {/* 3. CLINICAL GUARDIAN TAB */}
        <TabsContent value="clinical" className="mt-0 space-y-4">
          <ClinicalAutomationsView />
        </TabsContent>

        {/* 4. AI AGENTS TAB */}
        <TabsContent value="ai-agents" className="mt-0 space-y-4">
          <AiAgentsView />
        </TabsContent>
      </Tabs>

      {/* Rule Builder / Journey Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingJourneyId
                ? t("automations.builder.editJourneyTitle", "Úprava zákazníckej cesty")
                : t("automations.builder.newJourneyTitle", "Nová zákaznícka cesta")}
            </DialogTitle>
            <DialogDescription>
              {t(
                "automations.builder.descriptionPlaceholder",
                "Popíšte cieľ a časovanie tejto automatizovanej cesty...",
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="journey-name">
                  {t("automations.builder.journeyName", "Názov cesty")}
                </Label>
                <Input
                  id="journey-name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder={t(
                    "automations.builder.journeyNamePlaceholder",
                    "napr. Pooperačná starostlivosť a kontrola",
                  )}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="journey-key">
                  {t("automations.builder.journeyKey", "Unikátny kľúč")}
                </Label>
                <Input
                  id="journey-key"
                  value={formKey}
                  onChange={(e) => setFormKey(e.target.value)}
                  disabled={Boolean(editingJourneyId)}
                  placeholder={t(
                    "automations.builder.journeyKeyPlaceholder",
                    "napr. post_op_care",
                  )}
                  className="h-9 font-mono text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="journey-desc">
                {t("automations.builder.description", "Popis cesty")}
              </Label>
              <Textarea
                id="journey-desc"
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                placeholder={t(
                  "automations.builder.descriptionPlaceholder",
                  "Popíšte cieľ a časovanie tejto automatizovanej cesty...",
                )}
                className="text-xs min-h-[64px]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="journey-trigger">
                  {t("automations.builder.triggerEvent", "Klinická spúšťacia udalosť")}
                </Label>
                <select
                  id="journey-trigger"
                  className={filterControlClass}
                  value={formTrigger}
                  onChange={(e) => setFormTrigger(e.target.value)}
                >
                  {TRIGGER_OPTIONS.map((trig) => (
                    <option key={trig} value={trig}>
                      {t(`automations.triggers.${trig}`, trig)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="journey-cap-days">
                  {t("automations.builder.frequencyCapWindow", "Okno limitu (dni)")}
                </Label>
                <Input
                  id="journey-cap-days"
                  type="number"
                  min={1}
                  value={formCapDays}
                  onChange={(e) => setFormCapDays(Number(e.target.value))}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="journey-cap-max">
                  {t("automations.builder.frequencyCapMax", "Max. správ v okne")}
                </Label>
                <Input
                  id="journey-cap-max"
                  type="number"
                  min={0}
                  value={formCapMax}
                  onChange={(e) => setFormCapMax(Number(e.target.value))}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {/* Sequence steps editor */}
            <div className="space-y-3 pt-3 border-t border-border">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">
                  {t("automations.builder.stepsTitle", "Sekvencia krokov")} (
                  {formSteps.length})
                </Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleAddStep}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  <span>{t("automations.builder.addStep", "Pridať krok")}</span>
                </Button>
              </div>

              <div className="space-y-2.5">
                {formSteps.map((step, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg border border-border bg-card/60 space-y-2.5 text-xs shadow-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-primary">
                        {t("automations.builder.stepNumber", "Krok {num}", {
                          num: idx + 1,
                        })}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-6 px-1.5 text-destructive hover:bg-destructive/10"
                        onClick={() => handleRemoveStep(idx)}
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        <span>{t("automations.builder.removeStep", "Odstrániť krok")}</span>
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                      <div className="sm:col-span-2 space-y-1">
                        <Label className="text-[11px] text-muted-foreground">
                          {t("automations.builder.stepLabel", "Názov kroku")}
                        </Label>
                        <Input
                          value={step.label}
                          onChange={(e) =>
                            handleStepChange(idx, "label", e.target.value)
                          }
                          placeholder={t(
                            "automations.builder.stepLabelPlaceholder",
                            "napr. Kontrolná SMS 24h po prepustení",
                          )}
                          className="h-8 text-xs"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">
                          {t("automations.builder.channel", "Kanál")}
                        </Label>
                        <select
                          className={filterControlClass}
                          value={step.channel ?? "sms"}
                          onChange={(e) =>
                            handleStepChange(idx, "channel", e.target.value)
                          }
                        >
                          <option value="sms">
                            {t("automations.channels.sms", "SMS")}
                          </option>
                          <option value="email">
                            {t("automations.channels.email", "E-mail")}
                          </option>
                          <option value="task">
                            {t("automations.channels.task", "Úloha pre personál")}
                          </option>
                          <option value="content_brief">
                            {t("automations.channels.content_brief", "Obsahový návrh")}
                          </option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">
                          {t("automations.builder.delayHours", "Oneskorenie (hodiny)")}
                        </Label>
                        <Input
                          type="number"
                          min={0}
                          value={step.delayHours}
                          onChange={(e) =>
                            handleStepChange(
                              idx,
                              "delayHours",
                              Number(e.target.value),
                            )
                          }
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">
                        {t("automations.builder.legalBasis", "Právny základ (GDPR)")}
                      </Label>
                      <select
                        className={filterControlClass}
                        value={step.legalBasis ?? "contract"}
                        onChange={(e) =>
                          handleStepChange(idx, "legalBasis", e.target.value)
                        }
                      >
                        <option value="contract">
                          {t(
                            "automations.legal.contract",
                            "Plnenie zmluvy (Zákonná starostlivosť)",
                          )}
                        </option>
                        <option value="consent">
                          {t(
                            "automations.legal.consent",
                            "Výslovný súhlas klienta (GDPR)",
                          )}
                        </option>
                        <option value="legitimate_interest">
                          {t(
                            "automations.legal.legitimate_interest",
                            "Oprávnený záujem kliniky",
                          )}
                        </option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsModalOpen(false)}
            >
              {t("automations.builder.cancel", "Zrušiť")}
            </Button>
            <Button
              size="sm"
              onClick={handleSaveJourney}
              disabled={
                !formName.trim() ||
                createJourneyMutation.isPending ||
                updateJourneyMutation.isPending
              }
            >
              {createJourneyMutation.isPending ||
              updateJourneyMutation.isPending
                ? t("automations.builder.saving", "Ukladám...")
                : t("automations.builder.saveJourney", "Uložiť cestu")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AutomationsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <AutomationsContent />
    </Suspense>
  );
}
