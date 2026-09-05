/**
 * Veterinary Laboratory Analyzer Parser & Reference Ranges
 * Supports IDEXX (Catalyst/ProCyte), Fuji Dri-Chem, Mindray (BC-Vet), and generic CSV.
 * Slovak veterinary standards (ŠVPS SR) for canine and feline species.
 */

export type SpeciesType = "canine" | "feline" | "other";

export type ResultFlag = "NORMAL" | "LOW" | "HIGH" | "CRITICAL";

export interface LabAnalyteResult {
  code: string;
  name: string;
  value: number;
  valueString?: string;
  unit: string;
  refLow?: number | null;
  refHigh?: number | null;
  flag: ResultFlag;
  category?: "BIOCHEMISTRY" | "HEMATOLOGY" | "ELECTROLYTES" | "OTHER";
}

export interface ReferenceRange {
  name: string;
  unit: string;
  category: "BIOCHEMISTRY" | "HEMATOLOGY" | "ELECTROLYTES" | "OTHER";
  canine: { low: number; high: number; criticalLow?: number; criticalHigh?: number };
  feline: { low: number; high: number; criticalLow?: number; criticalHigh?: number };
}

export const REFERENCE_RANGES: Record<string, ReferenceRange> = {
  // --- BIOCHEMISTRY ---
  ALT: {
    name: "Alanínaminotransferáza",
    unit: "U/L",
    category: "BIOCHEMISTRY",
    canine: { low: 10, high: 100, criticalHigh: 500 },
    feline: { low: 12, high: 130, criticalHigh: 500 },
  },
  AST: {
    name: "Aspartátaminotransferáza",
    unit: "U/L",
    category: "BIOCHEMISTRY",
    canine: { low: 0, high: 50, criticalHigh: 300 },
    feline: { low: 0, high: 48, criticalHigh: 300 },
  },
  ALP: {
    name: "Alkalická fosfatáza",
    unit: "U/L",
    category: "BIOCHEMISTRY",
    canine: { low: 23, high: 212, criticalHigh: 800 },
    feline: { low: 14, high: 111, criticalHigh: 400 },
  },
  GGT: {
    name: "Gamaglutamyltransferáza",
    unit: "U/L",
    category: "BIOCHEMISTRY",
    canine: { low: 0, high: 7, criticalHigh: 30 },
    feline: { low: 0, high: 5, criticalHigh: 25 },
  },
  UREA: {
    name: "Močovina (Urea)",
    unit: "mmol/L",
    category: "BIOCHEMISTRY",
    canine: { low: 2.5, high: 9.6, criticalHigh: 30.0 },
    feline: { low: 5.7, high: 12.9, criticalHigh: 35.0 },
  },
  BUN: {
    name: "Močovinový dusík (BUN)",
    unit: "mmol/L",
    category: "BIOCHEMISTRY",
    canine: { low: 2.5, high: 9.6, criticalHigh: 30.0 },
    feline: { low: 5.7, high: 12.9, criticalHigh: 35.0 },
  },
  CREA: {
    name: "Kreatinín",
    unit: "µmol/L",
    category: "BIOCHEMISTRY",
    canine: { low: 44, high: 159, criticalHigh: 440 },
    feline: { low: 71, high: 212, criticalHigh: 440 },
  },
  GLU: {
    name: "Glukóza",
    unit: "mmol/L",
    category: "BIOCHEMISTRY",
    canine: { low: 3.3, high: 6.5, criticalLow: 2.2, criticalHigh: 22.0 },
    feline: { low: 3.8, high: 8.3, criticalLow: 2.2, criticalHigh: 25.0 },
  },
  TBIL: {
    name: "Celkový bilirubín",
    unit: "µmol/L",
    category: "BIOCHEMISTRY",
    canine: { low: 0, high: 6.8, criticalHigh: 35.0 },
    feline: { low: 0, high: 6.8, criticalHigh: 35.0 },
  },
  TP: {
    name: "Celkové bielkoviny",
    unit: "g/L",
    category: "BIOCHEMISTRY",
    canine: { low: 52, high: 82, criticalLow: 35, criticalHigh: 100 },
    feline: { low: 57, high: 89, criticalLow: 40, criticalHigh: 110 },
  },
  ALB: {
    name: "Albumín",
    unit: "g/L",
    category: "BIOCHEMISTRY",
    canine: { low: 23, high: 40, criticalLow: 15 },
    feline: { low: 22, high: 40, criticalLow: 15 },
  },
  GLOB: {
    name: "Globulíny",
    unit: "g/L",
    category: "BIOCHEMISTRY",
    canine: { low: 25, high: 45, criticalHigh: 65 },
    feline: { low: 28, high: 51, criticalHigh: 75 },
  },
  AMYL: {
    name: "Amyláza",
    unit: "U/L",
    category: "BIOCHEMISTRY",
    canine: { low: 500, high: 1500, criticalHigh: 3000 },
    feline: { low: 500, high: 1500, criticalHigh: 3000 },
  },
  LIPA: {
    name: "Lipáza",
    unit: "U/L",
    category: "BIOCHEMISTRY",
    canine: { low: 100, high: 1400, criticalHigh: 3000 },
    feline: { low: 0, high: 250, criticalHigh: 600 },
  },

  // --- ELECTROLYTES ---
  CA: {
    name: "Vápnik (Ca)",
    unit: "mmol/L",
    category: "ELECTROLYTES",
    canine: { low: 2.15, high: 2.95, criticalLow: 1.5, criticalHigh: 3.8 },
    feline: { low: 1.95, high: 2.83, criticalLow: 1.5, criticalHigh: 3.8 },
  },
  PHOS: {
    name: "Fosfor (P)",
    unit: "mmol/L",
    category: "ELECTROLYTES",
    canine: { low: 0.81, high: 2.19, criticalHigh: 3.5 },
    feline: { low: 1.00, high: 2.42, criticalHigh: 3.5 },
  },
  NA: {
    name: "Sodík (Na)",
    unit: "mmol/L",
    category: "ELECTROLYTES",
    canine: { low: 144, high: 160, criticalLow: 125, criticalHigh: 175 },
    feline: { low: 150, high: 165, criticalLow: 130, criticalHigh: 180 },
  },
  K: {
    name: "Draslík (K)",
    unit: "mmol/L",
    category: "ELECTROLYTES",
    canine: { low: 3.5, high: 5.8, criticalLow: 2.8, criticalHigh: 7.0 },
    feline: { low: 3.5, high: 5.8, criticalLow: 2.8, criticalHigh: 7.0 },
  },
  CL: {
    name: "Chloridy (Cl)",
    unit: "mmol/L",
    category: "ELECTROLYTES",
    canine: { low: 109, high: 122 },
    feline: { low: 112, high: 129 },
  },

  // --- HEMATOLOGY ---
  RBC: {
    name: "Erytrocyty (RBC)",
    unit: "10^12/L",
    category: "HEMATOLOGY",
    canine: { low: 5.5, high: 8.5, criticalLow: 2.5 },
    feline: { low: 5.0, high: 10.0, criticalLow: 2.5 },
  },
  HGB: {
    name: "Hemoglobín (Hgb)",
    unit: "g/L",
    category: "HEMATOLOGY",
    canine: { low: 120, high: 180, criticalLow: 60 },
    feline: { low: 80, high: 150, criticalLow: 50 },
  },
  HCT: {
    name: "Hematokrit (HCT)",
    unit: "%",
    category: "HEMATOLOGY",
    canine: { low: 37, high: 55, criticalLow: 18, criticalHigh: 65 },
    feline: { low: 24, high: 45, criticalLow: 14, criticalHigh: 55 },
  },
  MCV: {
    name: "Stredný objem erytrocytu (MCV)",
    unit: "fL",
    category: "HEMATOLOGY",
    canine: { low: 60, high: 77 },
    feline: { low: 39, high: 55 },
  },
  WBC: {
    name: "Leukocyty (WBC)",
    unit: "10^9/L",
    category: "HEMATOLOGY",
    canine: { low: 6.0, high: 17.0, criticalLow: 2.5, criticalHigh: 35.0 },
    feline: { low: 5.5, high: 19.5, criticalLow: 2.5, criticalHigh: 35.0 },
  },
  PLT: {
    name: "Trombocyty (PLT)",
    unit: "10^9/L",
    category: "HEMATOLOGY",
    canine: { low: 175, high: 500, criticalLow: 40 },
    feline: { low: 175, high: 600, criticalLow: 40 },
  },
};

/**
 * Priradí flag (NORMAL, LOW, HIGH, CRITICAL) hodnote parametra podľa referenčného rozsahu.
 */
export function evaluateResultFlag(
  code: string,
  value: number,
  species: SpeciesType = "canine",
  customLow?: number | null,
  customHigh?: number | null
): ResultFlag {
  const normCode = code.trim().toUpperCase();
  const ref = REFERENCE_RANGES[normCode];

  let low = customLow ?? (ref ? (species === "feline" ? ref.feline.low : ref.canine.low) : null);
  let high = customHigh ?? (ref ? (species === "feline" ? ref.feline.high : ref.canine.high) : null);
  let critLow = ref ? (species === "feline" ? ref.feline.criticalLow : ref.canine.criticalLow) : undefined;
  let critHigh = ref ? (species === "feline" ? ref.feline.criticalHigh : ref.canine.criticalHigh) : undefined;

  if (critLow != null && value <= critLow) return "CRITICAL";
  if (critHigh != null && value >= critHigh) return "CRITICAL";

  if (low != null && value < low) return "LOW";
  if (high != null && value > high) return "HIGH";

  return "NORMAL";
}

/**
 * Parser výstupov IDEXX (Catalyst / ProCyte / VetTest)
 * Formát: Tabulkový alebo čiarkový export s kľúčovými stĺpcami.
 */
export function parseIdexx(rawText: string, species: SpeciesType = "canine"): LabAnalyteResult[] {
  const results: LabAnalyteResult[] = [];
  const lines = rawText.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.toLowerCase().startsWith("test") || trimmed.toLowerCase().startsWith("analyte")) {
      continue;
    }

    // Split by tab or comma
    const parts = line.includes("\t") ? line.split("\t") : line.split(",");
    if (parts.length < 2) continue;

    const rawCode = parts[0].trim().replace(/['"]/g, "");
    const code = rawCode.toUpperCase();
    const rawVal = parts[1].trim().replace(/['"]/g, "").replace(",", ".");
    const val = parseFloat(rawVal);

    if (isNaN(val)) continue;

    const ref = REFERENCE_RANGES[code];
    let unit = parts[2]?.trim().replace(/['"]/g, "") || ref?.unit || "";
    let customLow: number | null = null;
    let customHigh: number | null = null;

    if (parts.length >= 4) {
      const lowVal = parseFloat(parts[3].trim().replace(/['"]/g, "").replace(",", "."));
      if (!isNaN(lowVal)) customLow = lowVal;
    }
    if (parts.length >= 5) {
      const highVal = parseFloat(parts[4].trim().replace(/['"]/g, "").replace(",", "."));
      if (!isNaN(highVal)) customHigh = highVal;
    }

    const flag = evaluateResultFlag(code, val, species, customLow, customHigh);

    results.push({
      code,
      name: ref?.name ?? rawCode,
      value: val,
      valueString: rawVal,
      unit,
      refLow: customLow ?? (ref ? (species === "feline" ? ref.feline.low : ref.canine.low) : null),
      refHigh: customHigh ?? (ref ? (species === "feline" ? ref.feline.high : ref.canine.high) : null),
      flag,
      category: ref?.category ?? "OTHER",
    });
  }

  return results;
}

/**
 * Parser výstupov Fuji Dri-Chem (NX500i / NX700)
 * Formát: CSV export s názvom položky, hodnotou, jednotkou a rozsahom.
 */
export function parseFujiDriChem(rawText: string, species: SpeciesType = "canine"): LabAnalyteResult[] {
  const results: LabAnalyteResult[] = [];
  const lines = rawText.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("Item") || trimmed.startsWith("Test")) continue;

    const parts = trimmed.split(/[,;]/);
    if (parts.length < 2) continue;

    const rawCode = parts[0].trim().replace(/['"]/g, "");
    const code = rawCode.toUpperCase();
    const rawVal = parts[1].trim().replace(/['"]/g, "").replace(",", ".");
    const val = parseFloat(rawVal);
    if (isNaN(val)) continue;

    const ref = REFERENCE_RANGES[code];
    const unit = parts[2]?.trim().replace(/['"]/g, "") || ref?.unit || "";

    let customLow: number | null = null;
    let customHigh: number | null = null;

    if (parts.length >= 4) {
      const pLow = parseFloat(parts[3].trim().replace(",", "."));
      if (!isNaN(pLow)) customLow = pLow;
    }
    if (parts.length >= 5) {
      const pHigh = parseFloat(parts[4].trim().replace(",", "."));
      if (!isNaN(pHigh)) customHigh = pHigh;
    }

    const flag = evaluateResultFlag(code, val, species, customLow, customHigh);

    results.push({
      code,
      name: ref?.name ?? rawCode,
      value: val,
      valueString: rawVal,
      unit,
      refLow: customLow ?? (ref ? (species === "feline" ? ref.feline.low : ref.canine.low) : null),
      refHigh: customHigh ?? (ref ? (species === "feline" ? ref.feline.high : ref.canine.high) : null),
      flag,
      category: ref?.category ?? "BIOCHEMISTRY",
    });
  }

  return results;
}

/**
 * Parser hematologických analyzátorov Mindray (BC-2800Vet / BC-5000Vet)
 */
export function parseMindray(rawText: string, species: SpeciesType = "canine"): LabAnalyteResult[] {
  const results: LabAnalyteResult[] = [];
  const lines = rawText.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("Parameter") || trimmed.startsWith("---")) continue;

    // Mindray prints: PARAMETER  VALUE  [FLAG]  UNIT  [REF_LOW - REF_HIGH]
    const parts = trimmed.split(/\s{2,}|[,;\t]/).filter(Boolean);
    if (parts.length < 2) continue;

    const rawCode = parts[0].trim();
    const code = rawCode.toUpperCase();
    const rawVal = parts[1].trim().replace(",", ".");
    const val = parseFloat(rawVal);
    if (isNaN(val)) continue;

    const ref = REFERENCE_RANGES[code];
    let unit = ref?.unit || "";
    let customLow: number | null = null;
    let customHigh: number | null = null;

    // Search for range like "6.0-17.0"
    const rangeMatch = trimmed.match(/(\d+[\.,]?\d*)\s*[-–]\s*(\d+[\.,]?\d*)/);
    if (rangeMatch) {
      customLow = parseFloat(rangeMatch[1].replace(",", "."));
      customHigh = parseFloat(rangeMatch[2].replace(",", "."));
    }

    const flag = evaluateResultFlag(code, val, species, customLow, customHigh);

    results.push({
      code,
      name: ref?.name ?? rawCode,
      value: val,
      valueString: rawVal,
      unit,
      refLow: customLow ?? (ref ? (species === "feline" ? ref.feline.low : ref.canine.low) : null),
      refHigh: customHigh ?? (ref ? (species === "feline" ? ref.feline.high : ref.canine.high) : null),
      flag,
      category: "HEMATOLOGY",
    });
  }

  return results;
}

/**
 * Automatická detekcia a parser ľubovoľného laboratórneho súboru
 */
export function autoDetectAndParse(params: {
  content: string;
  filename?: string;
  species?: SpeciesType;
}): {
  analyzerType: "IDEXX" | "FUJI_DRI_CHEM" | "MINDRAY" | "GENERIC_CSV";
  deviceModel?: string;
  results: LabAnalyteResult[];
  abnormalCount: number;
  criticalCount: number;
} {
  const { content, filename = "", species = "canine" } = params;
  const lower = content.toLowerCase();
  const lowerFilename = filename.toLowerCase();

  let analyzerType: "IDEXX" | "FUJI_DRI_CHEM" | "MINDRAY" | "GENERIC_CSV" = "GENERIC_CSV";
  let deviceModel: string | undefined;
  let results: LabAnalyteResult[] = [];

  if (lower.includes("idexx") || lower.includes("catalyst") || lower.includes("procyte") || lowerFilename.includes("idexx")) {
    analyzerType = "IDEXX";
    deviceModel = lower.includes("procyte") ? "ProCyte Dx" : "Catalyst One";
    results = parseIdexx(content, species);
  } else if (lower.includes("fuji") || lower.includes("dri-chem") || lowerFilename.includes("fuji")) {
    analyzerType = "FUJI_DRI_CHEM";
    deviceModel = "Fuji Dri-Chem NX500i";
    results = parseFujiDriChem(content, species);
  } else if (lower.includes("mindray") || lower.includes("bc-") || lowerFilename.includes("mindray")) {
    analyzerType = "MINDRAY";
    deviceModel = "Mindray BC-Vet";
    results = parseMindray(content, species);
  } else {
    // Fallback IDEXX / CSV parser
    results = parseIdexx(content, species);
    if (results.length === 0) {
      results = parseFujiDriChem(content, species);
    }
  }

  const abnormalCount = results.filter((r) => r.flag === "HIGH" || r.flag === "LOW" || r.flag === "CRITICAL").length;
  const criticalCount = results.filter((r) => r.flag === "CRITICAL").length;

  return {
    analyzerType,
    deviceModel,
    results,
    abnormalCount,
    criticalCount,
  };
}
