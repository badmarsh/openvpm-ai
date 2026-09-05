"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  OctagonX,
  AlertTriangle,
  Calendar,
  Plus,
  Filter,
  Sparkles,
  Wand2,
  CheckCheck,
  Archive,
  Loader2,
  CalendarDays,
  Image as ImageIcon,
  RefreshCw,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

export default function ContentPlanPage() {
  const { t } = useI18n();
  const utils = trpc.useUtils();

  const [status, setStatus] = useState("all");
  const [channel, setChannel] = useState("all");

  const [customTopic, setCustomTopic] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newChannel, setNewChannel] = useState("instagram");
  const [newDate, setNewDate] = useState("");

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
    onSuccess: () => {
      utils.extensions.marketing.listContentItems.invalidate();
      toast.success("Príspevok bol schválený.");
    },
    onError: (err) => {
      toast.error(err.message || "Nepodarilo sa schváliť príspevok.");
    },
  });

  const rejectMutation = trpc.extensions.marketing.rejectContentItem.useMutation({
    onSuccess: () => {
      utils.extensions.marketing.listContentItems.invalidate();
      toast.success("Príspevok bol archivovaný.");
    },
  });

  const autoFixMutation = trpc.extensions.marketing.autoFixContentItem.useMutation({
    onSuccess: (data) => {
      utils.extensions.marketing.listContentItems.invalidate();
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
    onSuccess: () => {
      utils.extensions.marketing.listContentItems.invalidate();
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

  const latestBatch = batchesQuery.data?.[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <CalendarDays className="w-7 h-7 text-primary" />
            {t("marketing.plan.title", "Plán obsahu a schvaľovanie")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            {t(
              "marketing.plan.description",
              "Týždenné dávky príspevkov na sociálne siete. Schválenie týždňa trvá menej ako 5 minút. Príspevky s blokujúcim nálezom sa nesmú publikovať."
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {latestBatch && latestBatch.status !== "approved" && (
            <Button
              variant="default"
              onClick={() => approveBatchMutation.mutate({ batchId: latestBatch.id })}
              disabled={approveBatchMutation.isPending}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {approveBatchMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCheck className="w-4 h-4" />
              )}
              Schváliť celý týždeň
            </Button>
          )}

          <Button
            variant="outline"
            onClick={() => generateBatchMutation.mutate({})}
            disabled={generateBatchMutation.isPending}
            className="gap-1.5"
          >
            {generateBatchMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Wand2 className="w-4 h-4" />
            )}
            Vygenerovať týždeň
          </Button>

          <Button onClick={() => setIsDialogOpen(true)} className="gap-1.5">
            <Plus className="w-4 h-4" />
            {t("marketing.plan.newPost", "Nový príspevok")}
          </Button>
        </div>
      </div>

      {/* Quick AI Topic Input */}
      <div className="p-4 rounded-xl border bg-card shadow-sm flex flex-col sm:flex-row items-center gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-primary shrink-0">
          <Sparkles className="w-4 h-4 text-primary" />
          <span>Chcem post o:</span>
        </div>
        <Input
          value={customTopic}
          onChange={(e) => setCustomTopic(e.target.value)}
          placeholder="Napr. Prečo neodkladať jesenné čistenie zubov u psov a mačiek..."
          className="text-xs h-9"
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

      {/* Create Dialog */}
      {isDialogOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg border bg-background p-6 shadow-lg rounded-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-lg font-semibold text-foreground">Vytvoriť vlastný príspevok</h2>
              <Button variant="ghost" size="sm" onClick={() => setIsDialogOpen(false)}>
                ✕
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
                  {createMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
                  Vytvoriť
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center justify-between">
        <Tabs value={status} onValueChange={setStatus}>
          <TabsList>
            <TabsTrigger value="all">{t("marketing.plan.all", "Všetky")}</TabsTrigger>
            <TabsTrigger value="proposed">{t("marketing.plan.proposed", "Na schválenie")}</TabsTrigger>
            <TabsTrigger value="approved">{t("marketing.plan.approved", "Schválené")}</TabsTrigger>
            <TabsTrigger value="published">{t("marketing.plan.published", "Publikované")}</TabsTrigger>
            <TabsTrigger value="blocked">{t("marketing.plan.blocked", "Zablokované")}</TabsTrigger>
          </TabsList>
        </Tabs>

        <select
          value={channel}
          onChange={(e) => setChannel(e.target.value)}
          className="h-9 w-[180px] rounded-md border bg-background px-3 text-xs outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="all">Všetky kanály</option>
          <option value="instagram">Instagram</option>
          <option value="facebook">Facebook</option>
          <option value="google_business">Google Business</option>
          <option value="sms">SMS</option>
          <option value="email">Email</option>
        </select>
      </div>

      {/* Content Cards Grid */}
      {listQuery.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="h-44 w-full animate-pulse rounded-xl bg-muted" />
          <div className="h-44 w-full animate-pulse rounded-xl bg-muted" />
          <div className="h-44 w-full animate-pulse rounded-xl bg-muted" />
        </div>
      ) : listQuery.data?.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground space-y-2">
          <Calendar className="w-10 h-10 text-muted-foreground/40 mx-auto" />
          <p className="text-sm font-medium text-foreground">Žiadne príspevky vo vybranom filtri</p>
          <p className="text-xs">Kliknite na „Vygenerovať týždeň“ alebo vytvorte vlastný príspevok.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {listQuery.data?.map((item: any) => {
            const isBlocked = item.status === "blocked" || item.validatorVerdict === "block";
            const isProposed = item.status === "proposed";
            const isApproved = item.status === "approved";

            return (
              <div
                key={item.id}
                className="rounded-xl border bg-card p-4 shadow-sm space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-sm text-foreground line-clamp-2">{item.title}</h3>
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {item.channel}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>
                      {item.scheduledFor ? new Date(item.scheduledFor).toLocaleDateString("sk-SK") : "Nenaplánované"}
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
                        <Badge variant="secondary" className="text-[9px] bg-background/85 backdrop-blur-sm shadow-xs font-semibold">
                          {item.mediaAsset.kind === "brand_graphic" ? "Grafika" : item.mediaAsset.kind === "photo" ? "Fotografia" : "AI Ilustrácia"}
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
                      className={isApproved ? "bg-emerald-600 hover:bg-emerald-700 text-white text-[10px]" : "text-[10px]"}
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
                        {item.validatorVerdict === "pass" && <CheckCircle2 className="mr-1 h-3 w-3" />}
                        {item.validatorVerdict === "warn" && <AlertTriangle className="mr-1 h-3 w-3" />}
                        {item.validatorVerdict === "block" && <OctagonX className="mr-1 h-3 w-3" />}
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
      )}
    </div>
  );
}
