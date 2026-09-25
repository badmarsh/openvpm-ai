"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";
import { PageHeader } from "@/components/layout/page-header";
import { pageShellClass } from "@/components/layout/page-kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Info,
  Loader2,
  Settings2,
  ShieldCheck,
  WifiOff,
} from "lucide-react";

type EkasaRegisterType = "ORP" | "VRP" | "CLOUD";

type EkasaForm = {
  dic: string;
  icDph: string;
  pokladnicaId: string;
  pokladnicaType: EkasaRegisterType;
  ekasaApiUrl: string;
  offlineModeEnabled: boolean;
  cashlessEnabled: boolean;
};

type ComplianceKey = "dic" | "pokladnicaId" | "apiUrl" | "certUploaded" | "dphConfig";

const DEFAULT_EKASA_API_URL = "https://ekasa.financnasprava.sk/oto/api";

const DEFAULT_FORM: EkasaForm = {
  dic: "",
  icDph: "",
  pokladnicaId: "",
  pokladnicaType: "CLOUD",
  ekasaApiUrl: DEFAULT_EKASA_API_URL,
  offlineModeEnabled: false,
  cashlessEnabled: false,
};

export default function EkasaSettingsPage() {
  const { t } = useI18n();
  const {
    data: config,
    error: configError,
    isLoading,
    refetch,
  } = trpc.extensions.ekasa.getConfig.useQuery();
  const updateConfig = trpc.extensions.ekasa.updateConfig.useMutation();

  const [form, setForm] = useState<EkasaForm>(DEFAULT_FORM);
  const [initialized, setInitialized] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!config || initialized) return;

    setForm({
      dic: config.dic ?? "",
      icDph: config.icDph ?? "",
      pokladnicaId: config.pokladnicaId ?? "",
      pokladnicaType: (config.pokladnicaType as EkasaRegisterType | null) ?? "CLOUD",
      ekasaApiUrl: config.ekasaApiUrl ?? DEFAULT_EKASA_API_URL,
      offlineModeEnabled: config.offlineModeEnabled ?? false,
      cashlessEnabled: config.cashlessEnabled ?? false,
    });
    setInitialized(true);
  }, [config, initialized]);

  const COMPLIANCE_ITEMS: Array<{
    key: ComplianceKey;
    label: string;
    description: string;
    required: boolean;
  }> = [
    {
      key: "dic",
      label: t("settings.ekasa.compliance.items.dic.label", "DIČ nakonfigurované"),
      description: t(
        "settings.ekasa.compliance.items.dic.description",
        "Daňové identifikačné číslo podnikateľa (povinné)",
      ),
      required: true,
    },
    {
      key: "pokladnicaId",
      label: t("settings.ekasa.compliance.items.pokladnicaId.label", "ID pokladnice nastavené"),
      description: t(
        "settings.ekasa.compliance.items.pokladnicaId.description",
        "Identifikátor pridelený FR SR pri registrácii e-Kasa",
      ),
      required: true,
    },
    {
      key: "apiUrl",
      label: t("settings.ekasa.compliance.items.apiUrl.label", "API URL nastavené"),
      description: t(
        "settings.ekasa.compliance.items.apiUrl.description",
        "Endpoint FR SR pre odosielanie dokladov",
      ),
      required: true,
    },
    {
      key: "certUploaded",
      label: t(
        "settings.ekasa.compliance.items.certUploaded.label",
        "Klientský certifikát nahratý",
      ),
      description: t(
        "settings.ekasa.compliance.items.certUploaded.description",
        "PKCS#12 certifikát z FR SR pre PKP podpis (voliteľné pre CLOUD typ)",
      ),
      required: false,
    },
    {
      key: "dphConfig",
      label: t("settings.ekasa.compliance.items.dphConfig.label", "IČ DPH (ak platiteľ DPH)"),
      description: t(
        "settings.ekasa.compliance.items.dphConfig.description",
        "Identifikačné číslo pre DPH — vyplniť len ak ste platiteľom DPH",
      ),
      required: false,
    },
  ];

  const registerTypeTooltips: Record<EkasaRegisterType, string> = {
    CLOUD: t(
      "settings.ekasa.registerTypes.cloud.tooltip",
      "API integrácia e-Kasa; certifikát PKCS#12 môže byť potrebný podľa nastavenia služby.",
    ),
    ORP: t(
      "settings.ekasa.registerTypes.orp.tooltip",
      "Online registračná pokladnica zaregistrovaná vo Finančnej správe SR.",
    ),
    VRP: t(
      "settings.ekasa.registerTypes.vrp.tooltip",
      "Virtuálna registračná pokladnica používaná prostredníctvom služby Finančnej správy SR.",
    ),
  };

  const checks: Record<ComplianceKey, boolean> = {
    dic: Boolean(form.dic.trim()),
    pokladnicaId: Boolean(form.pokladnicaId.trim()),
    apiUrl: Boolean(form.ekasaApiUrl.trim()),
    // Only the presence of the certificate is used in the UI; its contents and password are never rendered.
    certUploaded: Boolean(config?.certBase64),
    dphConfig: Boolean(form.icDph.trim()),
  };
  const requiredPassed = COMPLIANCE_ITEMS.filter((item) => item.required).every(
    (item) => checks[item.key],
  );
  const savePending = isSaving || updateConfig.isPending;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);

    try {
      await updateConfig.mutateAsync({
        ...form,
        icDph: form.icDph.trim() || undefined,
      });
      void refetch();
      toast.success(t("settings.ekasa.save.success", "Nastavenia e-Kasa boli uložené."));
    } catch {
      toast.error(t("settings.ekasa.save.error", "Nastavenia e-Kasa sa nepodarilo uložiť."));
    } finally {
      // Mutations that reject (including network timeouts) must always release the form.
      setIsSaving(false);
    }
  };

  return (
    <div className={pageShellClass}>
      <PageHeader
        icon={Settings2}
        title={t("settings.ekasa.title", "Nastavenia e-Kasa")}
        subtitle={t(
          "settings.ekasa.subtitle",
          "Konfigurácia elektronickej registračnej pokladnice (Zákon č. 289/2008 Z. z.)",
        )}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/settings">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t("settings.ekasa.back", "Späť do nastavení")}
            </Link>
          </Button>
        }
      />

      {isLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            {t("settings.ekasa.loading", "Načítavam nastavenia e-Kasa...")}
          </CardContent>
        </Card>
      ) : configError ? (
        <Card>
          <CardContent className="flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-medium">
                  {t("settings.ekasa.loadError.title", "Nastavenia e-Kasa sa nepodarilo načítať")}
                </p>
                <p className="mt-1 text-muted-foreground">
                  {t(
                    "settings.ekasa.loadError.description",
                    "Pred vykonaním zmien skúste znova načítať uloženú konfiguráciu pokladnice.",
                  )}
                </p>
              </div>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
              {t("settings.ekasa.loadError.retry", "Skúsiť znova")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader className="flex-row items-start justify-between gap-4 border-b border-border p-5">
              <div className="flex items-start gap-3">
                <ShieldCheck
                  className={`mt-0.5 h-5 w-5 shrink-0 ${requiredPassed ? "text-success" : "text-warning"}`}
                  aria-hidden="true"
                />
                <div>
                  <CardTitle className="text-base">
                    {t("settings.ekasa.compliance.title", "Kontrola fiškálnej konfigurácie")}
                  </CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {requiredPassed
                      ? t(
                          "settings.ekasa.compliance.complete",
                          "Všetky povinné legislatívne údaje sú vyplnené.",
                        )
                      : t(
                          "settings.ekasa.compliance.incomplete",
                          "Pred spustením evidencie doplňte povinné fiškálne údaje.",
                        )}
                  </p>
                </div>
              </div>
              <Badge variant={requiredPassed ? "success" : "warning"} className="shrink-0">
                {requiredPassed
                  ? t("settings.ekasa.compliance.completeBadge", "Pripravené")
                  : t("settings.ekasa.compliance.incompleteBadge", "Vyžaduje doplnenie")}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-3 p-5">
              {COMPLIANCE_ITEMS.map((item) => {
                const passed = checks[item.key];
                const status = passed
                  ? t("settings.ekasa.compliance.status.configured", "Nakonfigurované")
                  : item.required
                    ? t("settings.ekasa.compliance.status.required", "Povinné")
                    : t("settings.ekasa.compliance.status.optional", "Voliteľné");

                return (
                  <div key={item.key} className="flex items-start gap-3">
                    {passed ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                    ) : item.required ? (
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
                    ) : (
                      <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{item.label}</span>
                        <Badge variant={passed ? "success" : item.required ? "warning" : "secondary"}>
                          {status}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <form onSubmit={handleSubmit}>
            <Card>
              <CardHeader className="border-b border-border p-5">
                <CardTitle className="text-base">
                  {t("settings.ekasa.form.title", "Konfigurácia pokladnice")}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {t(
                    "settings.ekasa.form.description",
                    "Doplňte identifikačné údaje praxe a možnosti prenosu dokladov.",
                  )}
                </p>
              </CardHeader>
              <CardContent className="space-y-6 p-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="ekasa-dic">
                      {t("settings.ekasa.fields.dic.label", "DIČ")} <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="ekasa-dic"
                      value={form.dic}
                      onChange={(event) => setForm((current) => ({ ...current, dic: event.target.value }))}
                      placeholder={t("settings.ekasa.fields.dic.placeholder", "1234567890")}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="ekasa-ic-dph">
                      {t("settings.ekasa.fields.icDph.label", "IČ DPH")}
                    </Label>
                    <Input
                      id="ekasa-ic-dph"
                      value={form.icDph}
                      onChange={(event) => setForm((current) => ({ ...current, icDph: event.target.value }))}
                      placeholder={t(
                        "settings.ekasa.fields.icDph.placeholder",
                        "SK1234567890 (len ak platiteľ DPH)",
                      )}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="ekasa-register-id">
                      {t("settings.ekasa.fields.pokladnicaId.label", "ID pokladnice")} {" "}
                      <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="ekasa-register-id"
                      value={form.pokladnicaId}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, pokladnicaId: event.target.value }))
                      }
                      placeholder={t("settings.ekasa.fields.pokladnicaId.placeholder", "napr. 88812345678")}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1">
                      <Label htmlFor="ekasa-register-type">
                        {t("settings.ekasa.fields.pokladnicaType.label", "Typ pokladnice")}
                      </Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground"
                              aria-label={t(
                                "settings.ekasa.fields.pokladnicaType.tooltipLabel",
                                "Pomoc k typu pokladnice",
                              )}
                            >
                              <Info className="h-4 w-4" aria-hidden="true" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{registerTypeTooltips[form.pokladnicaType]}</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <select
                      id="ekasa-register-type"
                      value={form.pokladnicaType}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          pokladnicaType: event.target.value as EkasaRegisterType,
                        }))
                      }
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      aria-describedby="ekasa-register-type-help"
                    >
                      <option value="CLOUD">
                        {t("settings.ekasa.registerTypes.cloud.label", "CLOUD (API)")}
                      </option>
                      <option value="ORP">
                        {t("settings.ekasa.registerTypes.orp.label", "ORP — Online registračná pokladnica")}
                      </option>
                      <option value="VRP">
                        {t("settings.ekasa.registerTypes.vrp.label", "VRP — Virtuálna registračná pokladnica")}
                      </option>
                    </select>
                    <p id="ekasa-register-type-help" className="text-xs text-muted-foreground">
                      {registerTypeTooltips[form.pokladnicaType]}
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Label htmlFor="ekasa-api-url">
                      {t("settings.ekasa.fields.apiUrl.label", "e-Kasa API URL")}
                    </Label>
                    <a
                      href="https://ekasa.financnasprava.sk"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" aria-hidden="true" />
                      {t("settings.ekasa.fields.apiUrl.portal", "Portál Finančnej správy SR")}
                    </a>
                  </div>
                  <Input
                    id="ekasa-api-url"
                    value={form.ekasaApiUrl}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, ekasaApiUrl: event.target.value }))
                    }
                    type="url"
                    className="font-mono text-xs"
                    required
                  />
                </div>

                <div className="space-y-3">
                  <h2 className="text-sm font-semibold text-foreground">
                    {t("settings.ekasa.options.title", "Možnosti")}
                  </h2>

                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-muted/20 p-3">
                      <div className="flex min-w-0 items-start gap-2.5">
                        <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                        <div>
                          <Label htmlFor="ekasa-offline-mode" className="cursor-pointer text-sm">
                            {t("settings.ekasa.options.offline.label", "Offline režim")}
                          </Label>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {t(
                              "settings.ekasa.options.offline.description",
                              "Doklady sa lokálne uložia a odošlú po obnovení pripojenia.",
                            )}
                          </p>
                        </div>
                      </div>
                      <Switch
                        id="ekasa-offline-mode"
                        checked={form.offlineModeEnabled}
                        onCheckedChange={(checked) =>
                          setForm((current) => ({ ...current, offlineModeEnabled: checked }))
                        }
                        aria-label={t("settings.ekasa.options.offline.label", "Offline režim")}
                      />
                    </div>

                    <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-muted/20 p-3">
                      <div className="flex min-w-0 items-start gap-2.5">
                        <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                        <div>
                          <Label htmlFor="ekasa-cashless" className="cursor-pointer text-sm">
                            {t(
                              "settings.ekasa.options.cashless.label",
                              "Povoliť bezhotovostné platby",
                            )}
                          </Label>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {t(
                              "settings.ekasa.options.cashless.description",
                              "Karta a bankový prevod vyžadujú nastavenie platobného terminálu.",
                            )}
                          </p>
                        </div>
                      </div>
                      <Switch
                        id="ekasa-cashless"
                        checked={form.cashlessEnabled}
                        onCheckedChange={(checked) =>
                          setForm((current) => ({ ...current, cashlessEnabled: checked }))
                        }
                        aria-label={t(
                          "settings.ekasa.options.cashless.label",
                          "Povoliť bezhotovostné platby",
                        )}
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-info/30 bg-info-muted/40 p-3 text-xs text-info-muted-foreground">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">
                      {t("settings.ekasa.certificate.title", "Certifikát pre PKP podpis")}
                    </span>
                    <Badge variant={checks.certUploaded ? "success" : "secondary"}>
                      {checks.certUploaded
                        ? t("settings.ekasa.certificate.configured", "Nakonfigurovaný")
                        : t("settings.ekasa.certificate.notConfigured", "Nenakonfigurovaný")}
                    </Badge>
                  </div>
                  <p className="mt-1">
                    {t(
                      "settings.ekasa.certificate.description",
                      "Pre produkčné prostredie poskytnite certifikát PKCS#12 vydaný FR SR prostredníctvom schváleného administrátorského postupu. Tento formulár zobrazuje iba stav certifikátu.",
                    )}
                  </p>
                </div>
              </CardContent>
              <div className="flex flex-wrap items-center gap-3 border-t border-border p-5">
                <Button type="submit" disabled={savePending}>
                  {savePending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Settings2 className="mr-2 h-4 w-4" aria-hidden="true" />
                  )}
                  {savePending
                    ? t("settings.ekasa.save.saving", "Ukladám nastavenia...")
                    : t("settings.ekasa.save.action", "Uložiť nastavenia e-Kasa")}
                </Button>
                {updateConfig.isError ? (
                  <p className="text-sm text-destructive" role="alert">
                    {t("settings.ekasa.save.error", "Nastavenia e-Kasa sa nepodarilo uložiť.")}
                  </p>
                ) : null}
              </div>
            </Card>
          </form>

          <Card className="bg-muted/30">
            <CardContent className="p-4 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">
                {t("settings.ekasa.legal.title", "Právna poznámka")}
              </p>
              <p className="mt-1">
                {t(
                  "settings.ekasa.legal.description",
                  "Systém e-Kasa je regulovaný Zákonom č. 289/2008 Z. z. o používaní elektronickej registračnej pokladnice a Zákonom č. 384/2025 Z. z. Každý doklad musí obsahovať OKP a PKP kód. Systém generuje OKP (SHA-1) a PKP (RSA-SHA256) po konfigurácii certifikátu.",
                )}
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
