/**
 * Patient files land in one `files` table differentiated by `category`
 * (where the upload came from) and mime type. These helpers are the single
 * source of truth for sorting that bucket into what the UI treats as
 * photos, signed consents, imaging studies, and other documents.
 */

import { IMAGING_FILE_CATEGORY } from "@/lib/imaging/modality";

/** Category written by QR capture uploads and patient photo uploads. */
export const PATIENT_PHOTO_CATEGORY = "patient-photos";
/** Category written when a consent request is signed (signed PDF). */
export const CONSENT_FILE_CATEGORY = "consents";
/** Diagnostic imaging studies (RTG / USG / CT / endoscopy). */
export const IMAGING_CATEGORY = IMAGING_FILE_CATEGORY;

export type PatientFileKind = "photo" | "consent" | "imaging" | "document";

export const PATIENT_FILE_KINDS: readonly PatientFileKind[] = [
  "photo",
  "consent",
  "imaging",
  "document",
];

export function patientFileKind(file: {
  category: string | null;
  mimeType: string | null;
}): PatientFileKind {
  if (file.category === CONSENT_FILE_CATEGORY) return "consent";
  // Diagnostic imaging keeps its own bucket: a scan must never render in the
  // photo grid (and never replace the patient profile photo).
  if (file.category === IMAGING_CATEGORY) return "imaging";
  // Scanned records remain documents, even when supplied as an image.
  if (file.category === "documents" || file.category === "lab-results") {
    return "document";
  }
  if (file.mimeType?.startsWith("image/")) return "photo";
  return "document";
}

/** Human label for a file row: signed consents show what was signed. */
export function patientFileLabel(file: {
  category: string | null;
  mimeType: string | null;
  fileName: string;
  title?: string | null;
  consentTitle?: string | null;
}): string {
  if (patientFileKind(file) === "consent" && file.consentTitle) {
    return file.consentTitle;
  }
  if (file.title?.trim()) return file.title.trim();
  return file.fileName;
}
