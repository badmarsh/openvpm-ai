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
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

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

export default function ReviewsPage() {
  const { t } = useI18n();

  // Filters state
  const [platformFilter, setPlatformFilter] = useState<"all" | "google" | "facebook">("all");
  const [unansweredOnly, setUnansweredOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Interaction state
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  // New review form state
  const [newPlatform, setNewPlatform] = useState<"google" | "facebook">("google");
  const [newName, setNewName] = useState("");
  const [newRating, setNewRating] = useState(5);
  const [newText, setNewText] = useState("");
  const [newReply, setNewReply] = useState("");

  const utils = trpc.useUtils();

  // Queries & Mutations
  const listQuery = trpc.extensions.marketing.listReviews.useQuery({
    limit: 100,
    platform: platformFilter,
    unansweredOnly,
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

  const rawReviews = listQuery.data ?? [];

  // Filter in-memory by search query
  const reviews = useMemo(() => {
    if (!searchQuery.trim()) return rawReviews;
    const q = searchQuery.toLowerCase();
    return rawReviews.filter(
      (r) =>
        (r.reviewerName || "").toLowerCase().includes(q) ||
        (r.reviewText && r.reviewText.toLowerCase().includes(q))
    );
  }, [rawReviews, searchQuery]);

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

    for (const r of rawReviews) {
      const star = Math.min(5, Math.max(1, r.rating || 5)) as 1 | 2 | 3 | 4 | 5;
      counts[star]++;
      sum += r.rating ?? 5;
      if (!r.replyText) unanswered++;

      if (r.platform === "facebook") {
        fbSum += r.rating ?? 5;
        fbCount++;
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
      counts,
    };
  }, [rawReviews]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Star className="w-7 h-7 text-amber-500 fill-amber-500" />
            {t("marketing.reviews.title", "Recenzie (Google & Facebook)")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            {t(
              "marketing.reviews.description",
              "Správa, štatistiky a odpovedanie na Google a Facebook recenzie kliniky. Žiadosti o recenziu sa po úmrtí pacienta automaticky blokujú (Sympathy Gate)."
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => seedMutation.mutate({ force: rawReviews.length === 0 ? false : true })}
            disabled={seedMutation.isPending}
            className="text-xs gap-1.5"
            title="Načítať slovenské vzorové recenzie pre Google a Facebook"
          >
            {seedMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
            )}
            {t("marketing.reviews.seedDemo", "Vzorové recenzie")}
          </Button>

          <Button
            size="sm"
            onClick={() => setIsAddDialogOpen(true)}
            className="text-xs gap-1.5"
          >
            <Plus className="w-4 h-4" />
            {t("marketing.reviews.addReview", "Pridať recenziu")}
          </Button>
        </div>
      </div>

      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Celkové hodnotenie */}
        <div className="p-5 rounded-xl border bg-card shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {t("marketing.reviews.averageRating", "Celkové hodnotenie")}
              </span>
              <Badge variant="secondary" className="text-xs font-medium">
                {stats.total} recenzií
              </Badge>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-4xl font-extrabold text-foreground">{stats.avg}</span>
              <span className="text-sm text-muted-foreground font-medium">/ 5.0</span>
            </div>
            <div className="mt-1">
              <StarRating rating={Math.round(Number(stats.avg))} />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t flex items-center justify-between text-xs text-muted-foreground">
            <span>Čaká na odpoveď:</span>
            <span
              className={`font-semibold ${
                stats.unanswered > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600"
              }`}
            >
              {stats.unanswered}
            </span>
          </div>
        </div>

        {/* Google Recenzie */}
        <div
          onClick={() => setPlatformFilter(platformFilter === "google" ? "all" : "google")}
          className={`p-5 rounded-xl border bg-card shadow-sm cursor-pointer transition-all hover:border-blue-400 ${
            platformFilter === "google" ? "ring-2 ring-blue-500/50 border-blue-500" : ""
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-semibold text-sm">
              <GoogleIcon className="w-4 h-4" />
              <span>Google Business</span>
            </div>
            <Badge
              variant="outline"
              className="text-[11px] bg-blue-50/50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
            >
              {stats.googleTotal} hodnotení
            </Badge>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-4xl font-extrabold text-foreground">{stats.googleAvg}</span>
            <span className="text-sm text-muted-foreground font-medium">/ 5.0</span>
          </div>
          <div className="mt-1">
            <StarRating rating={Math.round(Number(stats.googleAvg))} />
          </div>
          <p className="mt-4 pt-3 border-t text-xs text-muted-foreground">
            Overené recenzie priamo z profilu Google Moja Firma
          </p>
        </div>

        {/* Facebook Odporúčania */}
        <div
          onClick={() => setPlatformFilter(platformFilter === "facebook" ? "all" : "facebook")}
          className={`p-5 rounded-xl border bg-card shadow-sm cursor-pointer transition-all hover:border-blue-600 ${
            platformFilter === "facebook" ? "ring-2 ring-blue-600/50 border-blue-600" : ""
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-semibold text-sm">
              <FacebookIcon className="w-4 h-4" />
              <span>Facebook Stránka</span>
            </div>
            <Badge
              variant="outline"
              className="text-[11px] bg-blue-50/50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
            >
              {stats.facebookTotal} odporúčaní
            </Badge>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-4xl font-extrabold text-foreground">{stats.facebookAvg}</span>
            <span className="text-sm text-muted-foreground font-medium">/ 5.0</span>
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            <StarRating rating={Math.round(Number(stats.facebookAvg))} />
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-0.5 ml-1">
              <ThumbsUp className="w-3 h-3" /> 100% odporúča
            </span>
          </div>
          <p className="mt-4 pt-3 border-t text-xs text-muted-foreground">
            Odporúčania a spätná väzba z komunitnej FB stránky
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
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
        </div>

        {/* Search & Answered Filter */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 md:w-64">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("marketing.reviews.filterSearch", "Hľadať v recenziách...")}
              className="h-8 pl-8 text-xs bg-background"
            />
          </div>

          <Button
            variant={unansweredOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setUnansweredOnly(!unansweredOnly)}
            className="text-xs h-8 gap-1.5"
          >
            <Filter className="w-3 h-3" />
            {t("marketing.reviews.unanswered", "Iba bez odpovede")}
            {stats.unanswered > 0 && (
              <Badge
                variant="secondary"
                className={`ml-1 text-[10px] px-1.5 py-0 ${
                  unansweredOnly ? "bg-primary-foreground text-primary" : ""
                }`}
              >
                {stats.unanswered}
              </Badge>
            )}
          </Button>
        </div>
      </div>

      {/* Reviews List */}
      {listQuery.isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="h-44 w-full animate-pulse rounded-xl bg-muted/60" />
          <div className="h-44 w-full animate-pulse rounded-xl bg-muted/60" />
        </div>
      ) : reviews.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground space-y-3 bg-card/50">
          <Star className="w-10 h-10 text-muted-foreground/40 mx-auto" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              {t("marketing.reviews.noReviews", "Žiadne recenzie.")}
            </p>
            <p className="text-xs">
              {platformFilter !== "all"
                ? `V kategórii ${platformFilter === "google" ? "Google" : "Facebook"} zatiaľ nemáte žiadne recenzie.`
                : "Kliknite na tlačidlo 'Vzorové recenzie' vyššie pre okamžité nahratie reálnych recenzií."}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => seedMutation.mutate({ force: true })}
            disabled={seedMutation.isPending}
            className="text-xs gap-1.5 mt-2"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Načítať vzorové recenzie (Google & Facebook)
          </Button>
        </div>
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
                      <div className="pt-1 flex justify-end">
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
                              platform: (review.platform as "google" | "facebook") || "google",
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

                      <div className="flex gap-2 justify-end">
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
                          disabled={!replyText.trim() || replyMutation.isPending}
                          onClick={() => replyMutation.mutate({ id: review.id, replyText })}
                          className="text-xs h-8 gap-1"
                        >
                          {replyMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                          {t("marketing.reviews.send", "Odoslať odpoveď")}
                        </Button>
                      </div>
                    </div>
                  ) : !review.replyText ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setReplyingTo(review.id);
                        setReplyText("");
                      }}
                      className="text-xs w-full h-8"
                    >
                      <MessageSquare className="w-3.5 h-3.5 mr-1.5 text-primary" />
                      {t("marketing.reviews.reply", "Odpovedať na recenziu")}
                    </Button>
                  ) : null}
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
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewPlatform("google")}
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${
                      newPlatform === "google"
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300"
                        : "hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    <GoogleIcon className="w-4 h-4" />
                    Google Recenzia
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewPlatform("facebook")}
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${
                      newPlatform === "facebook"
                        ? "border-blue-600 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300"
                        : "hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    <FacebookIcon className="w-4 h-4" />
                    Facebook Odporúčanie
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
    </div>
  );
}

