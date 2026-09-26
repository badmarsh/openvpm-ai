"use client";

import { ScanLine, ExternalLink, Download, Upload } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { EmptyState } from "@/components/common/empty-state";
import { useI18n } from "@/lib/i18n";
import { formatClinicalDateTime } from "@/lib/records/clinical-dates";
import { ModalityBadge } from "@/components/imaging/modality-badge";
import { resolveImagingModality } from "@/lib/imaging/modality";
import { PatientDocumentUpload } from "@/components/records/patient-document-upload";
import { DataTableFrame } from "@/components/layout/page-kit";
import { TableScroll } from "@/components/common/table-scroll";

export function ImagingTab({
  patientId,
  timeZone,
}: {
  patientId: string;
  timeZone?: string | null;
}) {
  const { t } = useI18n();
  const { data, isLoading, error } = trpc.extensions.patientClinicalCard.listImaging.useQuery({ patientId });

  // Fallback to legacy files query for mocked environments where extension router not yet deployed
  const legacyFiles = trpc.records.listPatientFiles.useQuery({ patientId }, { enabled: !!error || (!isLoading && !data) });

  const imagingFiles = (data ?? legacyFiles.data?.filter((f) => (f as unknown as { category: string | null }).category === "imaging")) as typeof data | undefined;

  if (error && legacyFiles.error) {
    return (
      <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
        {t("patients.imagingTab.loadError", "Nepodarilo sa načítať zobrazovaciu diagnostiku.")}
      </div>
    );
  }
  if (isLoading || legacyFiles.isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-32 w-full animate-pulse rounded bg-muted" />
      </div>
    );
  }

  const studies = (imagingFiles as unknown as Array<{
    id: string;
    fileName: string;
    fileUrl: string;
    documentType: string | null;
    createdAt: Date | string;
    title: string | null;
  }>) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {t(
            "patients.imagingTab.help",
            "Prílohy kategórie „imaging“ (RTG, USG, MRI) – nikdy neprepisujú fotografiu pacienta (patient.photoUrl)."
          )}
        </p>
        <span className="text-xs tabular-nums text-muted-foreground">
          {t("patients.imagingTab.count", "{count} štúdií", { count: studies.length })}
        </span>
      </div>

      {/* Upload stays imaging-only – policy ensures photoUrl is untouched */}
      <PatientDocumentUpload key={`${patientId}-imaging`} patientId={patientId} />

      {studies.length === 0 ? (
        <EmptyState
          icon={ScanLine}
          title={t("patients.imagingTab.empty", "Žiadne zobrazovacie štúdie")}
          description={t(
            "patients.imagingTab.emptyDesc",
            "RTG, USG či MRI snímky nahrané ako „imaging“ sa zobrazia tu. Fotografia pacienta zostáva nedotknutá."
          )}
        />
      ) : (
        <DataTableFrame>
          <TableScroll>
            <ul className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3">
              {studies.map((file) => {
                const modality = resolveImagingModality(file.documentType);
                return (
                  <li
                    key={file.id}
                    className="flex gap-3 rounded-lg border border-border bg-card p-3 shadow-2xs"
                  >
                    <a href={file.fileUrl} target="_blank" rel="noreferrer" className="shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={file.fileUrl}
                        alt={file.fileName}
                        loading="lazy"
                        decoding="async"
                        className="h-20 w-20 rounded-md border border-border object-cover transition-opacity hover:opacity-80"
                      />
                    </a>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {modality ? <ModalityBadge code={modality} /> : null}
                        <span className="truncate text-xs font-medium">{file.fileName}</span>
                      </div>
                      <p className="mt-1 truncate text-[11px] text-muted-foreground">
                        {t("patients.imagingTab.study", "Zobrazovacia štúdia")} ·{" "}
                        {formatClinicalDateTime(file.createdAt as Date, timeZone, "—")}
                      </p>
                      <div className="mt-1.5 flex items-center gap-3">
                        <a
                          href={file.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" />
                          {t("patients.imagingTab.view", "Zobraziť")}
                        </a>
                        <a
                          href={file.fileUrl}
                          download={file.fileName}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                        >
                          <Download className="h-3 w-3" />
                          {t("patients.imagingTab.download", "Stiahnuť")}
                        </a>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </TableScroll>
        </DataTableFrame>
      )}
    </div>
  );
}
