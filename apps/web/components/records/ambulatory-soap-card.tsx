"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  SOAP_SECTION_MAX_LENGTH,
  soapSectionText,
} from "@/lib/records/soap-content";
import { useOnlineStatus } from "@/lib/use-online-status";
import { useUnsavedChangesGuard } from "@/lib/use-unsaved-changes-guard";
import { ClinicalStatusBadge } from "@/components/clinical/clinical-status-badge";
import { AiSoapFinalizeDialog } from "@/components/records/ai-soap-finalize-dialog";
import { useI18n } from "@/lib/i18n";
import type { SoapSectionProvenance } from "@/lib/records/soap-ai-provenance";

function trpcErrorCode(error: unknown): string | undefined {
  return error && typeof error === "object" && "data" in error
    ? (error as { data?: { code?: string } }).data?.code
    : undefined;
}

type SoapSections = {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
};

const EMPTY_SECTIONS: SoapSections = {
  subjective: "",
  objective: "",
  assessment: "",
  plan: "",
};


export function AmbulatorySoapCard({
  patientId,
  appointmentId,
  canWrite,
  visitOpen,
  linkedSoapCount,
  onPlanChange,
}: {
  patientId: string;
  appointmentId: string;
  canWrite: boolean;
  visitOpen: boolean;
  linkedSoapCount: number;
  onPlanChange?: (plan: string) => void;
}) {
  const utils = trpc.useUtils();
  const isOnline = useOnlineStatus();
  const [sections, setSections] = useState<SoapSections>({ ...EMPTY_SECTIONS });
  const [dirty, setDirty] = useState(false);
  const initializedDraftRef = useRef<string | null>(null);
  const draftQuery = trpc.records.getSoapDraft.useQuery(
    { patientId, appointmentId },
    { enabled: canWrite && linkedSoapCount === 0 },
  );
  const finalizedNotesQuery = trpc.records.listSoapNotes.useQuery(
    { patientId },
    { enabled: linkedSoapCount > 0 },
  );
  const draft = draftQuery.data;
  const finalizedVisitNote = finalizedNotesQuery.data?.find(
    (note) =>
      note.appointmentId === appointmentId &&
      note.status === "finalized" &&
      !note.correctionAction,
  );
  const finalizedVisitPlan = finalizedVisitNote
    ? soapSectionText(finalizedVisitNote.plan)
    : null;

  useEffect(() => {
    const draftKey = draft ? `${draft.id}:${draft.revision}` : "empty";
    if (dirty || initializedDraftRef.current === draftKey) return;
    setSections(
      draft
        ? {
            subjective: soapSectionText(draft.subjective),
            objective: soapSectionText(draft.objective),
            assessment: soapSectionText(draft.assessment),
            plan: soapSectionText(draft.plan),
          }
        : { ...EMPTY_SECTIONS },
    );
    initializedDraftRef.current = draftKey;
  }, [dirty, draft]);

  useEffect(() => {
    if (linkedSoapCount > 0) {
      if (finalizedVisitPlan !== null) {
        onPlanChange?.(finalizedVisitPlan);
      }
      return;
    }
    onPlanChange?.(sections.plan);
  }, [finalizedVisitPlan, linkedSoapCount, onPlanChange, sections.plan]);

  const { t } = useI18n();

  const sectionFields: ReadonlyArray<{
    name: keyof SoapSections;
    label: string;
    placeholder: string;
  }> = [
    {
      name: "subjective",
      label: t("soap.subjective", "Subjective"),
      placeholder: t(
        "soap.placeholder.subjective",
        "History, presenting concern, owner observations"
      ),
    },
    {
      name: "objective",
      label: t("soap.objective", "Objective"),
      placeholder: t(
        "soap.placeholder.objective",
        "Exam findings and field observations"
      ),
    },
    {
      name: "assessment",
      label: t("soap.assessment", "Assessment"),
      placeholder: t(
        "soap.placeholder.assessment",
        "Problems, differentials, diagnosis"
      ),
    },
    {
      name: "plan",
      label: t("soap.plan", "Plan"),
      placeholder: t(
        "soap.placeholder.plan",
        "Treatment, prescriptions, monitoring, follow-up"
      ),
    },
  ];

  useUnsavedChangesGuard(
    dirty,
    t(
      "soap.unsavedGuard",
      "SOAP changes have not been saved on the server. Leave and lose these values?"
    ),
  );

  const saveDraft = trpc.records.saveSoapDraft.useMutation({
    onSuccess: async (saved) => {
      if (saved.outcome === "saved") {
        initializedDraftRef.current = `${saved.draft.id}:${saved.draft.revision}`;
        utils.records.getSoapDraft.setData(
          { patientId, appointmentId },
          // This card never links AI receipts, so a save preserves the flag.
          { ...saved.draft, aiAssisted: draft?.aiAssisted ?? false },
        );
        setDirty(false);
        toast.success(t("soap.toasts.saved", "SOAP draft saved"));
      } else if (saved.outcome === "conflict") {
        toast.error(
          t(
            "soap.toasts.conflict",
            "SOAP changed in another session. Refresh before saving again."
          ),
        );
      } else {
        setDirty(false);
        toast.info(
          t(
            "soap.toasts.alreadyFinalized",
            "SOAP was already finalized in another session."
          ),
        );
      }
      await Promise.all([
        utils.records.getSoapDraft.invalidate({ patientId, appointmentId }),
        utils.encounters.getCloseout.invalidate({ appointmentId }),
      ]);
    },
    onError: (error) => toast.error(error.message),
  });
  const finalize = trpc.records.finalizeSoapNote.useMutation({
    onSuccess: async () => {
      setDirty(false);
      await Promise.all([
        utils.records.getSoapDraft.invalidate({ patientId, appointmentId }),
        utils.records.listSoapNotes.invalidate({ patientId }),
        utils.encounters.getCloseout.invalidate({ appointmentId }),
      ]);
      toast.success(t("soap.toasts.finalized", "SOAP note finalized"));
    },
    onError: (error) => toast.error(error.message),
  });
  const prepareFinalization = trpc.records.prepareSoapFinalization.useMutation({
    onError: (error) => toast.error(error.message),
  });
  const [aiConfirm, setAiConfirm] = useState<{
    savedRecord: { id: string; revision: number };
    confirmationId: string;
    sections: SoapSectionProvenance;
  } | null>(null);
  const [aiConfirmOpen, setAiConfirmOpen] = useState(false);

  const hasContent = Object.values(sections).some(
    (value) => value.trim().length > 0,
  );
  const stateReady = !draftQuery.isLoading && !draftQuery.error;
  const canSave =
    canWrite &&
    visitOpen &&
    isOnline &&
    stateReady &&
    dirty &&
    hasContent &&
    !saveDraft.isPending &&
    !finalize.isPending;

  async function persistDraft() {
    if (!canSave) return draft ?? null;
    try {
      const result = await saveDraft.mutateAsync({
        patientId,
        appointmentId,
        noteId: draft?.id,
        expectedRevision: draft?.revision ?? 0,
        ...sections,
      });
      return result.outcome === "saved" ? result.draft : null;
    } catch {
      return null;
    }
  }

  async function finalizeNote() {
    if (
      !isOnline ||
      !visitOpen ||
      !hasContent ||
      finalize.isPending ||
      prepareFinalization.isPending
    )
      return;
    try {
      const saved = dirty ? await persistDraft() : draft;
      if (!saved) return;
      // Sprint 33: the vet confirms AI-assisted content explicitly. Re-read
      // the flag — a receipt may have been linked since the draft was loaded.
      // On a stale flag the server gate fails closed with a clear message.
      let aiAssisted = saved.id === draft?.id && draft.aiAssisted === true;
      try {
        const fresh = await utils.records.getSoapDraft.fetch({
          patientId,
          appointmentId,
        });
        if (fresh && fresh.id === saved.id) {
          aiAssisted = fresh.aiAssisted === true;
        }
      } catch {
        // Keep the cached flag; the server gate is the source of truth.
      }
      if (!aiAssisted) {
        await finalize.mutateAsync({
          patientId,
          appointmentId,
          noteId: saved.id,
          expectedRevision: saved.revision,
        });
        return;
      }
      const prepared = await prepareFinalization.mutateAsync({
        patientId,
        appointmentId,
        noteId: saved.id,
        expectedRevision: saved.revision,
      });
      if (!prepared.required) {
        await finalize.mutateAsync({
          patientId,
          appointmentId,
          noteId: saved.id,
          expectedRevision: saved.revision,
        });
        return;
      }
      setAiConfirm({
        savedRecord: { id: saved.id, revision: saved.revision },
        confirmationId: prepared.confirmationId,
        sections: prepared.sections,
      });
      setAiConfirmOpen(true);
    } catch {
      // Mutation handlers surface the server error while preserving local text.
    }
  }

  async function confirmAiFinalize() {
    const confirmation = aiConfirm;
    if (
      !confirmation ||
      finalize.isPending ||
      prepareFinalization.isPending
    )
      return;
    setAiConfirmOpen(false);
    try {
      await finalize.mutateAsync({
        patientId,
        appointmentId,
        noteId: confirmation.savedRecord.id,
        expectedRevision: confirmation.savedRecord.revision,
        clinicianConfirmed: { confirmationId: confirmation.confirmationId },
      });
      setAiConfirm(null);
    } catch (error) {
      // The mutation onError already toasted the server message. On an
      // expired or stale envelope, re-prepare once and let the vet confirm
      // the fresh envelope; anything else closes the dialog for good.
      if (trpcErrorCode(error) === "CONFLICT") {
        try {
          const prepared = await prepareFinalization.mutateAsync({
            patientId,
            appointmentId,
            noteId: confirmation.savedRecord.id,
            expectedRevision: confirmation.savedRecord.revision,
          });
          if (prepared.required) {
            setAiConfirm({
              savedRecord: confirmation.savedRecord,
              confirmationId: prepared.confirmationId,
              sections: prepared.sections,
            });
            setAiConfirmOpen(true);
            return;
          }
        } catch {
          // The prepare onError toasted; fall through to close.
        }
      }
      setAiConfirm(null);
    }
  }

  return (
    <Card id="ambulatory-soap" className="scroll-mt-4">
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3">
            <FileText className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <CardTitle>{t("soap.card.title", "SOAP note")}</CardTitle>
              <CardDescription>
                {t(
                  "soap.card.description",
                  "Document the visit here without leaving the field workspace."
                )}
              </CardDescription>
            </div>
          </div>
          {linkedSoapCount > 0 ? (
            <ClinicalStatusBadge
              status="authorized"
              doctorName={finalizedVisitNote?.finalizerName || finalizedVisitNote?.authorName}
              signedAt={finalizedVisitNote?.finalizedAt || finalizedVisitNote?.createdAt}
              size="sm"
            />
          ) : (
            <ClinicalStatusBadge
              status={
                draft?.assessment?.includes("AI") || draft?.subjective?.includes("AI")
                  ? "ai_draft"
                  : "administrative_draft"
              }
              size="sm"
            />
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {linkedSoapCount > 0 ? (
          <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm flex items-center justify-between flex-wrap gap-2">
            <span>{t("soap.finalizedLinked", "Finalized SOAP documentation is linked to this visit.")}</span>
            <span className="text-xs font-mono text-emerald-800 dark:text-emerald-300">
              {t("soap.statutorySigned", "Podpísané podľa Zákona č. 39/2007 Z. z. (§3)")}
            </span>
          </div>
        ) : !canWrite ? (
          <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
            {t(
              "soap.unauthorized",
              "Only an administrator or veterinarian can author the SOAP note."
            )}
          </div>
        ) : draftQuery.error ? (
          <div className="rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {t(
              "soap.errorLock",
              "SOAP draft state could not be verified. Entry is locked to avoid overwriting another clinician’s work."
            )}
          </div>
        ) : draftQuery.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("soap.loading", "Loading SOAP draft...")}
          </div>
        ) : (
          <>
            {!isOnline ? (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
                {t(
                  "soap.offline",
                  "Offline — keep this page open. These values are not saved until the server confirms them."
                )}
              </div>
            ) : null}
            <div className="grid gap-4 lg:grid-cols-2">
              {sectionFields.map((field) => (
                <label key={field.name} className="space-y-1.5">
                  <span className="text-sm font-medium">{field.label}</span>
                  <Textarea
                    value={sections[field.name]}
                    maxLength={SOAP_SECTION_MAX_LENGTH}
                    rows={6}
                    disabled={
                      !visitOpen || saveDraft.isPending || finalize.isPending
                    }
                    placeholder={field.placeholder}
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      setSections((current) => ({
                        ...current,
                        [field.name]: value,
                      }));
                      setDirty(true);
                    }}
                  />
                </label>
              ))}
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={!canSave}
                onClick={() => void persistDraft()}
              >
                {saveDraft.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                {t("soap.actions.saveDraft", "Save draft")}
              </Button>
              <Button
                type="button"
                disabled={
                  !visitOpen ||
                  !isOnline ||
                  !stateReady ||
                  !hasContent ||
                  saveDraft.isPending ||
                  finalize.isPending ||
                  prepareFinalization.isPending
                }
                onClick={() => void finalizeNote()}
              >
                {finalize.isPending || prepareFinalization.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {t("soap.actions.finalize", "Finalize SOAP note")}
              </Button>
            </div>
          </>
        )}
      </CardContent>
      <AiSoapFinalizeDialog
        open={aiConfirmOpen}
        sections={aiConfirm?.sections ?? {}}
        onConfirm={() => void confirmAiFinalize()}
        onCancel={() => {
          setAiConfirmOpen(false);
          setAiConfirm(null);
        }}
        pending={finalize.isPending || prepareFinalization.isPending}
      />
    </Card>
  );
}
