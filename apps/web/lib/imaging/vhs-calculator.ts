/**
 * Vertebral Heart Score (VHS) Calculator & Reference Ranges
 * Buchanan & Bucheler (1995) standard veterinary cardiothoracic ratio.
 *
 * Measurements:
 * - Long axis (L): Distance from carina / bifurcation of trachea to cardiac apex (mm)
 * - Short axis (S): Maximum transverse dimension perpendicular to long axis (mm)
 * - T4 vertebra length (v): Cranial border of T4 to caudal border (mm)
 *
 * Formula:
 * VHS (v) = (L_mm / T4_mm) + (S_mm / T4_mm)
 */

export type VhsSpecies = "canine" | "feline";

export type VhsStatus = "normal" | "borderline" | "cardiomegaly";

export interface BreedVhsRange {
  min: number;
  max: number;
  borderlineMax: number;
}

export const BREED_SPECIFIC_VHS: Record<string, BreedVhsRange> = {
  boxer: { min: 10.3, max: 11.6, borderlineMax: 12.0 },
  bulldog: { min: 10.5, max: 11.8, borderlineMax: 12.2 },
  french_bulldog: { min: 10.5, max: 11.8, borderlineMax: 12.2 },
  pug: { min: 10.4, max: 11.8, borderlineMax: 12.2 },
  boston_terrier: { min: 10.3, max: 11.5, borderlineMax: 12.0 },
  dachshund: { min: 9.5, max: 11.0, borderlineMax: 11.5 },
  cavalier: { min: 9.9, max: 11.2, borderlineMax: 11.7 },
  cavalier_king_charles: { min: 9.9, max: 11.2, borderlineMax: 11.7 },
  doberman: { min: 9.2, max: 10.2, borderlineMax: 10.6 },
  whippet: { min: 9.5, max: 11.0, borderlineMax: 11.4 },
  german_shepherd: { min: 8.7, max: 10.5, borderlineMax: 11.0 },
  standard_canine: { min: 8.5, max: 10.5, borderlineMax: 11.5 },
};

export function getReferenceRangeForBreed(breedName?: string | null): BreedVhsRange {
  if (!breedName) return BREED_SPECIFIC_VHS.standard_canine!;
  const normalized = breedName.toLowerCase().replace(/[^a-z]/g, "_");
  for (const [key, range] of Object.entries(BREED_SPECIFIC_VHS)) {
    if (normalized.includes(key)) return range;
  }
  return BREED_SPECIFIC_VHS.standard_canine!;
}

export interface VhsResult {
  longAxisVertebrae: number;
  shortAxisVertebrae: number;
  vhsScore: number;
  species: VhsSpecies;
  breed?: string;
  status: VhsStatus;
  statusLabelSk: string;
  statusLabelEn: string;
  referenceRange: string;
  clinicalInterpretationSk: string;
  clinicalInterpretationEn: string;
}

export function calculateVhs(params: {
  longAxisMm: number;
  shortAxisMm: number;
  t4VertebraLengthMm: number;
  species?: VhsSpecies;
  breed?: string;
}): VhsResult {
  const { longAxisMm, shortAxisMm, t4VertebraLengthMm, species = "canine", breed } = params;

  if (t4VertebraLengthMm <= 0) {
    throw new Error("T4 vertebra length must be greater than zero");
  }
  if (longAxisMm <= 0 || shortAxisMm <= 0) {
    throw new Error("Cardiac dimensions must be greater than zero");
  }

  const lV = Number((longAxisMm / t4VertebraLengthMm).toFixed(2));
  const sV = Number((shortAxisMm / t4VertebraLengthMm).toFixed(2));
  const vhsScore = Number((lV + sV).toFixed(1));

  if (species === "feline") {
    const referenceRange = "< 8.0 v";
    if (vhsScore < 8.0) {
      return {
        longAxisVertebrae: lV,
        shortAxisVertebrae: sV,
        vhsScore,
        species,
        breed,
        status: "normal",
        statusLabelSk: "Normálna veľkosť srdca",
        statusLabelEn: "Normal cardiac size",
        referenceRange,
        clinicalInterpretationSk: `VHS ${vhsScore} v je v norme pre mačky (< 8.0 v). Silueta srdca nevykazuje známky kardiomegálie.`,
        clinicalInterpretationEn: `VHS ${vhsScore} v is within normal feline limits (< 8.0 v). No cardiomegaly detected.`,
      };
    }
    if (vhsScore <= 8.5) {
      return {
        longAxisVertebrae: lV,
        shortAxisVertebrae: sV,
        vhsScore,
        species,
        breed,
        status: "borderline",
        statusLabelSk: "Hraničná kardiomegália",
        statusLabelEn: "Borderline cardiomegaly",
        referenceRange,
        clinicalInterpretationSk: `VHS ${vhsScore} v je na hornej hranici normy pre mačky (8.0 – 8.5 v). Odporúča sa echokardiografické vyšetrenie (ECHO) na vylúčenie HCM.`,
        clinicalInterpretationEn: `VHS ${vhsScore} v is borderline for felines (8.0 - 8.5 v). Echocardiography recommended to rule out HCM.`,
      };
    }
    return {
      longAxisVertebrae: lV,
      shortAxisVertebrae: sV,
      vhsScore,
      species,
      breed,
      status: "cardiomegaly",
      statusLabelSk: "Kardiomegália (zväčšené srdce)",
      statusLabelEn: "Cardiomegaly",
      referenceRange,
      clinicalInterpretationSk: `VHS ${vhsScore} v indikuje signifikantné zväčšenie srdca u mačky (> 8.5 v). Riziko kongestívneho zlyhania srdca (CHF). Odporúčaná okamžitá kardiologická konzultácia.`,
      clinicalInterpretationEn: `VHS ${vhsScore} v indicates significant feline cardiomegaly (> 8.5 v). Risk of CHF. Immediate cardiology consult recommended.`,
    };
  }

  // Canine standard or breed-specific interval
  const breedRange = getReferenceRangeForBreed(breed);
  const isCustomBreed = Boolean(breed && breedRange !== BREED_SPECIFIC_VHS.standard_canine);
  const referenceRange = isCustomBreed
    ? `${breedRange.min} – ${breedRange.max} v (${breed})`
    : "8.5 – 10.5 v";

  if (vhsScore <= breedRange.max) {
    return {
      longAxisVertebrae: lV,
      shortAxisVertebrae: sV,
      vhsScore,
      species: "canine",
      breed,
      status: "normal",
      statusLabelSk: "Normálna veľkosť srdca",
      statusLabelEn: "Normal cardiac size",
      referenceRange,
      clinicalInterpretationSk: `VHS ${vhsScore} v je v referenčnom rozmedzí pre ${breed || "psov"} (${referenceRange}). Srdcová silueta je bez rádiologických známok kardiomegálie.`,
      clinicalInterpretationEn: `VHS ${vhsScore} v is within normal limits for ${breed || "canine"} (${referenceRange}). No radiographic cardiomegaly.`,
    };
  }
  if (vhsScore <= breedRange.borderlineMax) {
    return {
      longAxisVertebrae: lV,
      shortAxisVertebrae: sV,
      vhsScore,
      species: "canine",
      breed,
      status: "borderline",
      statusLabelSk: "Mierna / Hraničná kardiomegália",
      statusLabelEn: "Mild / Borderline cardiomegaly",
      referenceRange,
      clinicalInterpretationSk: `VHS ${vhsScore} v indikuje mierne zväčšenie srdcovej siluety pre ${breed || "psov"} (${referenceRange}). Indikované ECHO a kontrola NT-proBNP na posúdenie chlopňovej insuficiencie (MMVD).`,
      clinicalInterpretationEn: `VHS ${vhsScore} v indicates mild cardiac enlargement for ${breed || "canine"} (${referenceRange}). Echocardiography and NT-proBNP indicated to stage MMVD.`,
    };
  }
  return {
    longAxisVertebrae: lV,
    shortAxisVertebrae: sV,
    vhsScore,
    species: "canine",
    breed,
    status: "cardiomegaly",
    statusLabelSk: "Výrazná kardiomegália",
    statusLabelEn: "Marked cardiomegaly",
    referenceRange,
    clinicalInterpretationSk: `VHS ${vhsScore} v predstavuje signifikantnú kardiomegáliu pre ${breed || "psov"} (> ${breedRange.borderlineMax} v). Vysoké riziko dekompenzácie a pľúcneho edému. Odporúčaná liečba podľa ACVIM guidelinov (Pimobendan, ACE inhibítory).`,
    clinicalInterpretationEn: `VHS ${vhsScore} v indicates marked cardiomegaly for ${breed || "canine"} (> ${breedRange.borderlineMax} v). High risk of pulmonary edema. ACVIM staging therapy recommended.`,
  };
}
