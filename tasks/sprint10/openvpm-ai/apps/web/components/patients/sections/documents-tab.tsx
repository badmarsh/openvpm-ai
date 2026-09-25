"use client";

import { useMemo, useState } from "react";
import { Download, ExternalLink, FileText, Paperclip, ScanLine } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { EmptyState } from "@/components/common/empty-state";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { formatClinicalDateTime } from "@/lib/records/clinical-dates";
import { PatientDocumentUpload } from "@/components/records/patient-document-upload";
import { ModalityBadge } from "@/components/imaging/modality-badge";
import { patientFileKind, patientFileLabel, type PatientFileKind } from "@/lib/records/file-kinds";
import { resolveImagingModality } from "@/lib/imaging/modality";

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
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="h-8 w-48 animate-pulse rounded bg-muted" />
      <div className="h-32 w-full animate-pulse rounded bg-muted" />
    </div>
  );
}

type PatientFile = {
  id: string;
  fileName: string;
  fileUrl: string;
  mimeType: string | null;
  fileSizeBytes: number | null;
  category: string | null;
  title: string | null;
  documentType: string | null;
  appointmentId: string | null;
  createdAt: Date;
  consentTitle: string | null;
  consentSignerName: string | null;
  consentSignedAt: Date | null;
};

function PatientPhotoGrid({ photos }: { photos: PatientFile[] }) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-8">
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
            className="aspect-square w-full rounded-md border border-border object-cover transition-opacity hover:opacity-80"
          />
        </a>
      ))}
    </div>
  );
}

/**
 * Diagnostic studies get their own grid: an RTG/USG/CT scan is evidence, not
 * an owner-facing photo, and it must never be presented as the patient photo.
 */
function PatientImagingGrid({
  studies,
  timeZone,
}: {
  studies: PatientFile[];
  timeZone?: string | null;
}) {
  const { t } = useI18n();
  return (
    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {studies.map((file) => {
        const modality = resolveImagingModality(file.documentType);
        return (
          <li
            key={file.id}
            className="flex gap-3 rounded-md border border-border bg-card p-2"
          >
            <a
              href={file.fileUrl}
              target="_blank"
              rel="noreferrer"
              className="shrink-0"
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
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                {modality ? (
                  <ModalityBadge code={modality} />
                ) : null}
                <span className="truncate text-xs font-medium">
                  {patientFileLabel(file)}
                </span>
              </div>
              <p className="mt-1 truncate text-[11px] text-muted-foreground">
                {t("patients.documentsTab.imagingStudy", "Imaging study")}
                {" · "}
                {formatClinicalDateTime(file.createdAt, timeZone, "Unknown")}
              </p>
              <div className="mt-1 flex items-center gap-2">
                <a
                  href={file.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  {t("patients.documentsTab.view", "View")}
                </a>
                <a
                  href={file.fileUrl}
                  download={file.fileName}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                >
                  <Download className="h-3 w-3" />
                  {t("patients.documentsTab.download", "Download")}
                </a>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

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

const documentFilters: {
  id: PatientFileKind | "all" | "lab";
  labelKey: string;
  defaultLabel: string;
}[] = [
  { id: "all", labelKey: "patients.documentsTab.filterAll", defaultLabel: "All" },
  {
    id: "photo",
    labelKey: "patients.documentsTab.filterPhotos",
    defaultLabel: "Photos",
  },
  {
    id: "imaging",
    labelKey: "patients.documentsTab.filterImaging",
    defaultLabel: "Imaging",
  },
  {
    id: "consent",
    labelKey: "patients.documentsTab.filterConsents",
    defaultLabel: "Consents",
  },
  {
    id: "document",
    labelKey: "patients.documentsTab.filterDocuments",
    defaultLabel: "Documents",
  },
  {
    id: "lab",
    labelKey: "patients.documentsTab.filterLab",
    defaultLabel: "Lab reports",
  },
];

export function DocumentsTab({
  patientId,
  timeZone,
}: {
  patientId: string;
  timeZone?: string | null;
}) {
  const { t } = useI18n();
  const [filter, setFilter] = useState<PatientFileKind | "all" | "lab">("all");
  const { data, isLoading, error } = trpc.records.listPatientFiles.useQuery({
    patientId,
  });
  const filesMissing = !isLoading && !error && !data;

  const counts = useMemo(() => {
    const next = { all: 0, photo: 0, consent: 0, imaging: 0, document: 0, lab: 0 };
    for (const file of data ?? []) {
      next.all += 1;
      next[patientFileKind(file)] += 1;
      if (file.category === "lab-results") next.lab += 1;
    }
    return next;
  }, [data]);

  if (error) {
    return (
      <PatientDetailErrorPanel
        message={`Unable to load documents. ${error.message}`}
      />
    );
  }
  if (filesMissing) {
    return (
      <PatientDetailErrorPanel
        message={t(
          "common.error_retry",
          "Unable to load documents. Please retry.",
        )}
      />
    );
  }
  if (isLoading) {
    return (
      <PatientDetailLoadingPanel
        label={t("patients.documentsTab.loading", "Loading documents...")}
      />
    );
  }
  if (!data || data.length === 0) {
    return (
      <div className="space-y-4">
        <PatientDocumentUpload key={patientId} patientId={patientId} />
        <EmptyState
          icon={Paperclip}
          title={t("patients.documentsTab.empty", "No documents yet")}
          description={t(
            "patients.documentsTab.emptyDescExtended",
            "Upload outside records and lab reports here. Captured photos and signed consents also appear in this list.",
          )}
        />
      </div>
    );
  }

  const visible = data.filter(
    (file) =>
      filter === "all" ||
      (filter === "lab"
        ? file.category === "lab-results"
        : patientFileKind(file) === filter),
  );
  const photos = visible.filter((file) => patientFileKind(file) === "photo");
  const imagingStudies = visible.filter(
    (file) => patientFileKind(file) === "imaging",
  );
  const documents = visible.filter(
    (file) =>
      patientFileKind(file) !== "photo" &&
      patientFileKind(file) !== "imaging",
  );

  return (
    <div className="space-y-4">
      <PatientDocumentUpload key={patientId} patientId={patientId} />
      <div className="flex flex-wrap gap-2">
        {documentFilters.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setFilter(option.id)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              filter === option.id
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {t(option.labelKey, option.defaultLabel)} ({counts[option.id]})
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
          {t(
            "patients.documentsTab.emptyFilter",
            "Nothing here yet for this filter.",
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {photos.length > 0 && (
            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="mb-3 text-sm font-medium">
                {t("patients.documentsTab.photosTitle", "Photos")}
              </h3>
              <PatientPhotoGrid photos={photos} />
            </div>
          )}
          {imagingStudies.length > 0 && (
            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-medium">
                <ScanLine className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                {t("patients.documentsTab.imagingTitle", "Imaging studies")}
                <span className="text-xs font-normal tabular-nums text-muted-foreground">
                  ({imagingStudies.length})
                </span>
              </h3>
              <PatientImagingGrid studies={imagingStudies} timeZone={timeZone} />
            </div>
          )}
          {documents.length > 0 && (
            <div className="rounded-lg border border-border bg-card px-4 py-2">
              <PatientFileRows files={documents} timeZone={timeZone} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
