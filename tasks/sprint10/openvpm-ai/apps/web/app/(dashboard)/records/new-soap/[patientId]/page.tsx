"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Copy,
  ArrowLeft,
  ClipboardList,
  Loader2,
  Save,
  ShieldAlert,
  Sparkles,
  WifiOff,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/common/empty-state";
import { CapturePhotos } from "@/components/records/capture-photos";
import { ClinicalGuardianConfirmDialog } from "@/components/clinical/clinical-guardian-confirm-dialog";
import type { EvaluatedSafetyAlert } from "@/lib/ai/clinical-guardian";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  hasSoapContent,
  normalizeSoapSection,
  soapSectionText,
} from "@/lib/records/soap-content";
import {
  SOAP_NOTE_TEMPLATES,
  applySoapTemplateToSections,
  getSoapTemplateById,
  hasUnresolvedSoapTemplatePrompts,
} from "@/lib/records/soap-templates";
import {
  guardedSoapNavigationDestination,
  runSoapSafeLeave,
  soapEditorNeedsLeaveGuard,
} from "@/lib/records/soap-navigation";
import { useOnlineStatus } from "@/lib/use-online-status";
import {
  buildVisitContext,
  type VisitContextItem,
} from "@/lib/records/visit-context";
import { useI18n } from "@/lib/i18n";
import { PageHeader } from "@/components/layout/page-header";

function SoapEditorLoading() {
  const { t } = useI18n();
  return (
    <div className="min-h-32 rounded-lg border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
      {t("records.soap.loadingEditor", "Načítavam editor...")}
    </div>
  );
}

const SoapNoteEditor = dynamic(
  () => import("@/components/SoapNoteEditor").then((mod) => mod.SoapNoteEditor),
  {
    ssr: false,
    loading: () => <SoapEditorLoading />,
  },
);

function canCreateSoapNoteRole(role?: string | null): boolean {
  return role === "admin" || role === "veterinarian";
}

/** Plain-text AI draft sections -> simple HTML the tiptap editor can load. */
function draftTextToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const paragraphs = escaped
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br>")}</p>`);
  return paragraphs.join("");
}

type SoapEditorSections = {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
};

type SoapDraftSaveState =
  | "idle"
  | "offline"
  | "unsaved"
  | "saving"
  | "saved"
  | "error"
  | "conflict";

function soapDraftFingerprint(sections: SoapEditorSections): string {
  return JSON.stringify({
    subjective: normalizeSoapSection(sections.subjective),
    objective: normalizeSoapSection(sections.objective),
    assessment: normalizeSoapSection(sections.assessment),
    plan: normalizeSoapSection(sections.plan),
  });
}

function localSoapTextForClipboard(sections: SoapEditorSections): string {
  return [
    ["Subjective", soapSectionText(sections.subjective)],
    ["Objective", soapSectionText(sections.objective)],
    ["Assessment", soapSectionText(sections.assessment)],
    ["Plan", soapSectionText(sections.plan)],
  ]
    .filter((entry) => Boolean(entry[1]))
    .map(([label, content]) => `${label}\n${content}`)
    .join("\n\n");
}

async function copyTextToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    // Clipboard API can be unavailable or denied in some managed browsers.
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("Clipboard access was denied");
}

export default function NewSoapNotePage() {
  const { t } = useI18n();
  const params = useParams<{ patientId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const userRole = session?.user?.role;
  const canCreateSoapNote = canCreateSoapNoteRole(userRole);
  const accessDenied = status !== "loading" && !canCreateSoapNote;
  const appointmentId = searchParams.get("appointmentId") ?? undefined;
  const returnPath = appointmentId
    ? `/encounters/${encodeURIComponent(appointmentId)}`
    : "/records";

  const [subjective, setSubjective] = useState("");
  const [objective, setObjective] = useState("");
  const [assessment, setAssessment] = useState("");
  const [plan, setPlan] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState(
    SOAP_NOTE_TEMPLATES[0]?.id ?? "",
  );
  const [replaceTemplateContent, setReplaceTemplateContent] = useState(false);
  const canSave = hasSoapContent({ subjective, objective, assessment, plan });
  const hasTemplatePrompts = hasUnresolvedSoapTemplatePrompts({
    subjective,
    objective,
    assessment,
    plan,
  });
  const canSubmit = canSave && !hasTemplatePrompts;
  const selectedTemplate = getSoapTemplateById(selectedTemplateId);

  const {
    data: patient,
    isLoading: patientLoading,
    error: patientError,
  } = trpc.patients.getById.useQuery(
    { id: params.patientId },
    { enabled: !!params.patientId && canCreateSoapNote && !!appointmentId },
  );

  const draftQuery = trpc.records.getSoapDraft.useQuery(
    { patientId: params.patientId, appointmentId: appointmentId! },
    {
      enabled:
        !!params.patientId && !!appointmentId && canCreateSoapNote && !!patient,
    },
  );
  const saveDraftMutation = trpc.records.saveSoapDraft.useMutation();
  const finalizeMutation = trpc.records.finalizeSoapNote.useMutation();
  const discardMutation = trpc.records.discardSoapDraft.useMutation();
  const checkMedicationsMutation = trpc.extensions.clinicalGuardian.checkMedications.useMutation();
  const recordAlertsMutation = trpc.extensions.clinicalGuardian.recordAlerts.useMutation();

  const [draftMode, setDraftMode] = useState<"flash" | "pro">("flash");
  const [detectedAlerts, setDetectedAlerts] = useState<EvaluatedSafetyAlert[]>([]);
  const [guardianConfirmOpen, setGuardianConfirmOpen] = useState(false);
  const [pendingFinalizeSaved, setPendingFinalizeSaved] = useState<{ id: string; revision: number } | null>(null);

  const [draftInitialized, setDraftInitialized] = useState(false);
  const draftInitializedRef = useRef(false);
  const [saveState, setSaveState] = useState<SoapDraftSaveState>("idle");
  const isOnline = useOnlineStatus();
  const onlineStatusRef = useRef(isOnline);
  onlineStatusRef.current = isOnline;
  const wasOnlineRef = useRef(isOnline);
  const [finalizedElsewhere, setFinalizedElsewhere] = useState(false);
  const [localTextCopied, setLocalTextCopied] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [conflictDraft, setConflictDraft] = useState<NonNullable<
    typeof draftQuery.data
  > | null>(null);
  const draftIdRef = useRef<string | null>(null);
  const revisionRef = useRef(0);
  const lastSavedFingerprintRef = useRef("");
  const savePromiseRef = useRef<Promise<unknown> | null>(null);
  const navigationAttemptRef = useRef<Promise<boolean> | null>(null);
  const saveDraftRef = useRef(saveDraftMutation.mutateAsync);
  saveDraftRef.current = saveDraftMutation.mutateAsync;
  const conflictRef = useRef(false);
  const finalizedElsewhereRef = useRef(false);
  const localTextCopiedRef = useRef(false);
  const sectionsRef = useRef<SoapEditorSections>({
    subjective,
    objective,
    assessment,
    plan,
  });
  sectionsRef.current = { subjective, objective, assessment, plan };

  const editorNeedsLeaveGuard = useCallback(
    () =>
      soapEditorNeedsLeaveGuard({
        draftInitialized: draftInitializedRef.current,
        finalizedElsewhere: finalizedElsewhereRef.current,
        localTextCopied: localTextCopiedRef.current,
        hasLocalText: Boolean(localSoapTextForClipboard(sectionsRef.current)),
        conflict: conflictRef.current,
        savePending: savePromiseRef.current !== null,
        dirty:
          soapDraftFingerprint(sectionsRef.current) !==
          lastSavedFingerprintRef.current,
      }),
    [],
  );

  useEffect(() => {
    if (!draftQuery.isSuccess || draftInitialized) return;
    const draft = draftQuery.data;
    const sections = {
      subjective: draft?.subjective ?? "",
      objective: draft?.objective ?? "",
      assessment: draft?.assessment ?? "",
      plan: draft?.plan ?? "",
    };
    setSubjective(sections.subjective);
    setObjective(sections.objective);
    setAssessment(sections.assessment);
    setPlan(sections.plan);
    sectionsRef.current = sections;
    draftIdRef.current = draft?.id ?? null;
    revisionRef.current = draft?.revision ?? 0;
    lastSavedFingerprintRef.current = soapDraftFingerprint(sections);
    setLastSavedAt(draft?.updatedAt ?? null);
    setSaveState(draft ? "saved" : "idle");
    draftInitializedRef.current = true;
    setDraftInitialized(true);
  }, [draftInitialized, draftQuery.data, draftQuery.isSuccess]);

  const persistDraft = useCallback(async () => {
    if (
      finalizedElsewhereRef.current ||
      !appointmentId ||
      !params.patientId ||
      !draftInitialized
    )
      return null;

    if (!onlineStatusRef.current) {
      setSaveState("offline");
      return null;
    }

    while (true) {
      if (finalizedElsewhereRef.current) return null;
      if (conflictRef.current) return null;
      if (!onlineStatusRef.current) {
        setSaveState("offline");
        return null;
      }
      if (savePromiseRef.current) {
        await savePromiseRef.current.catch(() => null);
        continue;
      }
      const sections = { ...sectionsRef.current };
      const fingerprint = soapDraftFingerprint(sections);
      if (fingerprint === lastSavedFingerprintRef.current) {
        return draftIdRef.current
          ? { id: draftIdRef.current, revision: revisionRef.current }
          : null;
      }
      setSaveState("saving");
      const request = saveDraftRef.current({
        patientId: params.patientId,
        appointmentId,
        noteId: draftIdRef.current ?? undefined,
        expectedRevision: revisionRef.current,
        ...sections,
      });
      savePromiseRef.current = request;
      try {
        const result = await request;
        if (result.outcome === "already_finalized") {
          finalizedElsewhereRef.current = true;
          localTextCopiedRef.current = false;
          setLocalTextCopied(false);
          setFinalizedElsewhere(true);
          return null;
        }
        if (result.outcome === "conflict") {
          conflictRef.current = true;
          setConflictDraft(result.draft);
          setSaveState("conflict");
          return null;
        }
        draftIdRef.current = result.draft.id;
        revisionRef.current = result.draft.revision;
        lastSavedFingerprintRef.current = fingerprint;
        setLastSavedAt(result.draft.updatedAt);
        setSaveState("saved");
      } catch (error) {
        if (!onlineStatusRef.current) {
          setSaveState("offline");
        } else {
          setSaveState("error");
          toast.error(
            error instanceof Error
              ? error.message
              : t("records.newSoap.draftSaveFailed", "SOAP draft could not be saved"),
          );
        }
        return null;
      } finally {
        if (savePromiseRef.current === request) savePromiseRef.current = null;
      }
    }
  }, [appointmentId, draftInitialized, params.patientId, t]);

  useEffect(() => {
    const wasOnline = wasOnlineRef.current;
    wasOnlineRef.current = isOnline;
    if (
      !draftInitialized ||
      finalizedElsewhereRef.current ||
      conflictRef.current
    ) {
      return;
    }
    if (!isOnline) {
      setSaveState("offline");
      return;
    }
    if (wasOnline) return;

    const fingerprint = soapDraftFingerprint(sectionsRef.current);
    if (fingerprint === lastSavedFingerprintRef.current) {
      setSaveState(draftIdRef.current ? "saved" : "idle");
      return;
    }

    // Retry only the in-memory SOAP draft through the existing revision guard.
    // No clinical content is written to browser persistence while offline.
    setSaveState("unsaved");
    void persistDraft();
  }, [draftInitialized, isOnline, persistDraft]);

  useEffect(() => {
    if (finalizedElsewhere || !draftInitialized || conflictRef.current) return;
    const fingerprint = soapDraftFingerprint(sectionsRef.current);
    if (fingerprint === lastSavedFingerprintRef.current) return;
    if (!isOnline) {
      setSaveState("offline");
      return;
    }
    if (savePromiseRef.current) return;
    setSaveState("unsaved");
    const timer = window.setTimeout(() => void persistDraft(), 1_200);
    return () => window.clearTimeout(timer);
  }, [
    assessment,
    draftInitialized,
    finalizedElsewhere,
    isOnline,
    objective,
    persistDraft,
    plan,
    subjective,
  ]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!editorNeedsLeaveGuard()) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [editorNeedsLeaveGuard]);

  // AI draft availability mirrors the OpenVPM Agent (same key + model config).
  const agentStatus = trpc.agent.status.useQuery(undefined, {
    enabled: canCreateSoapNote && !!appointmentId,
  });
  const aiConfigured = agentStatus.data?.configured ?? false;
  const canUseAi = agentStatus.data?.canUseAi ?? false;
  const needsAiBillingSetup = agentStatus.data?.needsBillingSetup ?? false;

  // GT-005: the draft request must carry the visit context (appointment
  // type, reason for the visit, today's measurements). Without it the model
  // drafts only from chart data and loses what happened in the clinic today.
  const appointmentQuery = trpc.appointments.getById.useQuery(
    { id: appointmentId! },
    { enabled: canCreateSoapNote && !!appointmentId },
  );

  // Measurements belong to the visit, so they stay readable even after the
  // appointment is closed out.
  const visitVitalsQuery = trpc.vitals.listByAppointment.useQuery(
    { appointmentId: appointmentId! },
    { enabled: canCreateSoapNote && !!appointmentId },
  );

  const visitContext = useMemo(
    () =>
      buildVisitContext({
        appointment: appointmentQuery.data ?? null,
        vitals: visitVitalsQuery.data ?? null,
      }),
    [appointmentQuery.data, visitVitalsQuery.data],
  );

  const visitContextChipLabel = useCallback(
    (item: VisitContextItem): string => {
      switch (item.id) {
        case "visitType":
          return t("records.newSoap.aiContextChipVisitType", "Visit: {value}", {
            value: item.value,
          });
        case "reason":
          return t("records.newSoap.aiContextChipReason", "Reason: {value}", {
            value: item.value,
          });
        case "doctor":
          return t("records.newSoap.aiContextChipDoctor", "Doctor: {value}", {
            value: item.value,
          });
        case "location":
          return t("records.newSoap.aiContextChipLocation", "Location: {value}", {
            value: item.value,
          });
        case "temperatureC":
          return t(
            "records.newSoap.aiContextChipTemperature",
            "Temperature: {value}",
            { value: item.value },
          );
        case "heartRateBpm":
          return t("records.newSoap.aiContextChipHeartRate", "Heart rate: {value}", {
            value: item.value,
          });
        case "respiratoryRateBpm":
          return t(
            "records.newSoap.aiContextChipRespiratoryRate",
            "Respiratory rate: {value}",
            { value: item.value },
          );
        case "weightKg":
          return t("records.newSoap.aiContextChipWeight", "Weight: {value}", {
            value: item.value,
          });
        default:
          return item.value;
      }
    },
    [t],
  );

  const draftWithAi = trpc.ai.draftSoapNote.useMutation({
    onSuccess: (draft) => {
      if (finalizedElsewhereRef.current) return;
      setSubjective(draftTextToHtml(draft.subjective));
      setObjective(draftTextToHtml(draft.objective));
      setAssessment(draftTextToHtml(draft.assessment));
      setPlan(draftTextToHtml(draft.plan));
      toast.success(t("records.newSoap.draftReadyReview", "Draft ready. Please review and edit before you save."));
    },
    onError: (err) => toast.error(err.message),
  });

  function handleDraftWithAi() {
    if (
      finalizedElsewhereRef.current ||
      !params.patientId ||
      draftWithAi.isPending
    )
      return;
    if (
      canSave &&
      !window.confirm(t("records.newSoap.confirmReplaceWithAi", "Replace what you typed with the AI draft?"))
    ) {
      return;
    }
    draftWithAi.mutate({
      patientId: params.patientId,
      visitContext: visitContext.text ?? undefined,
      mode: draftMode,
      deepThinking: draftMode === "pro",
    });
  }

  async function executeFinalize(savedRecord: { id: string; revision: number }) {
    try {
      const result = await finalizeMutation.mutateAsync({
        patientId: params.patientId,
        appointmentId: appointmentId!,
        noteId: savedRecord.id,
        expectedRevision: savedRecord.revision,
      });
      if (result.outcome === "conflict") {
        if (result.note.status === "finalized") {
          finalizedElsewhereRef.current = true;
          localTextCopiedRef.current = false;
          setLocalTextCopied(false);
          setFinalizedElsewhere(true);
          return;
        }
        conflictRef.current = true;
        setConflictDraft(result.note);
        setSaveState("conflict");
        return;
      }
      toast.success(t("records.newSoap.finalizedSuccess", "SOAP note finalized"));
      router.push(returnPath);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("records.newSoap.finalizeFailed", "SOAP note could not be finalized"),
      );
    }
  }

  const handleGuardianEditPrescription = () => {
    setGuardianConfirmOpen(false);
    toast.info(t("clinicalGuardian.dialog.editPrescriptionToast", "Upravte predpis v pláne vyšetrenia."));
  };

  const handleGuardianProceedAnyway = async () => {
    if (!pendingFinalizeSaved) return;
    setGuardianConfirmOpen(false);
    try {
      await recordAlertsMutation.mutateAsync({
        patientId: params.patientId,
        encounterId: appointmentId,
        alerts: detectedAlerts.map((a) => ({
          category: a.category,
          severity: a.severity,
          title: a.title,
          message: a.message,
          suggestedAction: a.suggestedAction,
          acknowledged: true,
        })),
      });
    } catch {
      // non-blocking
    }
    await executeFinalize(pendingFinalizeSaved);
  };

  async function handleFinalize() {
    if (finalizedElsewhereRef.current) return;
    if (!appointmentId) {
      toast.error(t("records.newSoap.openActiveVisitFirst", "Open an active visit before finalizing a SOAP note"));
      return;
    }
    if (!params.patientId || !patient) {
      toast.error(t("records.newSoap.loadPatientFirst", "Load the patient before finalizing a SOAP note"));
      return;
    }
    if (!canSave) {
      toast.error(t("records.newSoap.addSectionFirst", "Add at least one SOAP section before finalizing"));
      return;
    }
    if (hasTemplatePrompts) {
      toast.error(t("records.newSoap.replacePromptsFirst", "Replace or delete every draft prompt before finalizing"));
      return;
    }
    const saved = await persistDraft();
    if (!saved) return;

    // Check medication safety with Clinical Guardian before finalizing
    const planText = soapSectionText(sectionsRef.current.plan);
    const candidateMeds = planText
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 2)
      .map((name) => ({ name }));

    if (candidateMeds.length > 0) {
      try {
        const alerts = await checkMedicationsMutation.mutateAsync({
          patientId: params.patientId,
          encounterId: appointmentId,
          medications: candidateMeds,
        });
        if (alerts && alerts.length > 0 && alerts.some((a) => a.severity === "critical")) {
          setDetectedAlerts(alerts);
          setPendingFinalizeSaved(saved);
          setGuardianConfirmOpen(true);
          return;
        }
      } catch {
        // fail-safe
      }
    }

    if (
      !window.confirm(
        t(
          "records.newSoap.confirmFinalize",
          "Finalize this SOAP note? The signed note cannot be edited; later clarification must be an attributed addendum.",
        ),
      )
    ) {
      return;
    }

    await executeFinalize(saved);
  }

  function useServerDraft() {
    if (finalizedElsewhereRef.current || !conflictDraft) return;
    const sections = {
      subjective: conflictDraft.subjective ?? "",
      objective: conflictDraft.objective ?? "",
      assessment: conflictDraft.assessment ?? "",
      plan: conflictDraft.plan ?? "",
    };
    setSubjective(sections.subjective);
    setObjective(sections.objective);
    setAssessment(sections.assessment);
    setPlan(sections.plan);
    sectionsRef.current = sections;
    draftIdRef.current = conflictDraft.id;
    revisionRef.current = conflictDraft.revision;
    lastSavedFingerprintRef.current = soapDraftFingerprint(sections);
    setLastSavedAt(conflictDraft.updatedAt);
    conflictRef.current = false;
    setConflictDraft(null);
    setSaveState("saved");
  }

  async function overwriteServerDraft() {
    if (finalizedElsewhereRef.current || !conflictDraft) return;
    if (
      !window.confirm(
        t("records.newSoap.confirmOverwriteServer", "Replace the newer server draft with the version in this editor?"),
      )
    )
      return;
    draftIdRef.current = conflictDraft.id;
    revisionRef.current = conflictDraft.revision;
    lastSavedFingerprintRef.current = soapDraftFingerprint({
      subjective: conflictDraft.subjective ?? "",
      objective: conflictDraft.objective ?? "",
      assessment: conflictDraft.assessment ?? "",
      plan: conflictDraft.plan ?? "",
    });
    conflictRef.current = false;
    setConflictDraft(null);
    setSaveState("unsaved");
    await persistDraft();
  }

  async function handleDiscardDraft() {
    if (finalizedElsewhereRef.current || !appointmentId || !draftIdRef.current)
      return;
    if (
      !window.confirm(
        t("records.newSoap.confirmDiscard", "Discard this unfinished SOAP draft? This cannot be undone."),
      )
    )
      return;
    try {
      const result = await discardMutation.mutateAsync({
        patientId: params.patientId,
        appointmentId,
        noteId: draftIdRef.current,
        expectedRevision: revisionRef.current,
      });
      if (result.outcome === "already_finalized") {
        finalizedElsewhereRef.current = true;
        localTextCopiedRef.current = false;
        setLocalTextCopied(false);
        setFinalizedElsewhere(true);
        return;
      }
      if (result.outcome === "conflict") {
        conflictRef.current = true;
        setConflictDraft(result.draft);
        setSaveState("conflict");
        return;
      }
      toast.success(t("records.newSoap.draftDiscarded", "SOAP draft discarded"));
      router.push(returnPath);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("records.newSoap.discardFailed", "SOAP draft could not be discarded"),
      );
    }
  }

  function handleApplyTemplate() {
    if (finalizedElsewhereRef.current || !selectedTemplate) return;
    const next = applySoapTemplateToSections(
      { subjective, objective, assessment, plan },
      selectedTemplate,
      { replaceExisting: replaceTemplateContent },
    );
    setSubjective(next.subjective);
    setObjective(next.objective);
    setAssessment(next.assessment);
    setPlan(next.plan);
    toast.info(
      replaceTemplateContent || !canSave
        ? t(
            "records.newSoap.templateApplied",
            `${selectedTemplate.name} draft prompts applied`,
            { name: selectedTemplate.name },
          )
        : t(
            "records.newSoap.templateFilled",
            `${selectedTemplate.name} draft prompts filled blank sections`,
            { name: selectedTemplate.name },
          ),
    );
  }

  const leaveEditorSafely = useCallback(
    (destination: string): Promise<boolean> => {
      if (navigationAttemptRef.current) {
        return navigationAttemptRef.current;
      }

      const attempt = runSoapSafeLeave({
        readState: () => ({
          finalizedElsewhere: finalizedElsewhereRef.current,
          needsGuard: editorNeedsLeaveGuard(),
          localTextCopied: localTextCopiedRef.current,
          hasLocalText: Boolean(localSoapTextForClipboard(sectionsRef.current)),
        }),
        persistDraft,
        confirmFinalizedLocalTextLeave: () =>
          window.confirm(
            t(
              "records.newSoap.confirmLeaveUncopied",
              "Your local SOAP text was not included in the finalized note and has not been copied. Leave anyway?",
            ),
          ),
        confirmUnsavedLeave: () =>
          window.confirm(
            t(
              "records.newSoap.confirmLeaveUnsaved",
              "The latest draft changes could not be saved. Leave the editor anyway?",
            ),
          ),
        navigate: () => router.push(destination),
      });

      navigationAttemptRef.current = attempt;
      void attempt.finally(() => {
        if (navigationAttemptRef.current === attempt) {
          navigationAttemptRef.current = null;
        }
      });
      return attempt;
    },
    [editorNeedsLeaveGuard, persistDraft, router, t],
  );

  const copyLocalSoapText = useCallback(async () => {
    const text = localSoapTextForClipboard(sectionsRef.current);
    if (!text) {
      toast.error(t("records.newSoap.noTextToCopy", "There is no local SOAP text to copy"));
      return;
    }
    try {
      await copyTextToClipboard(text);
      localTextCopiedRef.current = true;
      setLocalTextCopied(true);
      toast.success(t("records.newSoap.textCopied", "Local SOAP text copied"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("records.newSoap.copyFailed", "Local SOAP text could not be copied"),
      );
    }
  }, [t]);

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      if (!editorNeedsLeaveGuard() && navigationAttemptRef.current === null) {
        return;
      }
      if (!(event.target instanceof Element)) return;
      const anchor = event.target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor) return;

      const destination = guardedSoapNavigationDestination({
        href: anchor.href,
        currentHref: window.location.href,
        button: event.button,
        defaultPrevented: event.defaultPrevented,
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        target: anchor.getAttribute("target"),
        download: anchor.hasAttribute("download"),
      });
      if (!destination) return;

      event.preventDefault();
      event.stopPropagation();
      void leaveEditorSafely(destination);
    };

    document.addEventListener("click", handleDocumentClick, true);
    return () =>
      document.removeEventListener("click", handleDocumentClick, true);
  }, [editorNeedsLeaveGuard, leaveEditorSafely]);

  if (accessDenied) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <ShieldAlert className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="font-heading text-xl font-semibold">{t("records.newSoap.accessDeniedTitle", "Access Denied")}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t("records.newSoap.accessDeniedDesc", "Only veterinarians and administrators can create SOAP notes.")}
        </p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push(returnPath)}
        >
          {appointmentId ? t("records.newSoap.backToVisit", "Back to visit") : t("records.newSoap.backToRecords", "Back to Records")}
        </Button>
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card p-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t("records.newSoap.checkingAccess", "Checking SOAP note access...")}
      </div>
    );
  }

  if (!appointmentId) {
    return (
      <>
        {/* title="Open an active visit first" */}
        <EmptyState
          icon={ClipboardList}
          title={t("records.newSoap.emptyVisitTitle", "Open an active visit first")}
          description={t("records.newSoap.emptyVisitDesc", "SOAP notes must be attached to a visit that is currently in exam. Open the appointment from the schedule, start the exam, and write the note from the encounter workspace.")}
          action={{
            label: t("records.newSoap.backToRecords", "Back to Records"),
            onClick: () => router.push("/records"),
            icon: ArrowLeft,
          }}
        />
      </>
    );
  }

  if (patientLoading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card p-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t("records.newSoap.loadingPatient", "Loading patient...")}
      </div>
    );
  }

  if (patientError || !patient) {
    return (
      <>
        {/* title="Unable to load patient" */}
        <EmptyState
          icon={AlertCircle}
          title={t("records.newSoap.unableToLoadPatient", "Unable to load patient")}
          description={
            patientError?.message ??
            t("records.newSoap.choosePatientDesc", "Choose a patient from Records before creating a SOAP note.")
          }
          action={{
            // label: "Back to Records"
            label: t("records.newSoap.backToRecords", "Back to Records"),
            onClick: () => router.push("/records"),
            icon: ArrowLeft,
          }}
        />
      </>
    );
  }

  if (!draftQuery.error && (draftQuery.isLoading || !draftInitialized)) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card p-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t("records.newSoap.loadingDraft", "Loading saved SOAP draft...")}
      </div>
    );
  }

  if (draftQuery.error) {
    return (
      <EmptyState
        icon={AlertCircle}
        title={t("records.newSoap.unableToLoadDraft", "Unable to load the saved draft")}
        description={`${draftQuery.error.message} ${t("records.newSoap.editingPausedDesc", "Editing is paused to prevent a duplicate clinical record.")}`}
        action={{
          label: t("records.newSoap.backToVisit", "Back to visit"),
          onClick: () => router.push(returnPath),
          icon: ArrowLeft,
        }}
      />
    );
  }

  if (finalizedElsewhere) {
    const localSections = [
      [t("records.soap.subjective", "Subjective"), soapSectionText(subjective)],
      [t("records.soap.objective", "Objective"), soapSectionText(objective)],
      [t("records.soap.assessment", "Assessment"), soapSectionText(assessment)],
      [t("records.soap.plan", "Plan"), soapSectionText(plan)],
    ].filter((entry) => Boolean(entry[1]));
    return (
      <div className="space-y-5">
        <div
          role="alert"
          className="rounded-lg border-2 border-destructive bg-destructive/10 p-5"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-6 w-6 shrink-0 text-destructive" />
            <div>
              <h2 className="font-heading text-xl font-semibold text-destructive">
                {t("records.newSoap.finalizedElsewhereTitle", "SOAP note finalized in another session")}
              </h2>
              <p className="mt-2 font-medium">
                {t("records.newSoap.finalizedElsewhereSubtitle", "Important: the local SOAP text below was NOT included in the finalized note.")}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("records.newSoap.finalizedElsewhereDesc", "Copy it before leaving, compare it with the signed chart, and add any clinically relevant clarification as an attributed addendum. Editing, autosave, AI drafting, templates, finalization, and discard are now disabled.")}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="font-semibold">{t("records.newSoap.preservedLocalText", "Preserved local SOAP text")}</h3>
          <div className="mt-4 space-y-4">
            {localSections.length > 0 ? (
              localSections.map(([label, content]) => (
                <div key={label}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {label}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{content}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("records.newSoap.noLocalText", "No local SOAP text was present.")}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => void copyLocalSoapText()}
            disabled={localSections.length === 0}
          >
            {localTextCopied ? (
              <CheckCircle2 className="mr-2 h-4 w-4" />
            ) : (
              <Copy className="mr-2 h-4 w-4" />
            )}
            {localTextCopied
              ? t("records.newSoap.localCopied", "Local SOAP text copied")
              : t("records.newSoap.copyLocal", "Copy local SOAP text")}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void leaveEditorSafely(returnPath)}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("records.newSoap.backToVisit", "Back to visit")}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              void leaveEditorSafely(
                `/patients/${encodeURIComponent(params.patientId)}`,
              )
            }
          >
            {t("records.newSoap.viewSignedChart", "View signed patient chart")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => void leaveEditorSafely(returnPath)}
        className="mb-4"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        {t("records.newSoap.backToVisit", "Back to visit")}
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            {t("records.newSoap.title", "SOAP Documentation")}
          </h1>
          {patient && (
            <p className="text-sm text-muted-foreground">
              {t("records.newSoap.patient", "Patient: {name}", { name: patient.name })}
              {patient.species
                ? ` - ${patient.species.charAt(0).toUpperCase() + patient.species.slice(1)}`
                : ""}
              {patient.breed ? ` (${patient.breed})` : ""}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            {t("records.newSoap.draftNotice", "Draft changes save automatically. Finalization creates the signed clinical record.")}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <CapturePhotos patientId={params.patientId} />
            <div className="flex items-center rounded-md border border-border bg-muted/40 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setDraftMode("flash")}
                className={cn(
                  "px-2 py-1 rounded text-xs font-medium transition-colors",
                  draftMode === "flash"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                ⚡ {t("records.newSoap.modeFlash", "Flash")}
              </button>
              <button
                type="button"
                onClick={() => setDraftMode("pro")}
                className={cn(
                  "px-2 py-1 rounded text-xs font-medium transition-colors",
                  draftMode === "pro"
                    ? "bg-background text-violet-600 dark:text-violet-400 font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                🧠 {t("records.newSoap.modePro", "Konzílium (Pro)")}
              </button>
            </div>
            <Button
              variant={draftMode === "pro" ? "default" : "outline"}
              size="sm"
              onClick={handleDraftWithAi}
              disabled={
                !isOnline || !aiConfigured || !canUseAi || draftWithAi.isPending
              }
              className={draftMode === "pro" ? "bg-violet-600 hover:bg-violet-700 text-white" : ""}
            >
              {draftWithAi.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              {draftWithAi.isPending
                ? t("records.newSoap.draftingAi", "Drafting...")
                : draftMode === "pro"
                  ? t("records.newSoap.draftConsilium", "Konziliárny rozbor (Pro)")
                  : t("records.newSoap.draftWithAi", "Draft with AI")}
            </Button>
          </div>
          {needsAiBillingSetup && !agentStatus.isLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{t("records.newSoap.aiTrialNeedCard", "Add a card to your trial to try AI.")}</span>
              {userRole === "admin" ? (
                <button
                  type="button"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                  onClick={() => router.push("/settings?tab=billing")}
                >
                  {t("records.newSoap.addCard", "Add a card")}
                </button>
              ) : (
                <span>{t("records.newSoap.askAdmin", "Ask a practice administrator.")}</span>
              )}
            </div>
          ) : !canUseAi && !agentStatus.isLoading ? (
            <p className="text-xs text-muted-foreground">
              {agentStatus.data?.accessMessage ??
                t("records.newSoap.aiNotAvailableWorkspace", "AI is not available for this workspace.")}
            </p>
          ) : !aiConfigured && !agentStatus.isLoading ? (
            <p className="text-xs text-muted-foreground">
              {t("records.newSoap.aiNotAvailableNow", "AI is not available right now. Please try again later.")}
            </p>
          ) : null}
        </div>
      </div>

      {/* GT-005: show exactly which visit data the AI draft receives. */}
      <div
        className="mt-4 rounded-lg border border-border bg-muted/20 px-3.5 py-2.5"
        role="status"
        aria-live="polite"
      >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <span className="inline-flex items-center gap-1.5 font-semibold uppercase tracking-wide text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            {t("records.newSoap.aiContextTitle", "AI context")}
          </span>
          {visitContext.hasContext ? (
            <span className="text-muted-foreground">
              {t(
                "records.newSoap.aiContextSent",
                "Sent to the model when drafting:",
              )}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5" />
              {t(
                "records.newSoap.aiContextEmpty",
                "No visit context – the AI will draft a generic structure",
              )}
            </span>
          )}
        </div>
        {visitContext.hasContext ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {visitContext.items.map((item) => (
              <span
                key={item.id}
                className="inline-flex max-w-full items-center truncate rounded-md border border-border bg-background px-2 py-0.5 text-xs font-medium"
                title={visitContextChipLabel(item)}
              >
                {visitContextChipLabel(item)}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mt-6 space-y-6">
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3"
          aria-live="polite"
        >
          <div className="flex items-center gap-2 text-sm">
            {saveState === "offline" ? (
              <WifiOff className="h-4 w-4 text-amber-600" />
            ) : saveState === "saving" ? (
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            ) : saveState === "saved" ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            ) : saveState === "error" || saveState === "conflict" ? (
              <AlertCircle className="h-4 w-4 text-destructive" />
            ) : (
              <Save className="h-4 w-4 text-muted-foreground" />
            )}
            <span>
              {saveState === "saving"
                ? t("records.newSoap.savingDraft", "Saving draft...")
                : saveState === "offline"
                  ? t("records.newSoap.offlinePaused", "Offline — autosave is paused")
                  : saveState === "saved"
                    ? (lastSavedAt
                        ? t("records.newSoap.draftSavedAt", "Draft saved at {time}", { time: lastSavedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) })
                        : t("records.newSoap.draftSaved", "Draft saved"))
                    : saveState === "error"
                      ? t("records.newSoap.draftSaveError", "Draft could not be saved")
                      : saveState === "conflict"
                        ? t("records.newSoap.draftConflict", "A newer draft exists in another session")
                        : saveState === "unsaved"
                          ? t("records.newSoap.changesNotSaved", "Changes not saved yet")
                          : t("records.newSoap.draftWillSave", "Draft will save after you begin typing")}
            </span>
          </div>
          <div className="flex gap-2">
            {isOnline && (saveState === "error" || saveState === "unsaved") ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void persistDraft()}
              >
                {t("records.newSoap.retrySave", "Retry save")}
              </Button>
            ) : null}
            {draftIdRef.current ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                disabled={
                  !isOnline ||
                  discardMutation.isPending ||
                  saveState === "saving"
                }
                onClick={() => void handleDiscardDraft()}
              >
                {discardMutation.isPending
                  ? t("records.newSoap.discarding", "Discarding...")
                  : t("records.newSoap.discardDraft", "Discard draft")}
              </Button>
            ) : null}
          </div>
        </div>

        {saveState === "offline" ? (
          <div
            role="status"
            className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100"
          >
            {t("records.newSoap.offlineBanner", "Keep this tab open. New SOAP changes remain only in this tab, and OpenVPM will retry the same revision-checked draft automatically when the connection returns.")}
          </div>
        ) : null}

        {conflictDraft ? (
          <div
            role="alert"
            className="rounded-lg border border-destructive/40 bg-destructive/5 p-4"
          >
            <h3 className="font-medium">
              {t("records.newSoap.draftChangedElsewhereTitle", "This draft changed in another session")}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("records.newSoap.draftChangedElsewhereDesc", "The saved draft was updated in another session at {time}. Your editor content has been kept unchanged.", { time: conflictDraft.updatedAt.toLocaleString() })}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={useServerDraft}>
                {t("records.newSoap.useServerVersion", "Use server version")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void overwriteServerDraft()}
              >
                {t("records.newSoap.overwriteWithMyVersion", "Overwrite with my version")}
              </Button>
            </div>
          </div>
        ) : null}
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <div className="w-full lg:max-w-sm">
              <label className="mb-1 block text-sm font-medium">
                {t("records.newSoap.templateLabel", "SOAP Template")}
              </label>
              <select
                value={selectedTemplateId}
                onChange={(event) => setSelectedTemplateId(event.target.value)}
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              >
                {SOAP_NOTE_TEMPLATES.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </div>
            {canSave && (
              <label className="flex min-h-10 items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm">
                <Checkbox
                  checked={replaceTemplateContent}
                  onChange={(event) =>
                    setReplaceTemplateContent(event.target.checked)
                  }
                />
                {t("records.newSoap.replaceExistingContent", "Replace existing content")}
              </label>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={handleApplyTemplate}
              disabled={!selectedTemplate}
            >
              <ClipboardList className="mr-2 h-4 w-4" />
              {t("records.newSoap.applyTemplate", "Apply template")}
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {t("records.newSoap.templateNote", "Templates add drafting prompts, not assumed findings. Replace or delete every prompt before finalizing the clinical record.")}
          </p>
        </div>

        {hasTemplatePrompts ? (
          <div
            role="alert"
            className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100"
          >
            {t("records.newSoap.templatePromptsWarning", "This draft still contains template prompts. Replace each prompt with findings verified during this visit, or delete it if it does not apply.")}
          </div>
        ) : null}

        <div className="rounded-lg border border-border bg-card p-6 space-y-6">
          {/* Subjective */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              {t("records.soap.subjective", "Subjective")}
            </label>
            <p className="text-xs text-muted-foreground mb-2">
              {t("records.soap.subjectiveDesc", "Owner's complaint, history, and symptoms reported")}
            </p>
            <SoapNoteEditor
              value={subjective}
              onChange={setSubjective}
              placeholder={t("records.soap.subjectivePlaceholder", "What the owner reports...")}
            />
          </div>

          {/* Objective */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              {t("records.soap.objective", "Objective")}
            </label>
            <p className="text-xs text-muted-foreground mb-2">
              {t("records.soap.objectiveDesc", "Physical examination findings, vitals, and test results")}
            </p>
            <SoapNoteEditor
              value={objective}
              onChange={setObjective}
              placeholder={t("records.soap.objectivePlaceholder", "Physical exam findings, vitals, lab results...")}
            />
          </div>

          {/* Assessment */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              {t("records.soap.assessment", "Assessment")}
            </label>
            <p className="text-xs text-muted-foreground mb-2">
              {t("records.soap.assessmentDesc", "Diagnosis or differential diagnoses")}
            </p>
            <SoapNoteEditor
              value={assessment}
              onChange={setAssessment}
              placeholder={t("records.soap.assessmentPlaceholder", "Diagnosis, differential diagnoses...")}
            />
          </div>

          {/* Plan */}
          <div>
            <label className="block text-sm font-medium mb-1.5">{t("records.soap.plan", "Plan")}</label>
            <p className="text-xs text-muted-foreground mb-2">
              {t("records.soap.planDesc", "Treatment plan, medications, follow-up instructions")}
            </p>
            <SoapNoteEditor
              value={plan}
              onChange={setPlan}
              placeholder={t("records.soap.planPlaceholder", "Treatment plan, medications, follow-up...")}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button
            onClick={() => void handleFinalize()}
            disabled={
              finalizeMutation.isPending ||
              !isOnline ||
              saveState === "saving" ||
              saveState === "error" ||
              saveState === "conflict" ||
              !canSubmit
            }
          >
            <Save className="mr-2 h-4 w-4" />
            {finalizeMutation.isPending
              ? t("records.newSoap.finalizing", "Finalizing...")
              : t("records.newSoap.finalizeSoapNote", "Finalize SOAP note")}
          </Button>
          {!canSave ? (
            <p className="text-sm text-muted-foreground">
              {t("records.newSoap.addAtLeastOneSection", "Add at least one section before finalizing.")}
            </p>
          ) : hasTemplatePrompts ? (
            <p className="text-sm text-amber-700 dark:text-amber-300">
              {t("records.newSoap.replaceOrDeletePrompts", "Replace or delete every draft prompt before finalizing.")}
            </p>
          ) : null}
          <Button
            variant="outline"
            onClick={() => void leaveEditorSafely(returnPath)}
          >
            {t("common.cancel", "Cancel")}
          </Button>
        </div>
      </div>

      <ClinicalGuardianConfirmDialog
        open={guardianConfirmOpen}
        onOpenChange={setGuardianConfirmOpen}
        alerts={detectedAlerts}
        onEditPrescription={handleGuardianEditPrescription}
        onProceedAnyway={handleGuardianProceedAnyway}
        isProcessing={finalizeMutation.isPending || recordAlertsMutation.isPending}
      />
    </div>
  );
}
