/**
 * Diagnostic imaging modalities (Sprint 6 — Clinical Whiteboard & Diagnostic
 * Imaging Modalities).
 *
 * One vocabulary for every surface that tags an imaging attachment:
 *  - `files.category` MUST stay `"imaging"` (never `"patient-photos"`), which
 *    is what keeps `patients.photoUrl` untouched (see docs/UIKIT.md and
 *    AGENTS.md §5 "Medical Imaging").
 *  - the modality itself lives in the existing `files.document_type` column,
 *    so no vanilla schema change is required.
 */

export const IMAGING_FILE_CATEGORY = "imaging";

export const IMAGING_MODALITY_CODES = [
  "rtg",
  "usg",
  "ct",
  "endoscopy",
  "mri",
] as const;

export type ImagingModality = (typeof IMAGING_MODALITY_CODES)[number];

/**
 * Non-diagnostic attachment produced by the AI imaging module (clinical
 * photograph of a lesion). It shares the strict `"imaging"` category — so it
 * can never overwrite the profile photo — but it is never summarised as a
 * diagnostic modality on the whiteboard.
 */
export const CLINICAL_PHOTO_MODALITY = "photo";

/** Every value the upload endpoint accepts for `category: "imaging"`. */
export const UPLOAD_MODALITY_CODES = [
  ...IMAGING_MODALITY_CODES,
  CLINICAL_PHOTO_MODALITY,
] as const;

export type ImagingUploadModality = (typeof UPLOAD_MODALITY_CODES)[number];

/** Badge codes shown on the whiteboard: the modalities plus lab. */
export type ClinicalBadgeCode = ImagingUploadModality | "lab";

export const CLINICAL_BADGE_CODES: readonly ClinicalBadgeCode[] = [
  ...UPLOAD_MODALITY_CODES,
  "lab",
];

/**
 * Values seen in `files.document_type` for imaging rows. Legacy imports and
 * the AI imaging module (`ext_imaging.aiImagingImageTypeEnum`) use the
 * English enum names, newer uploads store the canonical code.
 */
const MODALITY_ALIASES: Record<string, ImagingUploadModality> = {
  rtg: "rtg",
  xray: "rtg",
  "x-ray": "rtg",
  x_ray: "rtg",
  radiograph: "rtg",
  usg: "usg",
  sono: "usg",
  sonogram: "usg",
  ultrasound: "usg",
  ct: "ct",
  "ct-scan": "ct",
  computed_tomography: "ct",
  endoscopy: "endoscopy",
  endoskopia: "endoscopy",
  endoskop: "endoscopy",
  mri: "mri",
  magnetic_resonance: "mri",
  "magnetic-resonance": "mri",
  photo: "photo",
  photograph: "photo",
  "clinical-photo": "photo",
  clinical_photo: "photo",
};

/** Lower-case, trim and drop decorative punctuation before matching. */
function normalizeModalityToken(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Resolve a stored modality value to a canonical code. Unknown or empty
 * values return null so a caller never invents a modality that was not
 * recorded.
 */
export function resolveImagingModality(
  value: string | null | undefined,
): ImagingUploadModality | null {
  if (value == null) return null;
  const token = normalizeModalityToken(value);
  if (!token) return null;

  const exact = MODALITY_ALIASES[token];
  if (exact) return exact;

  // Tolerate decorated forms such as "imaging:rtg", "RTG hrudníka" or
  // "endoskopia (GIT)" by matching whole word tokens only — never
  // substrings, so an unrelated word can't be read as a modality.
  const parts = token.split(/[^a-z0-9]+/u).filter(Boolean);
  for (const part of parts) {
    const mapped = MODALITY_ALIASES[part];
    if (mapped) return mapped;
  }
  return null;
}

/**
 * Stable, duplicate-free modality list for a patient's attachments. The
 * order follows IMAGING_MODALITY_CODES so the whiteboard chips never
 * reshuffle between refreshes. Clinical photos are excluded: they are not
 * diagnostic studies and must not appear as a modality chip.
 */
export function normalizeModalityList(
  values: readonly (string | null | undefined)[],
): ImagingModality[] {
  const found = new Set<ImagingModality>();
  for (const value of values) {
    const code = resolveImagingModality(value);
    if (code && code !== CLINICAL_PHOTO_MODALITY) found.add(code);
  }
  return IMAGING_MODALITY_CODES.filter((code) => found.has(code));
}

/** i18n key for a badge code; every string goes through `useI18n()`. */
export function clinicalBadgeLabelKey(code: ClinicalBadgeCode): string {
  return `imaging.modality.${code}`;
}

/** Only imaging rows can carry a modality badge. */
export function isImagingCategory(category: string | null | undefined): boolean {
  return category === IMAGING_FILE_CATEGORY;
}
