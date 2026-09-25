"use client";

import { Fragment, useState } from "react";
import { CalendarDays, ChevronDown, ChevronRight, Download, ExternalLink, FileText, Loader2, Paperclip } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { EmptyState } from "@/components/common/empty-state";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { formatClinicalDate, formatClinicalDateTime } from "@/lib/records/clinical-dates";
import { formatAppointmentStatus } from "@/lib/scheduling/appointment-status";
import { patientFileKind, patientFileLabel, type PatientFileKind } from "@/lib/records/file-kinds";
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

const appointmentStatusStyles: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-700",
  confirmed: "bg-teal-100 text-teal-700",
  checked_in: "bg-amber-100 text-amber-700",
  in_exam: "bg-purple-100 text-purple-700",
  checked_out: "bg-green-100 text-green-700",
  no_show: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-500",
};

type PatientFile = {
  id: string;
  fileName: string;
  fileUrl: string;
  mimeType: string | null;
  fileSizeBytes: number | null;
  category: string | null;
  appointmentId: string | null;
  createdAt: Date;
  consentTitle: string | null;
  consentSignerName: string | null;
  consentSignedAt: Date | null;
};

function PatientFileRows({
  files,
  timeZone,
}: {
  files: PatientFile[];
  timeZone?: string | null;
}) {
  const { t } = useI18n();
  return (
    <ul className="divide-y divide-border">
      {files.map((file) => {
        const kind = patientFileKind(file);
        return (
          <li key={file.id} className="flex items-center gap-3 py-2.5">
            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {patientFileLabel(file)}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {kind === "consent"
                  ? file.consentSignerName
                    ? t(
                        "patients.documentsTab.signedConsent",
                        "Signed consent · Signed by {signer}",
                        { signer: file.consentSignerName },
                      )
                    : t(
                        "patients.documentsTab.signedConsentSimple",
                        "Signed consent",
                      )
                  : file.category === "lab-results"
                    ? t("patients.documentsTab.labReport", "Lab report")
                    : file.category === "documents"
                      ? t("patients.documentsTab.externalRecord", "External record")
                      : t("patients.documentsTab.document", "Document")}
                {" · "}
                {formatClinicalDateTime(file.createdAt, timeZone, "Unknown")}
              </p>
            </div>
            <a
              href={file.fileUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {t("patients.documentsTab.view", "View")}
            </a>
            <a
              href={file.fileUrl}
              download={file.fileName}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary hover:underline"
            >
              <Download className="h-3.5 w-3.5" />
              {t("patients.documentsTab.download", "Download")}
            </a>
          </li>
        );
      })}
    </ul>
  );
}

function VisitDocuments({
  patientId,
  appointmentId,
  timeZone,
}: {
  patientId: string;
  appointmentId: string;
  timeZone?: string | null;
}) {
  const { t } = useI18n();
  const { data, isLoading, error } = trpc.records.listPatientFiles.useQuery({
    patientId,
    appointmentId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {t("patients.documentsTab.loading", "Loading documents...")}
      </div>
    );
  }
  if (error || !data) {
    return (
      <p className="text-xs text-destructive">
        {t(
          "patients.documentsTab.loadError",
          "Unable to load documents for this visit.",
        )}
      </p>
    );
  }

  const photos = data.filter((file) => patientFileKind(file) === "photo");
  const documents = data.filter((file) => patientFileKind(file) !== "photo");

  if (photos.length === 0 && documents.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        {t(
          "patients.documentsTab.emptyVisit",
          "Nothing attached to this visit yet. Photos and consents captured during the visit show up here.",
        )}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {photos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {photos.map((file) => (
            <a
              key={file.id}
              href={file.fileUrl}
              target="_blank"
              rel="noreferrer"
              title={file.fileName}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={file.fileUrl}
                alt={file.fileName}
                loading="lazy"
                decoding="async"
                className="h-16 w-16 rounded-md border border-border object-cover transition-opacity hover:opacity-80"
              />
            </a>
          ))}
        </div>
      )}
      {documents.length > 0 && (
        <PatientFileRows files={documents} timeZone={timeZone} />
      )}
    </div>
  );
}

export function AppointmentsTab({
  patientId,
  timeZone,
}: {
  patientId: string;
  timeZone?: string | null;
}) {
  const { t } = useI18n();
  const {
    data: visits,
    isLoading,
    error,
  } = trpc.appointments.listByPatient.useQuery({ patientId });
  const visitsMissing = !isLoading && !error && !visits;
  const [expandedVisitId, setExpandedVisitId] = useState<string | null>(null);

  if (error) {
    return (
      <PatientDetailErrorPanel
        message={`Unable to load appointments. ${error.message}`}
      />
    );
  }
  if (visitsMissing) {
    return (
      <PatientDetailErrorPanel
        message={t(
          "common.error_retry",
          "Unable to load appointments. Please retry.",
        )}
      />
    );
  }
  if (isLoading) {
    return (
      <PatientDetailLoadingPanel
        label={t(
          "patients.appointmentsTab.loading",
          "Loading appointments...",
        )}
      />
    );
  }
  if (!visits || visits.length === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
        title={t(
          "patients.appointmentsTab.empty",
          "No appointments yet",
        )}
        description={t(
          "patients.appointmentsTab.emptyDesc",
          "Visits booked on the schedule will show up here.",
        )}
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="w-10 px-2 py-3">
              <span className="sr-only">
                {t("patients.documentsTab.title", "Documents")}
              </span>
            </th>
            <th className="h-10 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
              {t("patients.appointmentsTab.colWhen", "When")}
            </th>
            <th className="h-10 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
              {t("patients.appointmentsTab.colType", "Type")}
            </th>
            <th className="h-10 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
              {t("patients.appointmentsTab.colDoctor", "Doctor")}
            </th>
            <th className="h-10 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
              {t("patients.appointmentsTab.colStatus", "Status")}
            </th>
            <th className="h-10 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
              {t("patients.appointmentsTab.colNotes", "Notes")}
            </th>
          </tr>
        </thead>
        <tbody>
          {visits.map((visit) => {
            const expanded = expandedVisitId === visit.id;
            return (
              <Fragment key={visit.id}>
                <tr className="border-b border-border last:border-0">
                  <td className="px-2 py-3">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedVisitId(expanded ? null : visit.id)
                      }
                      aria-expanded={expanded}
                      aria-label={
                        expanded
                          ? t(
                              "patients.appointmentsTab.hideDocs",
                              "Hide documents for this visit",
                            )
                          : t(
                              "patients.appointmentsTab.showDocs",
                              "Show documents for this visit",
                            )
                      }
                      className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {expanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    {visit.startTime
                      ? formatClinicalDateTime(
                          visit.startTime,
                          timeZone,
                          "Unknown",
                        )
                      : "Unknown"}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-2">
                      {visit.typeColor ? (
                        <span
                          aria-hidden="true"
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: visit.typeColor }}
                        />
                      ) : null}
                      {visit.typeName ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {visit.doctorName ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                        appointmentStatusStyles[visit.status] ??
                          "bg-gray-100 text-gray-600",
                      )}
                    >
                      {formatAppointmentStatus(visit.status, t)}
                    </span>
                  </td>
                  <td className="max-w-xs truncate px-4 py-3 text-muted-foreground">
                    {visit.notes || "—"}
                  </td>
                </tr>
                {expanded && (
                  <tr className="border-b border-border last:border-0">
                    <td colSpan={6} className="bg-muted/30 px-4 py-3">
                      <VisitDocuments
                        patientId={patientId}
                        appointmentId={visit.id}
                        timeZone={timeZone}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}