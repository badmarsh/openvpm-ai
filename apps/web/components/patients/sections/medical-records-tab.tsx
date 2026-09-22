"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FileText, Plus } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/empty-state";
import { useI18n } from "@/lib/i18n";
import { ClinicalCorrectionControl } from "@/components/records/clinical-correction-control";
import { PatientHistorySearch } from "@/components/patients/patient-history-search";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { formatClinicalDate, formatClinicalDateTime } from "@/lib/records/clinical-dates";
import { soapSectionText } from "@/lib/records/soap-content";
import { PatientHeaderSkeleton, PatientSnapshotSkeleton } from "@/components/ui/content-skeletons";

function PatientDetailErrorPanel({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
      {message}
    </div>
  );
}

function PatientDetailLoadingPanel({ label }: { label: string }) {
  return (
    <div className="space-y-4">
      <div className="h-8 w-48 animate-pulse rounded bg-muted" />
      <div className="h-32 w-full animate-pulse rounded bg-muted" />
    </div>
  );
}

function SoapAddendumControl({
  patientId,
  noteId,
  enabled,
}: {
  patientId: string;
  noteId: string;
  enabled: boolean;
}) {
  const { t } = useI18n();
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [operationId, setOperationId] = useState(() => crypto.randomUUID());
  const addendum = trpc.records.addSoapNoteAddendum.useMutation({
    onSuccess: async () => {
      setContent("");
      setOpen(false);
      setOperationId(crypto.randomUUID());
      toast.success(
        t(
          "patients.recordsTab.addendumSuccess",
          "Addendum added to the finalized record",
        ),
      );
      await utils.records.listSoapNotes.invalidate({ patientId });
    },
    onError: (error) => toast.error(error.message),
  });
  if (!enabled) return null;
  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-4"
        onClick={() => {
          setOperationId(crypto.randomUUID());
          setOpen(true);
        }}
      >
        <Plus className="mr-2 h-4 w-4" />
        {t("patients.recordsTab.addAddendum", "Add addendum")}
      </Button>
    );
  }
  return (
    <div className="mt-4 rounded-md border border-border p-3">
      <label className="text-sm font-medium" htmlFor={`addendum-${noteId}`}>
        {t(
          "patients.recordsTab.addAttributedAddendum",
          "Add attributed addendum",
        )}
      </label>
      <p className="mt-1 text-xs text-muted-foreground">
        {t(
          "patients.recordsTab.addendaNotice",
          "Addenda cannot be edited or deleted after saving.",
        )}
      </p>
      <textarea
        id={`addendum-${noteId}`}
        value={content}
        onChange={(event) => setContent(event.target.value)}
        maxLength={10_000}
        rows={3}
        className="mt-2 w-full rounded-md border border-border bg-background p-2 text-sm"
      />
      <div className="mt-2 flex gap-2">
        <Button
          type="button"
          size="sm"
          disabled={!content.trim() || addendum.isPending}
          onClick={() =>
            addendum.mutate({
              patientId,
              noteId,
              operationId,
              content,
            })
          }
        >
          {addendum.isPending
            ? t("common.saving", "Saving...")
            : t("patients.recordsTab.saveAddendum", "Save addendum")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={addendum.isPending}
          onClick={() => {
            setOpen(false);
            setContent("");
            setOperationId(crypto.randomUUID());
          }}
        >
          {t("common.cancel", "Cancel")}
        </Button>
      </div>
    </div>
  );
}

export function MedicalRecordsTab({
  patientId,
  timeZone,
  canCorrectClinicalRecords,
  canSearchPatientHistory,
}: {
  patientId: string;
  timeZone?: string | null;
  canCorrectClinicalRecords: boolean;
  canSearchPatientHistory: boolean;
}) {
  const { t } = useI18n();
  const [historySearchActive, setHistorySearchActive] = useState(false);
  const utils = trpc.useUtils();
  const {
    data: notes,
    isLoading,
    error,
  } = trpc.records.listSoapNotes.useQuery({ patientId });
  const correctSoap = trpc.records.markSoapNoteEnteredInError.useMutation({
    onSuccess: async () => {
      toast.success(
        t(
          "patients.recordsTab.voidSoapSuccess",
          "SOAP note retained and marked entered in error",
        ),
      );
      await utils.records.listSoapNotes.invalidate({ patientId });
    },
    onError: (err) => toast.error(err.message),
  });
  const notesMissing = !isLoading && !error && !notes;

  return (
    <div className="space-y-4">
      {canSearchPatientHistory ? (
        <PatientHistorySearch
          patientId={patientId}
          timeZone={timeZone}
          onSearchModeChange={setHistorySearchActive}
        />
      ) : null}
      {!historySearchActive ? (
        error ? (
          <PatientDetailErrorPanel
            message={`Unable to load medical records. ${error.message}`}
          />
        ) : notesMissing ? (
          <PatientDetailErrorPanel
            message={t(
              "common.error_retry",
              "Unable to load medical records. Please retry.",
            )}
          />
        ) : isLoading ? (
          <PatientDetailLoadingPanel
            label={t(
              "patients.recordsTab.loading",
              "Loading medical records...",
            )}
          />
        ) : !notes || notes.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={t(
              "patients.recordsTab.empty",
              "No medical records yet",
            )}
            description={t(
              "patients.recordsTab.emptyDesc",
              "SOAP notes written in Records will show up here.",
            )}
          />
        ) : (
          notes.map((note) => {
            const hasOtherCurrentAppointmentSoap = Boolean(
              note.appointmentId &&
              notes.some(
                (candidate) =>
                  candidate.id !== note.id &&
                  candidate.appointmentId === note.appointmentId &&
                  candidate.status === "finalized" &&
                  !candidate.correctionId,
              ),
            );
            const hasAppointmentSoapDraft = Boolean(
              note.appointmentId &&
              notes.some(
                (candidate) =>
                  candidate.id !== note.id &&
                  candidate.appointmentId === note.appointmentId &&
                  candidate.status === "draft",
              ),
            );
            return (
              <div
                key={note.id}
                id={`soap-note-${note.id}`}
                className={cn(
                  "rounded-lg border border-border bg-card p-4",
                  note.correctionId && "border-destructive/40 bg-destructive/5",
                )}
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">
                      {note.createdAt
                        ? formatClinicalDate(
                            note.createdAt,
                            timeZone,
                            "Unknown",
                          )
                        : "Unknown"}
                    </p>
                    {note.imported ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                        {t("patients.recordsTab.imported", "Imported")}
                      </span>
                    ) : null}
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-medium",
                        note.status === "draft"
                          ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                          : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
                      )}
                    >
                      {note.status === "draft"
                        ? t("patients.recordsTab.draft", "Draft")
                        : t("patients.recordsTab.finalized", "Finalized")}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {note.imported
                      ? note.authorName
                        ? t("patients.recordsTab.importedBy", "Imported by {author}", {
                            author: note.authorName,
                          })
                        : t("patients.recordsTab.importedRecord", "Imported record")
                      : (note.authorName ??
                        t("patients.recordsTab.unknownAuthor", "Unknown author"))}
                  </p>
                </div>
                {note.status === "finalized" ? (
                  <p className="mb-3 text-xs text-muted-foreground">
                    {note.finalizedAt
                      ? t(
                          "patients.recordsTab.finalizedByOn",
                          "Finalized by {clinician} on {date}",
                          {
                            clinician:
                              note.finalizerName ??
                              t(
                                "patients.recordsTab.unknownClinician",
                                "Unknown clinician",
                              ),
                            date: formatClinicalDateTime(
                              note.finalizedAt,
                              timeZone,
                            ),
                          },
                        )
                      : t(
                          "patients.recordsTab.finalizedBy",
                          "Finalized by {clinician}",
                          {
                            clinician:
                              note.finalizerName ??
                              t(
                                "patients.recordsTab.unknownClinician",
                                "Unknown clinician",
                              ),
                          },
                        )}
                  </p>
                ) : note.appointmentId && canCorrectClinicalRecords ? (
                  <a
                    href={`/records/new-soap/${encodeURIComponent(patientId)}?appointmentId=${encodeURIComponent(note.appointmentId)}`}
                    className="mb-3 inline-flex text-xs font-medium text-primary hover:underline"
                  >
                    {t("patients.recordsTab.resumeDraft", "Resume draft")}
                  </a>
                ) : null}
                {note.replacesSoapNoteId ? (
                  <div className="mb-3 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
                    <p className="font-medium text-primary">
                      {t(
                        "patients.recordsTab.currentReplacement",
                        "Current replacement SOAP",
                      )}
                    </p>
                    <a
                      href={`#soap-note-${note.replacesSoapNoteId}`}
                      className="mt-1 inline-flex text-xs font-medium text-primary hover:underline"
                    >
                      {t(
                        "patients.recordsTab.viewRetainedOriginal",
                        "View retained original",
                      )}
                    </a>
                  </div>
                ) : null}
                <dl className="grid gap-3 sm:grid-cols-2">
                  {(
                    [
                      [
                        t("patients.recordsTab.subjective", "Subjective"),
                        note.subjective,
                      ],
                      [
                        t("patients.recordsTab.objective", "Objective"),
                        note.objective,
                      ],
                      [
                        t("patients.recordsTab.assessment", "Assessment"),
                        note.assessment,
                      ],
                      [
                        t("patients.recordsTab.plan", "Plan"),
                        note.plan,
                      ],
                    ] as const
                  ).map(([label, value]) =>
                    value ? (
                      <div key={label}>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {label}
                        </dt>
                        <dd className="mt-1 whitespace-pre-wrap text-sm">
                          {soapSectionText(value)}
                        </dd>
                      </div>
                    ) : null,
                  )}
                </dl>
                {note.addenda.length > 0 ? (
                  <div className="mt-4 space-y-2 border-t border-border pt-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("patients.recordsTab.addenda", "Addenda")}
                    </p>
                    {note.addenda.map((addendum) => (
                      <div
                        key={addendum.id}
                        className="rounded-md bg-muted/40 p-3"
                      >
                        <p className="text-xs font-medium">
                          {addendum.authorName} -{" "}
                          {formatClinicalDateTime(addendum.createdAt, timeZone)}
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-sm">
                          {soapSectionText(addendum.content)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}
                {note.status === "finalized" && !note.correctionId ? (
                  <SoapAddendumControl
                    patientId={patientId}
                    noteId={note.id}
                    enabled={canCorrectClinicalRecords}
                  />
                ) : null}
                {note.status === "finalized" ? (
                  <>
                    <ClinicalCorrectionControl
                      correction={
                        note.correctionId &&
                        note.correctionReason &&
                        note.correctedAt
                          ? {
                              id: note.correctionId,
                              reason: note.correctionReason,
                              correctedAt: note.correctedAt,
                              correctedByName: note.correctedByName,
                            }
                          : null
                      }
                      triggerLabel={t(
                        "patients.recordsTab.voidSoap",
                        "Void without replacement",
                      )}
                      description="The original stays in permanent chart history but leaves current clinical summaries immediately. If its content needs correction, cancel and use Replace finalized SOAP. Use void alone only when no replacement belongs on this encounter; closeout will require a documented reason."
                      canCorrect={canCorrectClinicalRecords}
                      isPending={
                        correctSoap.isPending &&
                        correctSoap.variables?.recordId === note.id
                      }
                      onCorrect={(reason) =>
                        correctSoap.mutateAsync({
                          patientId,
                          recordId: note.id,
                          reason,
                        })
                      }
                    />
                    {note.replacementSoapNoteId ? (
                      <div className="mt-3 flex justify-end">
                        <a
                          href={`#soap-note-${note.replacementSoapNoteId}`}
                          className="text-sm font-medium text-primary hover:underline"
                        >
                          {t(
                            "patients.recordsTab.viewSignedReplacement",
                            "View signed replacement",
                          )}
                        </a>
                      </div>
                    ) : canCorrectClinicalRecords &&
                      (!note.correctionId ||
                        (!hasOtherCurrentAppointmentSoap &&
                          !hasAppointmentSoapDraft)) ? (
                      <div className="mt-3 flex justify-end">
                        <Button asChild size="sm">
                          <Link
                            href={`/records/replace-soap/${encodeURIComponent(patientId)}?sourceNoteId=${encodeURIComponent(note.id)}&return=patient`}
                          >
                            {note.correctionId
                              ? t(
                                  "patients.recordsTab.createMissingReplacement",
                                  "Create missing replacement",
                                )
                              : t(
                                  "patients.recordsTab.replaceFinalizedSoap",
                                  "Replace finalized SOAP",
                                )}
                          </Link>
                        </Button>
                      </div>
                    ) : hasAppointmentSoapDraft && note.appointmentId ? (
                      <div className="mt-3 flex justify-end">
                        <Button asChild size="sm" variant="outline">
                          <a
                            href={`/records/new-soap/${encodeURIComponent(patientId)}?appointmentId=${encodeURIComponent(note.appointmentId)}`}
                          >
                            {t(
                              "patients.recordsTab.reviewEncounterSoapDraft",
                              "Review encounter SOAP draft",
                            )}
                          </a>
                        </Button>
                      </div>
                    ) : note.correctionId && hasOtherCurrentAppointmentSoap ? (
                      <p className="mt-3 text-right text-xs text-muted-foreground">
                        {t(
                          "patients.recordsTab.encounterHasSoap",
                          "This encounter already has a current finalized SOAP.",
                        )}
                      </p>
                    ) : null}
                  </>
                ) : null}
              </div>
            );
          })
        )
      ) : null}
    </div>
  );
}