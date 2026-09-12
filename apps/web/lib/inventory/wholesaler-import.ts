/**
 * Slovak Veterinary Wholesale Drug & Material Distributors Parser
 * 
 * Supports automated delivery note (dodací list) import from key Slovak distributors:
 * - Pharmos a.s. (CSV / EDI)
 * - Cymedica SK (veterinary pharmaceuticals with lot/batch tracking and expiry)
 * - Samohýl SK (veterinary goods, diets & consumables with EAN)
 * - Henry Schein SK (surgical instruments, dental & medical consumables)
 * - Standard Slovak EDI / CSV
 */

export type WholesalerType = "CYMEDICA" | "PHARMOS" | "SAMOHYL" | "HENRY_SCHEIN" | "GENERIC_CSV";

export interface WholesalerDeliveryItem {
  sku?: string;
  name: string;
  ean?: string;
  suklOrAdcCode?: string;
  batchNumber?: string;
  expirationDate?: string; // YYYY-MM-DD
  quantity: number;
  unit: string;
  unitPriceWithoutVat: number;
  vatRate: number; // e.g. 10 or 20
  totalWithoutVat: number;
  totalWithVat: number;
  isControlledSubstance?: boolean;
}

export interface WholesalerDeliveryNote {
  wholesaler: WholesalerType;
  deliveryNoteNumber: string;
  issueDate: string; // YYYY-MM-DD
  supplierName: string;
  supplierIco: string;
  customerName?: string;
  customerIco?: string;
  items: WholesalerDeliveryItem[];
  totalWithoutVat: number;
  totalVat: number;
  totalWithVat: number;
}

export interface ParseDeliveryNoteOptions {
  content: string;
  wholesaler?: WholesalerType;
  filename?: string;
}

/**
 * Splits a CSV line by appropriate delimiter while preserving decimal commas.
 */
function splitCsvLine(line: string): string[] {
  const delimiter = line.includes(";") ? ";" : line.includes("\t") ? "\t" : ",";
  return line.split(delimiter).map((c) => c.trim().replace(/^"/, "").replace(/"$/, ""));
}

/**
 * Parses numeric value supporting both comma (14,50) and dot (14.50) decimal separators.
 */
function parseSlovakNumber(val?: string): number {
  if (!val) return 0;
  const cleaned = val.replace(/\s+/g, "").replace(",", ".");
  return parseFloat(cleaned) || 0;
}

/**
 * Auto-detects wholesaler and parses delivery note CSV or text content.
 */
export function parseWholesalerDeliveryNote(options: ParseDeliveryNoteOptions): WholesalerDeliveryNote {
  const lines = options.content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const detectedWholesaler = options.wholesaler || detectWholesaler(options.content, options.filename);

  switch (detectedWholesaler) {
    case "CYMEDICA":
      return parseCymedica(lines);
    case "PHARMOS":
      return parsePharmos(lines);
    case "SAMOHYL":
      return parseSamohyl(lines);
    case "HENRY_SCHEIN":
      return parseHenrySchein(lines);
    case "GENERIC_CSV":
    default:
      return parseGenericCsv(lines);
  }
}

function detectWholesaler(content: string, filename?: string): WholesalerType {
  const upper = content.toUpperCase();
  const fnUpper = (filename || "").toUpperCase();

  if (upper.includes("CYMEDICA") || fnUpper.includes("CYMEDICA")) {
    return "CYMEDICA";
  }
  if (upper.includes("PHARMOS") || fnUpper.includes("PHARMOS")) {
    return "PHARMOS";
  }
  if (upper.includes("SAMOHYL") || upper.includes("SAMOHÝL") || fnUpper.includes("SAMOHYL")) {
    return "SAMOHYL";
  }
  if (upper.includes("HENRY SCHEIN") || upper.includes("SCHEIN") || fnUpper.includes("SCHEIN")) {
    return "HENRY_SCHEIN";
  }
  return "GENERIC_CSV";
}

function parseCymedica(lines: string[]): WholesalerDeliveryNote {
  const items: WholesalerDeliveryItem[] = [];
  let docNumber = `CYM-${Date.now().toString().slice(-6)}`;
  const issueDate = new Date().toISOString().slice(0, 10);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.includes("Dodací list") || line.includes("Faktúra")) {
      const match = line.match(/\d{7,12}/);
      if (match) {
        docNumber = match[0];
      }
    }

    if (line.startsWith("#") || line.startsWith("//")) continue;

    const cols = splitCsvLine(line);
    if (cols.length < 5) continue;

    // Header check
    if (cols[0].toLowerCase().includes("kod") || cols[1]?.toLowerCase().includes("nazov")) {
      continue;
    }

    const sku = cols[0];
    const name = cols[1];
    const batch = cols[2] || undefined;
    const exp = parseDate(cols[3]);
    const qty = parseSlovakNumber(cols[4]) || 1;
    const unit = cols[5] || "ks";
    const price = parseSlovakNumber(cols[6]);
    const vatRate = parseInt(cols[7], 10) || 10;
    const totalWithoutVat = Math.round(qty * price * 100) / 100;
    const totalWithVat = Math.round(totalWithoutVat * (1 + vatRate / 100) * 100) / 100;

    items.push({
      sku,
      name,
      batchNumber: batch,
      expirationDate: exp,
      quantity: qty,
      unit,
      unitPriceWithoutVat: price,
      vatRate,
      totalWithoutVat,
      totalWithVat,
    });
  }

  const sumWithoutVat = items.reduce((acc, it) => acc + it.totalWithoutVat, 0);
  const sumWithVat = items.reduce((acc, it) => acc + it.totalWithVat, 0);

  return {
    wholesaler: "CYMEDICA",
    deliveryNoteNumber: docNumber,
    issueDate,
    supplierName: "CYMEDICA SK s.r.o.",
    supplierIco: "36245842",
    items,
    totalWithoutVat: Math.round(sumWithoutVat * 100) / 100,
    totalVat: Math.round((sumWithVat - sumWithoutVat) * 100) / 100,
    totalWithVat: Math.round(sumWithVat * 100) / 100,
  };
}

function parsePharmos(lines: string[]): WholesalerDeliveryNote {
  const items: WholesalerDeliveryItem[] = [];
  let docNumber = `PH-${Date.now().toString().slice(-6)}`;
  const issueDate = new Date().toISOString().slice(0, 10);

  for (const line of lines) {
    if (line.includes("Dodací list") || line.includes("Faktúra")) {
      const match = line.match(/\d{7,12}/);
      if (match) docNumber = match[0];
    }
    if (line.startsWith("#")) continue;

    const cols = splitCsvLine(line);
    if (cols.length < 5) continue;
    if (cols[0].toLowerCase().includes("kod") || cols[1]?.toLowerCase().includes("nazov")) continue;

    const sku = cols[0];
    const name = cols[1];
    const batch = cols[2];
    const exp = parseDate(cols[3]);
    const qty = parseSlovakNumber(cols[4]) || 1;
    const price = parseSlovakNumber(cols[5]);
    const vatRate = parseInt(cols[6], 10) || 10;
    const totalWithoutVat = Math.round(qty * price * 100) / 100;
    const totalWithVat = Math.round(totalWithoutVat * (1 + vatRate / 100) * 100) / 100;

    items.push({
      sku,
      name,
      batchNumber: batch,
      expirationDate: exp,
      quantity: qty,
      unit: "bal",
      unitPriceWithoutVat: price,
      vatRate,
      totalWithoutVat,
      totalWithVat,
    });
  }

  const sumWithoutVat = items.reduce((acc, it) => acc + it.totalWithoutVat, 0);
  const sumWithVat = items.reduce((acc, it) => acc + it.totalWithVat, 0);

  return {
    wholesaler: "PHARMOS",
    deliveryNoteNumber: docNumber,
    issueDate,
    supplierName: "PHARMOS a.s.",
    supplierIco: "35974871",
    items,
    totalWithoutVat: Math.round(sumWithoutVat * 100) / 100,
    totalVat: Math.round((sumWithVat - sumWithoutVat) * 100) / 100,
    totalWithVat: Math.round(sumWithVat * 100) / 100,
  };
}

function parseSamohyl(lines: string[]): WholesalerDeliveryNote {
  const items: WholesalerDeliveryItem[] = [];
  const docNumber = `SAM-${Date.now().toString().slice(-6)}`;
  const issueDate = new Date().toISOString().slice(0, 10);

  for (const line of lines) {
    if (line.startsWith("#")) continue;
    const cols = splitCsvLine(line);
    if (cols.length < 4) continue;
    if (cols[0].toLowerCase().includes("ean") || cols[1]?.toLowerCase().includes("nazov")) continue;

    const ean = /^\d{8,14}$/.test(cols[0]) ? cols[0] : undefined;
    const name = cols[1] || cols[0];
    const qty = parseSlovakNumber(cols[2]) || 1;
    const price = parseSlovakNumber(cols[3]);
    const vatRate = 20;
    const totalWithoutVat = Math.round(qty * price * 100) / 100;
    const totalWithVat = Math.round(totalWithoutVat * 1.2 * 100) / 100;

    items.push({
      ean,
      name,
      quantity: qty,
      unit: "ks",
      unitPriceWithoutVat: price,
      vatRate,
      totalWithoutVat,
      totalWithVat,
    });
  }

  const sumWithoutVat = items.reduce((acc, it) => acc + it.totalWithoutVat, 0);
  const sumWithVat = items.reduce((acc, it) => acc + it.totalWithVat, 0);

  return {
    wholesaler: "SAMOHYL",
    deliveryNoteNumber: docNumber,
    issueDate,
    supplierName: "SAMOHÝL SK, s.r.o.",
    supplierIco: "36329485",
    items,
    totalWithoutVat: Math.round(sumWithoutVat * 100) / 100,
    totalVat: Math.round((sumWithVat - sumWithoutVat) * 100) / 100,
    totalWithVat: Math.round(sumWithVat * 100) / 100,
  };
}

function parseHenrySchein(lines: string[]): WholesalerDeliveryNote {
  const items: WholesalerDeliveryItem[] = [];
  const docNumber = `HS-${Date.now().toString().slice(-6)}`;
  const issueDate = new Date().toISOString().slice(0, 10);

  for (const line of lines) {
    if (line.startsWith("#")) continue;
    const cols = splitCsvLine(line);
    if (cols.length < 4) continue;
    if (cols[0].toLowerCase().includes("item") || cols[1]?.toLowerCase().includes("desc")) continue;

    const sku = cols[0];
    const name = cols[1];
    const qty = parseSlovakNumber(cols[2]) || 1;
    const price = parseSlovakNumber(cols[3]);
    const vatRate = 20;
    const totalWithoutVat = Math.round(qty * price * 100) / 100;
    const totalWithVat = Math.round(totalWithoutVat * 1.2 * 100) / 100;

    items.push({
      sku,
      name,
      quantity: qty,
      unit: "ks",
      unitPriceWithoutVat: price,
      vatRate,
      totalWithoutVat,
      totalWithVat,
    });
  }

  const sumWithoutVat = items.reduce((acc, it) => acc + it.totalWithoutVat, 0);
  const sumWithVat = items.reduce((acc, it) => acc + it.totalWithVat, 0);

  return {
    wholesaler: "HENRY_SCHEIN",
    deliveryNoteNumber: docNumber,
    issueDate,
    supplierName: "Henry Schein Dental / Veterinary",
    supplierIco: "45982103",
    items,
    totalWithoutVat: Math.round(sumWithoutVat * 100) / 100,
    totalVat: Math.round((sumWithVat - sumWithoutVat) * 100) / 100,
    totalWithVat: Math.round(sumWithVat * 100) / 100,
  };
}

function parseGenericCsv(lines: string[]): WholesalerDeliveryNote {
  const items: WholesalerDeliveryItem[] = [];
  const docNumber = `DL-${Date.now().toString().slice(-6)}`;
  const issueDate = new Date().toISOString().slice(0, 10);

  for (const line of lines) {
    if (line.startsWith("#")) continue;
    const cols = splitCsvLine(line);
    if (cols.length < 3) continue;
    if (cols[0].toLowerCase().includes("nazov") || cols[0].toLowerCase().includes("name")) continue;

    const name = cols[0];
    const qty = parseSlovakNumber(cols[1]) || 1;
    const price = parseSlovakNumber(cols[2]);
    const vatRate = parseInt(cols[3], 10) || 20;
    const totalWithoutVat = Math.round(qty * price * 100) / 100;
    const totalWithVat = Math.round(totalWithoutVat * (1 + vatRate / 100) * 100) / 100;

    items.push({
      name,
      quantity: qty,
      unit: "ks",
      unitPriceWithoutVat: price,
      vatRate,
      totalWithoutVat,
      totalWithVat,
    });
  }

  const sumWithoutVat = items.reduce((acc, it) => acc + it.totalWithoutVat, 0);
  const sumWithVat = items.reduce((acc, it) => acc + it.totalWithVat, 0);

  return {
    wholesaler: "GENERIC_CSV",
    deliveryNoteNumber: docNumber,
    issueDate,
    supplierName: "Všeobecný dodávateľ",
    supplierIco: "",
    items,
    totalWithoutVat: Math.round(sumWithoutVat * 100) / 100,
    totalVat: Math.round((sumWithVat - sumWithoutVat) * 100) / 100,
    totalWithVat: Math.round(sumWithVat * 100) / 100,
  };
}

function parseDate(val?: string): string | undefined {
  if (!val) return undefined;
  const dmyMatch = val.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
    return val;
  }
  return undefined;
}
