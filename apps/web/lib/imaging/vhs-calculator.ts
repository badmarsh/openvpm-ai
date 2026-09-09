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

export interface VhsResult {
  longAxisVertebrae: number;
  shortAxisVertebrae: number;
  vhsScore: number;
  species: VhsSpecies;
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
}): VhsResult {
  const { longAxisMm, shortAxisMm, t4VertebraLengthMm, species = "canine" } = params;

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
      status: "cardiomegaly",
      statusLabelSk: "Kardiomegália (zväčšené srdce)",
      statusLabelEn: "Cardiomegaly",
      referenceRange,
      clinicalInterpretationSk: `VHS ${vhsScore} v indikuje signifikantné zväčšenie srdca u mačky (> 8.5 v). Riziko kongestívneho zlyhania srdca (CHF). Odporúčaná okamžitá kardiologická konzultácia.`,
      clinicalInterpretationEn: `VHS ${vhsScore} v indicates significant feline cardiomegaly (> 8.5 v). Risk of CHF. Immediate cardiology consult recommended.`,
    };
  }

  // Canine standard (Buchanan)
  const referenceRange = "8.5 – 10.5 v";
  if (vhsScore <= 10.5) {
    return {
      longAxisVertebrae: lV,
      shortAxisVertebrae: sV,
      vhsScore,
      species: "canine",
      status: "normal",
      statusLabelSk: "Normálna veľkosť srdca",
      statusLabelEn: "Normal cardiac size",
      referenceRange,
      clinicalInterpretationSk: `VHS ${vhsScore} v je v referenčnom rozmedzí pre psov (8.5 – 10.5 v). Srdcová silueta je bez rádiologických známok kardiomegálie.`,
      clinicalInterpretationEn: `VHS ${vhsScore} v is within normal canine limits (8.5 - 10.5 v). No radiographic cardiomegaly.`,
    };
  }
  if (vhsScore <= 11.5) {
    return {
      longAxisVertebrae: lV,
      shortAxisVertebrae: sV,
      vhsScore,
      species: "canine",
      status: "borderline",
      statusLabelSk: "Mierna / Hraničná kardiomegália",
      statusLabelEn: "Mild / Borderline cardiomegaly",
      referenceRange,
      clinicalInterpretationSk: `VHS ${vhsScore} v indikuje mierne zväčšenie srdcovej siluety (10.6 – 11.5 v). Indikované ECHO a kontrola NT-proBNP na posúdenie chlopňovej insuficiencie (MMVD).`,
      clinicalInterpretationEn: `VHS ${vhsScore} v indicates mild cardiac enlargement (10.6 - 11.5 v). Echocardiography and NT-proBNP indicated to stage MMVD.`,
    };
  }
  return {
    longAxisVertebrae: lV,
    shortAxisVertebrae: sV,
    vhsScore,
    species: "canine",
    status: "cardiomegaly",
    statusLabelSk: "Výrazná kardiomegália",
    statusLabelEn: "Marked cardiomegaly",
    referenceRange,
    clinicalInterpretationSk: `VHS ${vhsScore} v predstavuje signifikantnú kardiomegáliu (> 11.5 v). Vysoké riziko dekompenzácie a pľúcneho edému. Odporúčaná liečba podľa ACVIM guidelinov (Pimobendan, ACE inhibítory).`,
    clinicalInterpretationEn: `VHS ${vhsScore} v indicates marked cardiomegaly (> 11.5 v). High risk of pulmonary edema. ACVIM staging therapy recommended.`,
  };
}
