"use client";

import { useMemo, useState } from "react";
import { Star, Heart, MessageSquare, ShieldAlert, Sparkles, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-4 w-4 ${
            star <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"
          }`}
        />
      ))}
    </div>
  );
}

const CANNED_RESPONSES = [
  "Ďakujeme za milé slová a dôveru v náš tím pri starostlivosti o vášho miláčika! S úctou, tím veterinárnej kliniky.",
  "Veľmi si vážime vašu spätnú väzbu. Sme radi, že ošetrenie a rekonvalescencia prebehli bez komplikácií! 🐾",
  "Ďakujeme za hodnotenie. Mrzí nás vaša nespokojnosť – záleží nám na každom pacientovi. Prosím kontaktujte vedenie kliniky, radi situáciu osobne preveríme a vyriešime.",
];

export default function ReviewsPage() {
  const { t } = useI18n();
  const [unansweredOnly, setUnansweredOnly] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const utils = trpc.useUtils();
  const listQuery = trpc.extensions.marketing.listReviews.useQuery({
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

  const toggleExpand = (id: string) => {
    const newSet = new Set(expanded);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpanded(newSet);
  };

  const reviews = listQuery.data ?? [];

  const stats = useMemo(() => {
    const total = reviews.length;
    if (total === 0) return { avg: 0, total: 0, counts: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } };
    const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let sum = 0;
    for (const r of reviews) {
      const star = Math.min(5, Math.max(1, r.rating || 5)) as 1 | 2 | 3 | 4 | 5;
      counts[star]++;
      sum += r.rating ?? 5;
    }
    return {
      avg: (sum / total).toFixed(1),
      total,
      counts,
    };
  }, [reviews]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Star className="w-7 h-7 text-amber-500 fill-amber-500" />
            {t("marketing.reviews.title", "Google Recenzie")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            {t(
              "marketing.reviews.description",
              "Správa a odpovedanie na Google recenzie kliniky. Žiadosti o recenziu sa po úmrtí pacienta automaticky blokujú (Sympathy Gate)."
            )}
          </p>
        </div>
      </div>

      {/* Ratings Breakdown Card */}
      {reviews.length > 0 && (
        <div className="p-5 rounded-xl border bg-card shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-6 items-center">
          <div className="text-center sm:text-left space-y-1">
            <div className="text-4xl font-extrabold text-foreground">{stats.avg}</div>
            <div className="flex justify-center sm:justify-start">
              <StarRating rating={Math.round(Number(stats.avg))} />
            </div>
            <p className="text-xs text-muted-foreground">Celkovo {stats.total} recenzií</p>
          </div>

          <div className="sm:col-span-2 space-y-1.5 text-xs">
            {[5, 4, 3, 2, 1].map((s) => {
              const count = (stats.counts as any)[s] || 0;
              const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;

              return (
                <div key={s} className="flex items-center gap-2">
                  <span className="w-6 text-muted-foreground font-semibold">{s}★</span>
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-amber-400 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-muted-foreground">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <Tabs
          value={unansweredOnly ? "unanswered" : "all"}
          onValueChange={(v) => setUnansweredOnly(v === "unanswered")}
        >
          <TabsList>
            <TabsTrigger value="all">{t("marketing.reviews.all", "Všetky")}</TabsTrigger>
            <TabsTrigger value="unanswered">
              {t("marketing.reviews.unanswered", "Bez odpovede")}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {listQuery.isLoading ? (
        <div className="space-y-4">
          <div className="h-32 w-full animate-pulse rounded-xl bg-muted" />
          <div className="h-32 w-full animate-pulse rounded-xl bg-muted" />
        </div>
      ) : reviews.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground space-y-2">
          <Star className="w-10 h-10 text-muted-foreground/30 mx-auto" />
          <p className="text-sm font-medium text-foreground">{t("marketing.reviews.noReviews", "Žiadne recenzie.")}</p>
          <p className="text-xs">Žiadosti o recenzie odchádzajú klientom po návšteve automaticky.</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {reviews.map((review: any) => {
            const isExpanded = expanded.has(review.id);
            const isLongText = review.text && review.text.length > 150;
            const displayText =
              !isExpanded && isLongText ? review.text.substring(0, 150) + "..." : review.text;

            return (
              <div key={review.id} className="rounded-xl border bg-card p-5 shadow-sm space-y-3 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-sm text-foreground">{review.reviewerName}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <StarRating rating={review.rating} />
                        <span className="text-xs text-muted-foreground">
                          {new Date(review.receivedAt).toLocaleDateString("sk-SK")}
                        </span>
                      </div>
                    </div>
                    {review.requestBlockedReason === "sympathy_gate" && (
                      <Badge
                        variant="secondary"
                        className="gap-1 bg-purple-100 text-purple-800 border-purple-200 text-[10px]"
                      >
                        <Heart className="h-3 w-3" />
                        {t("marketing.reviews.sympathy", "Ochrana súcitu")}
                      </Badge>
                    )}
                  </div>

                  {review.text && (
                    <div className="text-xs text-foreground/90 leading-relaxed">
                      <p className="whitespace-pre-wrap">{displayText}</p>
                      {isLongText && (
                        <button
                          onClick={() => toggleExpand(review.id)}
                          className="text-xs text-primary font-semibold hover:underline mt-1 cursor-pointer block"
                        >
                          {isExpanded
                            ? t("marketing.reviews.showLess", "Zobraziť menej")
                            : t("marketing.reviews.showMore", "Zobraziť viac")}
                        </button>
                      )}
                    </div>
                  )}

                  {review.replyText && (
                    <div className="rounded-lg bg-muted/40 p-3.5 border-l-4 border-primary text-xs space-y-1">
                      <div className="flex items-center gap-1.5 font-semibold text-primary">
                        <MessageSquare className="h-3.5 w-3.5" />
                        <span>{t("marketing.reviews.yourReply", "Odpoveď kliniky")}</span>
                      </div>
                      <p className="text-muted-foreground whitespace-pre-wrap">{review.replyText}</p>
                    </div>
                  )}
                </div>

                {!review.replyText && (
                  <div className="pt-3 border-t">
                    {replyingTo === review.id ? (
                      <div className="space-y-3">
                        {/* Quick canned responses */}
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-primary" />
                            Rýchle predpripravené odpovede:
                          </label>
                          <div className="flex flex-col gap-1.5">
                            {CANNED_RESPONSES.map((canned, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => setReplyText(canned)}
                                className="text-left text-[11px] p-2 rounded-lg border bg-muted/30 hover:bg-muted text-foreground/90 transition-colors cursor-pointer"
                              >
                                {canned}
                              </button>
                            ))}
                          </div>
                        </div>

                        <Textarea
                          rows={3}
                          placeholder={t(
                            "marketing.reviews.replyPlaceholder",
                            "Napíšte odpoveď na recenziu..."
                          )}
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          className="text-xs"
                        />

                        <div className="flex gap-2 justify-end">
                          <Button size="sm" variant="outline" onClick={() => setReplyingTo(null)} className="text-xs">
                            {t("common.cancel", "Zrušiť")}
                          </Button>
                          <Button
                            size="sm"
                            disabled={!replyText.trim() || replyMutation.isPending}
                            onClick={() => replyMutation.mutate({ id: review.id, replyText })}
                            className="text-xs gap-1"
                          >
                            {replyMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            {t("marketing.reviews.send", "Odoslať odpoveď")}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setReplyingTo(review.id);
                          setReplyText("");
                        }}
                        className="text-xs w-full"
                      >
                        <MessageSquare className="w-3.5 h-3.5 mr-1" />
                        {t("marketing.reviews.reply", "Odpovedať na recenziu")}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
