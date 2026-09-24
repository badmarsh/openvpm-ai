"use client";

import { useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";
import { CLIENT_UPLOAD_TIMEOUT_MS, fetchWithClientTimeout } from "@/lib/client-fetch";
import { PATIENT_DOCUMENT_MAX_BYTES } from "@/lib/upload-limits";
import { isAllowedUploadMimeType } from "@/lib/upload-security";
import {
  selectManagedUploadFile,
  settleManagedUploadAttempt,
  type ManagedUploadAttempt,
} from "@/lib/managed-upload-attempt";
import {
  IMAGING_FILE_CATEGORY,
  IMAGING_MODALITY_CODES,
  clinicalBadgeLabelKey,
  type ImagingModality,
} from "@/lib/imaging/modality";

/**
 * Upload categories. Diagnostic studies use the strict `"imaging"` category:
 * the API stores them under the imaging namespace and never writes
 * `patients.photoUrl` (only `"patient-photos"` may do that).
 */
type DocumentCategory = "documents" | "lab-results" | typeof IMAGING_FILE_CATEGORY;
type DocumentAttempt = ManagedUploadAttempt & {
  category: DocumentCategory;
  modality: ImagingModality | null;
};

const DOCUMENT_ACCEPT = "application/pdf,image/jpeg,image/png,image/webp";
const IMAGING_ACCEPT = "image/jpeg,image/png,image/webp";

export function PatientDocumentUpload({ patientId }: { patientId: string }) {
  const { t } = useI18n();
  const { data: session } = useSession();
  const utils = trpc.useUtils();
  const inputRef = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);
  const [category, setCategory] = useState<DocumentCategory>("documents");
  const [modality, setModality] = useState<ImagingModality | "">("");
  const [file, setFile] = useState<File | null>(null);
  const [attempt, setAttempt] = useState<DocumentAttempt | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!session?.user || session.user.role === "viewer") return null;

  const isImaging = category === IMAGING_FILE_CATEGORY;

  async function upload() {
    if (!file || busyRef.current) return;
    if (isImaging && !modality) {
      setError(
        t(
          "patients.documentsTab.imagingModalityRequired",
          "Select the diagnostic modality (RTG, USG, CT, or endoscopy) before uploading.",
        ),
      );
      return;
    }
    if (!isAllowedUploadMimeType(file.type) || file.size > PATIENT_DOCUMENT_MAX_BYTES || file.size === 0) {
      setError(
        isImaging
          ? t(
              "patients.documentsTab.imagingUploadValidation",
              "Choose a JPG, PNG, or WebP image up to 4 MB.",
            )
          : t("patients.documentsTab.uploadValidation", "Choose a PDF, JPG, PNG, or WebP file up to 4 MB. Compress or split large records into smaller PDFs."),
      );
      return;
    }
    const current: DocumentAttempt =
      attempt ?? {
        ...selectManagedUploadFile(null, file),
        category,
        modality: isImaging ? (modality as ImagingModality) : null,
      };
    busyRef.current = true;
    setUploading(true);
    setAttempt(current);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", current.file);
      body.append("category", current.category);
      body.append("patientId", patientId);
      if (current.modality) body.append("modality", current.modality);
      const response = await fetchWithClientTimeout("/api/upload", {
        method: "POST",
        headers: { "Idempotency-Key": current.idempotencyKey },
        body,
      }, CLIENT_UPLOAD_TIMEOUT_MS);
      if (!response.ok) {
        const next = settleManagedUploadAttempt(current, { kind: "response", status: response.status });
        setAttempt(next ? current : null);
        const detail = await response.json().catch(() => null);
        setError(typeof detail?.error === "string" ? detail.error : t("patients.documentsTab.uploadFailed", "Upload failed. Please try again."));
        return;
      }
      setAttempt(null);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      toast.success(
        current.category === "lab-results"
          ? t("patients.documentsTab.labReportAttached", "Lab report attached")
          : current.category === IMAGING_FILE_CATEGORY
            ? t("patients.documentsTab.imagingUploaded", "Imaging study attached")
            : t("patients.documentsTab.documentUploaded", "Document uploaded"),
      );
      void utils.records.listPatientFiles.invalidate({ patientId });
    } catch {
      setAttempt(current);
      setError(t("patients.documentsTab.uploadUnconfirmed", "The upload could not be confirmed. Retry to safely check and finish the same upload."));
    } finally {
      busyRef.current = false;
      setUploading(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="text-sm font-medium">
        {t("patients.documentsTab.uploadTitle", "Add a patient document")}
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">
        {isImaging
          ? t(
              "patients.documentsTab.uploadImagingDesc",
              "Attach a diagnostic study (RTG, USG, CT, endoscopy). Studies are stored separately as imaging and never replace the patient profile photo.",
            )
          : t(
              "patients.documentsTab.uploadDesc",
              "Attach previous records, referrals, scans, or external lab reports. PDF, JPG, PNG, or WebP; up to 4 MB per file. Compress or split larger files.",
            )}
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-xs font-medium">
          <span className="block">
            {t("patients.documentsTab.categoryLabel", "Document category")}
          </span>
          <select
            aria-label={t("patients.documentsTab.categoryLabel", "Document category")}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={category}
            disabled={uploading || !!attempt}
            onChange={(event) => {
              const next = event.target.value as DocumentCategory;
              setCategory(next);
              if (next !== IMAGING_FILE_CATEGORY) setModality("");
              setError(null);
            }}
          >
            <option value="documents">
              {t("patients.documentsTab.externalRecord", "External record")}
            </option>
            <option value="lab-results">
              {t("patients.documentsTab.labReport", "Lab report")}
            </option>
            <option value={IMAGING_FILE_CATEGORY}>
              {t("patients.documentsTab.imagingStudy", "Imaging study")}
            </option>
          </select>
        </label>
        {isImaging && (
          <label className="space-y-1 text-xs font-medium">
            <span className="block">
              {t("patients.documentsTab.modalityLabel", "Diagnostic modality")}
            </span>
            <select
              aria-label={t("patients.documentsTab.modalityLabel", "Diagnostic modality")}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={modality}
              required
              disabled={uploading || !!attempt}
              onChange={(event) => {
                setModality(event.target.value as ImagingModality | "");
                setError(null);
              }}
            >
              <option value="">
                {t("patients.documentsTab.modalityPlaceholder", "Select modality...")}
              </option>
              {IMAGING_MODALITY_CODES.map((code) => (
                <option key={code} value={code}>
                  {t(clinicalBadgeLabelKey(code), code.toUpperCase())}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="min-w-0 flex-1 space-y-1 text-xs font-medium">
          <span className="block">{t("patients.documentsTab.fileLabel", "File")}</span>
          <input
            ref={inputRef}
            type="file"
            accept={isImaging ? IMAGING_ACCEPT : DOCUMENT_ACCEPT}
            disabled={uploading || !!attempt}
            className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-2"
            onChange={(event) => { setFile(event.target.files?.[0] ?? null); setError(null); }}
          />
        </label>
        <Button type="button" size="sm" onClick={() => void upload()} disabled={!file || uploading}>
          {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
          {uploading
            ? t("patients.documentsTab.uploading", "Uploading…")
            : attempt
              ? t("patients.documentsTab.retryUpload", "Retry upload")
              : isImaging
                ? t("patients.documentsTab.uploadImaging", "Upload imaging study")
                : t("patients.documentsTab.uploadDocument", "Upload document")}
        </Button>
      </div>
      {category === "lab-results" && (
        <p className="mt-2 text-xs text-muted-foreground">
          {t("patients.documentsTab.labNotice", "The original report is saved in Documents. Results are not automatically entered into lab values.")}
        </p>
      )}
      {isImaging && (
        <p className="mt-2 text-xs text-muted-foreground">
          {t(
            "patients.documentsTab.imagingNotice",
            "The study is filed under the imaging category and tagged with its modality for the clinical whiteboard.",
          )}
        </p>
      )}
      {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  );
}
