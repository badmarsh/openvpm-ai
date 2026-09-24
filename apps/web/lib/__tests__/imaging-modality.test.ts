import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CLINICAL_PHOTO_MODALITY,
  IMAGING_FILE_CATEGORY,
  IMAGING_MODALITY_CODES,
  UPLOAD_MODALITY_CODES,
  clinicalBadgeLabelKey,
  isImagingCategory,
  normalizeModalityList,
  resolveImagingModality,
} from "../imaging/modality";

const uploadRoute = readFileSync("app/api/upload/route.ts", "utf8");
const uploadComponent = readFileSync(
  "components/records/patient-document-upload.tsx",
  "utf8",
);
const whiteboardPage = readFileSync(
  "app/(dashboard)/whiteboard/page.tsx",
  "utf8",
);

describe("diagnostic modality vocabulary", () => {
  it("covers the four required diagnostic modalities", () => {
    expect(IMAGING_MODALITY_CODES).toEqual([
      "rtg",
      "usg",
      "ct",
      "endoscopy",
      "mri",
    ]);
    expect(UPLOAD_MODALITY_CODES).toEqual([
      "rtg",
      "usg",
      "ct",
      "endoscopy",
      "mri",
      "photo",
    ]);
    expect(IMAGING_FILE_CATEGORY).toBe("imaging");
    expect(isImagingCategory("imaging")).toBe(true);
    expect(isImagingCategory("patient-photos")).toBe(false);
  });

  it("normalises stored and legacy modality values", () => {
    expect(resolveImagingModality("RTG")).toBe("rtg");
    expect(resolveImagingModality("xray")).toBe("rtg");
    expect(resolveImagingModality("x-ray")).toBe("rtg");
    expect(resolveImagingModality("USG")).toBe("usg");
    expect(resolveImagingModality("ultrasound")).toBe("usg");
    expect(resolveImagingModality("CT")).toBe("ct");
    expect(resolveImagingModality("computed_tomography")).toBe("ct");
    expect(resolveImagingModality("endoskopia")).toBe("endoscopy");
    expect(resolveImagingModality("Endoscopy")).toBe("endoscopy");
    expect(resolveImagingModality("imaging:usg")).toBe("usg");
    expect(resolveImagingModality("MRI")).toBe("mri");
    expect(resolveImagingModality("clinical-photo")).toBe(CLINICAL_PHOTO_MODALITY);
  });

  it("never invents a modality from unrelated text", () => {
    expect(resolveImagingModality(null)).toBeNull();
    expect(resolveImagingModality("")).toBeNull();
    expect(resolveImagingModality("dental cleaning")).toBeNull();
    expect(resolveImagingModality("contrast")).toBeNull();
    expect(resolveImagingModality("bad case report")).toBeNull();
  });

  it("keeps the modality list stable and duplicate-free", () => {
    expect(normalizeModalityList(["CT", "rtg", "rtg", null])).toEqual([
      "rtg",
      "ct",
    ]);
    expect(normalizeModalityList([])).toEqual([]);
    // Clinical photos keep the strict category but never become a modality chip.
    expect(normalizeModalityList(["photo", "RTG", "photo"])).toEqual(["rtg"]);
  });

  it("exposes one i18n key per badge", () => {
    expect(clinicalBadgeLabelKey("rtg")).toBe("imaging.modality.rtg");
    expect(clinicalBadgeLabelKey("lab")).toBe("imaging.modality.lab");
  });
});

describe("strict imaging category containment", () => {
  it("requires a modality for imaging uploads", () => {
    expect(uploadRoute).toContain('dashboardCategory === "imaging"');
    expect(uploadRoute).toContain("resolveImagingModality(");
    expect(uploadRoute).toContain("A supported modality is required for imaging uploads");
    expect(uploadRoute).toContain("documentType: imagingModality");
  });

  it("only ever writes patients.photoUrl for profile photos", () => {
    const photoWrite = uploadRoute.indexOf('{ photoUrl: reservation.fileUrl }');
    expect(photoWrite).toBeGreaterThan(-1);
    // The photo link is guarded by the profile-photo category and imaging
    // uploads skip the patient update entirely.
    expect(uploadRoute).toContain(
      'dashboardCategory === "patient-photos"\n              ? { photoUrl: reservation.fileUrl }',
    );
    expect(uploadRoute).toContain('else if (dashboardCategory !== "imaging")');
    expect(whiteboardPage).not.toContain("photoUrl:");
  });

  it("sends the modality with the strict imaging category from the patient card", () => {
    expect(uploadComponent).toContain("IMAGING_FILE_CATEGORY");
    expect(uploadComponent).toContain('body.append("modality", current.modality)');
    expect(uploadComponent).toContain('body.append("category", current.category)');
    expect(uploadComponent).toContain('patients.documentsTab.imagingModalityRequired');
  });

  it("tags AI-module uploads with a modality", () => {
    const imagingPage = readFileSync("app/(dashboard)/agent/imaging/page.tsx", "utf8");
    expect(imagingPage).toContain("IMAGE_TYPE_MODALITY");
    expect(imagingPage).toContain('formData.append("modality", IMAGE_TYPE_MODALITY[imageType])');
    expect(imagingPage).toContain('xray: "rtg"');
    expect(imagingPage).toContain('photo: "photo"');
  });

  it("keeps the whiteboard read-only towards patient identity", () => {
    // The board renders imaging chips from an aggregation; it has no update
    // path for files or patients at all.
    expect(whiteboardPage).not.toContain("files.");
    expect(whiteboardPage).not.toContain("patients.photoUrl");
  });
});
