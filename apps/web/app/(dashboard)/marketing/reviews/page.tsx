"use client";

import { useState } from "react";
import { Star, Heart, MessageSquare } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-4 w-4 ${star <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`}
        />
      ))}
    </div>
  );
}

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
    },
  });

  const toggleExpand = (id: string) => {
    const newSet = new Set(expanded);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpanded(newSet);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("marketing.reviews.title", "Recenzie")}</h1>
          <p className="text-muted-foreground">
            {t("marketing.reviews.description", "Správa Google recenzií kliniky.")}
          </p>
        </div>
      </div>

      <div>
        <Tabs value={unansweredOnly ? "unanswered" : "all"} onValueChange={(v) => setUnansweredOnly(v === "unanswered")}>
          <TabsList>
            <TabsTrigger value="all">Všetky</TabsTrigger>
            <TabsTrigger value="unanswered">Bez odpovede</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {listQuery.isLoading ? (
        <div className="space-y-4">
          <div className="h-32 w-full animate-pulse rounded-md bg-muted" />
          <div className="h-32 w-full animate-pulse rounded-md bg-muted" />
        </div>
      ) : listQuery.data?.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          {t("marketing.reviews.noReviews", "Žiadne recenzie.")}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {listQuery.data?.map((review: any) => {
            const isExpanded = expanded.has(review.id);
            const isLongText = review.text && review.text.length > 150;
            const displayText = !isExpanded && isLongText ? review.text.substring(0, 150) + "..." : review.text;

            return (
              <div key={review.id} className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-sm">{review.reviewerName}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <StarRating rating={review.rating} />
                      <span className="text-xs text-muted-foreground">
                        {new Date(review.receivedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  {review.requestBlockedReason === 'sympathy_gate' && (
                    <Badge variant="secondary" className="gap-1 bg-rose-100 text-rose-800 hover:bg-rose-100 border-rose-200">
                      <Heart className="h-3 w-3" />
                      {t("marketing.reviews.sympathy", "Ochrana súcitu")}
                    </Badge>
                  )}
                </div>

                {review.text && (
                  <div>
                    <p className="text-sm text-foreground/90 whitespace-pre-wrap">{displayText}</p>
                    {isLongText && (
                      <button 
                        onClick={() => toggleExpand(review.id)}
                        className="text-xs text-blue-600 hover:underline mt-1"
                      >
                        {isExpanded ? "Zobraziť menej" : "Zobraziť viac"}
                      </button>
                    )}
                  </div>
                )}

                {review.replyText ? (
                  <div className="mt-4 rounded-lg bg-muted/50 p-4 border-l-2 border-primary">
                    <div className="flex items-center gap-2 mb-2">
                      <MessageSquare className="h-3.5 w-3.5 text-primary" />
                      <span className="text-xs font-semibold">Vaša odpoveď</span>
                    </div>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{review.replyText}</p>
                  </div>
                ) : (
                  <div className="mt-4 pt-4 border-t">
                    {replyingTo === review.id ? (
                      <div className="space-y-3">
                        <Textarea 
                          rows={3} 
                          placeholder="Napíšte odpoveď..." 
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                        />
                        <div className="flex gap-2 justify-end">
                          <Button size="sm" variant="outline" onClick={() => setReplyingTo(null)}>
                            Zrušiť
                          </Button>
                          <Button 
                            size="sm" 
                            disabled={!replyText.trim() || replyMutation.isPending}
                            onClick={() => replyMutation.mutate({ id: review.id, replyText })}
                          >
                            Odoslať
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => setReplyingTo(review.id)}>
                        {t("marketing.reviews.reply", "Odpovedať")}
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

