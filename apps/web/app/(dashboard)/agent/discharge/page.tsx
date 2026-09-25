"use client";

import { useState, useCallback, useEffect, Suspense, useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  FileText,
  Send,
  Loader2,
  Bot,
  Sparkles,
  Copy,
  Check,
  Printer,
  Save,
  Edit3,
  Eye,
  AlertTriangle,
  Search,
  X,
  History,
  RotateCcw,
  Stethoscope,
  MessageSquare,
  Megaphone,
  ShieldCheck,
  ExternalLink,
  Clock,
  Download,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { PageHeader } from "@/components/layout/page-header";
import {
  pageShellClass,
  PageToolbar,
  SearchField,
  DataTableFrame,
  underlineTabsListClass,
  underlineTabsTriggerClass,
  filterControlClass,
  tableHeadClass,
  tableCellClass,
  tableRowClass,
} from "@/components/layout/page-kit";
import { formatSpecies } from "@/lib/patients/species";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { ClinicalStatusBadge } from "@/components/clinical/clinical-status-badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

// react-markdown + remark-gfm are heavy; the preview only exists after the
// first AI result, so the renderer loads lazily and never blocks page paint.
const MarkdownView = dynamic(
  () =>
    import("@/components/common/markdown-view").then(
      (mod) => mod.MarkdownView,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="animate-pulse space-y-2" aria-hidden="true">
        <div className="h-4 w-3/4 rounded bg-muted" />
        <div className="h-4 w-full rounded bg-muted" />
        <div className="h-4 w-5/6 rounded bg-muted" />
      </div>
    ),
  },
);

interface ClinicalPreset {
  key: string;
  name: string;
  diagnosis: string;
  treatment: string;
  followUp: string;
}

const PRESETS_SK: ClinicalPreset[] = [
  {
    key: "scenarioGastro",
    name: "Gastroenteritída",
    diagnosis: "Akútna gastroenteritída sekundárne k diétnej chybe, mierna dehydratácia (cca 5%).",
    treatment: "Subkutánna rehydratácia (Ringer-laktát 250ml), Maropitant (Cerenia) 1mg/kg s.c. proti zvracaniu. Domáca medikácia: Omeprazol 10mg 1x denne ráno nalačno, probiotická pasta 2x denne.",
    followUp: "Prísna gastrointestinálna diéta (varené kuracie mäso s rozvarenou ryžou alebo veterinárna diéta Gastrointestinal) po malých dávkach 4-5x denne počas 5 dní. Kontrola o 2-3 dni alebo ihneď pri pretrvávaní zvracania.",
  },
  {
    key: "scenarioSurgery",
    name: "Kastrácia / Rana",
    diagnosis: "Stav po plánovanom chirurgickom zákroku (orchiektómia / ovariohysterektómia) v celkovej anestézii. Operačná rana pokojná, bez známok krvácania.",
    treatment: "Pooperačná analgézia: Meloxicam 0.2mg/kg s.c. Domáca liečba: Meloxicam perorálna suspenzia 1x denne s krmivom počas 3 dní.",
    followUp: "Prísny kľudový režim 10 dní (zákaz behania, skákania a venčenia na voľno). Ochranný pooperačný golier / košieľka nepretržite. Kontrola operačnej rany a vybratie stehov o 10-12 dní.",
  },
  {
    key: "scenarioDental",
    name: "Dentálna hygiena",
    diagnosis: "Periodontálne ochorenie II. stupňa, generalizovaný zubný kameň a mierna gingivitída. Zákrok vykonaný v inhalačnej anestézii.",
    treatment: "Ultrazvukové odstránenie zubného kameňa, subgingiválny kuretáž, leštenie zubov (polishing), lokálna aplikácia chlórhexidínového dentálneho gélu.",
    followUp: "Mäkká strava počas nasledujúcich 3-4 dní. Začať domácu dentálnu prevenciu (enzymatická zubná pasta pre zvieratá, špeciálne dentálne pamlsky) po 5 dňoch. Preventívna kontrola chrupu o 6 mesiacov.",
  },
  {
    key: "scenarioOtitis",
    name: "Otitída",
    diagnosis: "Akútna obojstranná otitis externa (erytematózno-ceruminózny zápal zvukovodov s kvasinkovou a bakteriálnou flórou).",
    treatment: "Mechanický výplach a toaleta oboch zvukovodov. Aplikácia kombinovaných ušných kvapiek (antibiotikum + antimykotikum + protizápalová zložka).",
    followUp: "Aplikovať predpísané ušné kvapky 2x denne po dobu 7 dní. Pred aplikáciou uši očistiť čističom zvukovodov, nepoužívať vatové tyčinky hlboko do ucha. Kontrolné vyšetrenie a kontrolná cytológia o 7-10 dní.",
  },
];

/**
 * Sanitize rich text / Markdown to prevent HTML tag bleeding in print previews.
 * Strips <script>, <style>, event handlers and javascript: URIs.
 * Preserves markdown structure but removes raw HTML injection vectors.
 */
function sanitizeMarkdownForDisplay(input: string): string {
  if (!input) return "";
  return input
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/javascript:/gi, "")
    .trim();
}

/**
 * For print path: ensure rendered HTML does not contain executable tags.
 */
function sanitizePrintHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, "");
}

function DischargeContent() {
  const { t } = useI18n();
  const utils = trpc.useUtils();
  const searchParams = useSearchParams();
  const urlPatientId = searchParams.get("patientId");
  // Deep-link from /encounters/[appointmentId] carries the visit context too.
  const urlAppointmentId = searchParams.get("appointmentId");

  // Patient selection
  const [patientSearchOpen, setPatientSearchOpen] = useState(false);
  const [patientSearch, setPatientSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<{
    id: string;
    name: string;
    species?: string | null;
    breed?: string | null;
    clientName: string;
  } | null>(null);

  const initialPatientQ = trpc.patients.getById.useQuery(
    { id: urlPatientId ?? "" },
    { enabled: Boolean(urlPatientId) && !selectedPatient }
  );

  useEffect(() => {
    if (initialPatientQ.data && !selectedPatient) {
      const p = initialPatientQ.data;
      const clientName =
        [p.clientFirstName, p.clientLastName].filter(Boolean).join(" ").trim() ||
        t("discharge.defaultClientName", "Klient");
      setSelectedPatient({
        id: p.id,
        name: p.name,
        species: p.species,
        breed: p.breed,
        clientName,
      });
      setPetName(p.name);
      if (p.species) {
        setSpecies(p.breed ? `${p.species} (${p.breed})` : p.species);
      }
    }
  }, [initialPatientQ.data, selectedPatient, t]);

  // Encounter context: when the clinician arrives from the visit workspace the
  // signed clinical closeout (diagnosis, discharge instructions, follow-up) is
  // the anamnesis this report must start from. Without it the AI writes a
  // discharge summary from empty fields.
  const encounterCloseoutQ = trpc.encounters.getCloseout.useQuery(
    { appointmentId: urlAppointmentId ?? "" },
    { enabled: Boolean(urlAppointmentId), retry: false }
  );

  useEffect(() => {
    const closeout = encounterCloseoutQ.data?.closeout;
    if (!closeout) return;

    // Prefill only untouched fields — never clobber what the clinician typed.
    if (closeout.diagnosisSummary) {
      setDiagnosis((prev) => (prev.trim() === "" ? closeout.diagnosisSummary ?? "" : prev));
    }
    if (closeout.dischargeInstructions) {
      setTreatment((prev) =>
        prev.trim() === "" ? closeout.dischargeInstructions ?? "" : prev
      );
    }
    const followUpParts = [
      closeout.followUpNotes?.trim() || "",
      closeout.followUpDueDate
        ? t("discharge.encounterFollowUpDue", "Kontrola: {date}", {
            date: closeout.followUpDueDate,
          })
        : "",
    ].filter(Boolean);
    if (followUpParts.length > 0) {
      const followUpText = followUpParts.join("\n");
      setFollowUp((prev) => (prev.trim() === "" ? followUpText : prev));
    }
  }, [encounterCloseoutQ.data, t]);

  const patientSearchQ = trpc.patients.search.useQuery(
    { query: patientSearch },
    { enabled: patientSearch.length >= 2 }
  );

  const patientDetailQ = trpc.patients.getById.useQuery(
    { id: selectedPatient?.id ?? "" },
    { enabled: !!selectedPatient?.id }
  );

  // Sympathy gate: deceased patients must not have standard automated follow-ups scheduled
  // Deceased patients must not have standard automated follow-ups scheduled.
  // Suppression logging to ext_automation_suppression_log must remain uncompromised.
  const isDeceased = patientDetailQ.data?.status === "deceased";

  // Clinical inputs
  const [petName, setPetName] = useState("");
  const [species, setSpecies] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [treatment, setTreatment] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [language, setLanguage] = useState<"sk" | "en">("sk");
  const [tone, setTone] = useState<"empathetic" | "standard" | "formal">("empathetic");

  // Output & UI state
  const [result, setResult] = useState("");
  // Human-in-the-loop: AI discharge text is saved as a draft unless the
  // clinician explicitly confirms it for finalization.
  const [clinicianConfirmed, setClinicianConfirmed] = useState(false);
  const [usedAi, setUsedAi] = useState(false);
  const [viewMode, setViewMode] = useState<"preview" | "edit">("preview");
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"editor" | "history">("editor");
  const [historySearch, setHistorySearch] = useState("");

  // Advanced AI pillars: SMS, Pill schedule, Marketing
  const [resultSubTab, setResultSubTab] = useState<"report" | "sms_schedule" | "marketing">("report");
  const [smsScheduleData, setSmsScheduleData] = useState<{
    smsText: string;
    medicationSchedule: Array<{
      medicationName: string;
      dosage: string;
      frequency: string;
      morning: boolean;
      noon: boolean;
      evening: boolean;
      night: boolean;
      withFood: boolean;
      notes: string;
    }>;
    warningSigns: string[];
  } | null>(null);
  const [marketingPostData, setMarketingPostData] = useState<{
    item: any;
    validationReport: any;
  } | null>(null);
  const [smsCopied, setSmsCopied] = useState(false);
  const [marketingChannel, setMarketingChannel] = useState<"instagram" | "facebook" | "google_business">("instagram");

  // Mutations
  const generateMutation = trpc.extensions.discharge.generate.useMutation();
  const saveMutation = trpc.extensions.discharge.save.useMutation();
  const prepareConfirmationMutation =
    trpc.extensions.discharge.prepareConfirmation.useMutation();
  const generateSmsMutation = trpc.extensions.discharge.generateSmsAndSchedule.useMutation();
  const createMarketingPostMutation = trpc.extensions.discharge.createMarketingPostFromCase.useMutation();

  // History query
  const historyQuery = trpc.extensions.discharge.listRecent.useQuery(undefined, {
    enabled: activeTab === "history",
  });

  const filteredHistory = useMemo(() => {
    const data = historyQuery.data ?? [];
    if (!historySearch.trim()) return data;
    const q = historySearch.toLowerCase();
    return data.filter(
      (item) =>
        item.petName.toLowerCase().includes(q) ||
        (item.species ?? "").toLowerCase().includes(q) ||
        item.diagnosis.toLowerCase().includes(q)
    );
  }, [historyQuery.data, historySearch]);

  // Handle patient select
  const handleSelectPatient = (p: {
    id: string;
    name: string;
    species?: string | null;
    breed?: string | null;
    clientFirstName?: string | null;
    clientLastName?: string | null;
  }) => {
    const clientName =
      [p.clientFirstName, p.clientLastName].filter(Boolean).join(" ").trim() ||
      t("discharge.defaultClientName", "Klient");
    setSelectedPatient({
      id: p.id,
      name: p.name,
      species: p.species,
      breed: p.breed,
      clientName,
    });
    setPetName(p.name);
    if (p.species) {
      setSpecies(p.breed ? `${p.species} (${p.breed})` : p.species);
    }
    setPatientSearchOpen(false);
  };

  const handleClearPatient = () => {
    setSelectedPatient(null);
    setPetName("");
    setSpecies("");
  };

  // Apply preset
  const handleApplyPreset = (preset: ClinicalPreset) => {
    setDiagnosis(preset.diagnosis);
    setTreatment(preset.treatment);
    setFollowUp(preset.followUp);
    toast.info(t("discharge.presetApplied", "Šablóna „{name}“ aplikovaná", { name: t(`discharge.${preset.key}`, preset.name) }));
  };

  // Generate report
  const handleGenerate = async () => {
    if (!petName.trim() || !diagnosis.trim()) {
      toast.error(
        t(
          "discharge.validationError",
          "Please enter at least the pet name and diagnosis."
        )
      );
      return;
    }

    try {
      const res = await generateMutation.mutateAsync({
        patientId: selectedPatient?.id,
        petName: petName.trim(),
        species: species.trim() || undefined,
        diagnosis: diagnosis.trim(),
        treatment: treatment.trim() || undefined,
        followUp: followUp.trim() || undefined,
        language,
        tone,
      });

      if (res?.text) {
        // Sanitize rich text / Markdown to prevent HTML tag bleeding
        const sanitized = sanitizeMarkdownForDisplay(res.text);
        setResult(sanitized);
        setUsedAi(res.usedAi);
        setViewMode("preview");
        setResultSubTab("report");
        toast.success(
          res.usedAi
            ? t("discharge.aiBadge", "AI Generated")
            : t("discharge.templateBadge", "Clinical Template")
        );

        // Pre-fetch SMS and medication schedule - blocked by sympathy gate for deceased
        if (!isDeceased) {
          generateSmsMutation.mutate(
            {
              patientId: selectedPatient?.id,
              petName: petName.trim(),
              diagnosis: diagnosis.trim(),
              treatment: treatment.trim() || undefined,
              followUp: followUp.trim() || undefined,
              language,
            },
            {
              onSuccess: (smsData) => setSmsScheduleData(smsData),
            },
          );
        } else {
          setSmsScheduleData(null);
        }
      }
    } catch (error) {
      console.error("Discharge report generation failed:", error);
      toast.error(
        t("discharge.generationFailed", "Failed to generate report.")
      );
    }
  };

  const handleCreateMarketingPost = async () => {
    if (isDeceased) {
      toast.error(
        t(
          "discharge.deceasedWarning",
          "Notice: This patient is marked as deceased. The generated message will automatically be formatted as a condolence note."
        )
      );
      return;
    }
    if (!diagnosis.trim()) {
      toast.error(t("discharge.validationError", "Please enter at least the pet name and diagnosis."));
      return;
    }
    try {
      const res = await createMarketingPostMutation.mutateAsync({
        patientId: selectedPatient?.id,
        petName: petName.trim() || t("discharge.defaultPetName", "Pacient"),
        species: species.trim() || undefined,
        diagnosis: diagnosis.trim(),
        treatment: treatment.trim() || undefined,
        channel: marketingChannel,
      });
      setMarketingPostData(res);
      toast.success(t("discharge.marketingSuccess", "Post successfully drafted and added to content plan!"));
    } catch (err) {
      toast.error(t("discharge.marketingFailed", "Nepodarilo sa vytvoriť príspevok."));
    }
  };

  // Copy to clipboard
  const handleCopy = useCallback(async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      toast.success(t("discharge.copied", "Copied to clipboard"));
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error(t("discharge.copyFailed", "Kopírovanie zlyhalo"));
    }
  }, [result, t]);

  // Print report — render Markdown as styled HTML with hardened print stylesheet
  const handlePrint = useCallback(() => {
    if (!result) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      window.print();
      return;
    }

    // Render the ReactMarkdown preview div content via the DOM
    const previewEl = document.querySelector("[data-discharge-preview]");
    const rawHtml = previewEl?.innerHTML ?? "";
    const renderedHtml = sanitizePrintHtml(rawHtml);

    // Sanitized fallback text if preview not available
    const fallbackText = sanitizeMarkdownForDisplay(result)
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br/>");

    const contentHtml = renderedHtml || fallbackText;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Prepúšťacia správa - ${petName || "Pacient"}</title>
          <style>
            @media print {
              body { margin: 0; padding: 20mm; font-size: 11pt; color: #000; }
              @page { size: A4; margin: 15mm; }
              .header-bar, .markdown-body, .signature-block, .clinic-footer, .med-table, .warning-box {
                page-break-inside: avoid;
              }
              h1, h2, h3 { page-break-after: avoid; }
              ul, ol { page-break-inside: avoid; }
              .no-print { display: none !important; }
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              padding: 40px;
              color: #1a202c;
              line-height: 1.6;
              max-width: 800px;
              margin: 0 auto;
            }
            .header-bar {
              border-bottom: 2px solid #2563eb;
              padding-bottom: 12px;
              margin-bottom: 24px;
            }
            .signature-block {
              margin-top: 32px;
              padding-top: 16px;
              border-top: 1px solid #e2e8f0;
            }
            .clinic-footer {
              margin-top: 24px;
              padding: 12px;
              background: #f8fafc;
              border-radius: 8px;
              font-size: 10pt;
              color: #64748b;
            }
            h1 { font-size: 1.5em; margin-top: 1.5em; }
            h2 { font-size: 1.3em; margin-top: 1.3em; }
            h3 { font-size: 1.15em; margin-top: 1.15em; color: #1e3a8a; }
            ul, ol { padding-left: 1.5em; }
            li { margin-bottom: 0.3em; }
            strong { color: #1e3a8a; }
            hr { border: none; border-top: 1px solid #e2e8f0; margin: 1.5em 0; }
            p { margin-bottom: 0.6em; }
          </style>
        </head>
        <body>
          <div class="header-bar">
            <h2 style="margin: 0; color: #1e3a8a;">Veterinárna ambulancia & klinika</h2>
            <small style="color: #64748b;">Záverečná prepúšťacia správa pre majiteľa zvieraťa</small>
          </div>
          <div class="markdown-body">${contentHtml}</div>
          <div class="signature-block">
            <p style="margin:0; font-size: 11pt;"><strong>Podpis ošetrujúceho veterinárneho lekára / pečiatka:</strong></p>
            <div style="height: 60px; border-bottom: 1px solid #000; margin-top: 24px; width: 60%;"></div>
            <p style="font-size: 9pt; color: #64748b; margin-top: 8px;">Dátum: ${new Date().toLocaleDateString("sk-SK")} &nbsp;|&nbsp; Miesto: Veterinárna klinika</p>
          </div>
          <div class="clinic-footer">
            <p style="margin:0;">V prípade akýchkoľvek otázok alebo obáv kontaktujte našu kliniku. Tento dokument bol skontrolovaný a schválený ošetrujúcim lekárom.</p>
            <p style="margin: 4px 0 0 0; font-size: 9pt;">Vygenerované: ${new Date().toLocaleString("sk-SK")} • Pacient: ${petName || "Pacient"} • Režim: ${isDeceased ? "Sústrasť" : "Štandard"}</p>
          </div>
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }, [result, petName, isDeceased]);

  // PDF export via dynamic lazy-loading - must remain dynamic import
  const handleExportPdf = useCallback(async () => {
    if (!result) return;
    try {
      const { generateDischargeInstructions } = await import("@/lib/pdf");
      const meds =
        smsScheduleData?.medicationSchedule?.map((m) => ({
          name: m.medicationName,
          dosage: m.dosage,
          frequency: m.frequency,
          instructions: m.notes,
        })) ?? [];

      // Prevent generation of empty medication tables when no prescriptions were issued
      const filteredMeds = meds.filter((m) => m.name?.trim());

      const doc = generateDischargeInstructions({
        practiceName: "Veterinárna ambulancia",
        patientName: petName || t("discharge.defaultPetName", "Pacient"),
        species: species || t("discharge.defaultSpecies", "zviera"),
        clientName: selectedPatient?.clientName || t("discharge.defaultClientName", "Klient"),
        visitDate: new Date().toISOString().split("T")[0] ?? new Date().toLocaleDateString(),
        diagnosis: diagnosis || result.slice(0, 500),
        medications: filteredMeds,
        instructions: sanitizeMarkdownForDisplay(result)
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean)
          .slice(0, 30),
        followUpNotes: followUp,
        emergencyNotes: smsScheduleData?.warningSigns?.join(", "),
        locale: language,
      });
      doc.save(`discharge-${petName || "patient"}-${new Date().toISOString().split("T")[0]}.pdf`);
      toast.success(t("discharge.print", "Print / PDF"));
    } catch (e) {
      console.error("PDF export failed", e);
      toast.error(t("discharge.saveFailed", "Failed to save report"));
    }
  }, [result, petName, species, selectedPatient, diagnosis, followUp, smsScheduleData, language, t]);

  // Save to database. Finalization uses a pre-issued one-time confirmation
  // envelope (prepareConfirmation -> save) for replay protection; the
  // prepare step creates the server-side draft the envelope binds to.
  const handleSave = async () => {
    if (!result.trim() || !petName.trim() || !diagnosis.trim()) return;

    try {
      let confirmation:
        | { reportId: string; confirmationId: string; expectedRevision: number }
        | undefined;
      if (clinicianConfirmed) {
        try {
          const prepared = await prepareConfirmationMutation.mutateAsync({
            patientId: selectedPatient?.id,
            petName: petName.trim(),
            species: species.trim() || undefined,
            diagnosis: diagnosis.trim(),
            treatment: treatment.trim() || undefined,
            followUp: followUp.trim() || undefined,
            reportText: result,
            language,
          });
          confirmation = {
            reportId: prepared.reportId,
            confirmationId: prepared.confirmationId,
            expectedRevision: prepared.expectedRevision,
          };
        } catch {
          toast.error(
            t(
              "discharge.confirmPrepareFailed",
              "Could not prepare clinician confirmation. Please review and retry.",
            ),
          );
          return;
        }
      }
      await saveMutation.mutateAsync({
        ...(confirmation
          ? {
              id: confirmation.reportId,
              expectedRevision: confirmation.expectedRevision,
            }
          : {}),
        patientId: selectedPatient?.id,
        petName: petName.trim(),
        species: species.trim() || undefined,
        diagnosis: diagnosis.trim(),
        treatment: treatment.trim() || undefined,
        followUp: followUp.trim() || undefined,
        reportText: result,
        language,
        status: clinicianConfirmed ? "finalized" : "draft",
        clinicianConfirmed: confirmation
          ? { confirmationId: confirmation.confirmationId }
          : undefined,
      });
      toast.success(
        clinicianConfirmed
          ? t("discharge.saved", "Report confirmed and saved to chart")
          : t("discharge.savedDraft", "Report saved as a draft (not yet confirmed by a clinician)")
      );
      utils.extensions.discharge.listRecent.invalidate();
    } catch (err) {
      const code =
        err && typeof err === "object" && "data" in err
          ? (err as { data?: { code?: string } }).data?.code
          : undefined;
      toast.error(
        code === "CONFLICT"
          ? t(
              "discharge.saveConflict",
              "Záznam bol medzičasom zmenený. Obnovte dáta a skúste znova.",
            )
          : code === "PRECONDITION_FAILED"
            ? t(
                "discharge.confirmationExpired",
                "Potvrdenie vypršalo alebo je neplatné. Skontrolujte obsah a potvrďte znova.",
              )
            : t("discharge.saveFailed", "Failed to save report"),
      );
    }
  };

  // Load from history
  const handleLoadHistory = (item: {
    petName: string;
    species: string | null;
    diagnosis: string;
    treatment: string | null;
    followUp: string | null;
    reportText: string;
  }) => {
    setPetName(item.petName);
    setSpecies(item.species || "");
    setDiagnosis(item.diagnosis);
    setTreatment(item.treatment || "");
    setFollowUp(item.followUp || "");
    setResult(sanitizeMarkdownForDisplay(item.reportText));
    setActiveTab("editor");
    setViewMode("preview");
    toast.info(t("discharge.loadReport", "Load into editor"));
  };

  return (
    <div className={pageShellClass}>
      {/* Page Header - canonical with title and subtitle */}
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            {t("discharge.title", "Discharge Report Generator")}
            <Badge variant="secondary" className="gap-1 bg-primary/10 text-primary border-primary/20">
              <Sparkles className="h-3 w-3" />
              {t("discharge.badge", "Clinical AI Assistant")}
            </Badge>
          </span>
        }
        subtitle={t(
          "discharge.subtitle",
          "AI assistant for generating clear, empathetic home care instructions for pet owners.",
        )}
        actions={
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "editor" | "history")}>
            <TabsList className={underlineTabsListClass}>
              <TabsTrigger value="editor" className={cn(underlineTabsTriggerClass, "gap-1.5")}>
                <FileText className="h-4 w-4" />
                {t("discharge.editorTab", "Report Editor")}
              </TabsTrigger>
              <TabsTrigger value="history" className={cn(underlineTabsTriggerClass, "gap-1.5")}>
                <History className="h-4 w-4" />
                {t("discharge.historyTab", "Report History")}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />

      {activeTab === "history" ? (
        /* History View - wrapped in DataTableFrame with PageToolbar */
        <div className="space-y-4">
          <PageToolbar>
            <SearchField
              value={historySearch}
              onChange={setHistorySearch}
              placeholder={t("discharge.patientSelectPlaceholder", "Search patient by name...")}
            />
            <div className="flex items-center gap-2 ml-auto">
              <Badge variant="outline" className="text-xs">
                {filteredHistory.length} {t("discharge.historyTab", "Report History")}
              </Badge>
            </div>
          </PageToolbar>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                {t("discharge.historyTab", "Report History")}
              </CardTitle>
              <CardDescription>
                {t("discharge.formSubtitle", "Select a patient or enter details manually to generate the discharge instructions.")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {historyQuery.isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !filteredHistory || filteredHistory.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">{t("discharge.noHistory", "No saved reports yet")}</p>
                </div>
              ) : (
                <DataTableFrame>
                  <div className="grid gap-3 p-3 md:grid-cols-2">
                    {filteredHistory.map((item) => (
                      <Card key={item.id} className="hover:border-primary/50 transition-colors shadow-xs">
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-semibold">
                              {item.petName}
                              {item.species && (
                                <span className="text-xs font-normal text-muted-foreground ml-2">
                                  ({formatSpecies(item.species, t)})
                                </span>
                              )}
                            </CardTitle>
                            <Badge variant="outline" className="text-[11px]">
                              {new Date(item.createdAt).toLocaleDateString()}
                            </Badge>
                          </div>
                          <CardDescription className="line-clamp-2 text-xs">
                            {item.diagnosis}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-2 flex justify-end">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleLoadHistory(item)}
                            className="gap-1.5 text-xs h-7"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            {t("discharge.loadReport", "Load into editor")}
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </DataTableFrame>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        /* Main 2-Column Editor Layout */
        <div className="space-y-4">
          {/* Encounter selection toolbar - UI Kit PageToolbar */}
          <PageToolbar>
            <div className="flex flex-1 items-center gap-2 min-w-0">
              <Stethoscope className="h-4 w-4 text-primary shrink-0" />
              <span className="text-xs font-semibold text-foreground hidden sm:inline">
                {t("discharge.patientSearch", "Assign patient (optional)")}
              </span>
              <Popover open={patientSearchOpen} onOpenChange={setPatientSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={patientSearchOpen}
                    className="w-full sm:w-[320px] justify-between text-left font-normal h-9 text-xs"
                  >
                    {selectedPatient ? (
                      <span className="font-medium text-foreground truncate">
                        {selectedPatient.name}{" "}
                        <span className="text-xs text-muted-foreground">
                          ({selectedPatient.clientName})
                        </span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        {t("discharge.patientSelectPlaceholder", "Search patient by name...")}
                      </span>
                    )}
                    <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[360px] sm:w-[420px] p-2" align="start">
                  <Input
                    placeholder={t("discharge.patientSelectPlaceholder", "Search patient by name...")}
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                    className="mb-2 h-9 text-xs"
                    autoFocus
                  />
                  <div className="max-h-[220px] overflow-y-auto">
                    {patientSearchQ.isLoading && (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    )}
                    {patientSearchQ.data?.length === 0 && patientSearch.length >= 2 && (
                      <p className="text-center py-4 text-xs text-muted-foreground">
                        {t("discharge.noPatientsFound", "No patients found")}
                      </p>
                    )}
                    {patientSearchQ.data?.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className={cn(
                          "w-full text-left px-3 py-2 rounded-md text-xs hover:bg-accent flex items-center justify-between transition-colors",
                          selectedPatient?.id === p.id && "bg-accent font-medium"
                        )}
                        onClick={() => handleSelectPatient(p)}
                      >
                        <div className="truncate">
                          <span className="font-medium">{p.name}</span>
                          <span className="text-[11px] text-muted-foreground ml-2">
                            {p.species || t("discharge.defaultSpecies", "zviera")} — {p.clientFirstName} {p.clientLastName}
                          </span>
                        </div>
                        {selectedPatient?.id === p.id && (
                          <Check className="h-4 w-4 text-primary shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            {selectedPatient && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearPatient}
                className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1"
              >
                <X className="h-3 w-3" />
                {t("discharge.clearPatient", "Clear selection")}
              </Button>
            )}
          </PageToolbar>

          {/* Sympathy Gate Banner - semantic tokens destructive/muted */}
          {isDeceased && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs leading-relaxed">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <div className="space-y-1">
                <strong className="font-semibold block">{t("discharge.sympathyFlow", "Režim sústrasti")}</strong>
                <span className="text-destructive/90">
                  {t(
                    "discharge.deceasedWarning",
                    "Notice: This patient is marked as deceased. The generated message will automatically be formatted as a condolence note."
                  )}
                </span>
                <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground bg-muted/50 rounded px-2 py-1 border">
                  <ShieldCheck className="h-3 w-3" />
                  <span>
                    {t(
                      "discharge.sympathySuppressionNote",
                      "Automatické pripomienky, marketing a kontroly sú potlačené (ext_automation_suppression_log)."
                    )}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Clinical Inputs */}
            <div className="lg:col-span-6 flex flex-col gap-4">
              {/* Clinical Presets - wrapped in PageToolbar */}
              <PageToolbar className="bg-card/30">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  {t("discharge.quickScenarios", "Quick Clinical Presets")}:
                </div>
                <div className="flex flex-wrap gap-2 ml-auto">
                  {PRESETS_SK.map((preset) => (
                    <Button
                      key={preset.key}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs bg-card hover:bg-primary/10 hover:text-primary hover:border-primary/30"
                      onClick={() => handleApplyPreset(preset)}
                    >
                      {t(`discharge.${preset.key}`, preset.name)}
                    </Button>
                  ))}
                </div>
              </PageToolbar>

              {/* Clinical Details Form */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold">
                    {t("discharge.formTitle", "Clinical Report Inputs")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-foreground">
                        {t("discharge.petNameLabel", "Pet Name *")}
                      </label>
                      <Input
                        value={petName}
                        onChange={(e) => setPetName(e.target.value)}
                        placeholder={t("discharge.petNamePlaceholder", "e.g. Bella")}
                        className="h-9 text-xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-foreground">
                        {t("discharge.speciesLabel", "Species / Breed")}
                      </label>
                      <Input
                        value={species}
                        onChange={(e) => setSpecies(e.target.value)}
                        placeholder={t("discharge.speciesPlaceholder", "e.g. Dog, Golden Retriever")}
                        className="h-9 text-xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">
                      {t("discharge.diagnosisLabel", "Diagnosis & Clinical Finding *")}
                    </label>
                    <Textarea
                      rows={3}
                      value={diagnosis}
                      onChange={(e) => setDiagnosis(e.target.value)}
                      placeholder={t(
                        "discharge.diagnosisPlaceholder",
                        "e.g. Acute gastroenteritis secondary to dietary indiscretion, mild dehydration"
                      )}
                      className="text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">
                      {t("discharge.treatmentLabel", "Administered Treatment & Medications")}
                    </label>
                    <Textarea
                      rows={3}
                      value={treatment}
                      onChange={(e) => setTreatment(e.target.value)}
                      placeholder={t(
                        "discharge.treatmentPlaceholder",
                        "e.g. Subcutaneous fluids (LRS 250ml), Maropitant 1mg/kg SC. Discharge meds: Omeprazole 10mg once daily before meals."
                      )}
                      className="text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">
                      {t("discharge.followUpLabel", "Follow-up & Home Care")}
                    </label>
                    <Textarea
                      rows={3}
                      value={followUp}
                      onChange={(e) => setFollowUp(e.target.value)}
                      placeholder={t(
                        "discharge.followUpPlaceholder",
                        "e.g. Bland diet (boiled chicken & rice) for 5 days. Recheck in 3 days or sooner if vomiting resumes."
                      )}
                      className="text-xs"
                    />
                  </div>

                  {/* Tone and Language Selection */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-foreground">
                        {t("discharge.tone", "Communication Tone")}
                      </label>
                      <select
                        value={tone}
                        onChange={(e) => setTone(e.target.value as "empathetic" | "standard" | "formal")}
                        className={filterControlClass + " w-full text-xs"}
                      >
                        <option value="empathetic">
                          {t("discharge.toneEmpathetic", "Empathetic & Warm")}
                        </option>
                        <option value="standard">
                          {t("discharge.toneStandard", "Standard Professional")}
                        </option>
                        <option value="formal">
                          {t("discharge.toneFormal", "Concise Medical")}
                        </option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-foreground">
                        {t("discharge.language", "Report Language")}
                      </label>
                      <select
                        value={language}
                        onChange={(e) => setLanguage(e.target.value as "sk" | "en")}
                        className={filterControlClass + " w-full text-xs"}
                      >
                        <option value="sk">{t("discharge.languageSk", "Slovenčina (SK)")}</option>
                        <option value="en">{t("discharge.languageEn", "English (EN)")}</option>
                      </select>
                    </div>
                  </div>

                  {/* Submit Action */}
                  <Button
                    type="button"
                    onClick={handleGenerate}
                    disabled={!petName.trim() || !diagnosis.trim() || generateMutation.isPending}
                    className="w-full gap-2 py-5 text-sm font-semibold shadow-sm"
                  >
                    {generateMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t("discharge.generatingButton", "Generating client report...")}
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        {t("discharge.generateButton", "Generate Discharge Report")}
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Right Column: Generated Report Preview & Actions */}
            <div className="lg:col-span-6 flex flex-col gap-4 min-w-0">
              <Card className="flex flex-col h-full min-h-[550px] shadow-sm overflow-hidden">
                <CardHeader className="pb-3 border-b border-border">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Bot className="h-5 w-5 text-primary shrink-0" />
                      <CardTitle className="text-base font-semibold">
                        {t("discharge.resultTitle", "Final Discharge Report")}
                      </CardTitle>
                      {result && (
                        <ClinicalStatusBadge
                          status={clinicianConfirmed ? "authorized" : "ai_draft"}
                          confidenceScore={94}
                          size="sm"
                        />
                      )}
                    </div>

                    {/* Prominent vet approval toggle - before print/email actions */}
                    {result && (
                      <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 flex flex-col gap-2">
                        <label className="flex items-start gap-2.5 cursor-pointer">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-input mt-0.5"
                            checked={clinicianConfirmed}
                            onChange={(e) => setClinicianConfirmed(e.target.checked)}
                            aria-label={t("discharge.clinicianConfirm", "I reviewed this AI report and confirm it for the chart")}
                            data-testid="discharge-clinician-confirm"
                          />
                          <div className="flex-1 min-w-0">
                            <span className="text-xs font-semibold text-foreground block">
                              {t("discharge.clinicianConfirmShort", "Reviewed by clinician")}
                            </span>
                            <span className="text-[11px] text-muted-foreground leading-relaxed">
                              {t("discharge.clinicianConfirm", "I reviewed this AI report and confirm it for the chart")}
                            </span>
                          </div>
                          <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
                        </label>
                        {!clinicianConfirmed && (
                          <p className="text-[11px] text-muted-foreground bg-muted/50 rounded px-2 py-1 border">
                            {t(
                              "discharge.approvalRequiredNote",
                              "AI výstup musí skontrolovať ošetrujúci veterinár pred tlačou alebo odoslaním majiteľovi."
                            )}
                          </p>
                        )}
                      </div>
                    )}

                    {result && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setViewMode(viewMode === "preview" ? "edit" : "preview")}
                          className="h-8 px-2.5 text-xs gap-1"
                        >
                          {viewMode === "preview" ? (
                            <>
                              <Edit3 className="h-3.5 w-3.5" />
                              {t("discharge.editMode", "Edit")}
                            </>
                          ) : (
                            <>
                              <Eye className="h-3.5 w-3.5" />
                              {t("discharge.previewMode", "Preview")}
                            </>
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleCopy}
                          className="h-8 px-2.5 text-xs gap-1"
                        >
                          {copied ? (
                            <Check className="h-3.5 w-3.5 text-success" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                          {copied
                            ? t("discharge.copied", "Copied to clipboard")
                            : t("discharge.copy", "Copy")}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handlePrint}
                          className="h-8 px-2.5 text-xs gap-1"
                        >
                          <Printer className="h-3.5 w-3.5" />
                          {t("discharge.print", "Print / PDF")}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleExportPdf}
                          className="h-8 px-2.5 text-xs gap-1"
                          title="Export PDF via dynamic import"
                        >
                          <Download className="h-3.5 w-3.5" />
                          PDF
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={handleSave}
                          disabled={saveMutation.isPending}
                          className="h-8 px-3 text-xs gap-1 bg-primary text-primary-foreground ml-auto"
                        >
                          {saveMutation.isPending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Save className="h-3.5 w-3.5" />
                          )}
                          {saveMutation.isPending
                            ? t("discharge.saving", "Saving...")
                            : clinicianConfirmed
                              ? t("discharge.saveFinal", "Confirm & Save to Chart")
                              : t("discharge.saveDraft", "Save Draft")}
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>

                {/* Advanced AI Sub-tabs: Report / SMS & Pill Schedule / Social Marketing - underline tabs */}
                {result && (
                  <div className="border-b border-border bg-muted/20 px-3 overflow-x-auto">
                    <Tabs value={resultSubTab} onValueChange={(v) => setResultSubTab(v as any)}>
                      <TabsList className={underlineTabsListClass}>
                        <TabsTrigger
                          value="report"
                          className={cn(underlineTabsTriggerClass, "gap-1.5")}
                          onClick={() => setResultSubTab("report")}
                        >
                          <FileText className="h-3.5 w-3.5" />
                          {t("discharge.tabs.report", "Discharge Report")}
                        </TabsTrigger>
                        <TabsTrigger
                          value="sms_schedule"
                          className={cn(underlineTabsTriggerClass, "gap-1.5")}
                          disabled={isDeceased}
                          onClick={() => {
                            if (isDeceased) return;
                            setResultSubTab("sms_schedule");
                            if (!smsScheduleData && result) {
                              generateSmsMutation.mutate(
                                {
                                  patientId: selectedPatient?.id,
                                  petName: petName.trim(),
                                  diagnosis: diagnosis.trim(),
                                  treatment: treatment.trim() || undefined,
                                  followUp: followUp.trim() || undefined,
                                  language,
                                },
                                {
                                  onSuccess: (data) => setSmsScheduleData(data),
                                }
                              );
                            }
                          }}
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                          {t("discharge.tabs.smsSchedule", "SMS & Pill Schedule")}
                          {smsScheduleData && !isDeceased && (
                            <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 ml-1">
                              {t("discharge.smsBadge", "160 zn.")}
                            </Badge>
                          )}
                          {isDeceased && (
                            <Badge variant="destructive" className="text-[10px] px-1 py-0 h-4 ml-1">
                              {t("discharge.sympathyFlow", "Režim sústrasti")}
                            </Badge>
                          )}
                        </TabsTrigger>
                        <TabsTrigger
                          value="marketing"
                          className={cn(underlineTabsTriggerClass, "gap-1.5")}
                          disabled={isDeceased}
                          onClick={() => !isDeceased && setResultSubTab("marketing")}
                        >
                          <Megaphone className="h-3.5 w-3.5" />
                          {t("discharge.tabs.marketing", "Educational Post (Ethics)")}
                          {marketingPostData && !isDeceased && (
                            <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 ml-1 bg-success/20 text-success">
                              ✓
                            </Badge>
                          )}
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                )}

                <CardContent className="flex-1 p-3 sm:p-4 flex flex-col min-h-0 overflow-hidden">
                  {generateMutation.isPending ? (
                    <div className="flex flex-col items-center justify-center h-full min-h-[350px] text-center p-8 text-muted-foreground gap-3">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <p className="text-sm font-medium text-foreground">
                        {t("discharge.generatingNotice", "AI is translating clinical jargon into practical home care instructions...")}
                      </p>
                    </div>
                  ) : result ? (
                    resultSubTab === "report" ? (
                      viewMode === "preview" ? (
                        <div
                          className="flex-1 overflow-y-auto p-4 sm:p-6 rounded-lg bg-muted/40 border border-border max-h-[70vh] lg:max-h-[600px] min-h-[300px]"
                          data-discharge-preview
                        >
                          <MarkdownView className="prose prose-sm max-w-none dark:prose-invert prose-headings:font-heading prose-headings:text-foreground prose-p:text-foreground prose-li:text-foreground prose-strong:text-foreground prose-hr:border-border break-words">
                            {result}
                          </MarkdownView>
                          {/* Signature block - ensure print stylesheet does not cut off */}
                          <div className="signature-block mt-8 pt-4 border-t border-border">
                            <p className="text-xs font-semibold text-foreground">
                              {t("discharge.signatureBlock", "Podpis ošetrujúceho lekára / pečiatka")}
                            </p>
                            <div className="mt-4 h-16 border-b border-foreground/20 w-2/3" />
                          </div>
                          <div className="clinic-footer mt-4 p-3 rounded-lg bg-muted/30 border text-[11px] text-muted-foreground">
                            <p className="m-0">
                              {t(
                                "discharge.footerNote",
                                "V prípade otázok kontaktujte kliniku. Dokument bol skontrolovaný lekárom."
                              )}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <Textarea
                          value={result}
                          onChange={(e) => setResult(sanitizeMarkdownForDisplay(e.target.value))}
                          className="flex-1 min-h-[400px] max-h-[70vh] lg:max-h-none font-mono text-xs leading-relaxed resize-y overflow-y-auto"
                        />
                      )
                    ) : resultSubTab === "sms_schedule" ? (
                      <div className="space-y-4 overflow-y-auto flex-1 pr-1 max-h-[70vh] lg:max-h-none">
                        {isDeceased ? (
                          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 space-y-2">
                            <h4 className="text-xs font-bold text-destructive flex items-center gap-1.5">
                              <AlertTriangle className="h-4 w-4 shrink-0" />
                              {t("discharge.sympathyFlow", "Režim sústrasti")}
                            </h4>
                            <p className="text-xs text-muted-foreground">
                              {t(
                                "discharge.deceasedWarning",
                                "Notice: This patient is marked as deceased. The generated message will automatically be formatted as a condolence note."
                              )}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              SMS a marketing sú automaticky potlačené. Záznam v ext_automation_suppression_log.
                            </p>
                          </div>
                        ) : (
                          <>
                            {/* 160-char SMS Card */}
                            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                              <div className="flex items-center justify-between flex-wrap gap-2">
                                <div className="flex items-center gap-2">
                                  <MessageSquare className="h-4 w-4 text-primary" />
                                  <h4 className="text-xs font-bold text-foreground">
                                    {t("discharge.smsTextLabel", "SMS Message for Owner (max 160 chars)")}
                                  </h4>
                                </div>
                                <Badge
                                  variant={
                                    (smsScheduleData?.smsText.length ?? 0) <= 160
                                      ? "secondary"
                                      : "destructive"
                                  }
                                  className="text-[11px] font-mono"
                                >
                                  {t("discharge.smsCharCount", "{count} / 160 znakov", { count: smsScheduleData?.smsText.length ?? 0 })}
                                </Badge>
                              </div>

                              <div className="rounded-lg bg-muted/50 p-3 text-xs text-foreground font-mono leading-relaxed border border-border/60 break-words">
                                {generateSmsMutation.isPending ? (
                                  <div className="flex items-center gap-2 py-2 text-muted-foreground">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    <span>{t("discharge.smsPreparing", "Pripravujem SMS súhrn a liekový rozvrh...")}</span>
                                  </div>
                                ) : (
                                  smsScheduleData?.smsText ||
                                  t("discharge.smsGenerating", "SMS text sa generuje...")
                                )}
                              </div>

                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-8 text-xs gap-1.5"
                                  onClick={async () => {
                                    if (!smsScheduleData?.smsText) return;
                                    await navigator.clipboard.writeText(smsScheduleData.smsText);
                                    setSmsCopied(true);
                                    toast.success(t("discharge.smsCopied", "SMS skopírovaná do schránky"));
                                    setTimeout(() => setSmsCopied(false), 2000);
                                  }}
                                >
                                  {smsCopied ? (
                                    <Check className="h-3.5 w-3.5 text-success" />
                                  ) : (
                                    <Copy className="h-3.5 w-3.5" />
                                  )}
                                  {smsCopied
                                    ? t("discharge.copiedShort", "Skopírované")
                                    : t("discharge.copySms", "Kopírovať SMS")}
                                </Button>
                              </div>
                            </div>

                            {/* Visual Pill Schedule Table - wrapped in DataTableFrame, prevent empty tables */}
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 px-1">
                                <Clock className="h-4 w-4 text-primary" />
                                <h4 className="text-xs font-bold text-foreground">
                                  {t("discharge.medScheduleTitle", "Home Medication Schedule")}
                                </h4>
                              </div>

                              {smsScheduleData?.medicationSchedule && smsScheduleData.medicationSchedule.length > 0 ? (
                                <DataTableFrame>
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-xs text-left border-collapse">
                                      <thead>
                                        <tr className="border-b bg-muted/30">
                                          <th className={tableHeadClass}>{t("discharge.medColumn", "Liek / Dávkovanie")}</th>
                                          <th className={cn(tableHeadClass, "text-center")}>{t("discharge.morning", "Ráno")} (☀️)</th>
                                          <th className={cn(tableHeadClass, "text-center")}>{t("discharge.noon", "Obed")} (🌤️)</th>
                                          <th className={cn(tableHeadClass, "text-center")}>{t("discharge.evening", "Večer")} (🌙)</th>
                                          <th className={cn(tableHeadClass, "text-center")}>{t("discharge.night", "Noc")} (🌑)</th>
                                          <th className={tableHeadClass}>{t("discharge.regimenColumn", "Režim / Pokyn")}</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {smsScheduleData.medicationSchedule
                                          .filter((item) => item.medicationName?.trim())
                                          .map((item, idx) => (
                                            <tr key={idx} className={tableRowClass}>
                                              <td className={cn(tableCellClass, "font-medium text-foreground")}>
                                                {item.medicationName}
                                                {item.dosage && (
                                                  <span className="block text-[11px] text-muted-foreground">
                                                    {item.dosage}
                                                  </span>
                                                )}
                                              </td>
                                              <td className={cn(tableCellClass, "text-center")}>
                                                {item.morning ? (
                                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                                    {t("discharge.yes", "Áno")}
                                                  </Badge>
                                                ) : (
                                                  <span className="text-muted-foreground/40">—</span>
                                                )}
                                              </td>
                                              <td className={cn(tableCellClass, "text-center")}>
                                                {item.noon ? (
                                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                                    {t("discharge.yes", "Áno")}
                                                  </Badge>
                                                ) : (
                                                  <span className="text-muted-foreground/40">—</span>
                                                )}
                                              </td>
                                              <td className={cn(tableCellClass, "text-center")}>
                                                {item.evening ? (
                                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                                    {t("discharge.yes", "Áno")}
                                                  </Badge>
                                                ) : (
                                                  <span className="text-muted-foreground/40">—</span>
                                                )}
                                              </td>
                                              <td className={cn(tableCellClass, "text-center")}>
                                                {item.night ? (
                                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                                    {t("discharge.yes", "Áno")}
                                                  </Badge>
                                                ) : (
                                                  <span className="text-muted-foreground/40">—</span>
                                                )}
                                              </td>
                                              <td className={cn(tableCellClass, "text-muted-foreground")}>
                                                {item.withFood ? (
                                                  <Badge variant="outline" className="text-[10px] border-success/30 bg-success/10 text-success mr-1">
                                                    {t("discharge.withFood", "S krmivom")}
                                                  </Badge>
                                                ) : null}
                                                {item.notes}
                                              </td>
                                            </tr>
                                          ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </DataTableFrame>
                              ) : (
                                <div className="rounded-lg border border-dashed p-4 text-center">
                                  <p className="text-xs text-muted-foreground italic">
                                    {t("discharge.noHomeMedication", "Pre tohto pacienta nebola predpísaná žiadna špecifická domáca perorálna medikácia.")}
                                  </p>
                                </div>
                              )}
                            </div>

                            {/* Warning signs box - semantic destructive */}
                            {smsScheduleData?.warningSigns && smsScheduleData.warningSigns.length > 0 && (
                              <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 space-y-2">
                                <h4 className="text-xs font-bold text-destructive flex items-center gap-1.5">
                                  <AlertTriangle className="h-4 w-4 shrink-0" />
                                  {t("discharge.warningSignsTitle", "Warning Signs (when to call immediately)")}
                                </h4>
                                <ul className="space-y-1 text-xs text-foreground list-disc pl-5">
                                  {smsScheduleData.warningSigns.map((w, idx) => (
                                    <li key={idx}>{w}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    ) : (
                      /* Marketing Post Tab - sympathy gate suppressed */
                      <div className="space-y-4 overflow-y-auto flex-1 pr-1 max-h-[70vh] lg:max-h-none">
                        {isDeceased ? (
                          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 space-y-2">
                            <h4 className="text-xs font-bold text-destructive flex items-center gap-1.5">
                              <AlertTriangle className="h-4 w-4 shrink-0" />
                              {t("discharge.sympathyFlow", "Režim sústrasti")}
                            </h4>
                            <p className="text-xs text-muted-foreground">
                              Marketingové príspevky sú pre uhynutých pacientov automaticky potlačené. Suppression log: ext_automation_suppression_log.
                            </p>
                          </div>
                        ) : (
                          <>
                            <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-1.5">
                              <div className="flex items-center gap-2 text-foreground">
                                <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
                                <h4 className="text-xs font-bold">
                                  {t("discharge.marketingTitle", "Autonomous Marketing Brain from Clinical Case")}
                                </h4>
                              </div>
                              <p className="text-xs text-muted-foreground leading-relaxed">
                                {t(
                                  "discharge.marketingSubtitle",
                                  "Generate an anonymized educational social post compliant with veterinary ethics."
                                )}
                              </p>
                            </div>

                            <PageToolbar>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-foreground">{t("discharge.channel", "Kanál")}:</span>
                                {(["instagram", "facebook", "google_business"] as const).map((ch) => (
                                  <Button
                                    key={ch}
                                    type="button"
                                    variant={marketingChannel === ch ? "default" : "outline"}
                                    size="sm"
                                    className="h-7 text-xs capitalize"
                                    onClick={() => setMarketingChannel(ch)}
                                  >
                                    {ch === "google_business" ? t("discharge.channelGoogle", "Google Profil") : ch}
                                  </Button>
                                ))}
                              </div>

                              <Button
                                type="button"
                                onClick={handleCreateMarketingPost}
                                disabled={createMarketingPostMutation.isPending || !diagnosis.trim()}
                                size="sm"
                                className="gap-1.5 text-xs bg-primary text-primary-foreground ml-auto"
                              >
                                {createMarketingPostMutation.isPending ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Sparkles className="h-3.5 w-3.5" />
                                )}
                                {t("discharge.createMarketingButton", "Create Social Media Draft")}
                              </Button>
                            </PageToolbar>

                            {marketingPostData && (
                              <DataTableFrame>
                                <div className="p-4 space-y-3">
                                  <div className="flex items-center justify-between flex-wrap gap-2">
                                    <h4 className="text-xs font-bold text-foreground">
                                      {marketingPostData.item.title}
                                    </h4>
                                    <Badge
                                      variant={
                                        marketingPostData.validationReport?.verdict === "pass"
                                          ? "default"
                                          : "secondary"
                                      }
                                      className={
                                        marketingPostData.validationReport?.verdict === "pass"
                                          ? "bg-success text-success-foreground text-[10px]"
                                          : "bg-warning text-warning-foreground text-[10px]"
                                      }
                                    >
                                      KVL SR: {marketingPostData.validationReport?.verdict?.toUpperCase() ?? "PASS"}
                                    </Badge>
                                  </div>

                                  <div className="rounded-lg bg-muted/40 p-3 text-xs text-foreground whitespace-pre-wrap leading-relaxed border border-border/60 break-words">
                                    {marketingPostData.item.body}
                                  </div>

                                  <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
                                    <span className="text-[11px] text-muted-foreground">
                                      {t("discharge.marketingQueued", "Zaradené v marketingovom štúdiu ako koncept")}
                                    </span>
                                    <Button variant="outline" size="sm" asChild className="h-7 text-xs gap-1">
                                      <Link href="/marketing/plan">
                                        {t("discharge.openInPlan", "Otvoriť v pláne obsahu")}
                                        <ExternalLink className="h-3 w-3" />
                                      </Link>
                                    </Button>
                                  </div>
                                </div>
                              </DataTableFrame>
                            )}
                          </>
                        )}
                      </div>
                    )
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full min-h-[350px] text-center p-8 text-muted-foreground gap-3">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                        <FileText className="h-6 w-6" />
                      </div>
                      <p className="text-xs max-w-sm">
                        {t(
                          "discharge.emptyPrompt",
                          "Fill in clinical details on the left and click 'Generate Discharge Report' to create clear instructions for the pet owner."
                        )}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DischargePage() {
  const { t } = useI18n();
  return (
    <Suspense
      fallback={
        <div className="flex h-96 items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="text-xs text-muted-foreground">
              {t("discharge.page.loading", "Načítavam prepúšťaciu správu...")}
            </span>
          </div>
        </div>
      }
    >
      <DischargeContent />
    </Suspense>
  );
}
