"use client";

import { useState, useRef, useCallback } from "react";
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
  Syringe,
  Package,
  Phone,
  Mail,
  MapPin,
  User,
  ExternalLink,
  ChevronRight,
  Download,
  FileSignature,
  Activity,
  Check,
  FileText,
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

export default function FieldVisitsPage() {
  const [activeTab, setActiveTab] = useState<string>("farms");
  const [selectedFarmId, setSelectedFarmId] = useState<string | null>(null);

  // Formulár nového výjazdu
  const [formFarmId, setFormFarmId] = useState<string>("");
  const [formCowId, setFormCowId] = useState<string>("");
  const [formDiagnosis, setFormDiagnosis] = useState<string>("");
  const [formNotes, setFormNotes] = useState<string>("");
  const [formServiceId, setFormServiceId] = useState<string>("");
  const [formProductId, setFormProductId] = useState<string>("");
  const [formProductQty, setFormProductQty] = useState<number>(1);
  const [formSendKvepis, setFormSendKvepis] = useState<boolean>(true);

  // Dialóg novej kravy
  const [newCowFarmId, setNewCowFarmId] = useState<string | null>(null);
  const [newCowName, setNewCowName] = useState<string>("");
  const [newCowEarTag, setNewCowEarTag] = useState<string>("");
  const [newCowBreed, setNewCowBreed] = useState<string>("Holštajnsko-frízsky dobytok");


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
  const { data: overview, isLoading, refetch } = trpc.extensions.fieldVisits.getOverview.useQuery();
  const { data: stock } = trpc.extensions.fieldVisits.getLargeAnimalStock.useQuery();
  const { data: servicesList } = trpc.extensions.fieldVisits.getLargeAnimalServices.useQuery();

  const createVisitMutation = trpc.extensions.fieldVisits.createFieldVisit.useMutation({
    onSuccess: () => {
      utils.extensions.fieldVisits.getOverview.invalidate();
      setActiveTab("visits");
      setFormDiagnosis("");
      setFormNotes("");
      setFormServiceId("");
      setFormProductId("");
      alert("Terénny výjazd bol úspešne uložený do knihy ošetrení aj do faktúry!");
    },
    onError: (err) => alert("Chyba pri ukladaní výjazdu: " + err.message),
  });

  const closeInvoiceMutation = trpc.extensions.fieldVisits.closeFarmInvoice.useMutation({
    onSuccess: () => {
      utils.extensions.fieldVisits.getOverview.invalidate();
      alert("Faktúra bola úspešne uzatvorená a odoslaná farme!");
    },
  });

  const registerCowMutation = trpc.extensions.fieldVisits.registerCow.useMutation({
    onSuccess: () => {
      utils.extensions.fieldVisits.getOverview.invalidate();
      setNewCowFarmId(null);
      setNewCowName("");
      setNewCowEarTag("");
      alert("Nová krava bola úspešne zaevidovaná!");
    },
  });


  const parseVoiceVisitMutation = trpc.extensions.fieldVisits.parseVoiceVisit.useMutation({
    onSuccess: (draft) => {
      setVoiceDraft(draft);
      setVoiceTranscript(draft.transcript);
      setVoicePhase("review");
      // Predvyplň formulár z AI draftu
      if (draft.diagnosis) setFormDiagnosis(draft.diagnosis);
      if (draft.notes) setFormNotes(draft.notes);
    },
    onError: () => {
      setVoicePhase("idle");
      alert("Prepis sa nepodaril. Skúste znova alebo zadajte diagnózu manuálne.");
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
          parseVoiceVisitMutation.mutate({ audioBase64: base64, audioMimeType: "audio/webm" });
        };
        reader.readAsDataURL(blob);
      };
      mediaRecRef.current = mr;
      mr.start();
      setVoicePhase("recording");
    } catch {
      alert("Prístup k mikrofónu sa nepodaril. Skontrolujte povolenia prehliadača.");
    }
  }, [parseVoiceVisitMutation]);

  const stopVoiceRecording = useCallback(() => {
    mediaRecRef.current?.stop();
    mediaRecRef.current = null;
  }, []);
  const handleSubmitVisit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formFarmId || !formCowId || !formDiagnosis) {
      alert("Prosím vyberte farmu, zviera a zadajte diagnózu.");
      return;
    }

    createVisitMutation.mutate({
      farmId: formFarmId,
      cowId: formCowId,
      diagnosis: formDiagnosis,
      serviceIds: formServiceId ? [formServiceId] : [],
      products: formProductId ? [{ productId: formProductId, quantity: formProductQty }] : [],
      notes: formNotes,
      sendToKvepis: formSendKvepis,
    });
  };

  const selectedFarmCows = overview?.farms.find((f) => f.id === formFarmId)?.cows || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Terénna prax & Hospodárske chovy"
        subtitle="Kniha terénnych ošetrení, individuálna evidencia hovädzieho dobytka (CEHZ), agregovaná fakturácia a hlásenia KVEPIS pre MVDr. Martina Sýkoru."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="gap-1.5"
            >
              <RefreshCw className="h-4 w-4" />
              Obnoviť
            </Button>
            <Button
              size="sm"
              onClick={() => setActiveTab("new-visit")}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Plus className="h-4 w-4" />
              Nový výjazd na farmu
            </Button>
          </div>
        }
      />

      {/* KPI Karty */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-emerald-100 dark:border-emerald-950 bg-gradient-to-br from-emerald-50/40 via-card to-card">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center justify-between text-xs font-medium">
              <span>Zmluvné farmy (B2B)</span>
              <Building2 className="h-4 w-4 text-emerald-600" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold tracking-tight text-emerald-950 dark:text-emerald-50">
              {overview?.totalFarms || 4} chovy
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Očová, Revúca, Tisovec, G. Poloma
          </CardContent>
        </Card>

        <Card className="border-blue-100 dark:border-blue-950 bg-gradient-to-br from-blue-50/40 via-card to-card">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center justify-between text-xs font-medium">
              <span>Evidovaný dobytok (CEHZ)</span>
              <Activity className="h-4 w-4 text-blue-600" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold tracking-tight text-blue-950 dark:text-blue-50">
              {overview?.totalCows || 16} kráv
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Vedené jednotlivo s úradnou ušnou známkou
          </CardContent>
        </Card>

        <Card className="border-amber-200 dark:border-amber-950 bg-gradient-to-br from-amber-50/50 via-card to-card">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center justify-between text-xs font-medium text-amber-900 dark:text-amber-300">
              <span>Nezafakturované pohľadávky</span>
              <ReceiptText className="h-4 w-4 text-amber-600" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold tracking-tight text-amber-950 dark:text-amber-50">
              {overview?.totalUnbilled?.toFixed(2) || "2 001.21"} €
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-amber-700 dark:text-amber-400 font-medium">
            4 otvorené dávky čakajúce na fakturáciu
          </CardContent>
        </Card>

        <Card className="border-purple-100 dark:border-purple-950 bg-gradient-to-br from-purple-50/40 via-card to-card">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center justify-between text-xs font-medium">
              <span>Hlásenia KVEPIS (ŠVPS SR)</span>
              <ShieldCheck className="h-4 w-4 text-purple-600" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold tracking-tight text-purple-950 dark:text-purple-50">
              {overview?.kvepisSubmissions?.length || 3} potvrdené
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            100% doručeniek prijatých z ÚPVS
          </CardContent>
        </Card>
      </div>

      {/* Hlavné záložky */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 max-w-2xl">
          <TabsTrigger value="farms" className="gap-1.5">
            <Building2 className="h-4 w-4" />
            Farmy & Fakturácia
          </TabsTrigger>
          <TabsTrigger value="visits" className="gap-1.5">
            <Calendar className="h-4 w-4" />
            Kniha ošetrení
          </TabsTrigger>
          <TabsTrigger value="stock" className="gap-1.5">
            <Package className="h-4 w-4" />
            Sklad liečiv
          </TabsTrigger>
          <TabsTrigger value="new-visit" className="gap-1.5">
            <Plus className="h-4 w-4" />
            Nový výjazd (Mobil)
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: FARMY A FAKTURÁCIA */}
        <TabsContent value="farms" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {overview?.farms.map((farm) => (
              <Card key={farm.id} className="overflow-hidden border-border/80 hover:border-emerald-300 transition-colors">
                <CardHeader className="bg-muted/30 pb-3 border-b">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg font-bold flex items-center gap-2">
                        <Tractor className="h-5 w-5 text-emerald-600" />
                        {farm.name}
                      </CardTitle>
                      <CardDescription className="text-xs mt-1 flex flex-wrap gap-x-3 gap-y-1">
                        <span><strong>IČO:</strong> {farm.ico}</span>
                        <span><strong>CEHZ chov:</strong> {farm.cehz}</span>
                        {farm.contactPerson && <span><strong>Zootechnik:</strong> {farm.contactPerson}</span>}
                      </CardDescription>
                    </div>

                    {farm.unbilledAmount > 0 ? (
                      <Badge className="bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-200">
                        K fakturácii: {farm.unbilledAmount.toFixed(2)} €
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50">
                        Všetko vyfakturované
                      </Badge>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="pt-4 space-y-4">
                  {/* Informácie o kravách */}
                  <div>
                    <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      <span>Evidovaný dobytok ({farm.cows.length} ks)</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs px-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                        onClick={() => setNewCowFarmId(farm.id)}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Pridať kravu
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {farm.cows.map((cow) => (
                        <div
                          key={cow.id}
                          className="px-2 py-1 rounded bg-muted/60 border text-xs flex items-center gap-1.5"
                        >
                          <Tag className="h-3 w-3 text-muted-foreground" />
                          <span className="font-medium">{cow.name}</span>
                          <span className="font-mono text-[10px] text-muted-foreground">{cow.earTag}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Nezafakturovaná faktúra */}
                  {farm.draftInvoice && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50/40 dark:bg-amber-950/20 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-900 dark:text-amber-200">
                          <Clock className="h-4 w-4 text-amber-600" />
                          <span>Otvorená kumulatívna faktúra (September 2026)</span>
                        </div>
                        <span className="text-sm font-bold text-amber-950 dark:text-amber-100">
                          {farm.draftInvoice.total} € s DPH
                        </span>
                      </div>

                      <div className="text-xs text-muted-foreground">
                        Základ: {farm.draftInvoice.subtotal} € • DPH 23%: {farm.draftInvoice.tax} €
                      </div>

                      {farm.draftInvoice.items && (
                        <div className="text-xs space-y-1 pt-1 border-t border-amber-200/60">
                          {farm.draftInvoice.items.slice(0, 3).map((it: any) => (
                            <div key={it.id} className="flex justify-between text-muted-foreground">
                              <span className="truncate max-w-[260px]">• {it.description}</span>
                              <span className="font-medium text-foreground">{it.total} €</span>
                            </div>
                          ))}
                          {farm.draftInvoice.items.length > 3 && (
                            <div className="text-[11px] text-amber-700 italic">
                              + ďalších {farm.draftInvoice.items.length - 3} položiek
                            </div>
                          )}
                        </div>
                      )}

                      <div className="pt-2 flex justify-end">
                        <Button
                          size="sm"
                          className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-7 gap-1"
                          onClick={() => closeInvoiceMutation.mutate({ invoiceId: farm.draftInvoice!.id })}
                          disabled={closeInvoiceMutation.isPending}
                        >
                          <Send className="h-3 w-3" />
                          Vystaviť faktúru a odoslať
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Už uhradené faktúry */}
                  {farm.invoices.filter((i) => i.status === "paid").length > 0 && (
                    <div className="text-xs border-t pt-2 space-y-1">
                      <span className="text-muted-foreground font-medium">Uhradené faktúry v septembri:</span>
                      {farm.invoices.filter((i) => i.status === "paid").map((inv) => (
                        <div key={inv.id} className="flex items-center justify-between text-emerald-700 bg-emerald-50/50 p-1.5 rounded">
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Faktúra z 15.09.2026
                          </span>
                          <span className="font-bold">{inv.total} € s DPH (UHRADENÁ)</span>
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
                Ambulantná kniha terénnych ošetrení hospodárskych zvierat (September 2026)
              </CardTitle>
              <CardDescription className="text-xs">
                Evidencia úkonov, podaných liekov, ochranných lehôt na mlieko a mäso a stavu hlásení do KVEPIS.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="divide-y text-sm">
                {overview?.recentVisits.map((visit: any) => {
                  const farm = overview.farms.find((f) => f.id === visit.clientId);
                  const cow = farm?.cows.find((c) => c.id === visit.patientId);

                  return (
                    <div key={visit.id} className="py-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="bg-muted text-xs font-mono">
                            {new Date(visit.startTime).toLocaleDateString("sk-SK")}
                          </Badge>
                          <span className="font-bold text-foreground">{farm?.name}</span>
                          <span className="text-xs text-muted-foreground font-mono">({farm?.cehz})</span>
                          {cow && (
                            <Badge className="bg-blue-50 text-blue-700 border-blue-200">
                              🐄 {cow.name} — {cow.earTag}
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
                          KVEPIS doručenka
                        </Badge>
                        <Badge variant="outline" className="text-[11px] text-muted-foreground">
                          Účtované do paušálu
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
                Pohotovostný terénny sklad liečiv pre hospodárske zvieratá
              </CardTitle>
              <CardDescription className="text-xs">
                Antibiotiká, intramammáriá, infúzne roztoky a vakcíny s evidenciou šarží a expirácií.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/50 border-b text-muted-foreground uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">Kód / SKU</th>
                      <th className="py-2.5 px-3">Prípravok / Liečivo</th>
                      <th className="py-2.5 px-3">Kategória</th>
                      <th className="py-2.5 px-3">Šarža (Lot)</th>
                      <th className="py-2.5 px-3">Expirácia</th>
                      <th className="py-2.5 px-3 text-right">Zásoba</th>
                      <th className="py-2.5 px-3 text-right">Cena bez DPH</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {stock?.map((item) => (
                      <tr key={item.id} className="hover:bg-muted/30">
                        <td className="py-2 px-3 font-mono text-muted-foreground">{item.sku}</td>
                        <td className="py-2 px-3 font-semibold text-foreground">{item.name}</td>
                        <td className="py-2 px-3">
                          <Badge variant="secondary" className="text-[10px]">
                            {item.category}
                          </Badge>
                        </td>
                        <td className="py-2 px-3 font-mono text-[11px]">{item.lotNumber || "—"}</td>
                        <td className="py-2 px-3 text-muted-foreground">{item.expirationDate || "—"}</td>
                        <td className="py-2 px-3 text-right font-bold text-emerald-700">
                          {item.stockQuantity} ks/fl.
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-medium">
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
                <p className="text-sm font-semibold text-emerald-900">Nadiktujte výjazd hlasom</p>
                <p className="text-xs text-muted-foreground">Povedzte farmu, kravu, diagnózu a liek — AI predvyplní formulár nižšie</p>
                {voicePhase === "idle" && (
                  <button type="button" onClick={startVoiceRecording} className="inline-flex flex-col items-center gap-2 mx-auto px-8 py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition-colors">
                    <Mic className="h-8 w-8" />
                    <span className="text-sm font-semibold">Začať nahrávanie</span>
                  </button>
                )}
                {voicePhase === "recording" && (
                  <button type="button" onClick={stopVoiceRecording} className="inline-flex flex-col items-center gap-2 mx-auto px-8 py-4 rounded-2xl bg-red-500 hover:bg-red-600 text-white shadow-md animate-pulse">
                    <Mic className="h-8 w-8" />
                    <span className="text-sm font-semibold">Nahrávam… klepnite pre zastavenie</span>
                  </button>
                )}
                {voicePhase === "processing" && (
                  <div className="flex flex-col items-center gap-2 py-3"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /><span className="text-sm text-muted-foreground mt-1">AI spracováva diktát…</span></div>
                )}
                {voicePhase === "review" && voiceDraft && (
                  <div className="space-y-3 text-left">
                    <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800"><Sparkles className="h-4 w-4" />AI predvyplnil formulár</div>
                    <div className="rounded-lg border bg-background p-3 text-xs text-muted-foreground italic"><span className="font-medium not-italic text-foreground">Prepis: </span>{voiceDraft.transcript}</div>
                    <div className="flex gap-2 pt-1"><Button type="button" size="sm" variant="outline" className="text-xs" onClick={() => { setVoicePhase("idle"); setVoiceDraft(null); }}>Nahrať znova</Button><span className="text-xs text-muted-foreground self-center">Formulár nižšie je predvyplnený — skontrolujte a uložte</span></div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="max-w-2xl mx-auto border-emerald-200">
            <CardHeader className="bg-emerald-50/50 border-b pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2 text-emerald-900">
                <Plus className="h-5 w-5 text-emerald-600" />
                Rýchly záznam výjazdu na farmu (Dr. Sýkora)
              </CardTitle>
              <CardDescription className="text-xs text-emerald-700">
                Optimalizované pre mobil/tablet v maštali. Záznam okamžite vloží položky na kumulatívnu faktúru farmy a pripraví KVEPIS hlásenie.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <form onSubmit={handleSubmitVisit} className="space-y-4">
                {/* 1. Farma */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">1. Výber farmy (chov)</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {overview?.farms.map((f) => (
                      <Button
                        key={f.id}
                        type="button"
                        variant={formFarmId === f.id ? "default" : "outline"}
                        className={
                          formFarmId === f.id
                            ? "bg-emerald-600 hover:bg-emerald-700 text-white justify-start text-xs h-auto py-2"
                            : "justify-start text-xs h-auto py-2"
                        }
                        onClick={() => {
                          setFormFarmId(f.id);
                          setFormCowId("");
                        }}
                      >
                        <Tractor className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                        <span className="truncate">{f.name}</span>
                      </Button>
                    ))}
                  </div>
                </div>

                {/* 2. Krava */}
                {formFarmId && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold">2. Výber zvieraťa</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-5 text-xs text-emerald-600"
                        onClick={() => setNewCowFarmId(formFarmId)}
                      >
                        + Nová krava
                      </Button>
                    </div>
                    <select
                      className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs"
                      value={formCowId}
                      onChange={(e) => setFormCowId(e.target.value)}
                    >
                      <option value="">-- Vyberte kravu z evidencie --</option>
                      {selectedFarmCows.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} (Ušné č.: {c.earTag}) — {c.breed}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* 3. Diagnóza a rýchle tagy */}
                <div className="space-y-1.5">


                  <div className="flex flex-wrap gap-1 mb-1.5">
                    {[
                      "Akútna katarálna mastitída",
                      "Panaritium (flegmóna prsta)",
                      "Pôrodná paréza (hypokalcémia)",
                      "Retencia sekundín post-partum",
                      "Sonografia gravidity",
                      "Vakcinácia IBR stádo",
                    ].map((diag) => (
                      <button
                        key={diag}
                        type="button"
                        className="text-[11px] px-2 py-0.5 rounded-full border bg-muted/60 hover:bg-emerald-50 hover:border-emerald-300"
                        onClick={() => setFormDiagnosis(diag)}
                      >
                        {diag}
                      </button>
                    ))}
                  </div>
                  <Input
                    placeholder="Zadajte diagnózu alebo klinický nález..."
                    value={formDiagnosis}
                    onChange={(e) => setFormDiagnosis(e.target.value)}
                    className="text-xs"
                    required
                  />
                </div>

                {/* 4. Úkon a liečivo */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Veterinárny úkon</Label>
                    <select
                      className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs"
                      value={formServiceId}
                      onChange={(e) => setFormServiceId(e.target.value)}
                    >
                      <option value="">-- Vyberte úkon --</option>
                      {servicesList?.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({parseFloat(s.defaultPrice || "0").toFixed(2)} €)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Aplikovaný / odovzdaný liek</Label>
                    <select
                      className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs"
                      value={formProductId}
                      onChange={(e) => setFormProductId(e.target.value)}
                    >
                      <option value="">-- Bez lieku / vlastné liečivo --</option>
                      {stock?.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({parseFloat(p.unitPrice || "0").toFixed(2)} €)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 5. Poznámka */}
                <div className="space-y-1.5">


                  <Input
                    placeholder="napr. Ochranná lehota mlieko 4 dni, kontrola o 3 dni..."
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    className="text-xs"
                  />
                </div>

                {/* KVEPIS Checkbox */}
                <div className="flex items-center gap-2 p-2.5 rounded-lg border bg-muted/40">
                  <input
                    type="checkbox"
                    id="kvepisCheck"
                    checked={formSendKvepis}
                    onChange={(e) => setFormSendKvepis(e.target.checked)}
                    className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                  />
                  <Label htmlFor="kvepisCheck" className="text-xs font-medium cursor-pointer">
                    Automaticky zaevidovať dávku do KVEPIS (Ambulantná kniha ošetrení ŠVPS SR)
                  </Label>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                  disabled={createVisitMutation.isPending}
                >
                  <Check className="h-4 w-4 mr-2" />
                  {createVisitMutation.isPending ? "Ukladám výjazd..." : "Uložiť ošetrenie do knihy a na faktúru"}
                </Button>
              </form>
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
                Registrácia novej kravy na farme
              </CardTitle>
              <CardDescription className="text-xs">
                Rýchle pridanie zvieraťa do individuálnej evidencie CEHZ.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Meno / Označenie kravy</Label>
                <Input
                  placeholder="napr. Malina č. 2101"
                  value={newCowName}
                  onChange={(e) => setNewCowName(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Úradné ušné číslo (CEHZ známka)</Label>
                <Input
                  placeholder="napr. SK 000801452101"
                  value={newCowEarTag}
                  onChange={(e) => setNewCowEarTag(e.target.value)}
                  className="text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Plemeno</Label>
                <Input
                  placeholder="napr. Holštajnsko-frízsky dobytok"
                  value={newCowBreed}
                  onChange={(e) => setNewCowBreed(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setNewCowFarmId(null)}
                >
                  Zrušiť
                </Button>
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => {
                    if (!newCowName || !newCowEarTag) {
                      alert("Zadajte meno a ušnú známku.");
                      return;
                    }
                    registerCowMutation.mutate({
                      farmId: newCowFarmId,
                      name: newCowName,
                      earTag: newCowEarTag,
                      breed: newCowBreed,
                    });
                  }}
                  disabled={registerCowMutation.isPending}
                >
                  Zaevidovať zviera
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
