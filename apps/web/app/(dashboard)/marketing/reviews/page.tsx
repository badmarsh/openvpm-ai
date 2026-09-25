"use client";

import { Fragment, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Copy,
  Heart,
  Loader2,
  MessageSquare,
  Pencil,
  Plus,
  SearchX,
  ShieldAlert,
  Sparkles,
  Star,
  ThumbsUp,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { formatDate, localeTagForLanguage } from "@/lib/locale/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

type Translate = ReturnType<typeof useI18n>["t"];

type PlatformFilter = "all" | "google" | "facebook" | "internal";
type StatusFilter = "all" | "unanswered" | "replied";
type Sentiment = "positive" | "neutral" | "negative";
type SentimentFilter = "all" | Sentiment;
type EscalationFilter = "all" | "escalated";

/** Row shape consumed by the queue (subset of ext_marketing_reviews). */
interface ReviewRow {
  id: string;
  platform: string;
  reviewerName: string | null;
  rating: number | null;
  reviewText: string | null;
  receivedAt: Date | null;
  replyText: string | null;
  repliedAt: Date | null;
  requestBlockedReason: string | null;
  sentimentScore: number | null;
  sentimentLabel: string | null;
  severity: string | null;
  escalationStatus: string;
  escalationReason: string | null;
}

/** Reason written by the sympathy gate when a review request is suppressed. */
const SYMPATHY_GATE_REASON = "sympathy_gate";

const REVIEW_SEARCH_MAX_LENGTH = 100;
const REVIEW_REPLY_MAX_LENGTH = 1000;
const REVIEW_TEXT_MAX_LENGTH = 2000;
const REVIEWER_NAME_MAX_LENGTH = 100;
/** Clinic commitment: answer a review within one working day. */
const REPLY_SLA_HOURS = 24;
const TABLE_COLUMNS = 7;

/** Case- and diacritics-insensitive matching ("kovac" finds "Kováčová"). */
function foldForSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase();
}

/** Slovak plural forms: 1 recenzia · 2–4 recenzie · 0 / 5+ recenzií. */
function reviewCountLabel(count: number, t: Translate): string {
  if (count === 1) {
    return t("marketing.reviews.toolbar.countOne", "{count} recenzia", { count });
  }
  if ([2, 3, 4].includes(count)) {
    return t("marketing.reviews.toolbar.countFew", "{count} recenzie", { count });
  }
  return t("marketing.reviews.toolbar.countOther", "{count} recenzií", { count });
}

/** Bounded average so an empty / unrated queue never prints NaN. */
function averageRating(rows: ReviewRow[]): string | null {
  const rated = rows.filter((row) => typeof row.rating === "number");
  if (rated.length === 0) return null;
  const sum = rated.reduce((acc, row) => acc + (row.rating ?? 0), 0);
  const value = sum / rated.length;
  return Number.isFinite(value) ? value.toFixed(1) : null;
}

/**
 * Sentiment of a review: the classifier label wins, otherwise the star rating
 * decides (4–5 positive, 1–2 negative, 3 neutral).
 */
function resolveSentiment(review: ReviewRow): Sentiment {
  if (review.sentimentLabel === "positive") return "positive";
  if (review.sentimentLabel === "negative") return "negative";
  if (review.sentimentLabel === "neutral") return "neutral";
  const rating = review.rating ?? 3;
  if (rating >= 4) return "positive";
  if (rating <= 2) return "negative";
  return "neutral";
}

function isSympathyBlocked(review: ReviewRow): boolean {
  return review.requestBlockedReason === SYMPATHY_GATE_REASON;
}

function startOfDay(value: string): number | null {
  const time = new Date(`${value}T00:00:00`).getTime();
  return Number.isNaN(time) ? null : time;
}

function endOfDay(value: string): number | null {
  const time = new Date(`${value}T23:59:59.999`).getTime();
  return Number.isNaN(time) ? null : time;
}

// ── Platform marks ───────────────────────────────────────────────────────────

function GoogleIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.15C3.25 21.28 7.34 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.26C.46 8.16 0 9.94 0 12s.46 3.84 1.26 5.42l4.02-3.15z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.25 2.72 1.26 6.58l4.02 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
      />
    </svg>
  );
}

function FacebookIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="#1877F2" aria-hidden="true">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function StarRating({ rating, className }: { rating: number; className?: string }) {
  return (
    <span className={cn("flex items-center gap-0.5", className)} aria-hidden="true">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(
            "h-3.5 w-3.5",
            star <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30",
          )}
        />
      ))}
    </span>
  );
}

function PlatformBadge({ platform, t }: { platform: string; t: Translate }) {
  if (platform === "facebook") {
    return (
      <Badge variant="info" className="gap-1 text-[11px] font-medium">
        <FacebookIcon className="h-3 w-3" />
        {t("marketing.reviews.platformFacebook", "Facebook")}
      </Badge>
    );
  }
  if (platform === "internal") {
    return (
      <Badge variant="secondary" className="text-[11px] font-medium">
        {t("marketing.reviews.platformInternal", "Interné")}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 text-[11px] font-medium">
      <GoogleIcon className="h-3 w-3" />
      {t("marketing.reviews.platformGoogle", "Google")}
    </Badge>
  );
}

/** Sentiment badge: positive / neutral / negative on semantic badge tokens. */
function SentimentBadge({ review, t }: { review: ReviewRow; t: Translate }) {
  const sentiment = resolveSentiment(review);
  const score =
    review.sentimentScore !== null && review.sentimentScore !== undefined
      ? ` (${review.sentimentScore > 0 ? "+" : ""}${review.sentimentScore}%)`
      : "";

  if (sentiment === "positive") {
    return (
      <Badge variant="success" className="gap-1 text-[11px] font-medium">
        <ThumbsUp className="h-3 w-3" aria-hidden="true" />
        {t("marketing.reviews.sentiment.positive", "Pozitívna")}
        {score}
      </Badge>
    );
  }
  if (sentiment === "negative") {
    return (
      <Badge variant="destructive" className="gap-1 text-[11px] font-medium">
        <AlertTriangle className="h-3 w-3" aria-hidden="true" />
        {t("marketing.reviews.sentiment.negative", "Negatívna")}
        {score}
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="text-[11px] font-medium">
      {t("marketing.reviews.sentiment.neutral", "Neutrálna")}
      {score}
    </Badge>
  );
}

/** Response SLA: answered, still inside the 24 h window, or overdue. */
function getSlaState(review: ReviewRow, t: Translate): {
  status: "replied" | "pending" | "overdue";
  label: string;
  variant: "success" | "warning" | "destructive";
} | null {
  if (review.replyText || review.repliedAt) {
    if (review.receivedAt && review.repliedAt) {
      const hours = Math.max(
        0,
        Math.round(
          (new Date(review.repliedAt).getTime() -
            new Date(review.receivedAt).getTime()) /
            (1000 * 60 * 60),
        ),
      );
      return {
        status: "replied",
        label: t("marketing.reviews.sla.repliedInHours", "Zodpovedané za {hours} h", { hours }),
        variant: "success",
      };
    }
    return {
      status: "replied",
      label: t("marketing.reviews.sla.replied", "Zodpovedané"),
      variant: "success",
    };
  }
  if (!review.receivedAt) return null;
  const hoursPassed =
    (Date.now() - new Date(review.receivedAt).getTime()) / (1000 * 60 * 60);
  if (hoursPassed > REPLY_SLA_HOURS) {
    return {
      status: "overdue",
      label: t("marketing.reviews.sla.overdue", "Po termíne ({hours} h)", {
        hours: Math.round(hoursPassed),
      }),
      variant: "destructive",
    };
  }
  return {
    status: "pending",
    label: t("marketing.reviews.sla.pending", "{hours} h do termínu", {
      hours: Math.max(1, Math.round(REPLY_SLA_HOURS - hoursPassed)),
    }),
    variant: "warning",
  };
}

function severityLabel(severity: string | null, t: Translate): string | null {
  if (severity === "critical") {
    return t("marketing.reviews.severity.critical", "Kritická závažnosť");
  }
  if (severity === "high") {
    return t("marketing.reviews.severity.high", "Vysoká závažnosť");
  }
  if (severity === "medium") {
    return t("marketing.reviews.severity.medium", "Stredná závažnosť");
  }
  return null;
}

/** Query failure: never let an error masquerade as an empty queue. */
function QueryErrorState({ title, onRetry }: { title: string; onRetry: () => void }) {
  const { t } = useI18n();
  return (
    <div role="alert">
      <EmptyState
        icon={AlertTriangle}
        title={title}
        className="border-destructive/30 bg-destructive/5 p-6"
        action={{ label: t("marketing.reviews.retry", "Skúsiť znova"), onClick: onRetry }}
      />
    </div>
  );
}

export default function ReviewsPage() {
  const { t, locale } = useI18n();
  const utils = trpc.useUtils();

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [ratingFilter, setRatingFilter] = useState<"all" | 1 | 2 | 3 | 4 | 5>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sentimentFilter, setSentimentFilter] = useState<SentimentFilter>("all");
  const [escalationFilter, setEscalationFilter] = useState<EscalationFilter>("all");
  const [sympathyOnly, setSympathyOnly] = useState(false);

  // Interaction
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  // Escalation dialog
  const [escalatingReview, setEscalatingReview] = useState<ReviewRow | null>(null);
  const [escalateReason, setEscalateReason] = useState("");
  const [isEscalateModalOpen, setIsEscalateModalOpen] = useState(false);

  // New review form
  const [newPlatform, setNewPlatform] = useState<"google" | "facebook" | "internal">("google");
  const [newName, setNewName] = useState("");
  const [newRating, setNewRating] = useState(5);
  const [newText, setNewText] = useState("");
  const [newReply, setNewReply] = useState("");

  const listQuery = trpc.extensions.marketing.listReviews.useQuery({
    limit: 100,
    platform: platformFilter,
    sentiment: sentimentFilter,
    escalation: escalationFilter,
    unansweredOnly: statusFilter === "unanswered",
  });

  const replyMutation = trpc.extensions.marketing.replyToReview.useMutation({
    onSuccess: () => {
      setReplyingTo(null);
      setReplyText("");
      utils.extensions.marketing.listReviews.invalidate();
      toast.success(t("marketing.reviews.toast.replySaved", "Odpoveď na recenziu bola uložená."));
    },
    onError: (err) => {
      toast.error(t("marketing.reviews.toast.replyError", "Nepodarilo sa uložiť odpoveď."), {
        description: err.message || undefined,
      });
    },
  });

  const approveReviewReplyMutation = trpc.extensions.marketing.approveReviewReply.useMutation({
    onSuccess: () => {
      setReplyingTo(null);
      setReplyText("");
      utils.extensions.marketing.listReviews.invalidate();
      toast.success(
        t("marketing.reviews.approveSuccess", "Odpoveď bola oficiálne schválená a publikovaná."),
      );
    },
    onError: (err) => {
      toast.error(t("marketing.reviews.toast.approveError", "Nepodarilo sa schváliť odpoveď."), {
        description: err.message || undefined,
      });
    },
  });

  const escalateReviewMutation = trpc.extensions.marketing.escalateReview.useMutation({
    onSuccess: () => {
      setIsEscalateModalOpen(false);
      setEscalateReason("");
      setEscalatingReview(null);
      utils.extensions.marketing.listReviews.invalidate();
      toast.success(
        t("marketing.reviews.escalateSuccess", "Recenzia bola úspešne eskalovaná na personál."),
      );
    },
    onError: (err) => {
      toast.error(t("marketing.reviews.toast.escalateError", "Nepodarilo sa eskalovať recenziu."), {
        description: err.message || undefined,
      });
    },
  });

  const generateReplyMutation = trpc.extensions.marketing.generateReviewReply.useMutation({
    onSuccess: (data) => {
      if (data?.reply) {
        setReplyText(data.reply);
        toast.success(t("marketing.reviews.toast.aiGenerated", "AI navrhla odpoveď na recenziu."));
      }
    },
    onError: (err) => {
      toast.error(t("marketing.reviews.toast.aiError", "Nepodarilo sa vygenerovať AI odpoveď."), {
        description: err.message || undefined,
      });
    },
  });

  const createReviewMutation = trpc.extensions.marketing.createReview.useMutation({
    onSuccess: () => {
      setIsAddDialogOpen(false);
      setNewName("");
      setNewRating(5);
      setNewText("");
      setNewReply("");
      utils.extensions.marketing.listReviews.invalidate();
      toast.success(t("marketing.reviews.toast.createSuccess", "Nová recenzia bola pridaná."));
    },
    onError: (err) => {
      toast.error(t("marketing.reviews.toast.createError", "Nepodarilo sa pridať recenziu."), {
        description: err.message || undefined,
      });
    },
  });

  const deleteReviewMutation = trpc.extensions.marketing.deleteReview.useMutation({
    onSuccess: () => {
      utils.extensions.marketing.listReviews.invalidate();
      toast.success(t("marketing.reviews.toast.deleteSuccess", "Recenzia bola zmazaná."));
    },
    onError: (err) => {
      toast.error(t("marketing.reviews.toast.deleteError", "Nepodarilo sa zmazať recenziu."), {
        description: err.message || undefined,
      });
    },
  });

  const rawReviews = useMemo<ReviewRow[]>(
    () => (listQuery.data ?? []) as ReviewRow[],
    [listQuery.data],
  );

  const dateRangeFrom = dateFrom ? startOfDay(dateFrom) : null;
  const dateRangeTo = dateTo ? endOfDay(dateTo) : null;

  const reviews = useMemo(() => {
    const needle = foldForSearch(searchQuery.trim());
    return rawReviews.filter((review) => {
      if (ratingFilter !== "all" && (review.rating ?? 5) !== ratingFilter) return false;
      if (statusFilter === "replied" && !review.replyText) return false;
      if (statusFilter === "unanswered" && review.replyText) return false;
      if (sympathyOnly && !isSympathyBlocked(review)) return false;
      if (dateRangeFrom !== null || dateRangeTo !== null) {
        const received = review.receivedAt ? new Date(review.receivedAt).getTime() : null;
        if (received === null) return false;
        if (dateRangeFrom !== null && received < dateRangeFrom) return false;
        if (dateRangeTo !== null && received > dateRangeTo) return false;
      }
      if (!needle) return true;
      return foldForSearch(
        [review.reviewerName, review.reviewText].filter(Boolean).join(" "),
      ).includes(needle);
    });
  }, [
    rawReviews,
    ratingFilter,
    statusFilter,
    sympathyOnly,
    dateRangeFrom,
    dateRangeTo,
    searchQuery,
  ]);

  const stats = useMemo(() => {
    const byPlatform = { google: 0, facebook: 0, internal: 0 };
    let unanswered = 0;
    let sympathyBlocked = 0;
    for (const review of rawReviews) {
      if (review.platform === "facebook") byPlatform.facebook += 1;
      else if (review.platform === "internal") byPlatform.internal += 1;
      else byPlatform.google += 1;
      if (!review.replyText) unanswered += 1;
      if (isSympathyBlocked(review)) sympathyBlocked += 1;
    }
    return {
      total: rawReviews.length,
      avg: averageRating(rawReviews),
      unanswered,
      sympathyBlocked,
      byPlatform,
    };
  }, [rawReviews]);

  const filtersActive =
    platformFilter !== "all" ||
    sentimentFilter !== "all" ||
    escalationFilter !== "all" ||
    ratingFilter !== "all" ||
    statusFilter !== "all" ||
    sympathyOnly ||
    dateFrom !== "" ||
    dateTo !== "" ||
    searchQuery.trim() !== "";

  const clearFilters = () => {
    setSearchQuery("");
    setPlatformFilter("all");
    setSentimentFilter("all");
    setEscalationFilter("all");
    setRatingFilter("all");
    setStatusFilter("all");
    setSympathyOnly(false);
    setDateFrom("");
    setDateTo("");
  };

  const toggleExpand = (id: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const startReply = (review: ReviewRow, prefilledText: string) => {
    setExpanded((current) => new Set(current).add(review.id));
    setReplyingTo(review.id);
    setReplyText(prefilledText);
  };

  const requestAiReply = (review: ReviewRow) => {
    generateReplyMutation.mutate({
      reviewId: review.id,
      platform: (review.platform as "google" | "facebook" | "internal") || "google",
      reviewerName: review.reviewerName || t("marketing.reviews.queue.defaultReviewer", "Klient"),
      rating: review.rating ?? 5,
      reviewText: review.reviewText || "",
      tone: (review.rating ?? 5) < 3 ? "apologetic" : "warm",
    });
  };

  const copyReply = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t("marketing.reviews.toast.copySuccess", "Odpoveď bola skopírovaná."));
    } catch {
      toast.error(t("marketing.reviews.toast.copyError", "Nepodarilo sa skopírovať odpoveď."));
    }
  };

  const askDelete = (review: ReviewRow) => {
    if (
      window.confirm(
        t("marketing.reviews.deleteConfirm", "Naozaj chcete zmazať túto recenziu?"),
      )
    ) {
      deleteReviewMutation.mutate({ id: review.id });
    }
  };

  const cannedResponses = [
    {
      label: t("marketing.reviews.canned.generalLabel", "Vďaka & dôvera (všeobecná)"),
      text: t(
        "marketing.reviews.canned.generalText",
        "Ďakujeme za milé slová a dôveru v náš tím pri starostlivosti o vášho miláčika! Veľmi si to vážime. S úctou, tím veterinárnej kliniky.",
      ),
    },
    {
      label: t("marketing.reviews.canned.recoveryLabel", "Pooperačná rekonvalescencia"),
      text: t(
        "marketing.reviews.canned.recoveryText",
        "Veľmi si vážime vašu spätnú väzbu. Sme nesmierne radi, že ošetrenie i rekonvalescencia prebehli bez komplikácií a pacientovi sa darí výborne!",
      ),
    },
    {
      label: t("marketing.reviews.canned.emergencyLabel", "Pohotovosť & akútny stav"),
      text: t(
        "marketing.reviews.canned.emergencyText",
        "Ďakujeme za pochopenie pri náročnom ošetrení. Rýchla reakcia a záchrana života zvieracieho pacienta sú pre nás prioritou. Prajeme veľa zdravia celej rodine!",
      ),
    },
    {
      label: t("marketing.reviews.canned.complaintLabel", "Konštruktívne riešenie nespokojnosti"),
      text: t(
        "marketing.reviews.canned.complaintText",
        "Ďakujeme za hodnotenie. Veľmi nás mrzí vaša nespokojnosť – záleží nám na každom pacientovi. Prosím kontaktujte vedenie kliniky, radi situáciu osobne preveríme a vyriešime.",
      ),
    },
    {
      label: t("marketing.reviews.canned.recommendationLabel", "Facebook odporúčanie"),
      text: t(
        "marketing.reviews.canned.recommendationText",
        "Ďakujeme za milé odporúčanie na Facebooku! Spokojnosť chovateľov a zdravie vašich štvornohých parťákov je pre náš kolektív najväčšou odmenou.",
      ),
    },
  ];

  const localeTag = localeTagForLanguage(locale);
  const formatCount = (value: number) =>
    new Intl.NumberFormat(localeTag, { maximumFractionDigits: 0 }).format(value);
  const kpiValue = (value: React.ReactNode) =>
    listQuery.isError ? (
      "—"
    ) : listQuery.isLoading ? (
      <span
        className="inline-block h-6 w-10 animate-pulse rounded bg-muted/60"
        aria-hidden="true"
      />
    ) : (
      value
    );

  return (
    <div className={pageShellClass}>
      <PageHeader
        icon={Star}
        title={t("marketing.reviews.title", "Recenzie (Google & Facebook)")}
        subtitle={t(
          "marketing.reviews.description",
          "Správa, štatistiky a odpovedanie na Google a Facebook recenzie kliniky. Žiadosti o recenziu sa po úmrtí pacienta automaticky blokujú (Sympathy Gate).",
        )}
        actions={
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => setIsAddDialogOpen(true)}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t("marketing.reviews.addReview", "Pridať recenziu")}
          </Button>
        }
      />

      <PageToolbar>
        <label htmlFor="marketing-reviews-search" className="sr-only">
          {t("marketing.reviews.toolbar.searchLabel", "Hľadať v recenziách")}
        </label>
        <SearchField
          id="marketing-reviews-search"
          value={searchQuery}
          maxLength={REVIEW_SEARCH_MAX_LENGTH}
          placeholder={t("marketing.reviews.filterSearch", "Hľadať v recenziách...")}
          onChange={setSearchQuery}
        />

        <select
          value={platformFilter}
          onChange={(e) => setPlatformFilter(e.target.value as PlatformFilter)}
          className={filterControlClass}
          aria-label={t("marketing.reviews.toolbar.platformLabel", "Filtrovať podľa platformy")}
        >
          <option value="all">{t("marketing.reviews.platformAll", "Všetky platformy")}</option>
          <option value="google">
            {t("marketing.reviews.platformGoogle", "Google")} ({stats.byPlatform.google})
          </option>
          <option value="facebook">
            {t("marketing.reviews.platformFacebook", "Facebook")} ({stats.byPlatform.facebook})
          </option>
          <option value="internal">
            {t("marketing.reviews.platformInternal", "Interné")} ({stats.byPlatform.internal})
          </option>
        </select>

        <div className="flex items-center gap-1.5">
          <label htmlFor="marketing-reviews-date-from" className="sr-only">
            {t("marketing.reviews.toolbar.dateFromLabel", "Dátum od")}
          </label>
          <Input
            id="marketing-reviews-date-from"
            type="date"
            value={dateFrom}
            max={dateTo || undefined}
            onChange={(e) => setDateFrom(e.target.value)}
            className={cn(filterControlClass, "h-9 w-40 text-xs")}
          />
          <span className="text-xs text-muted-foreground" aria-hidden="true">
            –
          </span>
          <label htmlFor="marketing-reviews-date-to" className="sr-only">
            {t("marketing.reviews.toolbar.dateToLabel", "Dátum do")}
          </label>
          <Input
            id="marketing-reviews-date-to"
            type="date"
            value={dateTo}
            min={dateFrom || undefined}
            onChange={(e) => setDateTo(e.target.value)}
            className={cn(filterControlClass, "h-9 w-40 text-xs")}
          />
        </div>

        <select
          value={ratingFilter}
          onChange={(e) =>
            setRatingFilter(e.target.value === "all" ? "all" : (Number(e.target.value) as 1 | 2 | 3 | 4 | 5))
          }
          className={filterControlClass}
          aria-label={t("marketing.reviews.toolbar.ratingLabel", "Filtrovať podľa hodnotenia")}
        >
          <option value="all">{t("marketing.reviews.toolbar.ratingAll", "Všetky hodnotenia")}</option>
          {[5, 4, 3, 2, 1].map((value) => (
            <option key={value} value={value}>
              {t("marketing.reviews.toolbar.ratingValue", "{value} ★", { value })}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className={filterControlClass}
          aria-label={t("marketing.reviews.toolbar.statusLabel", "Filtrovať podľa stavu odpovede")}
        >
          <option value="all">{t("marketing.reviews.toolbar.statusAll", "Všetky stavy")}</option>
          <option value="unanswered">
            {t("marketing.reviews.toolbar.statusUnanswered", "Čaká na odpoveď")}
          </option>
          <option value="replied">{t("marketing.reviews.toolbar.statusReplied", "Zodpovedané")}</option>
        </select>

        <select
          value={sentimentFilter}
          onChange={(e) => setSentimentFilter(e.target.value as SentimentFilter)}
          className={filterControlClass}
          aria-label={t("marketing.reviews.toolbar.sentimentLabel", "Filtrovať podľa sentimentu")}
        >
          <option value="all">{t("marketing.reviews.allSentiments", "Všetky sentimenty")}</option>
          <option value="positive">{t("marketing.reviews.sentiment.positive", "Pozitívna")}</option>
          <option value="neutral">{t("marketing.reviews.sentiment.neutral", "Neutrálna")}</option>
          <option value="negative">{t("marketing.reviews.sentiment.negative", "Negatívna")}</option>
        </select>

        <select
          value={escalationFilter}
          onChange={(e) => setEscalationFilter(e.target.value as EscalationFilter)}
          className={filterControlClass}
          aria-label={t("marketing.reviews.toolbar.escalationLabel", "Filtrovať eskalované recenzie")}
        >
          <option value="all">{t("marketing.reviews.toolbar.escalationAll", "Bez eskalácie")}</option>
          <option value="escalated">
            {t("marketing.reviews.onlyEscalated", "Eskalované")}
          </option>
        </select>

        <Button
          type="button"
          size="sm"
          variant={sympathyOnly ? "default" : "outline"}
          className="h-9 gap-1.5 text-xs"
          aria-pressed={sympathyOnly}
          onClick={() => setSympathyOnly((current) => !current)}
          title={t(
            "marketing.reviews.toolbar.sympathyOnlyHint",
            "Zobraziť iba recenzie klientov, ktorým sú po úmrtí pacienta blokované výzvy na recenziu.",
          )}
        >
          <Heart className="h-3.5 w-3.5" aria-hidden="true" />
          {t("marketing.reviews.toolbar.sympathyOnly", "Iba Sympathy Gate")}
        </Button>

        {filtersActive ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 text-xs"
            onClick={clearFilters}
          >
            {t("marketing.reviews.toolbar.clearFilters", "Zrušiť filtre")}
          </Button>
        ) : null}

        <p className="text-xs text-muted-foreground sm:ml-auto" aria-live="polite">
          {reviewCountLabel(reviews.length, t)}
        </p>
      </PageToolbar>

      <KpiGrid className="sm:grid-cols-4">
        <KpiCard
          label={t("marketing.reviews.averageRating", "Priemerné hodnotenie")}
          icon={Star}
          tone="primary"
          value={kpiValue(stats.avg !== null ? `${stats.avg} / 5` : "—")}
        />
        <KpiCard
          label={t("marketing.reviews.totalReviews", "Recenzie spolu")}
          icon={MessageSquare}
          value={kpiValue(formatCount(stats.total))}
        />
        <KpiCard
          label={t("marketing.reviews.unansweredCount", "Čaká na odpoveď")}
          icon={Clock}
          tone={stats.unanswered > 0 ? "warning" : undefined}
          value={kpiValue(formatCount(stats.unanswered))}
          active={statusFilter === "unanswered"}
          onClick={() =>
            setStatusFilter((current) => (current === "unanswered" ? "all" : "unanswered"))
          }
        />
        <KpiCard
          label={t("marketing.reviews.kpi.sympathyBlocked", "Blokované výzvy (Sympathy Gate)")}
          icon={Heart}
          tone={stats.sympathyBlocked > 0 ? "muted" : undefined}
          value={kpiValue(formatCount(stats.sympathyBlocked))}
          active={sympathyOnly}
          onClick={() => setSympathyOnly((current) => !current)}
        />
      </KpiGrid>

      <section className="space-y-3" aria-labelledby="marketing-reviews-queue-heading">
        <h2 id="marketing-reviews-queue-heading" className="text-sm font-semibold text-foreground">
          {t("marketing.reviews.queue.heading", "Fronta recenzií")}
        </h2>

        {listQuery.isError ? (
          <QueryErrorState
            title={t("marketing.reviews.queue.loadError", "Recenzie sa nepodarilo načítať.")}
            onRetry={() => listQuery.refetch()}
          />
        ) : listQuery.isLoading ? (
          <div
            role="status"
            aria-label={t("marketing.reviews.queue.loading", "Načítavam recenzie...")}
          >
            <TableSkeleton rows={5} cols={TABLE_COLUMNS} />
          </div>
        ) : rawReviews.length === 0 ? (
          <EmptyState
            icon={Star}
            title={t("marketing.reviews.noReviews", "Žiadne recenzie.")}
            description={t(
              "marketing.reviews.queue.emptyDesc",
              "Zatiaľ nemáte žiadnu zaznamenanú recenziu z Google, Facebooku ani z interného formulára kliniky.",
            )}
            action={{
              label: t("marketing.reviews.addReview", "Pridať recenziu"),
              onClick: () => setIsAddDialogOpen(true),
              icon: Plus,
            }}
          />
        ) : reviews.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title={t(
              "marketing.reviews.queue.emptyFilteredTitle",
              "Filtrom nevyhovuje žiadna recenzia",
            )}
            description={t(
              "marketing.reviews.queue.emptyFilteredDesc",
              "Upravte vyhľadávanie, platformu alebo časový rozsah.",
            )}
            action={{
              label: t("marketing.reviews.toolbar.clearFilters", "Zrušiť filtre"),
              onClick: clearFilters,
            }}
          />
        ) : (
          <DataTableFrame>
            <table
              aria-labelledby="marketing-reviews-queue-heading"
              className="w-full text-xs"
            >
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className={tableHeadClass}>
                    {t("marketing.reviews.queue.colReviewer", "Recenzent")}
                  </th>
                  <th className={tableHeadClass}>
                    {t("marketing.reviews.rating", "Hodnotenie")}
                  </th>
                  <th className={tableHeadClass}>
                    {t("marketing.reviews.queue.colSentiment", "Sentiment")}
                  </th>
                  <th className={tableHeadClass}>
                    {t("marketing.reviews.date", "Dátum prijatia")}
                  </th>
                  <th className={tableHeadClass}>
                    {t("marketing.reviews.queue.colSla", "Odpoveď (SLA)")}
                  </th>
                  <th className={tableHeadClass}>
                    {t("marketing.reviews.queue.colSympathy", "Sympathy Gate")}
                  </th>
                  <th className={cn(tableHeadClass, "text-right")}>
                    <span className="sr-only">
                      {t("marketing.reviews.queue.colActions", "Akcie")}
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {reviews.map((review) => {
                  const isExpanded = expanded.has(review.id);
                  const isReplying = replyingTo === review.id;
                  const fullText = review.reviewText ?? "";
                  const sla = getSlaState(review, t);
                  const severity = severityLabel(review.severity, t);
                  const sympathyBlocked = isSympathyBlocked(review);

                  return (
                    <Fragment key={review.id}>
                      <tr
                        onClick={() => toggleExpand(review.id)}
                        aria-expanded={isExpanded}
                        className={cn(
                          tableRowClass,
                          "cursor-pointer",
                          isExpanded && "bg-primary/5 hover:bg-primary/10",
                        )}
                      >
                        <td className={tableCellClass}>
                          <div className="font-semibold text-foreground">
                            {review.reviewerName ||
                              t("marketing.reviews.queue.anonymous", "Anonym")}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <PlatformBadge platform={review.platform} t={t} />
                            {review.platform === "facebook" && (review.rating ?? 5) >= 4 ? (
                              <Badge variant="success" className="gap-1 text-[11px] font-medium">
                                <ThumbsUp className="h-3 w-3" aria-hidden="true" />
                                {t("marketing.reviews.facebookRecommends", "Odporúča kliniku")}
                              </Badge>
                            ) : null}
                          </div>
                        </td>
                        <td className={tableCellClass}>
                          <div className="flex items-center gap-1.5">
                            <StarRating rating={review.rating ?? 5} />
                            <span className="font-mono tabular-nums text-muted-foreground">
                              {review.rating ?? 5}/5
                            </span>
                          </div>
                        </td>
                        <td className={tableCellClass}>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <SentimentBadge review={review} t={t} />
                            {severity ? (
                              <Badge variant="warning" className="gap-1 text-[11px] font-medium">
                                <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                                {severity}
                              </Badge>
                            ) : null}
                            {review.escalationStatus === "escalated" ? (
                              <Badge
                                variant="outline"
                                className="gap-1 text-[11px] font-medium"
                                title={
                                  review.escalationReason
                                    ? t("marketing.reviews.queue.escalationReason", "Dôvod: {reason}", {
                                        reason: review.escalationReason,
                                      })
                                    : undefined
                                }
                              >
                                <ShieldAlert className="h-3 w-3" aria-hidden="true" />
                                {t("marketing.reviews.queue.escalated", "Eskalované")}
                              </Badge>
                            ) : null}
                          </div>
                        </td>
                        <td className={cn(tableCellClass, "font-mono tabular-nums")}>
                          {review.receivedAt ? formatDate(review.receivedAt, undefined, locale) : "—"}
                        </td>
                        <td className={tableCellClass}>
                          {sla ? (
                            <Badge
                              variant={sla.variant}
                              className="gap-1 text-[11px] font-medium"
                            >
                              {sla.status === "replied" ? (
                                <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                              ) : (
                                <Clock className="h-3 w-3" aria-hidden="true" />
                              )}
                              {sla.label}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className={tableCellClass}>
                          {sympathyBlocked ? (
                            <Badge
                              variant="secondary"
                              className="gap-1 text-[11px] font-medium"
                              title={t(
                                "marketing.reviews.queue.sympathyTitle",
                                "Klientovi po úmrtí zvieratka neodchádzajú marketingové výzvy na recenziu.",
                              )}
                            >
                              <Heart className="h-3 w-3" aria-hidden="true" />
                              {t("marketing.reviews.sympathy", "Ochrana súcitu")}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className={cn(tableCellClass, "text-right")}>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              aria-label={
                                isExpanded
                                  ? t("marketing.reviews.queue.collapse", "Zbaliť recenziu")
                                  : t("marketing.reviews.queue.expand", "Otvoriť recenziu")
                              }
                              onClick={(event) => {
                                event.stopPropagation();
                                toggleExpand(review.id);
                              }}
                            >
                              <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                              aria-label={t("marketing.reviews.deleteReview", "Zmazať recenziu")}
                              title={t("marketing.reviews.deleteReview", "Zmazať recenziu")}
                              onClick={(event) => {
                                event.stopPropagation();
                                askDelete(review);
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            </Button>
                          </div>
                        </td>
                      </tr>

                      {isExpanded ? (
                        <tr className="border-b border-border bg-muted/20">
                          <td colSpan={TABLE_COLUMNS} className="px-3 py-3 align-top">
                            <div className="space-y-3">
                              {fullText ? (
                                <p className="max-w-4xl whitespace-pre-wrap text-xs leading-relaxed text-foreground/90">
                                  {fullText}
                                </p>
                              ) : (
                                <p className="text-xs text-muted-foreground">
                                  {t("marketing.reviews.queue.noText", "Recenzia bez textu.")}
                                </p>
                              )}

                              {sympathyBlocked ? (
                                <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                                  <Heart className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                  {t(
                                    "marketing.reviews.queue.sympathyNote",
                                    "Žiadosť o recenziu bola blokovaná Sympathy Gate — klientovi po úmrtí pacienta neposielame žiadne marketingové výzvy.",
                                  )}
                                </p>
                              ) : null}

                              {review.replyText && !isReplying ? (
                                <div className="space-y-1.5 rounded-lg border-l-4 border-primary bg-card p-3">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                                      <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                                      {t("marketing.reviews.yourReply", "Odpoveď kliniky")}
                                    </span>
                                    {review.repliedAt ? (
                                      <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                                        {formatDate(review.repliedAt, undefined, locale)}
                                      </span>
                                    ) : null}
                                  </div>
                                  <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-foreground/80">
                                    {review.replyText}
                                  </p>
                                  <div className="flex items-center gap-3 pt-1">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 gap-1 px-2 text-[11px] text-muted-foreground"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        void copyReply(review.replyText || "");
                                      }}
                                    >
                                      <Copy className="h-3 w-3" aria-hidden="true" />
                                      {t("marketing.reviews.copyReply", "Kopírovať odpoveď")}
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 gap-1 px-2 text-[11px] text-muted-foreground"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        startReply(review, review.replyText || "");
                                      }}
                                    >
                                      <Pencil className="h-3 w-3" aria-hidden="true" />
                                      {t("marketing.reviews.queue.editReply", "Upraviť odpoveď")}
                                    </Button>
                                  </div>
                                </div>
                              ) : null}

                              {isReplying ? (
                                <div className="space-y-3">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="text-[11px] font-semibold text-muted-foreground">
                                      {t("marketing.reviews.quickReplies", "Rýchle predpripravené odpovede:")}
                                    </span>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      className="h-7 gap-1 px-2 text-[11px]"
                                      disabled={generateReplyMutation.isPending}
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        requestAiReply(review);
                                      }}
                                    >
                                      {generateReplyMutation.isPending ? (
                                        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                                      ) : (
                                        <Sparkles className="h-3 w-3" aria-hidden="true" />
                                      )}
                                      {t("marketing.reviews.aiSuggest", "AI návrh odpovede")}
                                    </Button>
                                  </div>

                                  <div className="grid gap-1.5 sm:grid-cols-2">
                                    {cannedResponses.map((canned) => (
                                      <Button
                                        key={canned.label}
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-auto justify-start truncate p-2 text-left text-[11px] font-normal"
                                        title={canned.text}
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          setReplyText(canned.text);
                                        }}
                                      >
                                        {canned.label}
                                      </Button>
                                    ))}
                                  </div>

                                  <Textarea
                                    rows={3}
                                    maxLength={REVIEW_REPLY_MAX_LENGTH}
                                    placeholder={t(
                                      "marketing.reviews.replyPlaceholder",
                                      "Napíšte oficiálnu odpoveď na recenziu...",
                                    )}
                                    value={replyText}
                                    onChange={(e) => setReplyText(e.target.value)}
                                    onClick={(event) => event.stopPropagation()}
                                    className="text-xs"
                                  />

                                  <div className="flex flex-wrap justify-end gap-2">
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      className="h-8 text-xs"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        setReplyingTo(null);
                                        setReplyText("");
                                      }}
                                    >
                                      {t("common.cancel", "Zrušiť")}
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="secondary"
                                      className="h-8 gap-1 text-xs"
                                      disabled={!replyText.trim() || replyMutation.isPending}
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        replyMutation.mutate({ id: review.id, replyText });
                                      }}
                                    >
                                      {replyMutation.isPending ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                                      ) : null}
                                      {t("marketing.reviews.send", "Uložiť odpoveď")}
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      className="h-8 gap-1.5 text-xs"
                                      disabled={
                                        !replyText.trim() || approveReviewReplyMutation.isPending
                                      }
                                      onClick={async (event) => {
                                        event.stopPropagation();
                                        await copyReply(replyText.trim());
                                        approveReviewReplyMutation.mutate({
                                          id: review.id,
                                          approvedReplyText: replyText.trim(),
                                        });
                                      }}
                                    >
                                      {approveReviewReplyMutation.isPending ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                                      ) : (
                                        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                                      )}
                                      {t("marketing.reviews.copyAndApprove", "Kopírovať a označiť za vybavené")}
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex flex-wrap items-center gap-2">
                                    {!review.replyText ? (
                                      <>
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          className="h-8 gap-1.5 text-xs"
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            startReply(review, "");
                                          }}
                                        >
                                          <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                                          {t("marketing.reviews.reply", "Odpovedať")}
                                        </Button>
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          className="h-8 gap-1.5 text-xs"
                                          disabled={generateReplyMutation.isPending}
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            startReply(review, "");
                                            requestAiReply(review);
                                          }}
                                        >
                                          {generateReplyMutation.isPending ? (
                                            <Loader2
                                              className="h-3.5 w-3.5 animate-spin"
                                              aria-hidden="true"
                                            />
                                          ) : (
                                            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                                          )}
                                          {t("marketing.reviews.aiGenerate", "Generovať AI odpoveď")}
                                        </Button>
                                      </>
                                    ) : null}
                                  </div>

                                  {review.escalationStatus !== "escalated" ? (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      className="h-8 gap-1 text-xs"
                                      title={t(
                                        "marketing.reviews.queue.escalateTitle",
                                        "Eskalovať recenziu na personál (vytvoriť úlohu)",
                                      )}
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        setEscalatingReview(review);
                                        setEscalateReason("");
                                        setIsEscalateModalOpen(true);
                                      }}
                                    >
                                      <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                                      {t("marketing.reviews.queue.escalate", "Eskalovať")}
                                    </Button>
                                  ) : null}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </DataTableFrame>
        )}
      </section>

      {isAddDialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="marketing-reviews-add-title"
            className="grid w-full max-w-lg gap-4 rounded-xl border border-border bg-background p-6 shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 id="marketing-reviews-add-title" className="text-lg font-bold text-foreground">
                {t("marketing.reviews.dialog.addTitle", "Pridať novú recenziu")}
              </h2>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                aria-label={t("common.cancel", "Zrušiť")}
                onClick={() => setIsAddDialogOpen(false)}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <span className="font-semibold text-foreground">
                  {t("marketing.reviews.platform", "Platforma")}
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { value: "google" as const, label: t("marketing.reviews.platformGoogle", "Google") },
                      {
                        value: "facebook" as const,
                        label: t("marketing.reviews.platformFacebook", "Facebook"),
                      },
                      {
                        value: "internal" as const,
                        label: t("marketing.reviews.platformInternal", "Interné"),
                      },
                    ]
                  ).map((option) => (
                    <Button
                      key={option.value}
                      type="button"
                      size="sm"
                      variant={newPlatform === option.value ? "default" : "outline"}
                      className="h-9 text-xs"
                      aria-pressed={newPlatform === option.value}
                      onClick={() => setNewPlatform(option.value)}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="marketing-reviews-new-name" className="font-semibold text-foreground">
                  {t("marketing.reviews.reviewerName", "Meno recenzenta / klienta")}
                </label>
                <Input
                  id="marketing-reviews-new-name"
                  value={newName}
                  maxLength={REVIEWER_NAME_MAX_LENGTH}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={t(
                    "marketing.reviews.dialog.reviewerPlaceholder",
                    "Meno klienta z recenzie",
                  )}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <span
                  id="marketing-reviews-new-rating-label"
                  className="font-semibold text-foreground"
                >
                  {t("marketing.reviews.dialog.ratingLabel", "Hodnotenie (1 až 5 hviezdičiek)")}
                </span>
                <div
                  role="radiogroup"
                  aria-labelledby="marketing-reviews-new-rating-label"
                  className="flex items-center gap-1"
                >
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Button
                      key={star}
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      role="radio"
                      aria-checked={newRating === star}
                      aria-label={t("marketing.reviews.toolbar.ratingValue", "{value} ★", {
                        value: star,
                      })}
                      onClick={() => setNewRating(star)}
                    >
                      <Star
                        className={cn(
                          "h-5 w-5",
                          star <= newRating
                            ? "fill-amber-400 text-amber-400"
                            : "text-muted-foreground/30",
                        )}
                        aria-hidden="true"
                      />
                    </Button>
                  ))}
                  <span className="ml-2 font-mono text-xs tabular-nums text-muted-foreground">
                    {newRating} / 5
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="marketing-reviews-new-text" className="font-semibold text-foreground">
                  {t("marketing.reviews.reviewText", "Text recenzie")}
                </label>
                <Textarea
                  id="marketing-reviews-new-text"
                  rows={4}
                  maxLength={REVIEW_TEXT_MAX_LENGTH}
                  value={newText}
                  onChange={(e) => setNewText(e.target.value)}
                  placeholder={t(
                    "marketing.reviews.dialog.reviewTextPlaceholder",
                    "Vložte text hodnotenia alebo odporúčania od klienta...",
                  )}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="marketing-reviews-new-reply"
                  className="font-semibold text-muted-foreground"
                >
                  {t("marketing.reviews.dialog.replyOptional", "Odpoveď kliniky (nepovinné)")}
                </label>
                <Textarea
                  id="marketing-reviews-new-reply"
                  rows={2}
                  maxLength={REVIEW_REPLY_MAX_LENGTH}
                  value={newReply}
                  onChange={(e) => setNewReply(e.target.value)}
                  placeholder={t(
                    "marketing.reviews.dialog.replyPlaceholder",
                    "Ak už klinika na recenziu odpovedala, zadajte odpoveď tu...",
                  )}
                  className="text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-border pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => setIsAddDialogOpen(false)}
              >
                {t("common.cancel", "Zrušiť")}
              </Button>
              <Button
                type="button"
                size="sm"
                className="gap-1 text-xs"
                disabled={!newName.trim() || !newText.trim() || createReviewMutation.isPending}
                onClick={() =>
                  createReviewMutation.mutate({
                    platform: newPlatform,
                    reviewerName: newName.trim(),
                    rating: newRating,
                    reviewText: newText.trim(),
                    replyText: newReply.trim() || undefined,
                  })
                }
              >
                {createReviewMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : null}
                {t("marketing.reviews.dialog.save", "Uložiť recenziu")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {isEscalateModalOpen && escalatingReview ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="marketing-reviews-escalate-title"
            className="w-full max-w-md space-y-4 rounded-xl border border-border bg-card p-5 shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2
                id="marketing-reviews-escalate-title"
                className="flex items-center gap-2 text-base font-bold text-foreground"
              >
                <ShieldAlert className="h-5 w-5" aria-hidden="true" />
                {t("marketing.reviews.dialog.escalateTitle", "Eskalovať recenziu na personál")}
              </h2>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                aria-label={t("common.cancel", "Zrušiť")}
                onClick={() => setIsEscalateModalOpen(false)}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>

            <p className="text-xs leading-relaxed text-muted-foreground">
              {t(
                "marketing.reviews.dialog.escalateDescription",
                "Eskaláciou sa vytvorí interná úloha pre personál na bezodkladné kontaktovanie klienta a vyriešenie situácie.",
              )}
            </p>

            <div className="space-y-1 rounded-lg border border-border bg-muted/40 p-3 text-xs">
              <div className="font-semibold text-foreground">
                {escalatingReview.reviewerName ??
                  t("marketing.reviews.queue.anonymous", "Anonym")}{" "}
                ({escalatingReview.rating ?? 1}★)
              </div>
              <div className="line-clamp-2 italic text-muted-foreground">
                {escalatingReview.reviewText}
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="marketing-reviews-escalate-reason" className="text-xs font-semibold text-foreground">
                {t("marketing.reviews.dialog.escalateReasonLabel", "Dôvod eskalácie (povinné)")}
              </label>
              <Textarea
                id="marketing-reviews-escalate-reason"
                rows={3}
                maxLength={REVIEW_REPLY_MAX_LENGTH}
                value={escalateReason}
                onChange={(e) => setEscalateReason(e.target.value)}
                placeholder={t(
                  "marketing.reviews.dialog.escalateReasonPlaceholder",
                  "Napr.: Klient vyjadruje nespokojnosť s čakacou dobou a žiada spätné volanie...",
                )}
                className="text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 border-t border-border pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => setIsEscalateModalOpen(false)}
              >
                {t("common.cancel", "Zrušiť")}
              </Button>
              <Button
                type="button"
                size="sm"
                className="gap-1 text-xs"
                disabled={!escalateReason.trim() || escalateReviewMutation.isPending}
                onClick={() =>
                  escalateReviewMutation.mutate({
                    id: escalatingReview.id,
                    reason: escalateReason.trim(),
                  })
                }
              >
                {escalateReviewMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : null}
                <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                {t("marketing.reviews.dialog.escalateSubmit", "Potvrdiť eskaláciu")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
