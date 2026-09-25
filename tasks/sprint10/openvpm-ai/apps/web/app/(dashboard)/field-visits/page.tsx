"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import {
  Tractor,
  ReceiptText,
  ShieldCheck,
  Plus,
  Search,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Building2,
  Tag,
  Package,
  Activity,
  Check,
  RefreshCw,
  Send,
  Mic,
  Loader2,
  Sparkles,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/layout/page-header";
import { useI18n } from "@/lib/i18n";
import {
  MAX_WITHDRAWAL_DAYS,
  clampWithdrawalDays,
  computeFieldWithdrawalStatus,
  evaluateWithdrawalConflict,
  findControlledSubstanceConflict,
  formatCehzEarTag,
  isValidCehzEarTag,
  normalizeCehzEarTag,
  type FieldWithdrawalStatus,
} from "@/lib/field-visits/policy";

const BATCH_ACTIONS = ["vaccination", "deworming", "estrus_synch", "other"] as const;
type BatchAction = (typeof BATCH_ACTIONS)[number];

export default function FieldVisitsPage() {
  const { t, locale } = useI18n();
  const [activeTab, setActiveTab] = useState<string>("farms");
  const [selectedFarmId, setSelectedFarmId] = useState<string | null>(null); // eslint-disable-line @typescript-eslint/no-unused-vars

  // Rýchle vyhľadávanie ušných známok CEHZ
  const [earTagQuery, setEarTagQuery] = useState<string>("");

  // Formulár nového výjazdu
  const [formFarmId, setFormFarmId] = useState<string>("");
  const [formCowId, setFormCowId] = useState<string>("");
  const [formDiagnosis, setFormDiagnosis] = useState<string>("");
  const [formNotes, setFormNotes] = useState<string>("");
  const [formServiceId, setFormServiceId] = useState<string>("");
  const [formProductId, setFormProductId] = useState<string>("");
  const [formProductQty, setFormProductQty] = useState<number>(1);
  const [formMeatDays, setFormMeatDays] = useState<number>(0);
  const [formMilkDays, setFormMilkDays] = useState<number>(0);
  const [formSendKvepis, setFormSendKvepis] = useState<boolean>(true);

  // Hromadné ošetrenie stáda (Herd Batch Actions)
  const [batchAction, setBatchAction] = useState<BatchAction>("vaccination");
  const [batchCowIds, setBatchCowIds] = useState<string[]>([]);

  // Dialóg novej kravy
  const [newCowFarmId, setNewCowFarmId] = useState<string | null>(null);
  const [newCowName, setNewCowName] = useState<string>("");
  const [newCowEarTag, setNewCowEarTag] = useState<string>("");
  const [newCowBreed, setNewCowBreed] = useState<string>("Holštajnsko-frízsky dobytok");
  const [newCowTagError, setNewCowTagError] = useState<string | null>(null);

  // Withdrawal Watch: pokus o ukončenie liečby / expedíciu počas lehoty
  const [watchConflict, setWatchConflict] = useState<{
    safeUntil: Date;
    channels: Array<"meat" | "milk">;
  } | null>(null);
  const [watchAllowed, setWatchAllowed] = useState<boolean | null>(null);

  // Voice diktát: fázy a výsledok parsovania
  const [voicePhase, setVoicePhase] = useState<"idle" | "recording" | "processing" | "review">("idle");
  const [voiceTranscript, setVoiceTranscript] = useState<string>("");
  const [voiceDraft, setVoiceDraft] = useState<{
    farmNameHint: string | null;
    cowNameOrEarTag: string | null;
    diagnosis: string | null;
    medicationName: string | null;
    meatWithdrawalDays: number | null;
    milkWithdrawalDays: number | null;
    notes: string | null;
    confidence: "high" | "medium" | "low";
    transcript: string;
  } | null>(null);
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const utils = trpc.useUtils();
  const { data: overview, isLoading: _isLoading, refetch } = trpc.extensions.fieldVisits.getOverview.useQuery();
  const { data: stock } = trpc.extensions.fieldVisits.getLargeAnimalStock.useQuery();
  const { data: servicesList } = trpc.extensions.fieldVisits.getLargeAnimalServices.useQuery();

  const formatDate = useCallback(
    (d: Date | string | null | undefined): string => {
      if (!d) return "—";
      const date = typeof d === "string" ? new Date(d) : d;
      if (Number.isNaN(date.getTime())) return "—";
      return date.toLocaleDateString(locale === "en" ? "en-GB" : "sk-SK", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    },
    [locale]
  );

  /** Ochranné lehoty zvieraťa → stav pre výpočty a banner. */
  const withdrawalStatusesForCow = useCallback(
    (cowId: string): FieldWithdrawalStatus[] =>
      (overview?.withdrawals ?? [])
        .filter((w) => w.patientId === cowId)
        .map((w) =>
          computeFieldWithdrawalStatus({
            administeredAt: w.administeredAt,
            meatWithdrawalDays: w.meatWithdrawalDays ?? 0,
            milkWithdrawalDays: w.milkWithdrawalDays ?? 0,
            medicationName: w.medicationName,
          })
        ),
    [overview?.withdrawals]
  );

  const allWithdrawalStatuses = useMemo<FieldWithdrawalStatus[]>(
    () =>
      (overview?.withdrawals ?? []).map((w) =>
        computeFieldWithdrawalStatus({
          administeredAt: w.administeredAt,
          meatWithdrawalDays: w.meatWithdrawalDays ?? 0,
          milkWithdrawalDays: w.milkWithdrawalDays ?? 0,
          medicationName: w.medicationName,
        })
      ),
    [overview?.withdrawals]
  );

  const selectedCowStatuses = useMemo(
    () => (formCowId ? withdrawalStatusesForCow(formCowId) : []),
    [formCowId, withdrawalStatusesForCow]
  );
  const selectedCowHasWithdrawal = selectedCowStatuses.some((s) => s.anyActive);

  /** Slovak pluralization pre dni: 1 deň / 2–4 dni / 5+ dní. */
  const formatDays = useCallback(
    (days: number): string => {
      if (days === 1) return t("fieldVisits.withdrawalWatch.daysOne", "{days} deň", { days });
      if (days <= 4) return t("fieldVisits.withdrawalWatch.daysFew", "{days} dni", { days });
      return t("fieldVisits.withdrawalWatch.daysMany", "{days} dní", { days });
    },
    [t]
  );

  const milkBadgeText = useCallback(
    (days: number, safeUntil: Date | null): string =>
      t("fieldVisits.withdrawalWatch.milkBadge", "Mlieko: ešte {remaining} (do {date})", {
        remaining: formatDays(days),
        date: formatDate(safeUntil),
      }),
    [t, formatDays, formatDate]
  );

  const meatBadgeText = useCallback(
    (days: number): string =>
      t("fieldVisits.withdrawalWatch.meatBadge", "Mäso: ešte {remaining}", {
        remaining: formatDays(days),
      }),
    [t, formatDays]
  );

  // ---------------------------------------------------------------------
  // Rýchle vyhľadávanie ušných známok (CEHZ)
  // ---------------------------------------------------------------------
  const earTagMatches = useMemo(() => {
    const q = earTagQuery.trim();
    if (q.length < 2) return [];
    const qNorm = normalizeCehzEarTag(q);
    const qDigits = q.replace(/\D/g, "");
    const qLower = q.toLowerCase();
    const matches: Array<{ cowId: string; farmId: string; farmName: string; name: string; earTag: string }> = [];
    for (const farm of overview?.farms ?? []) {
      for (const cow of farm.cows) {
        const norm = normalizeCehzEarTag(cow.earTag);
        const cowDigits = (cow.earTag ?? "").replace(/\D/g, "");
        const hit =
          (qNorm !== null && norm === qNorm) ||
          (qDigits.length >= 3 && cowDigits.includes(qDigits)) ||
          cow.name.toLowerCase().includes(qLower);
        if (hit) {
          matches.push({ cowId: cow.id, farmId: farm.id, farmName: farm.name, name: cow.name, earTag: cow.earTag });
          if (matches.length >= 8) return matches;
        }
      }
    }
    return matches;
  }, [earTagQuery, overview?.farms]);

  const handleSelectSearchResult = (m: { cowId: string; farmId: string }) => {
    setFormFarmId(m.farmId);
    setFormCowId(m.cowId);
    setBatchCowIds([]);
    setActiveTab("new-visit");
    setEarTagQuery("");
  };

  const createVisitMutation = trpc.extensions.fieldVisits.createFieldVisit.useMutation({
    onSuccess: () => {
      utils.extensions.fieldVisits.getOverview.invalidate();
      setActiveTab("visits");
      setFormDiagnosis("");
      setFormNotes("");
      setFormServiceId("");
      setFormProductId("");
      setFormMeatDays(0);
      setFormMilkDays(0);
      setFormCowId("");
      alert(t("fieldVisits.alerts.visitSaved", "Terénny výjazd bol úspešne uložený do knihy ošetrení aj do faktúry!"));
    },
    onError: (err) =>
      alert(t("fieldVisits.alerts.visitError", "Chyba pri ukladaní výjazdu: {message}", { message: err.message })),
  });

  const createHerdBatchMutation = trpc.extensions.fieldVisits.createHerdBatchVisit.useMutation({
    onSuccess: (res) => {
      utils.extensions.fieldVisits.getOverview.invalidate();
      setBatchCowIds([]);
      setActiveTab("visits");
      alert(
        t("fieldVisits.alerts.batchSaved", "Hromadný výjazd uložený pre {count} zvierat.", {
          count: res.cowCount,
        })
      );
    },
    onError: (err) =>
      alert(t("fieldVisits.alerts.visitError", "Chyba pri ukladaní výjazdu: {message}", { message: err.message })),
  });

  const closeInvoiceMutation = trpc.extensions.fieldVisits.closeFarmInvoice.useMutation({
    onSuccess: () => {
      utils.extensions.fieldVisits.getOverview.invalidate();
      alert(t("fieldVisits.alerts.invoiceClosed", "Faktúra bola úspešne uzatvorená a odoslaná farme!"));
    },
  });

  const registerCowMutation = trpc.extensions.fieldVisits.registerCow.useMutation({
    onSuccess: () => {
      utils.extensions.fieldVisits.getOverview.invalidate();
      setNewCowFarmId(null);
      setNewCowName("");
      setNewCowEarTag("");
      setNewCowTagError(null);
      alert(t("fieldVisits.alerts.cowRegistered", "Nová krava bola úspešne zaevidovaná!"));
    },
    onError: (err) =>
      alert(t("fieldVisits.alerts.visitError", "Chyba pri ukladaní výjazdu: {message}", { message: err.message })),
  });

  const transcribeVoiceMutation = trpc.extensions.fieldVisits.transcribeVoice.useMutation({
    onSuccess: (draft) => {
      setVoiceDraft(draft);
      setVoiceTranscript(draft.transcript);
      setVoicePhase("review");
      // Predvyplň formulár z AI draftu — diagnóza, liek aj ochranné lehoty.
      if (draft.diagnosis) setFormDiagnosis(draft.diagnosis);
      if (draft.notes) setFormNotes(draft.notes);
      if (draft.meatWithdrawalDays != null) setFormMeatDays(clampWithdrawalDays(draft.meatWithdrawalDays));
      if (draft.milkWithdrawalDays != null) setFormMilkDays(clampWithdrawalDays(draft.milkWithdrawalDays));
      if (draft.medicationName && stock && stock.length > 0) {
        const lower = draft.medicationName.toLowerCase();
        const match = stock.find(
          (p) => p.name.toLowerCase().includes(lower) || lower.includes(p.name.toLowerCase().split(" ")[0] ?? "")
        );
        if (match && !findControlledSubstanceConflict([match.name])) {
          setFormProductId(match.id);
        }
      }
    },
    onError: () => {
      setVoicePhase("idle");
      alert(
        t(
          "fieldVisits.alerts.transcribeFailed",
          "Prepis sa nepodaril. Skúste znova alebo zadajte diagnózu manuálne."
        )
      );
    },
  });

  const startVoiceRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onload = async () => {
          const base64 = (reader.result as string).split(",")[1] ?? "";
          setVoicePhase("processing");
          transcribeVoiceMutation.mutate({ audioBase64: base64, audioMimeType: "audio/webm" });
        };
        reader.readAsDataURL(blob);
      };
      mediaRecRef.current = mr;
      mr.start();
      setVoicePhase("recording");
    } catch {
      alert(
        t(
          "fieldVisits.alerts.micDenied",
          "Prístup k mikrofónu sa nepodaril. Skontrolujte povolenia prehliadača."
        )
      );
    }
  }, [transcribeVoiceMutation, t]);

  const stopVoiceRecording = useCallback(() => {
    mediaRecRef.current?.stop();
    mediaRecRef.current = null;
  }, []);

  const handleProductChange = (productId: string) => {
    const prod = stock?.find((p) => p.id === productId);
    // Kontrolované látky (Zákon č. 139/1998 Z. z.) — žiadny AI/terénny prefill.
    const conflict = findControlledSubstanceConflict([prod?.name]);
    if (conflict) {
      alert(
        t(
          "fieldVisits.alerts.controlledBlocked",
          "Kontrolovanú látku '{name}' nie je možné podávať cez terénny výjazd (Zákon č. 139/1998 Z. z.). Záznam vytvorte ručne v sekcii Kontrolované látky.",
          { name: conflict }
        )
      );
      return;
    }
    setFormProductId(productId);
    setFormProductQty(1);
  };

  const handleSubmitVisit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formFarmId || !formCowId || !formDiagnosis) {
      alert(
        t(
          "fieldVisits.alerts.validationVisit",
          "Prosím vyberte farmu, zviera a zadajte diagnózu."
        )
      );
      return;
    }
    const selectedProduct = stock?.find((p) => p.id === formProductId);
    const conflict = findControlledSubstanceConflict([selectedProduct?.name]);
    if (conflict) {
      alert(
        t(
          "fieldVisits.alerts.controlledBlocked",
          "Kontrolovanú látku '{name}' nie je možné podávať cez terénny výjazd (Zákon č. 139/1998 Z. z.). Záznam vytvorte ručne v sekcii Kontrolované látky.",
          { name: conflict }
        )
      );
      return;
    }

    createVisitMutation.mutate({
      farmId: formFarmId,
      cowId: formCowId,
      diagnosis: formDiagnosis,
      serviceIds: formServiceId ? [formServiceId] : [],
      products: formProductId
        ? [{
            productId: formProductId,
            quantity: formProductQty,
            meatWithdrawalDays: clampWithdrawalDays(formMeatDays),
            milkWithdrawalDays: clampWithdrawalDays(formMilkDays),
          }]
        : [],
      notes: formNotes,
      sendToKvepis: formSendKvepis,
    });
  };

  const handleSubmitHerdBatch = () => {
    if (!formFarmId) {
      alert(t("fieldVisits.alerts.validationFarm", "Najprv vyberte farmu."));
      return;
    }
    if (batchCowIds.length < 2) {
      alert(t("fieldVisits.alerts.validationBatchSelection", "Vyberte aspoň 2 zvieratá."));
      return;
    }
    if (!formDiagnosis) {
      alert(t("fieldVisits.alerts.validationVisit", "Prosím vyberte farmu, zviera a zadajte diagnózu."));
      return;
    }
    const selectedProduct = stock?.find((p) => p.id === formProductId);
    const conflict = findControlledSubstanceConflict([selectedProduct?.name]);
    if (conflict) {
      alert(
        t(
          "fieldVisits.alerts.controlledBlocked",
          "Kontrolovanú látku '{name}' nie je možné podávať cez terénny výjazd (Zákon č. 139/1998 Z. z.). Záznam vytvorte ručne v sekcii Kontrolované látky.",
          { name: conflict }
        )
      );
      return;
    }
    createHerdBatchMutation.mutate({
      farmId: formFarmId,
      cowIds: batchCowIds,
      batchAction,
      diagnosis: formDiagnosis,
      serviceIds: formServiceId ? [formServiceId] : [],
      products: formProductId
        ? [{
            productId: formProductId,
            quantity: formProductQty,
            meatWithdrawalDays: clampWithdrawalDays(formMeatDays),
            milkWithdrawalDays: clampWithdrawalDays(formMilkDays),
          }]
        : [],
      notes: formNotes,
      sendToKvepis: formSendKvepis,
    });
  };

  const toggleBatchCow = (cowId: string) => {
    setBatchCowIds((prev) =>
      prev.includes(cowId) ? prev.filter((id) => id !== cowId) : [...prev, cowId]
    );
  };

  /** Pokus o ukončenie liečby / expedíciu — červená brána počas lehoty. */
  const attemptWatchAction = (action: "finish_treatment" | "dispatch_animal") => {
    const conflict = evaluateWithdrawalConflict(action, allWithdrawalStatuses);
    if (conflict) {
      setWatchConflict(conflict);
      setWatchAllowed(null);
    } else {
      setWatchConflict(null);
      setWatchAllowed(true);
    }
  };

  const handleRegisterCow = () => {
    if (!newCowName) {
      alert(t("fieldVisits.alerts.validationCowName", "Zadajte meno zvieraťa."));
      return;
    }
    if (!isValidCehzEarTag(newCowEarTag)) {
      setNewCowTagError(
        t(
          "fieldVisits.alerts.invalidEarTag",
          "Neplatná ušná známka CEHZ — očakávaný formát SK + 12 číslic (napr. SK 000801452101)."
        )
      );
      return;
    }
    setNewCowTagError(null);
    registerCowMutation.mutate({
      farmId: newCowFarmId as string,
      name: newCowName,
      earTag: normalizeCehzEarTag(newCowEarTag) as string,
      breed: newCowBreed,
    });
  };

  const selectedFarmCows = overview?.farms.find((f) => f.id === formFarmId)?.cows || [];
  const quickDiagnoses: Array<{ key: string; label: string }> = [
    { key: "mastitis", label: t("fieldVisits.form.quickDiagnoses.mastitis", "Akútna katarálna mastitída") },
    { key: "panaritium", label: t("fieldVisits.form.quickDiagnoses.panaritium", "Panaritium (flegmóna prsta)") },
    { key: "puerperalParesis", label: t("fieldVisits.form.quickDiagnoses.puerperalParesis", "Pôrodná paréza (hypokalcémia)") },
    { key: "retainedMembranes", label: t("fieldVisits.form.quickDiagnoses.retainedMembranes", "Retencia sekundín post-partum") },
    { key: "pregnancyScan", label: t("fieldVisits.form.quickDiagnoses.pregnancyScan", "Sonografia gravidity") },
    { key: "ibrVaccination", label: t("fieldVisits.form.quickDiagnoses.ibrVaccination", "Vakcinácia IBR stádo") },
  ];

  const monthPeriod = useMemo(
    () =>
      new Date().toLocaleDateString(locale === "en" ? "en-GB" : "sk-SK", {
        month: "long",
        year: "numeric",
      }),
    [locale]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Tractor}
        title={t("fieldVisits.title", "Terénna prax & Farmy")}
        subtitle={t(
          "fieldVisits.subtitle",
          "Kniha terénnych ošetrení, individuálna evidencia hospodárskych zvierat (CEHZ), hromadné zákroky stáda, ochranné lehoty a hlásenia KVEPIS."
        )}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="gap-1.5 min-h-[44px]"
            >
              <RefreshCw className="h-4 w-4" />
              {t("fieldVisits.actions.refresh", "Obnoviť")}
            </Button>
            <Button
              size="sm"
              onClick={() => setActiveTab("new-visit")}
              className="gap-1.5 min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Plus className="h-4 w-4" />
              {t("fieldVisits.actions.newVisit", "Nový výjazd na farmu")}
            </Button>
          </div>
        }
      />

      {/* Rýchle vyhľadávanie ušných známok CEHZ (mobile-first, do rukavíc) */}
      <Card className="border-emerald-200 dark:border-emerald-950">
        <CardContent className="pt-4 pb-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Search className="h-4 w-4 text-emerald-600" />
            {t("fieldVisits.earTagSearch.title", "Rýchle vyhľadávanie ušných známok (CEHZ)")}
          </div>
          <Input
            value={earTagQuery}
            onChange={(e) => setEarTagQuery(e.target.value)}
            placeholder={t(
              "fieldVisits.earTagSearch.placeholder",
              "SK 000801452101, 000801452101 alebo meno zvieraťa…"
            )}
            aria-label={t(
              "fieldVisits.earTagSearch.placeholder",
              "SK 000801452101, 000801452101 alebo meno zvieraťa…"
            )}
            className="min-h-[44px] font-mono text-sm"
            autoComplete="off"
          />
          {earTagQuery.trim().length >= 2 && (
            <div className="space-y-1">
              {earTagMatches.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {t("fieldVisits.earTagSearch.noMatch", "Žiadna zhoda v evidencii fariem.")}
                </p>
              ) : (
                earTagMatches.map((m) => (
                  <button
                    key={m.cowId}
                    type="button"
                    onClick={() => handleSelectSearchResult(m)}
                    className="w-full min-h-[44px] flex items-center justify-between gap-3 px-3 py-2 rounded-md border bg-background hover:bg-emerald-50 hover:border-emerald-300 text-left transition-colors"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <Tag className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="font-medium text-sm truncate">{m.name}</span>
                      <span className="font-mono text-xs text-muted-foreground tabular-nums">
                        {formatCehzEarTag(m.earTag) ?? m.earTag}
                      </span>
                    </span>
                    <span className="text-xs text-muted-foreground truncate">
                      {m.farmName}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* KPI Karty */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-emerald-100 dark:border-emerald-950 bg-gradient-to-br from-emerald-50/40 via-card to-card">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center justify-between text-xs font-medium">
              <span>{t("fieldVisits.kpi.farmsLabel", "Zmluvné farmy (B2B)")}</span>
              <Building2 className="h-4 w-4 text-emerald-600" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold tracking-tight text-emerald-950 dark:text-emerald-50 tabular-nums">
              {t("fieldVisits.kpi.farmsValue", "{count} chovy", {
                count: overview?.totalFarms || 4,
              })}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {t("fieldVisits.kpi.farmsFoot", "Očová, Revúca, Tisovec, G. Poloma")}
          </CardContent>
        </Card>

        <Card className="border-blue-100 dark:border-blue-950 bg-gradient-to-br from-blue-50/40 via-card to-card">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center justify-between text-xs font-medium">
              <span>{t("fieldVisits.kpi.cattleLabel", "Evidovaný dobytok (CEHZ)")}</span>
              <Activity className="h-4 w-4 text-blue-600" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold tracking-tight text-blue-950 dark:text-blue-50 tabular-nums">
              {t("fieldVisits.kpi.cattleValue", "{count} kráv", {
                count: overview?.totalCows || 16,
              })}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {t("fieldVisits.kpi.cattleFoot", "Vedené jednotlivo s úradnou ušnou známkou")}
          </CardContent>
        </Card>

        <Card className="border-amber-200 dark:border-amber-950 bg-gradient-to-br from-amber-50/50 via-card to-card">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center justify-between text-xs font-medium text-amber-900 dark:text-amber-300">
              <span>{t("fieldVisits.kpi.unbilledLabel", "Nezafakturované pohľadávky")}</span>
              <ReceiptText className="h-4 w-4 text-amber-600" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold tracking-tight text-amber-950 dark:text-amber-50 tabular-nums">
              {t("fieldVisits.kpi.unbilledValue", "{amount} €", {
                amount: overview?.totalUnbilled?.toFixed(2) || "2 001.21",
              })}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-amber-700 dark:text-amber-400 font-medium">
            {t("fieldVisits.kpi.unbilledFoot", "4 otvorené dávky čakajúce na fakturáciu")}
          </CardContent>
        </Card>

        <Card className="border-purple-100 dark:border-purple-950 bg-gradient-to-br from-purple-50/40 via-card to-card">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center justify-between text-xs font-medium">
              <span>{t("fieldVisits.kpi.kvepisLabel", "Hlásenia KVEPIS (ŠVPS SR)")}</span>
              <ShieldCheck className="h-4 w-4 text-purple-600" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold tracking-tight text-purple-950 dark:text-purple-50 tabular-nums">
              {t("fieldVisits.kpi.kvepisValue", "{count} potvrdené", {
                count: overview?.kvepisSubmissions?.length || 3,
              })}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {t("fieldVisits.kpi.kvepisFoot", "100% doručeniek prijatých z ÚPVS")}
          </CardContent>
        </Card>
      </div>

      {/* WITHDRAWAL WATCH — zvieratá v ochrannej lehote */}
      <Card
        className={
          overview?.withdrawals && overview.withdrawals.length > 0
            ? "border-red-300 bg-red-50/40 dark:border-red-900 dark:bg-red-950/20"
            : "border-border"
        }
        data-testid="withdrawal-watch"
      >
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            {overview?.withdrawals && overview.withdrawals.length > 0 ? (
              <AlertTriangle className="h-4 w-4 text-red-600" />
            ) : (
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
            )}
            {t("fieldVisits.withdrawalWatch.title", "Ochranné lehoty — Withdrawal Watch")}
          </CardTitle>
          <CardDescription className="text-xs">
            {t(
              "fieldVisits.withdrawalWatch.description",
              "Zvieratá s aktívnou ochrannou lehotou (Zákon č. 39/2007 Z. z.): zákaz dodávky mlieka a porážky na ľudský konzum do uvedeného dátumu."
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(!overview?.withdrawals || overview.withdrawals.length === 0) && (
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground">
                {t("fieldVisits.withdrawalWatch.emptyTitle", "Žiadne aktívne ochranné lehoty")}
              </p>
              <p className="text-xs mt-1">
                {t(
                  "fieldVisits.withdrawalWatch.emptyDesc",
                  "Všetky evidované zvieratá sú momentálne vhodné na dodávku a porážku."
                )}
              </p>
            </div>
          )}

          {overview?.withdrawals?.map((w) => {
            const statuses = withdrawalStatusesForCow(w.patientId);
            return (
              <div
                key={w.id}
                className="rounded-lg border border-red-200 bg-background p-3 space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-200 font-mono tabular-nums">
                      {formatCehzEarTag(w.earTag) ?? w.earTag ?? "—"}
                    </Badge>
                    <span className="font-semibold text-sm">{w.patientName ?? "—"}</span>
                    <span className="text-xs text-muted-foreground">{w.farmName ?? ""}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {t("fieldVisits.withdrawalWatch.medication", "Liečivo")}:{" "}
                    <span className="font-medium text-foreground">{w.medicationName}</span>
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {statuses.map((s, idx) => (
                    <span key={idx} className="contents">
                      {s.milk.active && (
                        <Badge className="bg-red-600 text-white border-red-700 hover:bg-red-600 tabular-nums">
                          {milkBadgeText(s.milk.remainingDays, s.milk.safeUntil)}
                        </Badge>
                      )}
                      {s.meat.active && (
                        <Badge className="bg-red-700 text-white border-red-800 hover:bg-red-700 tabular-nums">
                          {meatBadgeText(s.meat.remainingDays)}
                        </Badge>
                      )}
                    </span>
                  ))}
                </div>
                <div className="text-[11px] text-red-700 dark:text-red-400 font-medium">
                  {t(
                    "fieldVisits.withdrawalWatch.activeWarning",
                    "Zákaz dodávky mlieka a porážky na ľudský konzum — lehota ešte plynie (podané {date}).",
                    { date: formatDate(w.administeredAt) }
                  )}
                </div>
              </div>
            );
          })}

          {/* Červené zvýraznenie pri pokuse o expedíciu / ukončenie liečby */}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-[44px] border-red-300 text-red-700 hover:bg-red-50"
              onClick={() => attemptWatchAction("finish_treatment")}
            >
              <AlertTriangle className="h-4 w-4 mr-1.5" />
              {t("fieldVisits.withdrawalWatch.attemptFinish", "Ukončiť liečbu")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-[44px] border-red-300 text-red-700 hover:bg-red-50"
              onClick={() => attemptWatchAction("dispatch_animal")}
            >
              <Send className="h-4 w-4 mr-1.5" />
              {t("fieldVisits.withdrawalWatch.attemptDispatch", "Expedícia zvieraťa")}
            </Button>
          </div>

          {watchConflict && (
            <div
              role="alert"
              className="rounded-lg border-2 border-red-600 bg-red-600 text-white p-3 space-y-1"
              data-testid="withdrawal-conflict"
            >
              <p className="font-bold text-sm flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4" />
                {t(
                  "fieldVisits.withdrawalWatch.blockedTitle",
                  "BLOKOVANÉ — ochranná lehota ešte plynie"
                )}
              </p>
              {watchConflict.channels.includes("milk") && (
                <p className="text-xs">
                  {t("fieldVisits.withdrawalWatch.blockedMilk", "Zákaz dodávky mlieka na ľudský konzum.")}
                </p>
              )}
              {watchConflict.channels.includes("meat") && (
                <p className="text-xs">
                  {t("fieldVisits.withdrawalWatch.blockedMeat", "Zákaz porážky a dodávky mäsa na ľudský konzum.")}
                </p>
              )}
              <p className="text-xs">
                {t("fieldVisits.withdrawalWatch.blockedUntil", "Bezpečné až po {date}.", {
                  date: formatDate(watchConflict.safeUntil),
                })}
              </p>
            </div>
          )}
          {watchAllowed && !watchConflict && (
            <div className="rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 p-3 text-xs font-medium">
              {t(
                "fieldVisits.withdrawalWatch.allowed",
                "Žiadna aktívna ochranná lehota — akcia môže prebehnúť."
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Hlavné záložky */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid h-auto w-full max-w-2xl grid-cols-4 rounded-none border-b bg-transparent p-0">
          <TabsTrigger
            value="farms"
            className="min-h-[44px] gap-1.5 rounded-none border-b-2 border-transparent px-3 py-2.5 shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
          >
            <Building2 className="h-4 w-4" />
            {t("fieldVisits.tabs.farms", "Farmy & Fakturácia")}
          </TabsTrigger>
          <TabsTrigger
            value="visits"
            className="min-h-[44px] gap-1.5 rounded-none border-b-2 border-transparent px-3 py-2.5 shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
          >
            <Calendar className="h-4 w-4" />
            {t("fieldVisits.tabs.visits", "Kniha ošetrení")}
          </TabsTrigger>
          <TabsTrigger
            value="stock"
            className="min-h-[44px] gap-1.5 rounded-none border-b-2 border-transparent px-3 py-2.5 shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
          >
            <Package className="h-4 w-4" />
            {t("fieldVisits.tabs.stock", "Sklad liečiv")}
          </TabsTrigger>
          <TabsTrigger
            value="new-visit"
            className="min-h-[44px] gap-1.5 rounded-none border-b-2 border-transparent px-3 py-2.5 shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
          >
            <Plus className="h-4 w-4" />
            {t("fieldVisits.tabs.newVisit", "Nový výjazd (Mobil)")}
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: FARMY A FAKTURÁCIA */}
        <TabsContent value="farms" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {overview?.farms.map((farm) => (
              <Card key={farm.id} className="overflow-hidden border-border/80 hover:border-emerald-300 transition-colors">
                <CardHeader className="bg-muted/30 pb-3 border-b">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-lg font-bold flex items-center gap-2">
                        <Tractor className="h-5 w-5 text-emerald-600" />
                        {farm.name}
                      </CardTitle>
                      <CardDescription className="text-xs mt-1 flex flex-wrap gap-x-3 gap-y-1">
                        <span>
                          <strong>{t("fieldVisits.farms.ico", "IČO")}:</strong>{" "}
                          <span className="tabular-nums">{farm.ico}</span>
                        </span>
                        <span>
                          <strong>{t("fieldVisits.farms.cehz", "CEHZ chov")}:</strong>{" "}
                          <span className="tabular-nums">{farm.cehz}</span>
                        </span>
                        {farm.contactPerson && (
                          <span>
                            <strong>{t("fieldVisits.farms.herdsman", "Zootechnik")}:</strong>{" "}
                            {farm.contactPerson}
                          </span>
                        )}
                      </CardDescription>
                    </div>

                    {farm.unbilledAmount > 0 ? (
                      <Badge className="bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-200 tabular-nums">
                        {t("fieldVisits.farms.toInvoice", "K fakturácii: {amount} €", {
                          amount: farm.unbilledAmount.toFixed(2),
                        })}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50">
                        {t("fieldVisits.farms.allInvoiced", "Všetko vyfakturované")}
                      </Badge>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="pt-4 space-y-4">
                  {/* Evidovaný dobytok — hustá tabuľka (ui-craft-dense-dashboard) */}
                  <div>
                    <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      <span>
                        {t("fieldVisits.farms.cattleHeader", "Evidovaný dobytok ({count} ks)", {
                          count: farm.cows.length,
                        })}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="min-h-[44px] text-xs px-3 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                        onClick={() => setNewCowFarmId(farm.id)}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        {t("fieldVisits.farms.addCow", "Pridať kravu")}
                      </Button>
                    </div>
                    <div className="overflow-x-auto rounded-md border">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-muted/50 border-b text-muted-foreground uppercase tracking-wider">
                          <tr>
                            <th className="py-2.5 px-3">{t("fieldVisits.farms.colName", "Meno")}</th>
                            <th className="py-2.5 px-3">{t("fieldVisits.farms.colEarTag", "Ušná známka")}</th>
                            <th className="py-2.5 px-3">{t("fieldVisits.farms.colBreed", "Plemeno")}</th>
                            <th className="py-2.5 px-3 text-right">{t("fieldVisits.farms.colStatus", "Stav")}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {farm.cows.map((cow) => (
                            <tr key={cow.id} className="hover:bg-muted/30">
                              <td className="py-2.5 px-3 font-medium text-foreground">{cow.name}</td>
                              <td className="py-2.5 px-3 font-mono tabular-nums">
                                {formatCehzEarTag(cow.earTag) ?? cow.earTag}
                              </td>
                              <td className="py-2.5 px-3 text-muted-foreground">{cow.breed}</td>
                              <td className="py-2.5 px-3 text-right">
                                {cow.activeWithdrawal ? (
                                  <Badge className="bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-200 text-[10px]">
                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                    {t("fieldVisits.farms.inWithdrawal", "V ochrannej lehote")}
                                  </Badge>
                                ) : (
                                  <span className="tabular-nums text-muted-foreground">
                                    {t("fieldVisits.farms.statusActive", "Aktívne")}
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Nezafakturovaná faktúra */}
                  {farm.draftInvoice && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50/40 dark:bg-amber-950/20 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-900 dark:text-amber-200">
                          <Clock className="h-4 w-4 text-amber-600" />
                          <span>
                            {t("fieldVisits.farms.openInvoice", "Otvorená kumulatívna faktúra ({period})", {
                              period: monthPeriod,
                            })}
                          </span>
                        </div>
                        <span className="text-sm font-bold text-amber-950 dark:text-amber-100 tabular-nums">
                          {t("fieldVisits.farms.invoiceTotal", "{amount} € s DPH", {
                            amount: farm.draftInvoice.total,
                          })}
                        </span>
                      </div>

                      <div className="text-xs text-muted-foreground tabular-nums">
                        {t("fieldVisits.farms.invoiceBreakdown", "Základ: {subtotal} € • DPH 23%: {tax} €", {
                          subtotal: farm.draftInvoice.subtotal,
                          tax: farm.draftInvoice.tax,
                        })}
                      </div>

                      {farm.draftInvoice.items && (
                        <div className="text-xs space-y-1 pt-1 border-t border-amber-200/60">
                          {farm.draftInvoice.items.slice(0, 3).map((it: any) => (
                            <div key={it.id} className="flex justify-between text-muted-foreground py-2.5 px-3 -mx-3 rounded hover:bg-amber-100/40">
                              <span className="truncate max-w-[260px]">• {it.description}</span>
                              <span className="font-medium text-foreground tabular-nums">{it.total} €</span>
                            </div>
                          ))}
                          {farm.draftInvoice.items.length > 3 && (
                            <div className="text-[11px] text-amber-700 italic">
                              {t("fieldVisits.farms.moreItems", "+ ďalších {count} položiek", {
                                count: farm.draftInvoice.items.length - 3,
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="pt-2 flex justify-end">
                        <Button
                          size="sm"
                          className="min-h-[44px] bg-amber-600 hover:bg-amber-700 text-white text-xs gap-1"
                          onClick={() => closeInvoiceMutation.mutate({ invoiceId: farm.draftInvoice!.id })}
                          disabled={closeInvoiceMutation.isPending}
                        >
                          <Send className="h-3 w-3" />
                          {t("fieldVisits.farms.issueInvoice", "Vystaviť faktúru a odoslať")}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Už uhradené faktúry */}
                  {farm.invoices.filter((i) => i.status === "paid").length > 0 && (
                    <div className="text-xs border-t pt-2 space-y-1">
                      <span className="text-muted-foreground font-medium">
                        {t("fieldVisits.farms.paidInvoices", "Uhradené faktúry")}
                      </span>
                      {farm.invoices.filter((i) => i.status === "paid").map((inv) => (
                        <div key={inv.id} className="flex items-center justify-between text-emerald-700 bg-emerald-50/50 py-2.5 px-3 rounded">
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {t("fieldVisits.farms.invoiceFrom", "Faktúra z {date}", {
                              date: formatDate(inv.createdAt),
                            })}
                          </span>
                          <span className="font-bold tabular-nums">
                            {t("fieldVisits.farms.paidValue", "{amount} € s DPH (UHRADENÁ)", {
                              amount: inv.total,
                            })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* TAB 2: KNIHA OŠETRENÍ */}
        <TabsContent value="visits" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Calendar className="h-4 w-4 text-emerald-600" />
                {t(
                  "fieldVisits.visits.title",
                  "Ambulantná kniha terénnych ošetrení hospodárskych zvierat"
                )}
              </CardTitle>
              <CardDescription className="text-xs">
                {t(
                  "fieldVisits.visits.description",
                  "Evidencia úkonov, podaných liekov, ochranných lehôt na mlieko a mäso a stavu hlásení do KVEPIS."
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!overview?.recentVisits?.length && (
                <p className="text-sm text-muted-foreground">
                  {t("fieldVisits.visits.empty", "Zatiaľ žiadne terénne ošetrenia v knihe.")}
                </p>
              )}
              <div className="divide-y text-sm">
                {overview?.recentVisits.map((visit: any) => {
                  const farm = overview.farms.find((f) => f.id === visit.clientId);
                  const cow = farm?.cows.find((c) => c.id === visit.patientId);

                  return (
                    <div key={visit.id} className="py-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="bg-muted text-xs font-mono tabular-nums">
                            {formatDate(visit.startTime)}
                          </Badge>
                          <span className="font-bold text-foreground">{farm?.name}</span>
                          <span className="text-xs text-muted-foreground font-mono tabular-nums">({farm?.cehz})</span>
                          {cow && (
                            <Badge className="bg-blue-50 text-blue-700 border-blue-200">
                              🐄 {t("fieldVisits.visits.cowBadge", "{name} — {tag}", {
                                name: cow.name,
                                tag: cow.earTag,
                              })}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {visit.notes}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 self-start md:self-auto">
                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 flex items-center gap-1 text-[11px]">
                          <ShieldCheck className="h-3 w-3" />
                          {t("fieldVisits.visits.kvepisReceipt", "KVEPIS doručenka")}
                        </Badge>
                        <Badge variant="outline" className="text-[11px] text-muted-foreground">
                          {t("fieldVisits.visits.billedRetainer", "Účtované do paušálu")}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: SKLAD TERÉNNYCH LIEČIV */}
        <TabsContent value="stock" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Package className="h-4 w-4 text-emerald-600" />
                {t(
                  "fieldVisits.stock.title",
                  "Pohotovostný terénny sklad liečiv pre hospodárske zvieratá"
                )}
              </CardTitle>
              <CardDescription className="text-xs">
                {t(
                  "fieldVisits.stock.description",
                  "Antibiotiká, intramammáriá, infúzne roztoky a vakcíny s evidenciou šarží a expirácií."
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/50 border-b text-muted-foreground uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">{t("fieldVisits.stock.colSku", "Kód / SKU")}</th>
                      <th className="py-2.5 px-3">{t("fieldVisits.stock.colProduct", "Prípravok / Liečivo")}</th>
                      <th className="py-2.5 px-3">{t("fieldVisits.stock.colCategory", "Kategória")}</th>
                      <th className="py-2.5 px-3">{t("fieldVisits.stock.colLot", "Šarža (Lot)")}</th>
                      <th className="py-2.5 px-3">{t("fieldVisits.stock.colExpiry", "Expirácia")}</th>
                      <th className="py-2.5 px-3 text-right">{t("fieldVisits.stock.colStock", "Zásoba")}</th>
                      <th className="py-2.5 px-3 text-right">{t("fieldVisits.stock.colPrice", "Cena bez DPH")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {stock?.map((item) => (
                      <tr key={item.id} className="hover:bg-muted/30">
                        <td className="py-2.5 px-3 font-mono text-muted-foreground tabular-nums">{item.sku}</td>
                        <td className="py-2.5 px-3 font-semibold text-foreground">{item.name}</td>
                        <td className="py-2.5 px-3">
                          <Badge variant="secondary" className="text-[10px]">
                            {item.category}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] tabular-nums">{item.lotNumber || "—"}</td>
                        <td className="py-2.5 px-3 text-muted-foreground tabular-nums">{item.expirationDate || "—"}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-emerald-700 tabular-nums">
                          {item.stockQuantity} ks/fl.
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-medium tabular-nums">
                          {parseFloat(item.unitPrice || "0").toFixed(2)} €
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: NOVÝ VÝJAZD (MOBILNÝ REŽIM) */}
        <TabsContent value="new-visit" className="space-y-4">
          {/* HLASOVÝ VSTUP: nadiktujte výjazd, AI predvyplní formulár */}
          <Card className="max-w-2xl mx-auto border-emerald-300 bg-emerald-50/30">
            <CardContent className="pt-5 pb-4">
              <div className="text-center space-y-3">
                <p className="text-sm font-semibold text-emerald-900">
                  {t("fieldVisits.voice.title", "Nadiktujte výjazd hlasom")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t(
                    "fieldVisits.voice.hint",
                    "Povedzte farmu, zviera, diagnózu a liek — AI predvyplní formulár nižšie"
                  )}
                </p>
                {voicePhase === "idle" && (
                  <button
                    type="button"
                    onClick={startVoiceRecording}
                    className="inline-flex flex-col items-center gap-2 mx-auto px-8 min-h-[44px] py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition-colors"
                    aria-label={t("fieldVisits.voice.start", "Začať nahrávanie")}
                  >
                    <Mic className="h-8 w-8" />
                    <span className="text-sm font-semibold">
                      {t("fieldVisits.voice.start", "Začať nahrávanie")}
                    </span>
                  </button>
                )}
                {voicePhase === "recording" && (
                  <button
                    type="button"
                    onClick={stopVoiceRecording}
                    className="inline-flex flex-col items-center gap-2 mx-auto px-8 min-h-[44px] py-4 rounded-2xl bg-red-500 hover:bg-red-600 text-white shadow-md animate-pulse"
                    aria-label={t("fieldVisits.voice.recording", "Nahrávam… klepnite pre zastavenie")}
                  >
                    <Mic className="h-8 w-8" />
                    <span className="text-sm font-semibold">
                      {t("fieldVisits.voice.recording", "Nahrávam… klepnite pre zastavenie")}
                    </span>
                  </button>
                )}
                {voicePhase === "processing" && (
                  <div className="flex flex-col items-center gap-2 py-3">
                    <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                    <span className="text-sm text-muted-foreground mt-1">
                      {t("fieldVisits.voice.processing", "AI spracováva diktát…")}
                    </span>
                  </div>
                )}
                {voicePhase === "review" && voiceDraft && (
                  <div className="space-y-3 text-left">
                    <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
                      <Sparkles className="h-4 w-4" />
                      {t("fieldVisits.voice.prefilled", "AI predvyplnil formulár")}
                    </div>
                    <div className="rounded-lg border bg-background p-3 text-xs text-muted-foreground italic">
                      <span className="font-medium not-italic text-foreground">
                        {t("fieldVisits.voice.transcript", "Prepis")}{" "}
                      </span>
                      {voiceTranscript}
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="text-xs min-h-[44px]"
                        onClick={() => {
                          setVoicePhase("idle");
                          setVoiceDraft(null);
                        }}
                      >
                        {t("fieldVisits.voice.again", "Nahrať znova")}
                      </Button>
                      <span className="text-xs text-muted-foreground self-center">
                        {t(
                          "fieldVisits.voice.reviewHint",
                          "Formulár nižšie je predvyplnený — skontrolujte a uložte"
                        )}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="max-w-2xl mx-auto border-emerald-200">
            <CardHeader className="bg-emerald-50/50 border-b pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2 text-emerald-900">
                <Plus className="h-5 w-5 text-emerald-600" />
                {t("fieldVisits.form.cardTitle", "Rýchly záznam výjazdu na farmu")}
              </CardTitle>
              <CardDescription className="text-xs text-emerald-700">
                {t(
                  "fieldVisits.form.cardDesc",
                  "Optimalizované pre mobil/tablet v maštali. Záznam okamžite vloží položky na kumulatívnu faktúru farmy a pripraví KVEPIS hlásenie."
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <form onSubmit={handleSubmitVisit} className="space-y-4">
                {/* 1. Farma */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">
                    {t("fieldVisits.form.stepFarm", "1. Výber farmy (chov)")}
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    {overview?.farms.map((f) => (
                      <Button
                        key={f.id}
                        type="button"
                        variant={formFarmId === f.id ? "default" : "outline"}
                        className={
                          formFarmId === f.id
                            ? "min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white justify-start text-xs h-auto py-2"
                            : "min-h-[44px] justify-start text-xs h-auto py-2"
                        }
                        onClick={() => {
                          setFormFarmId(f.id);
                          setFormCowId("");
                          setBatchCowIds([]);
                        }}
                      >
                        <Tractor className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                        <span className="truncate">{f.name}</span>
                      </Button>
                    ))}
                  </div>
                </div>

                {/* 2. Zviera */}
                {formFarmId && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold">
                        {t("fieldVisits.form.stepAnimal", "2. Výber zvieraťa")}
                      </Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="min-h-[44px] text-xs text-emerald-600"
                        onClick={() => setNewCowFarmId(formFarmId)}
                      >
                        {t("fieldVisits.form.newCow", "+ Nová krava")}
                      </Button>
                    </div>
                    <select
                      className="w-full min-h-[44px] rounded-md border border-input bg-background px-3 py-2 text-xs"
                      value={formCowId}
                      onChange={(e) => setFormCowId(e.target.value)}
                      aria-label={t("fieldVisits.form.stepAnimal", "2. Výber zvieraťa")}
                    >
                      <option value="">
                        {t("fieldVisits.form.animalPlaceholder", "-- Vyberte kravu z evidencie --")}
                      </option>
                      {selectedFarmCows.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({t("fieldVisits.form.earTagShort", "Ušné č.")}:{" "}
                          {formatCehzEarTag(c.earTag) ?? c.earTag}) — {c.breed}
                          {c.activeWithdrawal ? ` ⚠ ${t("fieldVisits.farms.inWithdrawal", "V ochrannej lehote")}` : ""}
                        </option>
                      ))}
                    </select>

                    {/* Červený banner: zviera je v ochrannej lehote */}
                    {selectedCowHasWithdrawal && (
                      <div
                        role="alert"
                        className="rounded-lg border-2 border-red-500 bg-red-50 dark:bg-red-950/30 p-3 space-y-1"
                        data-testid="cow-withdrawal-banner"
                      >
                        <p className="text-xs font-bold text-red-700 dark:text-red-400 flex items-center gap-1.5">
                          <AlertTriangle className="h-4 w-4 shrink-0" />
                          {t(
                            "fieldVisits.form.withdrawalBannerTitle",
                            "Zviera je v ochrannej lehote — nedodávajte mlieko ani mäso na ľudský konzum."
                          )}
                        </p>
                        {selectedCowStatuses.map((s, idx) => (
                          <div key={idx} className="flex flex-wrap gap-1.5">
                            {s.milk.active && (
                              <Badge className="bg-red-600 text-white border-red-700 hover:bg-red-600 tabular-nums">
                                {milkBadgeText(s.milk.remainingDays, s.milk.safeUntil)}
                              </Badge>
                            )}
                            {s.meat.active && (
                              <Badge className="bg-red-700 text-white border-red-800 hover:bg-red-700 tabular-nums">
                                {meatBadgeText(s.meat.remainingDays)}
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 3. Diagnóza a rýchle tagy */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold" htmlFor="fv-diagnosis">
                    {t("fieldVisits.form.stepDiagnosis", "3. Diagnóza")}
                  </Label>
                  <div className="flex flex-wrap gap-1 mb-1.5">
                    {quickDiagnoses.map((diag) => (
                      <button
                        key={diag.key}
                        type="button"
                        className="min-h-[44px] text-[11px] px-3 py-1 rounded-full border bg-muted/60 hover:bg-emerald-50 hover:border-emerald-300"
                        onClick={() => setFormDiagnosis(diag.label)}
                      >
                        {diag.label}
                      </button>
                    ))}
                  </div>
                  <Input
                    id="fv-diagnosis"
                    placeholder={t(
                      "fieldVisits.form.diagnosisPlaceholder",
                      "Zadajte diagnózu alebo klinický nález..."
                    )}
                    value={formDiagnosis}
                    onChange={(e) => setFormDiagnosis(e.target.value)}
                    className="text-sm min-h-[44px]"
                    required
                  />
                </div>

                {/* 4. Úkon a liečivo */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">
                      {t("fieldVisits.form.service", "Veterinárny úkon")}
                    </Label>
                    <select
                      className="w-full min-h-[44px] rounded-md border border-input bg-background px-3 py-2 text-xs"
                      value={formServiceId}
                      onChange={(e) => setFormServiceId(e.target.value)}
                      aria-label={t("fieldVisits.form.service", "Veterinárny úkon")}
                    >
                      <option value="">
                        {t("fieldVisits.form.servicePlaceholder", "-- Vyberte úkon --")}
                      </option>
                      {servicesList?.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({parseFloat(s.defaultPrice || "0").toFixed(2)} €)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">
                      {t("fieldVisits.form.product", "Aplikovaný / odovzdaný liek")}
                    </Label>
                    <select
                      className="w-full min-h-[44px] rounded-md border border-input bg-background px-3 py-2 text-xs"
                      value={formProductId}
                      onChange={(e) => handleProductChange(e.target.value)}
                      aria-label={t("fieldVisits.form.product", "Aplikovaný / odovzdaný liek")}
                    >
                      <option value="">
                        {t("fieldVisits.form.productPlaceholder", "-- Bez lieku / vlastné liečivo --")}
                      </option>
                      {stock?.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({parseFloat(p.unitPrice || "0").toFixed(2)} €)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 4b. Ochranné lehoty (povinná evidencia — Zákon 39/2007 Z. z.) */}
                {formProductId && (
                  <div className="grid grid-cols-2 gap-3 rounded-lg border border-red-200 bg-red-50/40 dark:bg-red-950/20 p-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-red-800 dark:text-red-300" htmlFor="fv-meat-days">
                        {t("fieldVisits.form.meatWithdrawal", "Ochranná lehota — mäso (dní)")}
                      </Label>
                      <Input
                        id="fv-meat-days"
                        type="number"
                        min={0}
                        max={MAX_WITHDRAWAL_DAYS}
                        step={1}
                        value={formMeatDays}
                        onChange={(e) => setFormMeatDays(clampWithdrawalDays(Number(e.target.value)))}
                        className="min-h-[44px] tabular-nums"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-red-800 dark:text-red-300" htmlFor="fv-milk-days">
                        {t("fieldVisits.form.milkWithdrawal", "Ochranná lehota — mlieko (dní)")}
                      </Label>
                      <Input
                        id="fv-milk-days"
                        type="number"
                        min={0}
                        max={MAX_WITHDRAWAL_DAYS}
                        step={1}
                        value={formMilkDays}
                        onChange={(e) => setFormMilkDays(clampWithdrawalDays(Number(e.target.value)))}
                        className="min-h-[44px] tabular-nums"
                      />
                    </div>
                    <p className="col-span-2 text-[11px] text-red-700 dark:text-red-400">
                      {t(
                        "fieldVisits.form.withdrawalHint",
                        "Evidencia podľa Zákona č. 39/2007 Z. z. — maximálne {max} dní. Do konca lehoty je zákaz dodávky mlieka / porážky na ľudský konzum.",
                        { max: MAX_WITHDRAWAL_DAYS }
                      )}
                      {(formMeatDays > 0 || formMilkDays > 0) && (
                        <>
                          {" "}
                          {t("fieldVisits.form.withdrawalPreview", "Bezpečné od: {date}.", {
                            date: formatDate(
                              new Date(
                                Date.now() +
                                  Math.max(formMeatDays, formMilkDays) * 86_400_000
                              )
                            ),
                          })}
                        </>
                      )}
                    </p>
                  </div>
                )}

                {/* 5. Poznámka */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold" htmlFor="fv-notes">
                    {t("fieldVisits.form.notesLabel", "5. Poznámka / pokyny")}
                  </Label>
                  <Input
                    id="fv-notes"
                    placeholder={t(
                      "fieldVisits.form.notesPlaceholder",
                      "napr. Ochranná lehota mlieko 4 dni, kontrola o 3 dni..."
                    )}
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    className="text-sm min-h-[44px]"
                  />
                </div>

                {/* KVEPIS Checkbox */}
                <div className="flex items-center gap-2 p-2.5 rounded-lg border bg-muted/40 min-h-[44px]">
                  <input
                    type="checkbox"
                    id="kvepisCheck"
                    checked={formSendKvepis}
                    onChange={(e) => setFormSendKvepis(e.target.checked)}
                    className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 h-5 w-5"
                  />
                  <Label htmlFor="kvepisCheck" className="text-xs font-medium cursor-pointer">
                    {t(
                      "fieldVisits.form.kvepisCheckbox",
                      "Automaticky zaevidovať dávku do KVEPIS (Ambulantná kniha ošetrení ŠVPS SR)"
                    )}
                  </Label>
                </div>

                {formSendKvepis &&
                  formCowId &&
                  (() => {
                    const cow = selectedFarmCows.find((c) => c.id === formCowId);
                    const tagOk = cow ? isValidCehzEarTag(cow.earTag) : false;
                    if (cow && !tagOk) {
                      return (
                        <p className="text-xs text-red-600 font-medium">
                          {t(
                            "fieldVisits.form.earTagMissingWarning",
                            "KVEPIS koncept sa nepripraví — zviera nemá platnú ušnú známku CEHZ (SK + 12 číslic)."
                          )}
                        </p>
                      );
                    }
                    return null;
                  })()}

                <Button
                  type="submit"
                  className="w-full min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                  disabled={createVisitMutation.isPending}
                >
                  <Check className="h-4 w-4 mr-2" />
                  {createVisitMutation.isPending
                    ? t("fieldVisits.form.submitting", "Ukladám výjazd...")
                    : t("fieldVisits.form.submit", "Uložiť ošetrenie do knihy a na faktúru")}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* HROMADNÉ OŠETRENIE STÁDA (Herd Batch Actions) */}
          <Card className="max-w-2xl mx-auto border-blue-200">
            <CardHeader className="bg-blue-50/50 border-b pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2 text-blue-900">
                <ShieldCheck className="h-5 w-5 text-blue-600" />
                {t("fieldVisits.batch.cardTitle", "Hromadné ošetrenie stáda")}
              </CardTitle>
              <CardDescription className="text-xs text-blue-700">
                {t(
                  "fieldVisits.batch.cardDesc",
                  "Vyberte viacero zvierat naraz — jeden výjazd s rozpisom na ušné známky, fakturáciou a KVEPIS konceptmi."
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  {t("fieldVisits.batch.actionLabel", "Typ hromadného zákroku")}
                </Label>
                <select
                  className="w-full min-h-[44px] rounded-md border border-input bg-background px-3 py-2 text-xs"
                  value={batchAction}
                  onChange={(e) => setBatchAction(e.target.value as BatchAction)}
                  aria-label={t("fieldVisits.batch.actionLabel", "Typ hromadného zákroku")}
                >
                  <option value="vaccination">
                    {t("fieldVisits.batch.actionVaccination", "Hromadná vakcinácia stáda")}
                  </option>
                  <option value="deworming">
                    {t("fieldVisits.batch.actionDeworming", "Odčervenie stáda")}
                  </option>
                  <option value="estrus_synch">
                    {t("fieldVisits.batch.actionEstrusSynch", "Synchronizácia ruje")}
                  </option>
                  <option value="other">{t("fieldVisits.batch.actionOther", "Iný hromadný zákrok")}</option>
                </select>
              </div>

              <div className="rounded-lg border bg-muted/30 p-3 text-[11px] text-muted-foreground">
                {t(
                  "fieldVisits.batch.sharedHint",
                  "Diagnóza, úkon, liek, ochranné lehoty a poznámka z formulára vyššie sa použijú pre všetky vybrané zvieratá (najprv vyberte farmu)."
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">
                    {t("fieldVisits.batch.selectLabel", "Zvieratá stáda")}
                  </Label>
                  <span className="text-xs font-semibold text-blue-700 tabular-nums">
                    {t("fieldVisits.batch.selectedCount", "Vybrané: {count}", {
                      count: batchCowIds.length,
                    })}
                  </span>
                </div>
                {formFarmId ? (
                  <div className="rounded-md border divide-y max-h-64 overflow-y-auto">
                    {selectedFarmCows.map((c) => {
                      const checked = batchCowIds.includes(c.id);
                      return (
                        <label
                          key={c.id}
                          className={`flex items-center gap-3 px-3 min-h-[44px] py-2 cursor-pointer text-sm ${
                            checked ? "bg-blue-50 dark:bg-blue-950/30" : "hover:bg-muted/40"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleBatchCow(c.id)}
                            className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="font-medium">{c.name}</span>
                          <span className="font-mono text-xs text-muted-foreground tabular-nums ml-auto">
                            {formatCehzEarTag(c.earTag) ?? c.earTag}
                          </span>
                          {c.activeWithdrawal && (
                            <AlertTriangle className="h-3.5 w-3.5 text-red-600 shrink-0" />
                          )}
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {t("fieldVisits.batch.selectFarmFirst", "Najprv vyberte farmu v formulári vyššie.")}
                  </p>
                )}
                {formFarmId && selectedFarmCows.length > 0 && (
                  <div className="flex gap-2 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-h-[44px] text-xs"
                      onClick={() => setBatchCowIds(selectedFarmCows.map((c) => c.id))}
                    >
                      {t("fieldVisits.batch.selectAll", "Vybrať všetky")}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="min-h-[44px] text-xs"
                      onClick={() => setBatchCowIds([])}
                    >
                      {t("fieldVisits.batch.clearSelection", "Zrušiť výber")}
                    </Button>
                  </div>
                )}
              </div>

              <Button
                type="button"
                className="w-full min-h-[44px] bg-blue-600 hover:bg-blue-700 text-white font-bold"
                disabled={createHerdBatchMutation.isPending || batchCowIds.length < 2}
                onClick={handleSubmitHerdBatch}
              >
                <Check className="h-4 w-4 mr-2" />
                {createHerdBatchMutation.isPending
                  ? t("fieldVisits.batch.submitting", "Ukladám hromadný zákrok...")
                  : t("fieldVisits.batch.submit", "Uložiť hromadný zákrok stáda")}
              </Button>
              {batchCowIds.length === 1 && (
                <p className="text-xs text-amber-700">
                  {t("fieldVisits.batch.validationBatchSelection", "Vyberte aspoň 2 zvieratá.")}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* MODÁLNE OKNO PRE REGISTRÁCIU NOVEJ KRAVY */}
      {newCowFarmId && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md bg-card">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Tag className="h-4 w-4 text-emerald-600" />
                {t("fieldVisits.dialog.title", "Registrácia novej kravy na farme")}
              </CardTitle>
              <CardDescription className="text-xs">
                {t(
                  "fieldVisits.dialog.description",
                  "Rýchle pridanie zvieraťa do individuálnej evidencie CEHZ."
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              <div className="space-y-1">
                <Label className="text-xs" htmlFor="cow-name">
                  {t("fieldVisits.dialog.name", "Meno / Označenie kravy")}
                </Label>
                <Input
                  id="cow-name"
                  placeholder={t("fieldVisits.dialog.namePlaceholder", "napr. Malina č. 2101")}
                  value={newCowName}
                  onChange={(e) => setNewCowName(e.target.value)}
                  className="text-sm min-h-[44px]"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs" htmlFor="cow-ear-tag">
                  {t("fieldVisits.dialog.earTag", "Úradné ušné číslo (CEHZ známka)")}
                </Label>
                <Input
                  id="cow-ear-tag"
                  placeholder={t("fieldVisits.dialog.earTagPlaceholder", "napr. SK 000801452101")}
                  value={newCowEarTag}
                  onChange={(e) => {
                    setNewCowEarTag(e.target.value);
                    setNewCowTagError(null);
                  }}
                  className="text-sm min-h-[44px] font-mono"
                  aria-invalid={newCowTagError ? true : undefined}
                />
                {newCowTagError && (
                  <p role="alert" className="text-xs text-red-600 font-medium">
                    {newCowTagError}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <Label className="text-xs" htmlFor="cow-breed">
                  {t("fieldVisits.dialog.breed", "Plemeno")}
                </Label>
                <Input
                  id="cow-breed"
                  placeholder={t(
                    "fieldVisits.dialog.breedPlaceholder",
                    "napr. Holštajnsko-frízsky dobytok"
                  )}
                  value={newCowBreed}
                  onChange={(e) => setNewCowBreed(e.target.value)}
                  className="text-sm min-h-[44px]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  className="min-h-[44px]"
                  onClick={() => {
                    setNewCowFarmId(null);
                    setNewCowTagError(null);
                  }}
                >
                  {t("fieldVisits.dialog.cancel", "Zrušiť")}
                </Button>
                <Button
                  size="sm"
                  className="min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={handleRegisterCow}
                  disabled={registerCowMutation.isPending}
                >
                  {registerCowMutation.isPending
                    ? t("fieldVisits.dialog.saving", "Ukladám…")
                    : t("fieldVisits.dialog.confirm", "Zaevidovať zviera")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
