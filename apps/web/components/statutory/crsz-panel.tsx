"use client";

import { useState } from "react";
import {
  ShieldCheck,
  Plus,
  Printer,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Plane,
  Loader2,
  X,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/common/empty-state";
import { toast } from "sonner";
import { validateMicrochipNumber } from "@/lib/crsz/microchip";

export function CrszPanel() {
  const { t } = useI18n();
  const utils = trpc.useUtils();

  const [subTab, setSubTab] = useState<"chips" | "passports">("chips");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isPassportOpen, setIsPassportOpen] = useState(false);

  const chipsQuery = trpc.extensions.crsz.listMicrochips.useQuery({
    search: search || undefined,
    status: (statusFilter as any) || undefined,
    limit: 100,
  });

  const passportsQuery = trpc.extensions.crsz.listPassports.useQuery({
    limit: 100,
  });

  const printCertMutation = trpc.extensions.crsz.getCertificateHtml.useMutation({
    onSuccess: (html: string) => {
      const win = window.open("", "_blank");
      if (win) {
        win.document.write(html);
        win.document.close();
        win.focus();
        setTimeout(() => {
          win.print();
        }, 300);
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Nepodarilo sa vygenerovať potvrdenie KVL SR");
    },
  });

  return (
    <div className="space-y-4">
      {/* Sub tabs & Action */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          <Button
            variant={subTab === "chips" ? "default" : "outline"}
            size="sm"
            onClick={() => setSubTab("chips")}
            className="gap-2"
          >
            <ShieldCheck className="h-4 w-4" />
            <span>{t("crsz.subtabChips", "Centrálny register mikročipov (CRSZ)")}</span>
          </Button>
          <Button
            variant={subTab === "passports" ? "default" : "outline"}
            size="sm"
            onClick={() => setSubTab("passports")}
            className="gap-2"
          >
            <Plane className="h-4 w-4" />
            <span>{t("crsz.subtabPassports", "PetPass & Cestovná spôsobilosť")}</span>
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {subTab === "chips" ? (
            <Button size="sm" onClick={() => setIsRegisterOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              <span>{t("crsz.btnRegisterChip", "Zaevidovať mikročip")}</span>
            </Button>
          ) : (
            <Button size="sm" onClick={() => setIsPassportOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              <span>{t("crsz.btnIssuePassport", "Vystaviť PetPass")}</span>
            </Button>
          )}
        </div>
      </div>

      {/* CHIPS VIEW */}
      {subTab === "chips" && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 items-center gap-3">
              <div className="relative min-w-[260px] flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t("crsz.searchPlaceholder", "Hľadať číslo čipu, pacienta, plemeno...")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-xs"
              >
                <option value="">{t("crsz.filterAllStatus", "Všetky stavy")}</option>
                <option value="REGISTERED">{t("crsz.statusRegistered", "Zaevidované v CRSZ")}</option>
                <option value="PENDING_SUBMISSION">{t("crsz.statusPending", "Čaká na odoslanie")}</option>
                <option value="NOT_REGISTERED">{t("crsz.statusNotRegistered", "Nezaevidované")}</option>
                <option value="REJECTED">{t("crsz.statusRejected", "Zamietnuté")}</option>
              </select>
            </div>
          </div>

          {chipsQuery.isLoading ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !chipsQuery.data || chipsQuery.data.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title={t("crsz.emptyChipsTitle", "Žiadne zaevidované mikročipy")}
              description={t(
                "crsz.emptyChipsDesc",
                "Zaevidujte aplikovaný transpondér zvieraťa podľa ISO 11784/11785 pre súlad s CRSZ."
              )}
              action={{
                label: t("crsz.btnRegisterChip", "Zaevidovať mikročip"),
                onClick: () => setIsRegisterOpen(true),
                icon: Plus,
              }}
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border bg-card">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50 text-xs font-medium text-muted-foreground">
                    <th className="px-4 py-3">Číslo mikročipu (ISO)</th>
                    <th className="px-4 py-3">Zviera</th>
                    <th className="px-4 py-3">Majiteľ</th>
                    <th className="px-4 py-3">Dátum aplikácie</th>
                    <th className="px-4 py-3">Umiestnenie</th>
                    <th className="px-4 py-3">Stav CRSZ</th>
                    <th className="px-4 py-3 text-right">Potvrdenie KVL SR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {chipsQuery.data.map((item) => {
                    const isSlovak = item.microchipNumber.startsWith("703");
                    return (
                      <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs font-semibold">
                          <div className="flex items-center gap-1.5">
                            <span>{item.microchipNumber}</span>
                            {isSlovak && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0 border-blue-500/40 text-blue-600">
                                SK (703)
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{item.patient?.name ?? "—"}</div>
                          <div className="text-xs text-muted-foreground">
                            {item.patient?.species ?? ""} {item.patient?.breed ? "• " + item.patient.breed : ""}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            {item.client ? item.client.firstName + " " + item.client.lastName : "—"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {item.client?.phone || item.client?.city || ""}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {new Date(item.implantedAt).toLocaleDateString("sk-SK")}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {item.location === "LEFT_NECK"
                            ? "Ľavá strana krku"
                            : item.location === "INTERSCAPULAR"
                            ? "Medzi lopatkami"
                            : item.location === "RIGHT_NECK"
                            ? "Pravá strana krku"
                            : item.location}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant="outline"
                            className={
                              item.crszStatus === "REGISTERED"
                                ? "border-emerald-500/40 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40"
                                : item.crszStatus === "PENDING_SUBMISSION"
                                ? "border-amber-500/40 bg-amber-50 text-amber-700 dark:bg-amber-950/40"
                                : "border-rose-500/40 bg-rose-50 text-rose-700 dark:bg-rose-950/40"
                            }
                          >
                            {item.crszStatus === "REGISTERED"
                              ? "V CRSZ"
                              : item.crszStatus === "PENDING_SUBMISSION"
                              ? "Čaká"
                              : item.crszStatus === "NOT_REGISTERED"
                              ? "Nezaevidované"
                              : "Zamietnuté"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1 text-xs"
                            onClick={() => printCertMutation.mutate({ registrationId: item.id })}
                            disabled={printCertMutation.isPending}
                          >
                            <Printer className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>Tlačiť potvrdenie</span>
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* PASSPORTS VIEW */}
      {subTab === "passports" && (
        <div className="space-y-4">
          {passportsQuery.isLoading ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !passportsQuery.data || passportsQuery.data.length === 0 ? (
            <EmptyState
              icon={Plane}
              title={t("crsz.emptyPassportsTitle", "Žiadne vydané PetPassy")}
              description={t(
                "crsz.emptyPassportsDesc",
                "Evidujte vydané pasy spoločenských zvierat s kontrolou 21-dňovej lehoty vycestovania."
              )}
              action={{
                label: t("crsz.btnIssuePassport", "Vystaviť PetPass"),
                onClick: () => setIsPassportOpen(true),
                icon: Plus,
              }}
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border bg-card">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50 text-xs font-medium text-muted-foreground">
                    <th className="px-4 py-3">Číslo PetPassu</th>
                    <th className="px-4 py-3">Zviera & Majiteľ</th>
                    <th className="px-4 py-3">Dátum vystavenia</th>
                    <th className="px-4 py-3">Vakcinácia proti besnote</th>
                    <th className="px-4 py-3">Vycestovanie (EÚ 576/2013)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {passportsQuery.data.map((p) => {
                    const isEligible = p.travelEligibleFrom
                      ? new Date() >= new Date(p.travelEligibleFrom)
                      : false;
                    return (
                      <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-mono font-semibold text-xs text-primary">
                          {p.passportNumber}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{p.patient?.name ?? "—"}</div>
                          <div className="text-xs text-muted-foreground">
                            {p.client ? p.client.firstName + " " + p.client.lastName : "—"}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {new Date(p.issuedAt).toLocaleDateString("sk-SK")}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {p.rabiesAdministeredAt ? (
                            <div>
                              <div>{new Date(p.rabiesAdministeredAt).toLocaleDateString("sk-SK")}</div>
                              <div className="text-muted-foreground">
                                Platí do: {p.rabiesValidUntil ? new Date(p.rabiesValidUntil).toLocaleDateString("sk-SK") : "—"}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">Bez vakcíny</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {isEligible ? (
                            <Badge variant="outline" className="border-emerald-500/40 bg-emerald-50 text-emerald-700 text-xs gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              <span>Spôsobilé na cestu</span>
                            </Badge>
                          ) : p.travelEligibleFrom ? (
                            <Badge variant="outline" className="border-amber-500/40 bg-amber-50 text-amber-700 text-xs gap-1">
                              <Clock className="h-3 w-3" />
                              <span>Lehota do {new Date(p.travelEligibleFrom).toLocaleDateString("sk-SK")}</span>
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs text-muted-foreground">
                              Neúplné údaje
                            </Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* REGISTER MODAL */}
      {isRegisterOpen && (
        <RegisterMicrochipModal
          onClose={() => setIsRegisterOpen(false)}
          onSuccess={() => {
            setIsRegisterOpen(false)
            utils.extensions.crsz.listMicrochips.invalidate();
          }}
        />
      )}

      {/* PETPASS MODAL */}
      {isPassportOpen && (
        <IssuePassportModal
          onClose={() => setIsPassportOpen(false)}
          onSuccess={() => {
            setIsPassportOpen(false);
            utils.extensions.crsz.listPassports.invalidate();
          }}
        />
      )}
    </div>
  );
}

function RegisterMicrochipModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { t } = useI18n();
  const [patientSearch, setPatientSearch] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [microchipNumber, setMicrochipNumber] = useState("");
  const [implantedAt, setImplantedAt] = useState(new Date().toISOString().slice(0, 10));
  const [location, setLocation] = useState<"LEFT_NECK" | "INTERSCAPULAR" | "RIGHT_NECK" | "OTHER">("LEFT_NECK");
  const [notes, setNotes] = useState("");

  const patientsQuery = trpc.patients.list.useQuery(
    { search: patientSearch, limit: 10 },
    { enabled: patientSearch.length >= 2 }
  );

  const registerMutation = trpc.extensions.crsz.registerMicrochip.useMutation({
    onSuccess: () => {
      toast.success(t("crsz.registerSuccess", "Mikročip bol úspešne zaevidovaný do CRSZ"));
      onSuccess();
    },
    onError: (err: any) => {
      toast.error(err.message || "Chyba pri registrácii mikročipu");
    },
  });

  const validation = validateMicrochipNumber(microchipNumber);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientId) {
      toast.error("Vyberte pacienta");
      return;
    }
    if (!validation.valid) {
      toast.error(validation.error || "Neplatné číslo mikročipu");
      return;
    }

    registerMutation.mutate({
      patientId: selectedPatientId,
      microchipNumber: validation.code,
      implantedAt,
      location,
      notes: notes || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md rounded-xl border border-border bg-card shadow-2xl overflow-hidden p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-base">Zaevidovať mikročip (CRSZ)</h3>
          </div>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-muted text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-medium block mb-1">Vyhľadať pacienta *</label>
            <Input
              placeholder="Napíšte aspoň 2 znaky mena pacienta..."
              value={patientSearch}
              onChange={(e) => setPatientSearch(e.target.value)}
              className="mb-2"
            />
            {patientsQuery.data?.items && patientsQuery.data.items.length > 0 && (
              <div className="max-h-32 overflow-y-auto rounded-md border border-border bg-muted/20 p-1 space-y-1">
                {patientsQuery.data.items.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => {
                      setSelectedPatientId(p.id);
                      setPatientSearch(p.name + " (" + p.species + ")");
                    }}
                    className={`cursor-pointer rounded px-2 py-1 text-xs hover:bg-primary/10 ${
                      selectedPatientId === p.id ? "bg-primary/20 font-medium" : ""
                    }`}
                  >
                    {p.name} — {p.species} {p.breed ? "(" + p.breed + ")" : ""}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-medium block mb-1">15-miestny kód mikročipu (ISO 11784/11785) *</label>
            <Input
              placeholder="Napr. 703098100123456"
              value={microchipNumber}
              onChange={(e) => setMicrochipNumber(e.target.value)}
              className="font-mono text-sm"
              required
            />
            <div className="mt-1.5 flex items-center gap-1 text-xs">
              {validation.valid ? (
                <span className="text-emerald-600 flex items-center gap-1 font-medium">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Platný ISO transpondér {validation.isSlovakNationalCode ? "(Slovenský kód 703)" : validation.countryOrManufacturer ? "(" + validation.countryOrManufacturer + ")" : ""}
                </span>
              ) : microchipNumber.length > 0 ? (
                <span className="text-rose-600 flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {validation.error} ({microchipNumber.replace(/\D/g, "").length}/15 číslic)
                </span>
              ) : (
                <span className="text-muted-foreground">Vyžaduje presne 15 číslic</span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium block mb-1">Dátum aplikácie *</label>
              <Input
                type="date"
                value={implantedAt}
                onChange={(e) => setImplantedAt(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Umiestnenie čipu</label>
              <select
                value={location}
                onChange={(e) => setLocation(e.target.value as any)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
              >
                <option value="LEFT_NECK">Ľavá strana krku</option>
                <option value="INTERSCAPULAR">Medzi lopatkami</option>
                <option value="RIGHT_NECK">Pravá strana krku</option>
                <option value="OTHER">Iné</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Zrušiť
            </Button>
            <Button type="submit" size="sm" disabled={registerMutation.isPending || !validation.valid}>
              {registerMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Zaevidovať v CRSZ
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function IssuePassportModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { t } = useI18n();
  const [patientSearch, setPatientSearch] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [passportNumber, setPassportNumber] = useState("SK-");
  const [issuedAt, setIssuedAt] = useState(new Date().toISOString().slice(0, 10));
  const [rabiesDate, setRabiesDate] = useState("");
  const [isBooster, setIsBooster] = useState(false);

  const patientsQuery = trpc.patients.list.useQuery(
    { search: patientSearch, limit: 10 },
    { enabled: patientSearch.length >= 2 }
  );

  const issueMutation = trpc.extensions.crsz.issuePetPassport.useMutation({
    onSuccess: () => {
      toast.success(t("crsz.passportSuccess", "PetPass bol úspešne vystavený"));
      onSuccess();
    },
    onError: (err: any) => {
      toast.error(err.message || "Chyba pri vystavení pasu");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientId) {
      toast.error("Vyberte pacienta");
      return;
    }
    issueMutation.mutate({
      patientId: selectedPatientId,
      passportNumber,
      issuedAt,
      rabiesAdministeredAt: rabiesDate || undefined,
      isRevaccination: isBooster,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md rounded-xl border border-border bg-card shadow-2xl overflow-hidden p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <Plane className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-base">Vystaviť PetPass zvieraťa</h3>
          </div>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-muted text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-medium block mb-1">Vyhľadať pacienta *</label>
            <Input
              placeholder="Napíšte aspoň 2 znaky mena pacienta..."
              value={patientSearch}
              onChange={(e) => setPatientSearch(e.target.value)}
              className="mb-2"
            />
            {patientsQuery.data?.items && patientsQuery.data.items.length > 0 && (
              <div className="max-h-32 overflow-y-auto rounded-md border border-border bg-muted/20 p-1 space-y-1">
                {patientsQuery.data.items.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => {
                      setSelectedPatientId(p.id);
                      setPatientSearch(p.name + " (" + p.species + ")");
                    }}
                    className={`cursor-pointer rounded px-2 py-1 text-xs hover:bg-primary/10 ${
                      selectedPatientId === p.id ? "bg-primary/20 font-medium" : ""
                    }`}
                  >
                    {p.name} — {p.species} {p.breed ? "(" + p.breed + ")" : ""}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium block mb-1">Číslo PetPassu *</label>
              <Input
                placeholder="SK-12345678"
                value={passportNumber}
                onChange={(e) => setPassportNumber(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Dátum vystavenia *</label>
              <Input
                type="date"
                value={issuedAt}
                onChange={(e) => setIssuedAt(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="rounded-lg border border-border p-3 space-y-3 bg-muted/20">
            <div>
              <label className="text-xs font-medium block mb-1">Dátum vakcinácie proti besnote</label>
              <Input
                type="date"
                value={rabiesDate}
                onChange={(e) => setRabiesDate(e.target.value)}
              />
            </div>

            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={isBooster}
                onChange={(e) => setIsBooster(e.target.checked)}
                className="rounded border-input text-primary h-4 w-4"
              />
              <span>Ide o revakcináciu (booster v platnosti - bez 21-dňovej lehoty)</span>
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Zrušiť
            </Button>
            <Button type="submit" size="sm" disabled={issueMutation.isPending}>
              {issueMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Vystaviť pas
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}