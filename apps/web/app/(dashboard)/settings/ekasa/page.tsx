"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Settings2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  ExternalLink,
  Info,
  WifiOff,
  CreditCard,
} from "lucide-react";

const COMPLIANCE_ITEMS = [
  {
    key: "dic",
    label: "DIČ nakonfigurované",
    description: "Daňové identifikačné číslo podnikateľa (povinné)",
    required: true,
  },
  {
    key: "pokladnicaId",
    label: "ID pokladnice nastavené",
    description: "Identifikátor pridelený FR SR pri registrácii e-Kasa",
    required: true,
  },
  {
    key: "apiUrl",
    label: "API URL nastavené",
    description: "Endpoint FR SR pre odosielanie dokladov",
    required: true,
  },
  {
    key: "certUploaded",
    label: "Klientský certifikát nahratý",
    description: "PKCS#12 certifikát z FR SR pre PKP podpis (voliteľné pre CLOUD typ)",
    required: false,
  },
  {
    key: "dphConfig",
    label: "IČ DPH (ak platiteľ DPH)",
    description: "Identifikačné číslo pre DPH — vyplniť len ak ste platiteľom DPH",
    required: false,
  },
];

export default function EkasaSettingsPage() {
  const { data: config, isLoading, refetch } = trpc.ekasa.getConfig.useQuery();
  const updateConfig = trpc.ekasa.updateConfig.useMutation({ onSuccess: () => refetch() });

  const [form, setForm] = useState({
    dic: "",
    icDph: "",
    pokladnicaId: "",
    pokladnicaType: "CLOUD" as "ORP" | "VRP" | "CLOUD",
    ekasaApiUrl: "https://ekasa.financnasprava.sk/oto/api",
    offlineModeEnabled: false,
    cashlessEnabled: false,
  });
  const [initialized, setInitialized] = useState(false);
  const [saved, setSaved] = useState(false);

  if (config && !initialized) {
    setForm({
      dic: (config.dic as string) ?? "",
      icDph: (config.icDph as string) ?? "",
      pokladnicaId: (config.pokladnicaId as string) ?? "",
      pokladnicaType: (config.pokladnicaType as "ORP" | "VRP" | "CLOUD") ?? "CLOUD",
      ekasaApiUrl: (config.ekasaApiUrl as string) ?? "https://ekasa.financnasprava.sk/oto/api",
      offlineModeEnabled: (config.offlineModeEnabled as boolean) ?? false,
      cashlessEnabled: (config.cashlessEnabled as boolean) ?? false,
    });
    setInitialized(true);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateConfig.mutateAsync({
      ...form,
      icDph: form.icDph || undefined,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const checks = {
    dic: !!form.dic,
    pokladnicaId: !!form.pokladnicaId,
    apiUrl: !!form.ekasaApiUrl,
    certUploaded: !!(config?.certBase64),
    dphConfig: true,
  };
  const requiredPassed = COMPLIANCE_ITEMS.filter((i) => i.required).every(
    (i) => checks[i.key as keyof typeof checks]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
          <Settings2 className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">e-Kasa Nastavenia</h1>
          <p className="text-sm text-muted-foreground">
            Konfigurácia elektronickej registračnej pokladnice (Zákon č. 289/2008 Z. z.)
          </p>
        </div>
      </div>

      {/* Compliance Checklist */}
      <div className={`rounded-xl border p-5 shadow-sm ${requiredPassed ? "border-emerald-200 bg-emerald-50/50" : "border-amber-200 bg-amber-50/50"}`}>
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck className={`h-5 w-5 ${requiredPassed ? "text-emerald-600" : "text-amber-600"}`} />
          <span className="font-semibold text-sm">
            {requiredPassed ? "Splnené legislatívne požiadavky ✓" : "Nevyplnené povinné polia"}
          </span>
        </div>
        <div className="space-y-2">
          {COMPLIANCE_ITEMS.map((item) => {
            const passed = checks[item.key as keyof typeof checks];
            return (
              <div key={item.key} className="flex items-start gap-2">
                {passed ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                ) : item.required ? (
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                ) : (
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <div>
                  <span className={`text-xs font-medium ${!passed && item.required ? "text-amber-700" : ""}`}>
                    {item.label}
                    {!item.required && <span className="ml-1 text-muted-foreground">(voliteľné)</span>}
                  </span>
                  <p className="text-[11px] text-muted-foreground">{item.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Configuration Form */}
      <form onSubmit={handleSubmit} className="rounded-xl border bg-card p-5 shadow-sm space-y-5">
        <h2 className="text-sm font-semibold">Identifikačné údaje</h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* DIC */}
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              DIČ <span className="text-destructive">*</span>
            </label>
            <input
              value={form.dic}
              onChange={(e) => setForm({ ...form, dic: e.target.value })}
              placeholder="1234567890"
              required
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {/* IC DPH */}
          <div>
            <label className="mb-1.5 block text-sm font-medium">IČ DPH</label>
            <input
              value={form.icDph}
              onChange={(e) => setForm({ ...form, icDph: e.target.value })}
              placeholder="SK1234567890 (len ak platiteľ DPH)"
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {/* Pokladnica ID */}
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              ID pokladnice <span className="text-destructive">*</span>
            </label>
            <input
              value={form.pokladnicaId}
              onChange={(e) => setForm({ ...form, pokladnicaId: e.target.value })}
              placeholder="napr. 88812345678"
              required
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {/* Pokladnica Type */}
          <div>
            <label className="mb-1.5 block text-sm font-medium">Typ pokladnice</label>
            <select
              value={form.pokladnicaType}
              onChange={(e) => setForm({ ...form, pokladnicaType: e.target.value as "ORP" | "VRP" | "CLOUD" })}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="CLOUD">CLOUD (API)</option>
              <option value="ORP">ORP — Online registračná pokladnica</option>
              <option value="VRP">VRP — Virtuálna registračná pokladnica</option>
            </select>
          </div>
        </div>

        {/* API URL */}
        <div>
          <label className="mb-1.5 block text-sm font-medium">
            e-Kasa API URL
            <a
              href="https://ekasa.financnasprava.sk"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-2 inline-flex items-center gap-0.5 text-xs text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" />FR SR portál
            </a>
          </label>
          <input
            value={form.ekasaApiUrl}
            onChange={(e) => setForm({ ...form, ekasaApiUrl: e.target.value })}
            type="url"
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono"
          />
        </div>

        {/* Switches */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold">Možnosti</h2>

          {[
            {
              key: "offlineModeEnabled" as const,
              icon: WifiOff,
              label: "Offline mód",
              description: "Doklady sa ukladajú lokálne a odošlú po obnovení pripojenia",
            },
            {
              key: "cashlessEnabled" as const,
              icon: CreditCard,
              label: "Povolené bezhotovostné platby",
              description: "Karta, bankový prevod — vyžaduje nastavenie terminálu",
            },
          ].map((opt) => (
            <label key={opt.key} className="flex items-start gap-3 cursor-pointer">
              <div className="relative mt-0.5">
                <input
                  type="checkbox"
                  checked={form[opt.key]}
                  onChange={(e) => setForm({ ...form, [opt.key]: e.target.checked })}
                  className="sr-only"
                />
                <div
                  className={`h-5 w-9 rounded-full transition-colors ${form[opt.key] ? "bg-primary" : "bg-muted"}`}
                />
                <div
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${form[opt.key] ? "translate-x-4" : "translate-x-0.5"}`}
                />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <opt.icon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm font-medium">{opt.label}</span>
                </div>
                <p className="text-xs text-muted-foreground">{opt.description}</p>
              </div>
            </label>
          ))}
        </div>

        {/* Cert info */}
        <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 text-xs text-blue-700">
          <strong>Certifikát (PKP podpis):</strong> Pre produkčné prostredie nahrajte PKCS#12 certifikát
          vydaný FR SR cez Drizzle Studio alebo priamy DB prístup. Kontaktujte správcu systému.
        </div>

        {/* Submit */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={updateConfig.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60 hover:bg-primary/90 transition-colors"
          >
            {updateConfig.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : saved ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <Settings2 className="h-4 w-4" />
            )}
            {updateConfig.isPending ? "Ukladám…" : saved ? "Uložené!" : "Uložiť nastavenia"}
          </button>

          {updateConfig.isError && (
            <p className="text-sm text-destructive">
              {updateConfig.error?.message ?? "Chyba pri ukladaní"}
            </p>
          )}
        </div>
      </form>

      {/* Legal note */}
      <div className="rounded-xl border bg-muted/30 p-4 text-xs text-muted-foreground">
        <p className="font-medium mb-1">📋 Právna poznámka</p>
        <p>
          Systém e-Kasa je regulovaný <strong>Zákonom č. 289/2008 Z. z.</strong> o používaní
          elektronickej registračnej pokladnice a <strong>Zákonom č. 384/2025 Z. z.</strong>
          Každý doklad musí obsahovať OKP a PKP kód. Systém generuje OKP (SHA-1) a PKP (RSA-SHA256)
          automaticky po konfigurácii certifikátu.
        </p>
      </div>
    </div>
  );
}
