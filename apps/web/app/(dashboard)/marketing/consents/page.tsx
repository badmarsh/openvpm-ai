"use client";

import { useState } from "react";
import {
  ShieldCheck,
  Plus,
  Trash2,
  AlertCircle,
  FileCheck,
  MessageSquare,
  Camera,
  Tv,
  CheckCircle2,
  XCircle,
  Info,
  Loader2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const SCOPES = [
  { value: "marketing_messages", label: "Marketingové SMS / emaily", i18nKey: "marketing.consents.scopeMarketingMessages", icon: MessageSquare },
  { value: "photo_social", label: "Fotografie na sociálne siete", i18nKey: "marketing.consents.scopePhotoSocial", icon: Camera },
  { value: "photo_web", label: "Fotografie na web", i18nKey: "marketing.consents.scopePhotoWeb", icon: FileCheck },
  { value: "photo_tv", label: "Fotografie na TV v čakárni", i18nKey: "marketing.consents.scopePhotoTv", icon: Tv },
  { value: "story", label: "Príbeh pacienta / kazuistika", i18nKey: "marketing.consents.scopeStory", icon: FileCheck },
  { value: "testimonial", label: "Recenzia a svedectvo klienta", i18nKey: "marketing.consents.scopeTestimonial", icon: CheckCircle2 },
] as const;

export default function MarketingConsentsPage() {
  const { t } = useI18n();
  const utils = trpc.useUtils();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedScope, setSelectedScope] = useState<
    "photo_social" | "photo_web" | "photo_tv" | "story" | "testimonial" | "marketing_messages"
  >("marketing_messages");
  const [evidenceType, setEvidenceType] = useState<"signature" | "sms_confirm" | "pdf">("signature");
  const [notes, setNotes] = useState("");

  const consentsQuery = trpc.extensions.marketing.listMediaConsents.useQuery();
  const clientsQuery = trpc.clients.list.useQuery({ limit: 100 });

  const createMutation = trpc.extensions.marketing.createMediaConsent.useMutation({
    onSuccess: () => {
      toast.success(t("marketing.consents.createSuccess", "Súhlas bol úspešne zaznamenaný."));
      setIsCreateOpen(false);
      setSelectedClientId("");
      setNotes("");
      utils.extensions.marketing.listMediaConsents.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || t("marketing.consents.createError", "Nepodarilo sa uložiť súhlas."));
    },
  });

  const revokeMutation = trpc.extensions.marketing.revokeMediaConsent.useMutation({
    onSuccess: () => {
      toast.success(t("marketing.consents.revokeSuccess", "Súhlas bol odvolaný a marketingové položky zablokované."));
      utils.extensions.marketing.listMediaConsents.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || t("marketing.consents.revokeError", "Nepodarilo sa odvolať súhlas."));
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientId) {
      toast.error(t("marketing.consents.selectClientError", "Vyberte klienta."));
      return;
    }
    createMutation.mutate({
      clientId: selectedClientId,
      scope: selectedScope,
      evidenceType,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShieldCheck className="w-7 h-7 text-primary" />
            {t("marketing.consents.title", "Súhlasy (Consent Registry)")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            {t(
              "marketing.consents.subtitle",
              "Jediný zdroj pravdy pre GDPR a mediálne súhlasy. Žiadna fotografia bez aktívneho súhlasu sa nepublikuje. Odvolanie jedným klikom okamžite zruší plánované kampane."
            )}
          </p>
        </div>

        <Button onClick={() => setIsCreateOpen(!isCreateOpen)} className="gap-2">
          <Plus className="w-4 h-4" />
          {t("marketing.consents.createBtn", "Zaznamenať súhlas")}
        </Button>
      </div>

      {/* Info notice */}
      <div className="flex items-start gap-3 p-4 rounded-xl border bg-muted/40 text-xs text-muted-foreground leading-relaxed">
        <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <p>
          <strong>Kaskádové odvolanie:</strong> Pri odvolaní súhlasu so správami sú všetky čakajúce
          marketingové správy pre klienta okamžite potlačené (suppressed_no_consent). Pri odvolaní
          mediálneho súhlasu sa plánované príspevky obsahujúce dané médium automaticky archivujú.
        </p>
      </div>

      {/* Create Consent Panel */}
      {isCreateOpen && (
        <form
          onSubmit={handleCreate}
          className="p-5 rounded-xl border bg-card shadow-sm space-y-4 animate-in fade-in slide-in-from-top-2 duration-200"
        >
          <h2 className="text-base font-semibold text-foreground">Nový súhlas dotknutej osoby</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Klient *</label>
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="w-full h-9 rounded-md border bg-background px-3 text-xs focus:ring-1 focus:ring-primary outline-none"
                required
              >
                <option value="">-- Vyberte klienta --</option>
                {clientsQuery.data?.items.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.firstName} {c.lastName} ({c.phone || c.email || "bez kontaktu"})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Rozsah súhlasu *</label>
              <select
                value={selectedScope}
                onChange={(e) => setSelectedScope(e.target.value as any)}
                className="w-full h-9 rounded-md border bg-background px-3 text-xs focus:ring-1 focus:ring-primary outline-none"
              >
                {SCOPES.map((sc) => (
                  <option key={sc.value} value={sc.value}>
                    {t(sc.i18nKey, sc.label)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Dôkaz o udelení súhlasu *</label>
              <select
                value={evidenceType}
                onChange={(e) => setEvidenceType(e.target.value as any)}
                className="w-full h-9 rounded-md border bg-background px-3 text-xs focus:ring-1 focus:ring-primary outline-none"
              >
                <option value="signature">Vlastnoručný podpis na tablete / papier</option>
                <option value="sms_confirm">Overenie cez SMS kód</option>
                <option value="pdf">Podpísaný PDF formulár</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Poznámka / interné referencie</label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Napr. podpis na príjme, tablet #2"
              className="h-9 text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCreateOpen(false)}
            >
              Zrušiť
            </Button>
            <Button type="submit" size="sm" disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
              Uložiť súhlas
            </Button>
          </div>
        </form>
      )}

      {/* Consents Table */}
      <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
        <div className="p-4 border-b bg-muted/20 font-semibold text-sm flex items-center justify-between">
          <span>Evidované súhlasy ({consentsQuery.data?.length ?? 0})</span>
        </div>

        {consentsQuery.isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
            Načítavam evidenciu súhlasov...
          </div>
        ) : !consentsQuery.data || consentsQuery.data.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <ShieldCheck className="w-10 h-10 text-muted-foreground/50 mx-auto" />
            <p className="text-sm font-medium text-foreground">Žiadne zaevidované súhlasy</p>
            <p className="text-xs text-muted-foreground">
              Kliknite na tlačidlo vyššie pre pridanie prvého súhlasu klienta.
            </p>
          </div>
        ) : (
          <div className="divide-y text-xs">
            {consentsQuery.data.map(({ consent, client, patient }) => {
              const isRevoked = !!consent.revokedAt;
              const scopeObj = SCOPES.find((s) => s.value === consent.scope);

              return (
                <div
                  key={consent.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-foreground">
                        {client?.firstName} {client?.lastName}
                      </span>
                      {patient?.name && (
                        <Badge variant="outline" className="text-[10px]">
                          Pacient: {patient.name}
                        </Badge>
                      )}
                      {isRevoked ? (
                        <Badge variant="destructive" className="text-[10px] gap-1">
                          <XCircle className="w-3 h-3" />
                          Odvolaný ({new Date(consent.revokedAt!).toLocaleDateString("sk-SK")})
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Aktívny
                        </Badge>
                      )}
                    </div>
                    <div className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                      <span>{t("marketing.consents.scope", "Rozsah")}: <strong>{scopeObj ? t(scopeObj.i18nKey, scopeObj.label) : consent.scope}</strong></span>
                      <span>Dôkaz: {consent.evidenceType}</span>
                      <span>Udelené: {new Date(consent.grantedAt).toLocaleDateString("sk-SK")}</span>
                      {consent.notes && <span>({consent.notes})</span>}
                    </div>
                  </div>

                  {!isRevoked && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (confirm("Naozaj si želáte odvolať tento súhlas? Dôjde k okamžitému zrušeniu plánovaných správ a materiálov.")) {
                          revokeMutation.mutate({ consentId: consent.id });
                        }
                      }}
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive shrink-0 self-start sm:self-center"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" />
                      Odvolať súhlas
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
