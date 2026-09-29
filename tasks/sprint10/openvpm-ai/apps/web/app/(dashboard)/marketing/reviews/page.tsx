"use client";

import { useMemo, useState } from "react";
import {
  Star,
  Heart,
  MessageSquare,
  Sparkles,
  Loader2,
  Plus,
  Trash2,
  ThumbsUp,
  Search,
  RefreshCw,
  X,
  Filter,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Copy,
  Globe,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { PageHeader } from "@/components/layout/page-header";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { EmptyState } from "@/components/common/empty-state";

// ── Icons ────────────────────────────────────────────────────────────────────

function GoogleIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
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

function FacebookIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="#1877F2">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function StarRating({ rating, size = "w-4 h-4" }: { rating: number; size?: string }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`${size} ${
            star <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"
          }`}
        />
      ))}
    </div>
  );
}

// ── Canned quick replies ─────────────────────────────────────────────────────

const CANNED_RESPONSES = [
  {
    label: "Vďaka & Dôvera (Všeobecná)",
    text: "Ďakujeme za milé slová a dôveru v náš tím pri starostlivosti o vášho miláčika! Veľmi si to vážime. S úctou, tím veterinárnej kliniky.",
  },
  {
    label: "Pooperačná rekonvalescencia",
    text: "Veľmi si vážime vašu spätnú väzbu. Sme nesmierne radi, že ošetrenie i rekonvalescencia prebehli bez komplikácií a pacientovi sa darí výborne! 🐾",
  },
  {
    label: "Pohotovosť & Akútny stav",
    text: "Ďakujeme za pochopenie pri náročnom ošetrení. Rýchla reakcia a záchrana života zvieracieho pacienta sú pre nás prioritou. Prajeme veľa zdravia celej rodine!",
  },
  {
    label: "Konštruktívne riešenie nespokojnosti",
    text: "Ďakujeme za hodnotenie. Veľmi nás mrzí vaša nespokojnosť – záleží nám na každom pacientovi. Prosím kontaktujte vedenie kliniky, radi situáciu osobne preveríme a vyriešime.",
  },
  {
    label: "Facebook odporúčanie",
    text: "Ďakujeme za milé odporúčanie na Facebooku! Spokojnosť chovateľov a zdravie vašich štvornohých parťákov je pre náš kolektív najväčšou odmenou. ❤️🐾",
  },
];

function getSlaStatus(review: {
  receivedAt: string | Date | null;
  repliedAt: string | Date | null;
  replyText: string | null;
}) {
  if (review.replyText || review.repliedAt) {
    if (review.receivedAt && review.repliedAt) {
      const hours = Math.max(
        0,
        Math.round(
          (new Date(review.repliedAt).getTime() -
            new Date(review.receivedAt).getTime()) /
            (1000 * 60 * 60)
        )
      );
      return {
        status: "replied",
        label: `Zodpovedané za ${hours}h`,
        className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300",
      };
    }
    return {
      status: "replied",
      label: "Zodpovedané",
      className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300",
    };
  }
  if (!review.receivedAt) return null;
  const hoursPassed =
    (Date.now() - new Date(review.receivedAt).getTime()) / (1000 * 60 * 60);
  if (hoursPassed > 24) {
    return {
      status: "overdue",
      label: `SLA po termíne (${Math.round(hoursPassed)}h > 24h)`,
      className: "bg-destructive/15 text-destructive border-destructive/30",
    };
  }
  const remainingHours = Math.max(1, Math.round(24 - hoursPassed));
  return {
    status: "pending",
    label: `SLA: ${remainingHours}h do termínu`,
    className: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300",
  };
}

export default function ReviewsPage() {
  const { t } = useI18n();

  // Filters state
  const [platformFilter, setPlatformFilter] = useState<"all" | "google" | "facebook" | "internal">("all");
  const [ratingFilter, setRatingFilter] = useState<"all" | 1 | 2 | 3 | 4 | 5>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "unanswered" | "replied">("all");
  const [sentimentFilter, setSentimentFilter] = useState<"all" | "positive" | "neutral" | "negative" | "mixed">("all");
  const [escalationFilter, setEscalationFilter] = useState<"all" | "none" | "pending" | "escalated" | "resolved" | "wont_fix">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Interaction state
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  // Escalation modal state
  const [escalatingReview, setEscalatingReview] = useState<any | null>(null);
  const [escalateReason, setEscalateReason] = useState("");
  const [isEscalateModalOpen, setIsEscalateModalOpen] = useState(false);

  // New review form state
  const [newPlatform, setNewPlatform] = useState<"google" | "facebook" | "internal">("google");
  const [newName, setNewName] = useState("");
  const [newRating, setNewRating] = useState(5);
  const [newText, setNewText] = useState("");
  const [newReply, setNewReply] = useState("");

  const utils = trpc.useUtils();

  // Queries & Mutations
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
      toast.success("Odpoveď na recenziu bola uložená.");
    },
    onError: (err) => {
      toast.error(err.message || "Nepodarilo sa uložiť odpoveď.");
    },
  });

  const approveReviewReplyMutation = trpc.extensions.marketing.approveReviewReply.useMutation({
    onSuccess: () => {
      setReplyingTo(null);
      setReplyText("");
      utils.extensions.marketing.listReviews.invalidate();
      toast.success(t("marketing.reviews.approveSuccess", "Odpoveď bola oficiálne schválená a publikovaná."));
    },
    onError: (err) => {
      toast.error(err.message || "Nepodarilo sa schváliť odpoveď.");
    },
  });

  const escalateReviewMutation = trpc.extensions.marketing.escalateReview.useMutation({
    onSuccess: () => {
      setIsEscalateModalOpen(false);
      setEscalateReason("");
      setEscalatingReview(null);
      utils.extensions.marketing.listReviews.invalidate();
      toast.success(t("marketing.reviews.escalateSuccess", "Recenzia bola úspešne eskalovaná na personál."));
    },
    onError: (err) => {
      toast.error(err.message || "Nepodarilo sa eskalovať recenziu.");
    },
  });

  const generateReplyMutation = trpc.extensions.marketing.generateReviewReply.useMutation({
    onSuccess: (data) => {
      if (data?.reply) {
        setReplyText(data.reply);
        toast.success("AI navrhla odpoveď na recenziu.");
      }
    },
    onError: (err) => {
      toast.error(err.message || "Nepodarilo sa vygenerovať AI odpoveď.");
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
      toast.success("Nová recenzia bola pridaná.");
    },
    onError: (err) => {
      toast.error(err.message || "Nepodarilo sa pridať recenziu.");
    },
  });

  const deleteReviewMutation = trpc.extensions.marketing.deleteReview.useMutation({
    onSuccess: () => {
      utils.extensions.marketing.listReviews.invalidate();
      toast.success("Recenzia bola zmazaná.");
    },
    onError: (err) => {
      toast.error(err.message || "Nepodarilo sa zmazať recenziu.");
    },
  });

  const seedMutation = trpc.extensions.marketing.seedReviews.useMutation({
    onSuccess: (res) => {
      utils.extensions.marketing.listReviews.invalidate();
      toast.success(res.message || "Vzorové Google a Facebook recenzie boli úspešne načítané.");
    },
    onError: (err) => {
      toast.error(err.message || "Nepodarilo sa načítať vzorové recenzie.");
    },
  });

  const toggleExpand = (id: string) => {
    const newSet = new Set(expanded);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpanded(newSet);
  };

  const rawReviews = useMemo(() => listQuery.data ?? [], [listQuery.data]);

  // Filter in-memory by rating, status, and search query
  const reviews = useMemo(() => {
    let result = rawReviews;
    if (ratingFilter !== "all") {
      result = result.filter((r) => (r.rating ?? 5) === ratingFilter);
    }
    if (statusFilter === "replied") {
      result = result.filter((r) => Boolean(r.replyText));
    } else if (statusFilter === "unanswered") {
      result = result.filter((r) => !r.replyText);
    }
    if (!searchQuery.trim()) return result;
    const q = searchQuery.toLowerCase();
    return result.filter(
      (r) =>
        (r.reviewerName || "").toLowerCase().includes(q) ||
        (r.reviewText && r.reviewText.toLowerCase().includes(q))
    );
  }, [rawReviews, ratingFilter, statusFilter, searchQuery]);

  // Statistics calculation
  const stats = useMemo(() => {
    const total = rawReviews.length;
    if (total === 0) {
      return {
        avg: "0.0",
        total: 0,
        unanswered: 0,
        googleTotal: 0,
        googleAvg: "0.0",
        facebookTotal: 0,
        facebookAvg: "0.0",
        internalTotal: 0,
        internalAvg: "0.0",
        counts: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
      };
    }

    const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let sum = 0;
    let unanswered = 0;

    let googleSum = 0;
    let googleCount = 0;
    let fbSum = 0;
    let fbCount = 0;
    let internalSum = 0;
    let internalCount = 0;

    for (const r of rawReviews) {
      const star = Math.min(5, Math.max(1, r.rating || 5)) as 1 | 2 | 3 | 4 | 5;
      counts[star]++;
      sum += r.rating ?? 5;
      if (!r.replyText) unanswered++;

      if (r.platform === "facebook") {
        fbSum += r.rating ?? 5;
        fbCount++;
      } else if (r.platform === "internal") {
        internalSum += r.rating ?? 5;
        internalCount++;
      } else {
        googleSum += r.rating ?? 5;
        googleCount++;
      }
    }

    return {
      avg: (sum / total).toFixed(1),
      total,
      unanswered,
      googleTotal: googleCount,
      googleAvg: googleCount > 0 ? (googleSum / googleCount).toFixed(1) : "0.0",
      facebookTotal: fbCount,
      facebookAvg: fbCount > 0 ? (fbSum / fbCount).toFixed(1) : "0.0",
      internalTotal: internalCount,
      internalAvg: internalCount > 0 ? (internalSum / internalCount).toFixed(1) : "0.0",
      counts,
    };
  }, [rawReviews]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <Star className="w-6 h-6 text-amber-500 fill-amber-500" />
            {t("marketing.reviews.title", "Recenzie (Google & Facebook)")}
          </span>
        }
        subtitle={t(
          "marketing.reviews.description",
          "Správa, štatistiky a odpovedanie na Google a Facebook recenzie kliniky. Žiadosti o recenziu sa po úmrtí pacienta automaticky blokujú (Sympathy Gate)."
        )}
      />

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Platform Tabs */}
          <div className="inline-flex rounded-lg border bg-muted/40 p-1">
            <button
              type="button"
              onClick={() => setPlatformFilter("all")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                platformFilter === "all"
                  ? "bg-background text-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("marketing.reviews.platformAll", "Všetky platformy")}
            </button>
            <button
              type="button"
              onClick={() => setPlatformFilter("google")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 cursor-pointer ${
                platformFilter === "google"
                  ? "bg-background text-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <GoogleIcon className="w-3.5 h-3.5" />
              Google ({stats.googleTotal})
            </button>
            <button
              type="button"
              onClick={() => setPlatformFilter("facebook")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 cursor-pointer ${
                platformFilter === "facebook"
                  ? "bg-background text-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <FacebookIcon className="w-3.5 h-3.5" />
              Facebook ({stats.facebookTotal})
            </button>
            <button
              type="button"
              onClick={() => setPlatformFilter("internal")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 cursor-pointer ${
                platformFilter === "internal"
                  ? "bg-background text-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Globe className="w-3.5 h-3.5 text-indigo-500" />
              Interné ({stats.internalTotal})
            </button>
          </div>

          {/* Rating Filter (1-5 Stars) */}
          <div className="flex items-center gap-1 p-1 bg-muted/40 rounded-lg border border-border/40">
            <span className="text-xs font-medium text-muted-foreground px-2">Hodnotenie:</span>
            <button
              type="button"
              onClick={() => setRatingFilter("all")}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                ratingFilter === "all"
                  ? "bg-background text-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Všetky
            </button>
            {([5, 4, 3, 2, 1] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRatingFilter(ratingFilter === r ? "all" : r)}
                className={`px-2 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-0.5 cursor-pointer ${
                  ratingFilter === r
                    ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 font-bold shadow-sm"
                    : "text-muted-foreground hover:text-amber-500"
                }`}
              >
                <span>{r}</span>
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1 p-1 bg-muted/40 rounded-lg border border-border/40">
            <span className="text-xs font-medium text-muted-foreground px-2">Stav:</span>
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                statusFilter === "all"
                  ? "bg-background text-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Všetky
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("unanswered")}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer flex items-center gap-1 ${
                statusFilter === "unanswered"
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-semibold"
                  : "text-muted-foreground hover:text-amber-600"
              }`}
            >
              <Clock className="w-3 h-3" />
              Čaká na odpoveď
              {stats.unanswered > 0 && (
                <Badge variant="secondary" className="text-[10px] px-1 py-0 ml-0.5">
                  {stats.unanswered}
                </Badge>
              )}
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("replied")}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer flex items-center gap-1 ${
                statusFilter === "replied"
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-semibold"
                  : "text-muted-foreground hover:text-emerald-600"
              }`}
            >
              <CheckCircle2 className="w-3 h-3" />
              Zodpovedané
            </button>
          </div>
        </div>

        {/* Sentiment & Search row */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-muted/40 rounded-lg border border-border/40">
            <button
              type="button"
              onClick={() => setSentimentFilter("all")}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                sentimentFilter === "all"
                  ? "bg-background text-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("marketing.reviews.allSentiments", "Všetky sentimenty")}
            </button>
            <button
              type="button"
              onClick={() => setSentimentFilter("positive")}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                sentimentFilter === "positive"
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-semibold"
                  : "text-muted-foreground hover:text-emerald-600"
              }`}
            >
              Pozitívne
            </button>
            <button
              type="button"
              onClick={() => setSentimentFilter("negative")}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                sentimentFilter === "negative"
                  ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 font-semibold"
                  : "text-muted-foreground hover:text-rose-600"
              }`}
            >
              Negatívne
            </button>
            <button
              type="button"
              onClick={() => setEscalationFilter(escalationFilter === "escalated" ? "all" : "escalated")}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer flex items-center gap-1 ${
                escalationFilter === "escalated"
                  ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 font-semibold"
                  : "text-muted-foreground hover:text-purple-600"
              }`}
            >
              <ShieldAlert className="w-3 h-3" />
              {t("marketing.reviews.onlyEscalated", "Eskalované")}
            </button>
          </div>

          <div className="relative flex-1 sm:max-w-xs">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("marketing.reviews.filterSearch", "Hľadať v recenziách...")}
              className="h-8 pl-8 text-xs bg-background"
            />
          </div>
        </div>
      </div>

      {/* Reviews List */}
      {listQuery.isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="h-44 w-full animate-pulse rounded-xl bg-muted/60" />
          <div className="h-44 w-full animate-pulse rounded-xl bg-muted/60" />
        </div>
      ) : reviews.length === 0 ? (
        <EmptyState
          icon={Star}
          title={t("marketing.reviews.noReviews", "Žiadne recenzie.")}
          description={
            platformFilter !== "all"
              ? `V kategórii ${platformFilter === "google" ? "Google" : "Facebook"} zatiaľ nemáte žiadne recenzie.`
              : "Kliknite na tlačidlo 'Vzorové recenzie' vyššie pre okamžité nahratie reálnych recenzií."
          }
          action={{
            label: "Načítať vzorové recenzie (Google & Facebook)",
            onClick: () => seedMutation.mutate({ force: true }),
            icon: RefreshCw,
          }}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {reviews.map((review) => {
            const isExpanded = expanded.has(review.id);
            const fullText = review.reviewText ?? "";
            const isLongText = fullText.length > 180;
            const displayText =
              !isExpanded && isLongText ? fullText.substring(0, 180) + "..." : fullText;
            const isReplying = replyingTo === review.id;
            const isFacebook = review.platform === "facebook";

            return (
              <div
                key={review.id}
                className="rounded-xl border bg-card p-5 shadow-sm space-y-4 flex flex-col justify-between hover:shadow-md transition-shadow"
              >
                <div className="space-y-3">
                  {/* Review Top Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      {/* Avatar initials */}
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs ${
                          isFacebook
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                        }`}
                      >
                        {((review.reviewerName || "Anonym").slice(0, 2)).toUpperCase()}
                      </div>

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-sm text-foreground">
                            {review.reviewerName || "Anonym"}
                          </h3>

                          {/* Platform Badge */}
                          {isFacebook ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] gap-1 py-0 px-1.5 bg-blue-50/60 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                            >
                              <FacebookIcon className="w-3 h-3" />
                              Facebook
                            </Badge>
                          ) : review.platform === "internal" ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] gap-1 py-0 px-1.5 bg-purple-50/60 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800"
                            >
                              <Globe className="w-3 h-3 text-purple-600" />
                              Interné
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-[10px] gap-1 py-0 px-1.5 bg-amber-50/60 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                            >
                              <GoogleIcon className="w-3 h-3" />
                              Google
                            </Badge>
                          )}

                          {isFacebook && (review.rating ?? 5) >= 4 && (
                            <Badge
                              variant="secondary"
                              className="text-[10px] gap-1 py-0 px-1.5 bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
                            >
                              <ThumbsUp className="w-2.5 h-2.5" />
                              Odporúča
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-2 mt-1">
                          <StarRating rating={review.rating ?? 5} />
                          <span className="text-[11px] text-muted-foreground">
                            {review.receivedAt
                              ? new Date(review.receivedAt).toLocaleDateString("sk-SK", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })
                              : ""}
                          </span>
                        </div>

                        {/* Sentiment, Severity, Escalation & SLA Badges */}
                        <div className="flex items-center gap-1.5 flex-wrap mt-2">
                          {(() => {
                            const isEscalated = review.escalationStatus === "escalated";
                            const isNegative =
                              review.sentimentLabel === "negative" ||
                              (review.rating != null && review.rating <= 2);
                            const isPositive =
                              review.sentimentLabel === "positive" ||
                              (review.rating != null && review.rating >= 4);

                            if (isEscalated || isNegative) {
                              return (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] px-1.5 py-0 gap-1 bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/40 font-semibold"
                                >
                                  <AlertTriangle className="w-2.5 h-2.5" />
                                  {isEscalated ? "Negatívna / Eskalácia" : "Negatívna"}
                                  {review.sentimentScore != null &&
                                    ` (${review.sentimentScore > 0 ? "+" : ""}${review.sentimentScore}%)`}
                                </Badge>
                              );
                            }

                            if (isPositive) {
                              return (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] px-1.5 py-0 gap-1 bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 font-medium"
                                >
                                  <Sparkles className="w-2.5 h-2.5 text-emerald-500" />
                                  Pozitívna
                                  {review.sentimentScore != null &&
                                    ` (+${review.sentimentScore}%)`}
                                </Badge>
                              );
                            }

                            return (
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1.5 py-0 gap-1 bg-slate-50 text-slate-700 border-slate-300 dark:bg-slate-900"
                              >
                                Neutrálna
                              </Badge>
                            );
                          })()}

                          {review.severity && review.severity !== "none" && (
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-1.5 py-0 gap-1 ${
                                review.severity === "critical"
                                  ? "bg-red-100 text-red-800 border-red-300 dark:bg-red-950/50 font-bold"
                                  : review.severity === "high"
                                  ? "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950/50 font-semibold"
                                  : "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/50"
                              }`}
                            >
                              <AlertTriangle className="w-2.5 h-2.5" />
                              {review.severity === "critical"
                                ? "Kritická závažnosť"
                                : review.severity === "high"
                                ? "Vysoká závažnosť"
                                : "Stredná závažnosť"}
                            </Badge>
                          )}

                          {review.escalationStatus === "escalated" && (
                            <Badge
                              variant="secondary"
                              className="text-[10px] px-1.5 py-0 gap-1 bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/50 font-semibold"
                              title={
                                review.escalationReason
                                  ? `Dôvod: ${review.escalationReason}`
                                  : undefined
                              }
                            >
                              <ShieldAlert className="w-2.5 h-2.5 text-purple-600" />
                              Eskalované personálu
                            </Badge>
                          )}

                          {(() => {
                            const sla = getSlaStatus(review);
                            if (!sla) return null;
                            return (
                              <Badge
                                variant={
                                  sla.status === "overdue"
                                    ? "destructive"
                                    : "outline"
                                }
                                className={`text-[10px] px-1.5 py-0 gap-1 ${sla.className}`}
                              >
                                <Clock className="w-2.5 h-2.5" />
                                {sla.label}
                              </Badge>
                            );
                          })()}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {review.requestBlockedReason === "sympathy_gate" && (
                        <Badge
                          variant="secondary"
                          className="gap-1 bg-purple-100 text-purple-800 border-purple-200 text-[10px]"
                          title="Klientovi po úmrtí zvieratka neodchádzajú marketingové výzvy na recenziu"
                        >
                          <Heart className="h-3 w-3 fill-purple-600 text-purple-600" />
                          {t("marketing.reviews.sympathy", "Ochrana súcitu")}
                        </Badge>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(t("marketing.reviews.deleteConfirm", "Naozaj chcete zmazať túto recenziu?"))) {
                            deleteReviewMutation.mutate({ id: review.id });
                          }
                        }}
                        className="text-muted-foreground hover:text-destructive p-1 rounded-md transition-colors cursor-pointer"
                        title="Zmazať recenziu"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Review Text */}
                  {review.reviewText && (
                    <div className="text-xs text-foreground/90 leading-relaxed bg-muted/20 p-3 rounded-lg border border-border/40">
                      <p className="whitespace-pre-wrap">{displayText}</p>
                      {isLongText && (
                        <button
                          type="button"
                          onClick={() => toggleExpand(review.id)}
                          className="text-xs text-primary font-semibold hover:underline mt-1.5 cursor-pointer block"
                        >
                          {isExpanded
                            ? t("marketing.reviews.showLess", "Zobraziť menej")
                            : t("marketing.reviews.showMore", "Zobraziť viac")}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Existing Clinic Reply */}
                  {review.replyText && !isReplying && (
                    <div className="rounded-lg bg-muted/50 p-3.5 border-l-4 border-primary text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-semibold text-primary">
                          <MessageSquare className="h-3.5 w-3.5" />
                          <span>{t("marketing.reviews.yourReply", "Odpoveď kliniky")}</span>
                        </div>
                        {review.repliedAt && (
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(review.repliedAt).toLocaleDateString("sk-SK")}
                          </span>
                        )}
                      </div>
                      <p className="text-foreground/80 whitespace-pre-wrap text-[11px] leading-relaxed">
                        {review.replyText}
                      </p>
                      <div className="pt-1 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(review.replyText || "");
                              toast.success("Odpoveď bola skopírovaná do schránky.");
                            } catch {
                              toast.error("Nepodarilo sa skopírovať.");
                            }
                          }}
                          className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer"
                        >
                          <Copy className="w-3 h-3" />
                          Kopírovať odpoveď
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setReplyingTo(review.id);
                            setReplyText(review.replyText || "");
                          }}
                          className="text-[11px] text-muted-foreground hover:text-primary underline cursor-pointer"
                        >
                          Upraviť odpoveď
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Reply Form / Actions */}
                <div className="pt-3 border-t">
                  {isReplying ? (
                    <div className="space-y-3">
                      {/* AI & Canned Tools Header */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold text-muted-foreground">
                          {t("marketing.reviews.quickReplies", "Rýchle predpripravené odpovede:")}
                        </span>

                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            generateReplyMutation.mutate({
                              reviewId: review.id,
                              platform: (review.platform as "google" | "facebook" | "internal") || "google",
                              reviewerName: review.reviewerName || "Klient",
                              rating: review.rating ?? 5,
                              reviewText: review.reviewText || "",
                              tone: (review.rating ?? 5) < 3 ? "apologetic" : "warm",
                            })
                          }
                          disabled={generateReplyMutation.isPending}
                          className="h-7 text-[11px] text-primary gap-1 px-2"
                        >
                          {generateReplyMutation.isPending ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Sparkles className="w-3 h-3 text-amber-500" />
                          )}
                          {t("marketing.reviews.aiSuggest", "AI návrh odpovede")}
                        </Button>
                      </div>

                      {/* Canned responses buttons */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {CANNED_RESPONSES.map((canned, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setReplyText(canned.text)}
                            className="text-left text-[11px] p-2 rounded-lg border bg-muted/20 hover:bg-muted text-foreground/90 transition-colors cursor-pointer line-clamp-1"
                            title={canned.text}
                          >
                            ⭐ {canned.label}
                          </button>
                        ))}
                      </div>

                      <Textarea
                        rows={3}
                        placeholder={t(
                          "marketing.reviews.replyPlaceholder",
                          "Napíšte oficiálnu odpoveď na recenziu..."
                        )}
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        className="text-xs"
                      />

                      <div className="flex flex-wrap gap-2 justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setReplyingTo(null);
                            setReplyText("");
                          }}
                          className="text-xs h-8"
                        >
                          {t("common.cancel", "Zrušiť")}
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={!replyText.trim() || replyMutation.isPending}
                          onClick={() => replyMutation.mutate({ id: review.id, replyText })}
                          className="text-xs h-8 gap-1"
                        >
                          {replyMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                          {t("marketing.reviews.send", "Uložiť odpoveď")}
                        </Button>
                        <Button
                          size="sm"
                          disabled={!replyText.trim() || approveReviewReplyMutation.isPending}
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(replyText.trim());
                              toast.info("Odpoveď skopírovaná do schránky.");
                            } catch {
                              // ignore
                            }
                            approveReviewReplyMutation.mutate({
                              id: review.id,
                              approvedReplyText: replyText.trim(),
                            });
                          }}
                          className="text-xs h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                        >
                          {approveReviewReplyMutation.isPending ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                          {t("marketing.reviews.copyAndApprove", "Kopírovať a označiť za vybavené")}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {!review.replyText ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setReplyingTo(review.id);
                                setReplyText("");
                              }}
                              className="text-xs h-8"
                            >
                              <MessageSquare className="w-3.5 h-3.5 mr-1.5 text-primary" />
                              {t("marketing.reviews.reply", "Odpovedať")}
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setReplyingTo(review.id);
                                setReplyText("");
                                generateReplyMutation.mutate({
                                  reviewId: review.id,
                                  platform: (review.platform as "google" | "facebook" | "internal") || "google",
                                  reviewerName: review.reviewerName || "Klient",
                                  rating: review.rating ?? 5,
                                  reviewText: review.reviewText || "",
                                  tone: (review.rating ?? 5) < 3 ? "apologetic" : "warm",
                                });
                              }}
                              disabled={generateReplyMutation.isPending && replyingTo === review.id}
                              className="text-xs h-8 gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
                            >
                              {generateReplyMutation.isPending && replyingTo === review.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                              )}
                              {t("marketing.reviews.aiSuggest", "Generovať AI odpoveď")}
                            </Button>
                          </>
                        ) : null}
                      </div>

                      {review.escalationStatus !== "escalated" && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEscalatingReview(review);
                            setEscalateReason("");
                            setIsEscalateModalOpen(true);
                          }}
                          className="h-8 text-xs text-muted-foreground hover:text-purple-700 gap-1 px-2.5 border border-dashed border-border"
                          title="Eskalovať recenziu na personál (vytvoriť úlohu)"
                        >
                          <ShieldAlert className="w-3.5 h-3.5 text-purple-600" />
                          Eskalovať
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Pridať novú recenziu */}
      {isAddDialogOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="fixed z-50 grid w-full max-w-lg gap-4 border bg-background p-6 shadow-xl rounded-xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                {t("marketing.reviews.addReview", "Pridať novú recenziu")}
              </h2>
              <button
                type="button"
                onClick={() => setIsAddDialogOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Platform Selector */}
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">
                  {t("marketing.reviews.platform", "Platforma")}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewPlatform("google")}
                    className={`flex items-center justify-center gap-1.5 p-2 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${
                      newPlatform === "google"
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300"
                        : "hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    <GoogleIcon className="w-3.5 h-3.5" />
                    Google
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewPlatform("facebook")}
                    className={`flex items-center justify-center gap-1.5 p-2 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${
                      newPlatform === "facebook"
                        ? "border-blue-600 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300"
                        : "hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    <FacebookIcon className="w-3.5 h-3.5" />
                    Facebook
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewPlatform("internal")}
                    className={`flex items-center justify-center gap-1.5 p-2 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${
                      newPlatform === "internal"
                        ? "border-purple-600 bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300"
                        : "hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    <Globe className="w-3.5 h-3.5 text-purple-600" />
                    Interné
                  </button>
                </div>
              </div>

              {/* Reviewer Name */}
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">
                  {t("marketing.reviews.reviewerName", "Meno recenzenta / klienta")} *
                </label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="napr. Mária Horváthová"
                  className="text-xs"
                />
              </div>

              {/* Star Rating Selection */}
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">
                  {t("marketing.reviews.rating", "Hodnotenie (1 až 5 hviezdičiek)")}
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setNewRating(star)}
                      className="p-1 hover:scale-110 transition-transform cursor-pointer"
                    >
                      <Star
                        className={`w-6 h-6 ${
                          star <= newRating
                            ? "fill-amber-400 text-amber-400"
                            : "text-muted-foreground/30"
                        }`}
                      />
                    </button>
                  ))}
                  <span className="text-xs font-bold text-muted-foreground ml-2">
                    {newRating} / 5
                  </span>
                </div>
              </div>

              {/* Review Text */}
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">
                  {t("marketing.reviews.reviewText", "Text recenzie")} *
                </label>
                <Textarea
                  rows={4}
                  value={newText}
                  onChange={(e) => setNewText(e.target.value)}
                  placeholder="Vložte text hodnotenia alebo odporúčania od klienta..."
                  className="text-xs"
                />
              </div>

              {/* Optional reply */}
              <div className="space-y-1.5">
                <label className="font-semibold text-muted-foreground">
                  Odpoveď kliniky (nepovinné)
                </label>
                <Textarea
                  rows={2}
                  value={newReply}
                  onChange={(e) => setNewReply(e.target.value)}
                  placeholder="Ak už klinika na recenziu odpovedala, zadajte odpoveď tu..."
                  className="text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAddDialogOpen(false)}
                className="text-xs"
              >
                {t("common.cancel", "Zrušiť")}
              </Button>
              <Button
                size="sm"
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
                className="text-xs gap-1"
              >
                {createReviewMutation.isPending && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                )}
                {t("marketing.reviews.addReview", "Uložiť recenziu")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Escalation Modal */}
      {isEscalateModalOpen && escalatingReview && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border rounded-xl max-w-md w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-purple-600" />
                <h2 className="font-bold text-base text-foreground">
                  Eskalovať recenziu na personál
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsEscalateModalOpen(false)}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Eskaláciou sa vytvorí interná úloha pre personál (ext_marketing_staff_tasks) na bezodkladné kontaktovanie klienta a vyriešenie situácie.
            </p>

            <div className="bg-muted/40 p-3 rounded-lg border text-xs space-y-1">
              <div className="font-semibold text-foreground">
                {escalatingReview.reviewerName ?? "Anonym"} ({escalatingReview.rating ?? 1}★)
              </div>
              <div className="text-muted-foreground line-clamp-2 italic">
                "{escalatingReview.reviewText}"
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Dôvod eskalácie (povinné):
              </label>
              <Textarea
                rows={3}
                value={escalateReason}
                onChange={(e) => setEscalateReason(e.target.value)}
                placeholder="Napr.: Klient vyjadruje nespokojnosť s čakacou dobou a žiada spätné volanie..."
                className="text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEscalateModalOpen(false)}
                className="text-xs"
              >
                Zrušiť
              </Button>
              <Button
                size="sm"
                disabled={!escalateReason.trim() || escalateReviewMutation.isPending}
                onClick={() =>
                  escalateReviewMutation.mutate({
                    id: escalatingReview.id,
                    reason: escalateReason.trim(),
                  })
                }
                className="text-xs gap-1 bg-purple-600 hover:bg-purple-700 text-white"
              >
                {escalateReviewMutation.isPending && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                )}
                <ShieldAlert className="w-3.5 h-3.5" />
                Potvrdiť eskaláciu
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

