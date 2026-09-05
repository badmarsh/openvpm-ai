"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  OctagonX,
  AlertTriangle,
  Calendar,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  Sparkles,
  Wand2,
  CheckCheck,
  Archive,
  Loader2,
  Image as ImageIcon,
  RefreshCw,
  LayoutGrid,
  Clock,
  X,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  addCalendarMonths,
  buildMonthGrid,
  toISODate,
} from "@/lib/scheduling/calendar-views";
import { cn } from "@/lib/utils";

const WEEKDAYS = [
  { short: "Po", full: "Pondelok" },
  { short: "Ut", full: "Utorok" },
  { short: "St", full: "Streda" },
  { short: "Št", full: "Štvrtok" },
  { short: "Pia", full: "Piatok" },
  { short: "So", full: "Sobota", isWeekend: true },
  { short: "Ne", full: "Nedeľa", isWeekend: true },
];

function getChannelStyle(channel: string) {
  switch (channel) {
    case "instagram":
      return {
        bg: "bg-pink-500/10 dark:bg-pink-500/20",
        border: "border-pink-500/30",
        text: "text-pink-700 dark:text-pink-300",
        badge: "bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300",
        dot: "bg-pink-500",
        label: "Instagram",
        short: "IG",
      };
    case "facebook":
      return {
        bg: "bg-blue-500/10 dark:bg-blue-500/20",
        border: "border-blue-500/30",
        text: "text-blue-700 dark:text-blue-300",
        badge: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
        dot: "bg-blue-500",
        label: "Facebook",
        short: "FB",
      };
    case "google_business":
      return {
        bg: "bg-emerald-500/10 dark:bg-emerald-500/20",
        border: "border-emerald-500/30",
        text: "text-emerald-700 dark:text-emerald-300",
        badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
        dot: "bg-emerald-500",
        label: "Google Business",
        short: "GBP",
      };
    case "sms":
      return {
        bg: "bg-amber-500/10 dark:bg-amber-500/20",
        border: "border-amber-500/30",
        text: "text-amber-700 dark:text-amber-300",
        badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
        dot: "bg-amber-500",
        label: "SMS",
        short: "SMS",
      };
    case "email":
      return {
        bg: "bg-purple-500/10 dark:bg-purple-500/20",
        border: "border-purple-500/30",
        text: "text-purple-700 dark:text-purple-300",
        badge: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
        dot: "bg-purple-500",
        label: "Email",
        short: "Email",
      };
    default:
      return {
        bg: "bg-muted",
        border: "border-border",
        text: "text-foreground",
        badge: "bg-muted text-muted-foreground",
        dot: "bg-muted-foreground",
        label: channel,
        short: channel.slice(0, 2).toUpperCase(),
      };
  }
}

function getStatusBadge(status: string, validatorVerdict?: string | null) {
  if (status === "blocked" || validatorVerdict === "block") {
    return {
      dot: "bg-rose-500 ring-2 ring-rose-500/30",
      label: "Zablokované",
      badgeVariant: "destructive" as const,
      badgeClass: "bg-rose-600 text-white",
    };
  }
  if (status === "approved") {
    return {
      dot: "bg-emerald-500 ring-2 ring-emerald-500/30",
      label: "Schválené",
      badgeVariant: "default" as const,
      badgeClass: "bg-emerald-600 hover:bg-emerald-700 text-white",
    };
  }
  if (status === "published") {
    return {
      dot: "bg-sky-500 ring-2 ring-sky-500/30",
      label: "Publikované",
      badgeVariant: "secondary" as const,
      badgeClass: "bg-sky-600 text-white",
    };
  }
  return {
    dot: "bg-amber-500 ring-2 ring-amber-500/30",
    label: "Na schválenie",
    badgeVariant: "secondary" as const,
    badgeClass: "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30",
  };
}

export default function ContentPlanPage() {
  const { t } = useI18n();
  const utils = trpc.useUtils();

  const [activeView, setActiveView] = useState<"calendar" | "grid">("calendar");
  const [currentMonth, setCurrentMonth] = useState(() => new Date());

  const [status, setStatus] = useState("all");
  const [channel, setChannel] = useState("all");

  const [customTopic, setCustomTopic] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newChannel, setNewChannel] = useState("instagram");
  const [newDate, setNewDate] = useState("");

  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");

  const listQuery = trpc.extensions.marketing.listContentItems.useQuery({
    status: status === "all" ? undefined : (status as any),
    channel: channel === "all" ? undefined : (channel as any),
  });

  const batchesQuery = trpc.extensions.marketing.listContentBatches.useQuery();

  const validateMutation = trpc.extensions.marketing.validateContent.useMutation();

  const createMutation = trpc.extensions.marketing.createContentItem.useMutation({
    onSuccess: () => {
      setIsDialogOpen(false);
      utils.extensions.marketing.listContentItems.invalidate();
      setNewTitle("");
      setNewBody("");
      setNewDate("");
      toast.success("Príspevok bol vytvorený.");
    },
    onError: (err) => {
      toast.error(err.message || "Nepodarilo sa vytvoriť príspevok.");
    },
  });

  const approveMutation = trpc.extensions.marketing.approveContentItem.useMutation({
    onSuccess: (updated) => {
      utils.extensions.marketing.listContentItems.invalidate();
      if (selectedItem?.id === updated?.id) {
        setSelectedItem((prev: any) => (prev ? { ...prev, status: "approved" } : null));
      }
      toast.success("Príspevok bol schválený.");
    },
    onError: (err) => {
      toast.error(err.message || "Nepodarilo sa schváliť príspevok.");
    },
  });

  const rejectMutation = trpc.extensions.marketing.rejectContentItem.useMutation({
    onSuccess: () => {
      utils.extensions.marketing.listContentItems.invalidate();
      setSelectedItem(null);
      toast.success("Príspevok bol archivovaný.");
    },
  });

  const autoFixMutation = trpc.extensions.marketing.autoFixContentItem.useMutation({
    onSuccess: (data) => {
      utils.extensions.marketing.listContentItems.invalidate();
      if (data && selectedItem?.id === data.id) {
        setSelectedItem(data);
      }
      if (data?.status === "blocked") {
        toast.warning("Niektoré nálezy vyžadujú manuálnu úpravu.");
      } else {
        toast.success("Text bol automaticky opravený v súlade s predpismi KVL SR.");
      }
    },
    onError: (err) => {
      toast.error(err.message || "Nepodarilo sa automaticky opraviť text.");
    },
  });

  const rescheduleMutation = trpc.extensions.marketing.rescheduleContentItem.useMutation({
    onSuccess: (updated) => {
      utils.extensions.marketing.listContentItems.invalidate();
      if (selectedItem?.id === updated?.id) {
        setSelectedItem((prev: any) =>
          prev ? { ...prev, scheduledFor: updated.scheduledFor } : null
        );
      }
      toast.success(
        updated.scheduledFor
          ? `Dátum publikovania bol zmenený na ${new Date(
              updated.scheduledFor
            ).toLocaleDateString("sk-SK")}.`
          : "Termín publikovania bol zrušený."
      );
    },
    onError: (err) => {
      toast.error(err.message || "Nepodarilo sa zmeniť dátum publikovania.");
    },
  });

  const customPostMutation = trpc.extensions.marketing.createCustomPost.useMutation({
    onSuccess: () => {
      utils.extensions.marketing.listContentItems.invalidate();
      setCustomTopic("");
      toast.success("Príspevok na zadanú tému bol vygenerovaný a zaradený do plánu.");
    },
    onError: (err) => {
      toast.error(err.message || "Nepodarilo sa vygenerovať príspevok.");
    },
  });

  const generateBatchMutation = trpc.extensions.marketing.createContentBatch.useMutation({
    onSuccess: () => {
      utils.extensions.marketing.listContentBatches.invalidate();
      utils.extensions.marketing.listContentItems.invalidate();
      toast.success("Nový týždenný batch bol vygenerovaný zo sezónnych receptov!");
    },
    onError: (err) => {
      toast.error(err.message || "Nepodarilo sa vygenerovať batch.");
    },
  });

  const approveBatchMutation = trpc.extensions.marketing.approveContentBatch.useMutation({
    onSuccess: () => {
      utils.extensions.marketing.listContentBatches.invalidate();
      utils.extensions.marketing.listContentItems.invalidate();
      toast.success("Všetky pripravené príspevky v týždni boli schválené!");
    },
    onError: (err) => {
      toast.error(err.message || "Nepodarilo sa schváliť batch.");
    },
  });

  const [generatingItemId, setGeneratingItemId] = useState<string | null>(null);

  const generateImageMutation = trpc.extensions.marketing.generateImageForPost.useMutation({
    onMutate: (vars) => {
      setGeneratingItemId(vars.itemId);
    },
    onSettled: () => {
      setGeneratingItemId(null);
    },
    onSuccess: (data) => {
      utils.extensions.marketing.listContentItems.invalidate();
      if (selectedItem?.id === data?.item?.id) {
        setSelectedItem((prev: any) =>
          prev ? { ...prev, mediaAsset: data.asset } : null
        );
      }
      toast.success("Obrázok bol vygenerovaný a priradený k príspevku.");
    },
    onError: (err) => {
      toast.error(err.message || "Nepodarilo sa vygenerovať obrázok.");
    },
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      if (newBody.trim().length > 0) {
        validateMutation.mutate({ text: newBody, context: "marketing" });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [newBody, newChannel]);

  useEffect(() => {
    if (selectedItem?.scheduledFor) {
      setRescheduleDate(toISODate(new Date(selectedItem.scheduledFor)));
    } else {
      setRescheduleDate("");
    }
  }, [selectedItem]);

  const monthGrid = useMemo(() => {
    return buildMonthGrid(currentMonth, 1);
  }, [currentMonth]);

  const itemsByDate = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const item of listQuery.data ?? []) {
      if (!item.scheduledFor) continue;
      const key = toISODate(new Date(item.scheduledFor));
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return map;
  }, [listQuery.data]);

  const unscheduledItems = useMemo(() => {
    return (listQuery.data ?? []).filter((item: any) => !item.scheduledFor);
  }, [listQuery.data]);

  const monthTitle = useMemo(() => {
    const str = currentMonth.toLocaleDateString("sk-SK", {
      month: "long",
      year: "numeric",
    });
    return str.charAt(0).toUpperCase() + str.slice(1);
  }, [currentMonth]);

  const latestBatch = batchesQuery.data?.[0];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <CalendarDays className="w-7 h-7 text-primary" />
            {t("marketing.plan.title", "Edičný plán obsahu")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            {t(
              "marketing.plan.description",
              "Prehľadný kalendár sociálnych sietí, SMS a emailov s dodržiavaním etického kódexu KVL SR a AI generovaním grafík."
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {latestBatch && latestBatch.status !== "approved" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => approveBatchMutation.mutate({ batchId: latestBatch.id })}
              disabled={approveBatchMutation.isPending}
              className="gap-1.5 text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
            >
              {approveBatchMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCheck className="w-3.5 h-3.5" />
              )}
              Schváliť celý týždeň
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => generateBatchMutation.mutate({})}
            disabled={generateBatchMutation.isPending}
            className="gap-1.5 text-xs"
          >
            {generateBatchMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Wand2 className="w-3.5 h-3.5 text-muted-foreground" />
            )}
            Vygenerovať týždeň
          </Button>

          <Button
            size="sm"
            onClick={() => {
              setNewDate(toISODate(new Date()));
              setIsDialogOpen(true);
            }}
            className="gap-1.5 text-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            {t("marketing.plan.newPost", "Nový príspevok")}
          </Button>
        </div>
      </div>

      {/* Quick AI Topic Input */}
      <div className="p-3.5 rounded-xl border bg-card/70 backdrop-blur-sm shadow-xs flex flex-col sm:flex-row items-center gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-primary shrink-0">
          <Sparkles className="w-4 h-4 text-primary animate-pulse" />
          <span>Rýchly nápad pre AI:</span>
        </div>
        <Input
          value={customTopic}
          onChange={(e) => setCustomTopic(e.target.value)}
          placeholder="Napr. Prečo neodkladať jesenné čistenie zubov u psov a mačiek..."
          className="text-xs h-9 bg-background"
          onKeyDown={(e) => {
            if (e.key === "Enter" && customTopic.trim()) {
              customPostMutation.mutate({ topic: customTopic });
            }
          }}
        />
        <Button
          size="sm"
          onClick={() => customPostMutation.mutate({ topic: customTopic })}
          disabled={!customTopic.trim() || customPostMutation.isPending}
          className="shrink-0 text-xs gap-1.5"
        >
          {customPostMutation.isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Wand2 className="w-3.5 h-3.5" />
          )}
          Zložiť príspevok
        </Button>
      </div>

      {/* View Switcher, Month Navigation & Filters Bar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between border-b pb-4">
        {/* Navigation / Month Picker (shown in calendar view) */}
        {activeView === "calendar" ? (
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg border bg-card p-0.5 shadow-xs">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-md hover:bg-muted"
                onClick={() => setCurrentMonth((m) => addCalendarMonths(m, -1))}
                title="Predchádzajúci mesiac"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2.5 text-xs font-medium hover:bg-muted"
                onClick={() => setCurrentMonth(new Date())}
              >
                {t("marketing.plan.today", "Dnes")}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-md hover:bg-muted"
                onClick={() => setCurrentMonth((m) => addCalendarMonths(m, 1))}
                title="Nasledujúci mesiac"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <h2 className="text-base font-semibold text-foreground tracking-tight pl-2">
              {monthTitle}
            </h2>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-foreground tracking-tight">
              {t("marketing.plan.cards", "Zoznam príspevkov")}
            </h2>
            <Badge variant="secondary" className="text-xs">
              {listQuery.data?.length ?? 0}
            </Badge>
          </div>
        )}

        {/* Filters and View Toggle */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Status filter tabs */}
          <Tabs value={status} onValueChange={setStatus} className="w-auto">
            <TabsList className="h-9 p-1">
              <TabsTrigger value="all" className="text-xs px-2.5 py-1">
                {t("marketing.plan.all", "Všetky")}
              </TabsTrigger>
              <TabsTrigger value="proposed" className="text-xs px-2.5 py-1">
                {t("marketing.plan.proposed", "Návrhy")}
              </TabsTrigger>
              <TabsTrigger value="approved" className="text-xs px-2.5 py-1">
                {t("marketing.plan.approved", "Schválené")}
              </TabsTrigger>
              <TabsTrigger value="blocked" className="text-xs px-2.5 py-1">
                {t("marketing.plan.blocked", "Zablokované")}
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Channel select */}
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            className="h-9 rounded-md border bg-background px-3 text-xs outline-none focus:ring-1 focus:ring-primary shadow-xs"
          >
            <option value="all">Všetky kanály</option>
            <option value="instagram">Instagram</option>
            <option value="facebook">Facebook</option>
            <option value="google_business">Google Business</option>
            <option value="sms">SMS</option>
            <option value="email">Email</option>
          </select>

          {/* View toggle (Calendar vs Grid) */}
          <div className="flex items-center rounded-lg border bg-muted/40 p-0.5 shadow-xs">
            <Button
              variant={activeView === "calendar" ? "secondary" : "ghost"}
              size="sm"
              className={cn(
                "h-8 px-2.5 text-xs gap-1.5",
                activeView === "calendar" && "bg-background shadow-xs font-semibold text-foreground"
              )}
              onClick={() => setActiveView("calendar")}
            >
              <CalendarDays className="h-3.5 w-3.5 text-primary" />
              <span className="hidden sm:inline">{t("marketing.plan.calendar", "Kalendár")}</span>
            </Button>
            <Button
              variant={activeView === "grid" ? "secondary" : "ghost"}
              size="sm"
              className={cn(
                "h-8 px-2.5 text-xs gap-1.5",
                activeView === "grid" && "bg-background shadow-xs font-semibold text-foreground"
              )}
              onClick={() => setActiveView("grid")}
            >
              <LayoutGrid className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="hidden sm:inline">{t("marketing.plan.cards", "Karty")}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {listQuery.isLoading ? (
        <div className="rounded-xl border bg-card p-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-3 text-xs text-muted-foreground">Načítavam plán obsahu...</p>
        </div>
      ) : activeView === "calendar" ? (
        /* ── CALENDAR VIEW ─────────────────────────────────────────── */
        <div className="space-y-6">
          <div className="rounded-2xl border bg-card shadow-xs overflow-hidden">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 border-b bg-muted/30 text-center text-xs font-semibold">
              {WEEKDAYS.map((day) => (
                <div
                  key={day.short}
                  className={cn(
                    "py-2.5 border-r last:border-r-0 tracking-wide",
                    day.isWeekend ? "text-muted-foreground/70 bg-muted/20" : "text-foreground"
                  )}
                >
                  <span className="hidden md:inline">{day.full}</span>
                  <span className="md:hidden">{day.short}</span>
                </div>
              ))}
            </div>

            {/* Day cells grid */}
            <div className="grid grid-cols-7 divide-y divide-border/60">
              {monthGrid.map((day) => {
                const dayItems = itemsByDate.get(day.dateKey) ?? [];
                const isWeekend = day.date.getDay() === 0 || day.date.getDay() === 6;

                return (
                  <div
                    key={day.dateKey}
                    className={cn(
                      "min-h-[110px] md:min-h-[135px] p-2 border-r last:border-r-0 flex flex-col justify-between transition-colors group relative",
                      !day.isCurrentMonth && "bg-muted/15 text-muted-foreground/40",
                      day.isToday && "bg-primary/5 ring-1 ring-inset ring-primary/20",
                      isWeekend && day.isCurrentMonth && "bg-muted/10"
                    )}
                  >
                    {/* Day number & Quick add button */}
                    <div className="flex items-center justify-between">
                      <span
                        className={cn(
                          "text-xs font-semibold rounded-full flex items-center justify-center transition-colors",
                          day.isToday
                            ? "h-6 w-6 bg-primary text-primary-foreground font-bold shadow-xs"
                            : day.isCurrentMonth
                            ? "text-foreground group-hover:text-primary"
                            : "text-muted-foreground/50"
                        )}
                      >
                        {day.date.getDate()}
                      </span>

                      {/* Quick + button on hover */}
                      <button
                        type="button"
                        onClick={() => {
                          setNewDate(day.dateKey);
                          setIsDialogOpen(true);
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity h-5 w-5 rounded-md hover:bg-primary/15 text-primary flex items-center justify-center text-xs"
                        title={`Pridať príspevok na ${day.dateKey}`}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Posts list in this day */}
                    <div className="mt-1 space-y-1.5 flex-1 overflow-y-auto max-h-[120px] scrollbar-none">
                      {dayItems.slice(0, 3).map((item) => {
                        const channelStyle = getChannelStyle(item.channel);
                        const statusBadge = getStatusBadge(
                          item.status,
                          item.validatorVerdict
                        );
                        const isBlocked =
                          item.status === "blocked" || item.validatorVerdict === "block";

                        return (
                          <div
                            key={item.id}
                            onClick={() => setSelectedItem(item)}
                            className={cn(
                              "cursor-pointer p-1.5 rounded-lg border text-[11px] leading-tight transition-all shadow-2xs hover:shadow-sm hover:scale-[1.02] flex items-center gap-1.5 select-none",
                              channelStyle.bg,
                              channelStyle.border,
                              isBlocked && "ring-1 ring-rose-500/50 bg-rose-500/10 border-rose-500/40"
                            )}
                            title={`${item.title} (${channelStyle.label})`}
                          >
                            {/* Media thumbnail if exists */}
                            {item.mediaAsset?.url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={item.mediaAsset.url}
                                alt={item.title}
                                className="w-5 h-5 rounded-md object-cover shrink-0 border"
                              />
                            ) : (
                              <span
                                className={cn(
                                  "w-4 h-4 rounded-md flex items-center justify-center text-[9px] font-bold shrink-0",
                                  channelStyle.badge
                                )}
                              >
                                {channelStyle.short}
                              </span>
                            )}

                            {/* Title */}
                            <span className="truncate flex-1 font-medium text-foreground">
                              {item.title}
                            </span>

                            {/* Status indicator dot */}
                            {isBlocked ? (
                              <OctagonX className="h-3 w-3 text-rose-500 shrink-0" />
                            ) : (
                              <span
                                className={cn("w-2 h-2 rounded-full shrink-0", statusBadge.dot)}
                              />
                            )}
                          </div>
                        );
                      })}

                      {dayItems.length > 3 && (
                        <div
                          onClick={() => {
                            setSelectedItem(dayItems[3]);
                          }}
                          className="text-[10px] text-center font-medium text-muted-foreground hover:text-foreground cursor-pointer pt-0.5"
                        >
                          +{dayItems.length - 3} ďalšie
                        </div>
                      )}
                    </div>

                    {/* Subtle bottom indicator */}
                    <div className="h-0.5" />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Unscheduled Drafts Section */}
          {unscheduledItems.length > 0 && (
            <div className="rounded-2xl border bg-card p-5 space-y-4 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-500" />
                  <h3 className="text-sm font-bold text-foreground">
                    {t("marketing.plan.unscheduled", "Nenaplánovaný obsah a koncepty")}
                  </h3>
                  <Badge variant="secondary" className="text-[10px]">
                    {unscheduledItems.length}
                  </Badge>
                </div>
                <span className="text-xs text-muted-foreground">
                  Kliknutím na príspevok mu môžete priradiť dátum publikovania.
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {unscheduledItems.map((item: any) => {
                  const channelStyle = getChannelStyle(item.channel);
                  const isBlocked =
                    item.status === "blocked" || item.validatorVerdict === "block";

                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedItem(item)}
                      className={cn(
                        "p-3 rounded-xl border bg-background hover:bg-muted/20 cursor-pointer transition-all hover:shadow-xs flex flex-col justify-between gap-2.5",
                        isBlocked && "border-rose-500/40"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span
                          className={cn(
                            "text-[10px] font-semibold px-2 py-0.5 rounded-md",
                            channelStyle.badge
                          )}
                        >
                          {channelStyle.label}
                        </span>
                        {isBlocked ? (
                          <Badge variant="destructive" className="text-[9px] px-1.5 py-0">
                            Blokované
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                            {item.status}
                          </Badge>
                        )}
                      </div>

                      <div className="font-semibold text-xs text-foreground line-clamp-2">
                        {item.title}
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-muted-foreground/60" />
                          Bez termínu
                        </span>
                        <span className="text-primary font-medium hover:underline">
                          Naplánovať →
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ── GRID / CARDS VIEW ─────────────────────────────────────── */
        listQuery.data?.length === 0 ? (
          <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground space-y-2">
            <Calendar className="w-10 h-10 text-muted-foreground/40 mx-auto" />
            <p className="text-sm font-medium text-foreground">
              Žiadne príspevky vo vybranom filtri
            </p>
            <p className="text-xs">Kliknite na „Vygenerovať týždeň“ alebo vytvorte vlastný príspevok.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {listQuery.data?.map((item: any) => {
              const isBlocked = item.status === "blocked" || item.validatorVerdict === "block";
              const isProposed = item.status === "proposed";
              const isApproved = item.status === "approved";
              const channelStyle = getChannelStyle(item.channel);

              return (
                <div
                  key={item.id}
                  className="rounded-xl border bg-card p-4 shadow-sm space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-sm text-foreground line-clamp-2">{item.title}</h3>
                      <Badge variant="outline" className={cn("text-[10px] shrink-0", channelStyle.badge)}>
                        {channelStyle.label}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>
                        {item.scheduledFor
                          ? new Date(item.scheduledFor).toLocaleDateString("sk-SK")
                          : "Nenaplánované"}
                      </span>
                    </div>

                    {item.mediaAsset?.url ? (
                      <div className="relative aspect-video w-full rounded-lg overflow-hidden border bg-muted/20 group">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.mediaAsset.url}
                          alt={item.mediaAsset.altText || item.title}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        <div className="absolute top-2 left-2 flex items-center gap-1">
                          <Badge
                            variant="secondary"
                            className="text-[9px] bg-background/85 backdrop-blur-sm shadow-xs font-semibold"
                          >
                            {item.mediaAsset.kind === "brand_graphic"
                              ? "Grafika"
                              : item.mediaAsset.kind === "photo"
                              ? "Fotografia"
                              : "AI Ilustrácia"}
                          </Badge>
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="absolute bottom-2 right-2 h-7 text-[10px] gap-1 bg-background/90 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity shadow-xs"
                          onClick={() => generateImageMutation.mutate({ itemId: item.id })}
                          disabled={generatingItemId === item.id}
                        >
                          {generatingItemId === item.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <RefreshCw className="w-3 h-3" />
                          )}
                          Prevekslovať AI
                        </Button>
                      </div>
                    ) : item.channel !== "sms" ? (
                      <div className="rounded-lg border border-dashed p-2.5 bg-muted/10 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <ImageIcon className="w-3.5 h-3.5 text-muted-foreground/60" />
                          <span>Bez vizuálu</span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs gap-1 text-primary border-primary/30 hover:bg-primary/5"
                          onClick={() => generateImageMutation.mutate({ itemId: item.id })}
                          disabled={generatingItemId === item.id}
                        >
                          {generatingItemId === item.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Sparkles className="w-3 h-3 text-primary" />
                          )}
                          Generovať vizuál
                        </Button>
                      </div>
                    ) : null}

                    <div className="p-3 rounded-lg bg-muted/40 text-xs leading-relaxed text-foreground whitespace-pre-wrap max-h-36 overflow-y-auto">
                      {item.body}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <Badge
                        variant={
                          isApproved
                            ? "default"
                            : isBlocked
                            ? "destructive"
                            : isProposed
                            ? "secondary"
                            : "outline"
                        }
                        className={
                          isApproved
                            ? "bg-emerald-600 hover:bg-emerald-700 text-white text-[10px]"
                            : "text-[10px]"
                        }
                      >
                        {item.status}
                      </Badge>

                      {item.validatorVerdict && (
                        <Badge
                          variant={
                            item.validatorVerdict === "pass"
                              ? "outline"
                              : item.validatorVerdict === "warn"
                              ? "secondary"
                              : "destructive"
                          }
                          className={
                            item.validatorVerdict === "warn"
                              ? "bg-amber-100 text-amber-800 text-[10px]"
                              : "text-[10px]"
                          }
                        >
                          {item.validatorVerdict === "pass" && (
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                          )}
                          {item.validatorVerdict === "warn" && (
                            <AlertTriangle className="mr-1 h-3 w-3" />
                          )}
                          {item.validatorVerdict === "block" && (
                            <OctagonX className="mr-1 h-3 w-3" />
                          )}
                          Validátor: {item.validatorVerdict}
                        </Badge>
                      )}
                    </div>

                    {isBlocked && item.validatorFindings && item.validatorFindings.length > 0 && (
                      <div className="text-xs text-destructive bg-destructive/10 p-2.5 rounded-lg space-y-1">
                        {item.validatorFindings.map((f: any, i: number) => (
                          <div key={i} className="flex items-start gap-1">
                            <span>•</span>
                            <span>{f.message}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t flex flex-wrap gap-2">
                    {isBlocked && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => autoFixMutation.mutate({ id: item.id })}
                        disabled={autoFixMutation.isPending}
                        className="text-xs gap-1 w-full text-primary border-primary/40 hover:bg-primary/10"
                      >
                        <Wand2 className="w-3.5 h-3.5" />
                        Automaticky opraviť (Auto-Fix)
                      </Button>
                    )}

                    {isProposed && !isBlocked && (
                      <Button
                        className="w-full text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                        size="sm"
                        onClick={() => approveMutation.mutate({ id: item.id })}
                        disabled={approveMutation.isPending}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {t("marketing.plan.approve", "Schváliť")}
                      </Button>
                    )}

                    {item.status !== "archived" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => rejectMutation.mutate({ id: item.id })}
                        className="text-xs text-muted-foreground hover:text-destructive w-full"
                      >
                        <Archive className="w-3.5 h-3.5 mr-1" />
                        Archivovať
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* ── POST DETAIL & ACTIONS MODAL ─────────────────────────────── */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-2xl border bg-background p-6 shadow-2xl rounded-2xl space-y-5 my-8">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "text-xs font-semibold px-2 py-0.5 rounded-md",
                      getChannelStyle(selectedItem.channel).badge
                    )}
                  >
                    {getChannelStyle(selectedItem.channel).label}
                  </span>
                  <Badge
                    variant={getStatusBadge(selectedItem.status, selectedItem.validatorVerdict).badgeVariant}
                    className={cn("text-[10px]", getStatusBadge(selectedItem.status, selectedItem.validatorVerdict).badgeClass)}
                  >
                    {getStatusBadge(selectedItem.status, selectedItem.validatorVerdict).label}
                  </Badge>
                  {selectedItem.validatorVerdict && (
                    <Badge variant="outline" className="text-[10px]">
                      KVL SR: {selectedItem.validatorVerdict}
                    </Badge>
                  )}
                </div>
                <h2 className="text-lg font-bold text-foreground leading-snug">
                  {selectedItem.title}
                </h2>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg"
                onClick={() => setSelectedItem(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Date reschedule bar */}
            <div className="p-3 rounded-xl border bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                <Calendar className="w-4 h-4 text-primary" />
                <span className="font-semibold text-foreground">Termín publikovania:</span>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Input
                  type="date"
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="text-xs h-8 bg-background"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs shrink-0"
                  disabled={rescheduleMutation.isPending}
                  onClick={() =>
                    rescheduleMutation.mutate({
                      id: selectedItem.id,
                      scheduledFor: rescheduleDate ? new Date(rescheduleDate).toISOString() : null,
                    })
                  }
                >
                  {rescheduleMutation.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    "Uložiť dátum"
                  )}
                </Button>
              </div>
            </div>

            {/* Media Image Preview / Generator */}
            {selectedItem.mediaAsset?.url ? (
              <div className="relative aspect-video w-full rounded-xl overflow-hidden border bg-muted/20 group shadow-inner">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedItem.mediaAsset.url}
                  alt={selectedItem.mediaAsset.altText || selectedItem.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-3 left-3 flex items-center gap-1.5">
                  <Badge variant="secondary" className="text-[10px] bg-background/90 backdrop-blur-sm shadow-sm font-semibold">
                    {selectedItem.mediaAsset.kind === "brand_graphic"
                      ? "Brandová grafika"
                      : selectedItem.mediaAsset.kind === "photo"
                      ? "Klinická fotografia"
                      : "AI Ilustrácia"}
                  </Badge>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  className="absolute bottom-3 right-3 text-xs gap-1.5 bg-background/90 backdrop-blur-sm shadow-md hover:bg-background"
                  onClick={() => generateImageMutation.mutate({ itemId: selectedItem.id })}
                  disabled={generatingItemId === selectedItem.id}
                >
                  {generatingItemId === selectedItem.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" />
                  )}
                  Prevekslovať AI vizuál
                </Button>
              </div>
            ) : selectedItem.channel !== "sms" ? (
              <div className="rounded-xl border border-dashed p-4 bg-muted/15 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <ImageIcon className="w-4 h-4 text-muted-foreground/60" />
                  <span>K tomuto príspevku zatiaľ nie je priradený vizuál.</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs gap-1.5 text-primary border-primary/30 hover:bg-primary/10"
                  onClick={() => generateImageMutation.mutate({ itemId: selectedItem.id })}
                  disabled={generatingItemId === selectedItem.id}
                >
                  {generatingItemId === selectedItem.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                  )}
                  Generovať AI ilustráciu
                </Button>
              </div>
            ) : null}

            {/* Post text content */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">
                Obsah príspevku:
              </label>
              <div className="p-4 rounded-xl bg-muted/30 border text-xs leading-relaxed text-foreground whitespace-pre-wrap max-h-48 overflow-y-auto">
                {selectedItem.body}
              </div>
            </div>

            {/* Validator findings */}
            {selectedItem.validatorVerdict === "block" && selectedItem.validatorFindings && (
              <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-xs space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-destructive">
                  <OctagonX className="w-4 h-4 shrink-0" />
                  <span>Nález etického validátora KVL SR (Blokované publikovanie)</span>
                </div>
                <ul className="space-y-1 pl-5 list-disc text-destructive">
                  {selectedItem.validatorFindings.map((f: any, i: number) => (
                    <li key={i}>{f.message}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Action buttons footer */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                {selectedItem.status !== "archived" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => rejectMutation.mutate({ id: selectedItem.id })}
                    className="text-xs text-muted-foreground hover:text-destructive w-full sm:w-auto"
                  >
                    <Archive className="w-3.5 h-3.5 mr-1" />
                    Archivovať
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                {selectedItem.validatorVerdict === "block" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => autoFixMutation.mutate({ id: selectedItem.id })}
                    disabled={autoFixMutation.isPending}
                    className="text-xs gap-1.5 text-primary border-primary/40 hover:bg-primary/10 w-full sm:w-auto"
                  >
                    <Wand2 className="w-3.5 h-3.5" />
                    Automaticky opraviť (Auto-Fix)
                  </Button>
                )}

                {selectedItem.status === "proposed" && selectedItem.validatorVerdict !== "block" && (
                  <Button
                    size="sm"
                    onClick={() => approveMutation.mutate({ id: selectedItem.id })}
                    disabled={approveMutation.isPending}
                    className="text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white w-full sm:w-auto shadow-xs"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Schváliť príspevok
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedItem(null)}
                  className="text-xs w-full sm:w-auto"
                >
                  Zatvoriť
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── CREATE CUSTOM POST DIALOG ───────────────────────────────── */}
      {isDialogOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg border bg-background p-6 shadow-2xl rounded-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-lg font-semibold text-foreground">Vytvoriť vlastný príspevok</h2>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsDialogOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Názov príspevku</label>
                <Input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Názov témy..."
                  className="text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Kanál</label>
                  <select
                    value={newChannel}
                    onChange={(e) => setNewChannel(e.target.value)}
                    className="flex h-9 w-full rounded-md border bg-background px-3 text-xs outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="instagram">Instagram</option>
                    <option value="facebook">Facebook</option>
                    <option value="google_business">Google Business</option>
                    <option value="sms">SMS</option>
                    <option value="email">Email</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Dátum publikovania</label>
                  <Input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="text-xs h-9"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Text príspevku</label>
                <Textarea
                  rows={5}
                  value={newBody}
                  onChange={(e) => setNewBody(e.target.value)}
                  placeholder="Napíšte text príspevku..."
                  className="text-xs"
                />

                {validateMutation.data?.findings && validateMutation.data.findings.length > 0 && (
                  <div className="mt-2 space-y-1 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs">
                    {validateMutation.data.findings.map((f: any, i: number) => (
                      <p
                        key={i}
                        className={`flex items-start gap-1.5 ${
                          f.severity === "block" ? "text-rose-600 font-semibold" : "text-amber-700"
                        }`}
                      >
                        {f.severity === "block" ? (
                          <OctagonX className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        )}
                        <span>{f.message}</span>
                      </p>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setIsDialogOpen(false)}>
                  Zrušiť
                </Button>
                <Button
                  size="sm"
                  onClick={() =>
                    createMutation.mutate({
                      title: newTitle,
                      body: newBody,
                      channel: newChannel as any,
                      scheduledFor: newDate ? new Date(newDate).toISOString() : undefined,
                    })
                  }
                  disabled={!newTitle || !newBody || createMutation.isPending}
                >
                  {createMutation.isPending && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                  )}
                  Vytvoriť
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
