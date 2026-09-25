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

export type WholesalerType =
  | "CYMEDICA"
  | "PHARMOS"
  | "SAMOHYL"
  | "HENRY_SCHEIN"
  | "BIOPHARM"
  | "KOMVET"
  | "SG_VET"
  | "SANVET"
  | "PHRAMED"
  | "PHARMACOPOLA"
  | "TOPVET"
  | "GENERIC_CSV";

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
  vatRate: number; // e.g. 5, 19 or 23; retain explicit historical/zero rates
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

import { isControlledSubstanceName } from "@/lib/controlled-substances/policy";

/**
 * Splits a CSV line by appropriate delimiter while preserving decimal commas.
 * Tab is prioritized when present, or an explicit preferred delimiter can be supplied.
 */
function splitCsvLine(line: string, preferredDelimiter?: string): string[] {
  const delimiter =
    preferredDelimiter ||
    (line.includes("\t") ? "\t" : line.includes(";") ? ";" : ",");
  return line.split(delimiter).map((c) => c.trim().replace(/^"/, "").replace(/"$/, ""));
}

/** Preserve explicit zero and historical tax rates; use the current standard rate when absent. */
function parseVatRate(value: string | undefined, fallback = 23): number {
  if (!value?.trim()) return fallback;
  const rate = Number(value.trim().replace(",", "."));
  return Number.isFinite(rate) && rate >= 0 && rate <= 100 ? rate : fallback;
}

/** Parse decimal commas and Slovak thousands separators. */
function parseSlovakNumber(val?: string): number {
  if (!val) return 0;
  const compact = val.replace(/\s+/g, "");
  const cleaned = compact.includes(",") ? compact.replace(/\./g, "").replace(",", ".") : compact;
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
    case "BIOPHARM":
      return parseBiopharm(lines);
    case "KOMVET":
      return parseKomvet(lines);
    case "SG_VET":
      return parseSgVet(options.content);
    case "SANVET":
      return parseSanvet(lines);
    case "PHRAMED":
      return parsePhramed(lines);
    case "PHARMACOPOLA":
      return parsePharmacopolaText(lines);
    case "TOPVET":
      return parseTopvet(lines);
    case "GENERIC_CSV":
    default:
      return parseGenericCsv(lines);
  }
}

export function detectWholesaler(content: string, filename?: string): WholesalerType {
  const upper = content.toUpperCase();
  const fnUpper = (filename || "").toUpperCase();

  if (upper.includes("CYMEDICA") || fnUpper.includes("CYMEDICA")) {
    return "CYMEDICA";
  }
  if (upper.includes("PHARMOS") || fnUpper.includes("PHARMOS")) {
    return "PHARMOS";
  }
  if (upper.includes("SAMOHYL") || upper.includes("SAMOHÝL") || fnUpper.includes("SAMOHYL") || fnUpper.includes("SAMOHÝL")) {
    return "SAMOHYL";
  }
  if (upper.includes("HENRY SCHEIN") || upper.includes("SCHEIN") || fnUpper.includes("SCHEIN")) {
    return "HENRY_SCHEIN";
  }
  if (
    upper.includes("BIOPHARM") ||
    upper.includes("BFARM") ||
    fnUpper.includes("BIOPHARM") ||
    fnUpper.includes("BFARM")
  ) {
    return "BIOPHARM";
  }
  if (
    upper.includes("KOMVET") ||
    upper.includes("KOM VET") ||
    fnUpper.includes("KOMVET") ||
    fnUpper.includes("KOM VET") ||
    fnUpper.includes("KOM_VET") ||
    fnUpper.includes("KOM-VET")
  ) {
    return "KOMVET";
  }
  if (
    upper.includes("SG-VET") ||
    upper.includes("SGVET") ||
    upper.includes("SG VET") ||
    upper.includes("SG_VET") ||
    fnUpper.includes("SG-VET") ||
    fnUpper.includes("SGVET") ||
    fnUpper.includes("SG VET") ||
    fnUpper.includes("SG_VET")
  ) {
    return "SG_VET";
  }
  if (
    upper.includes("SANVET") ||
    upper.includes("SAN-VET") ||
    upper.includes("SAN_VET") ||
    fnUpper.includes("SANVET") ||
    fnUpper.includes("SAN-VET") ||
    fnUpper.includes("SAN_VET")
  ) {
    return "SANVET";
  }
  if (
    upper.includes("PHRAMED") ||
    upper.includes("PHARMED") ||
    fnUpper.includes("PHRAMED") ||
    fnUpper.includes("PHARMED")
  ) {
    return "PHRAMED";
  }
  if (
    upper.includes("PHARMACOPOLA") ||
    fnUpper.includes("PHARMACOPOLA") ||
    /^ZF[0-9]/.test(fnUpper)
  ) {
    return "PHARMACOPOLA";
  }
  if (upper.includes("TOPVET") || fnUpper.includes("TOPVET")) {
    return "TOPVET";
  }
  return "GENERIC_CSV";
}

function parseCymedica(lines: string[]): WholesalerDeliveryNote {
  // If text contains EUR and tab-separated prices, it's a Cymedica PDF invoice layout
  const isPdfLayout = lines.some((l) => l.includes("EUR") && l.includes("\t"));
  if (isPdfLayout) {
    return parseCymedicaPdf(lines);
  }
  return parseCymedicaCsv(lines);
}

function parseCymedicaPdf(lines: string[]): WholesalerDeliveryNote {
  const items: WholesalerDeliveryItem[] = [];
  let docNumber = `CYM-${Date.now().toString().slice(-6)}`;
  let issueDate = new Date().toISOString().slice(0, 10);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes("Dodací list") || line.includes("Faktúra")) {
      const match = line.match(/\d{7,12}/);
      if (match) {
        docNumber = match[0];
      } else if (i + 1 < lines.length) {
        const nextMatch = lines[i + 1].match(/\d{7,12}/);
        if (nextMatch) docNumber = nextMatch[0];
      }
    }

    const dtMatch = line.match(/Dátum vystavenia:\s*(\d{1,2})\.(\d{1,2})\.(\d{4})/i);
    if (dtMatch) {
      issueDate = `${dtMatch[3]}-${dtMatch[2].padStart(2, "0")}-${dtMatch[1].padStart(2, "0")}`;
    }

    if (!line.includes("EUR")) continue;
    const cols = line.split("\t");
    if (cols.length < 4) continue;
    const totalWithVat = parseSlovakNumber(cols[0]);
    const bezDphParts = cols[1].trim().split(/\s+/);
    const totalWithoutVat = parseSlovakNumber(bezDphParts[0]);
    const qty = parseSlovakNumber(cols[2].replace("EUR", ""));

    const rawName = cols[3].trim();
    let vatRate = 5;
    const nameMatch = rawName.match(/(.*?)\s+(\d{1,2})$/);
    let name = rawName;
    if (nameMatch) {
      name = nameMatch[1].trim();
      vatRate = parseInt(nameMatch[2], 10);
    }

    if (!name || name.toLowerCase().includes("dopravné")) continue;

    const unitPriceWithoutVat = qty ? Math.round((totalWithoutVat / qty) * 100) / 100 : 0;
    items.push({
      name,
      quantity: qty,
      unit: "ks",
      unitPriceWithoutVat,
      vatRate,
      totalWithoutVat,
      totalWithVat,
      isControlledSubstance: isControlledSubstanceName(name),
    });
  }

  const sumWithoutVat = items.reduce((acc, it) => acc + it.totalWithoutVat, 0);
  const sumWithVat = items.reduce((acc, it) => acc + it.totalWithVat, 0);

  return {
    wholesaler: "CYMEDICA",
    deliveryNoteNumber: docNumber,
    issueDate,
    supplierName: "CYMEDICA SK s.r.o.",
    supplierIco: "36031780",
    items,
    totalWithoutVat: Math.round(sumWithoutVat * 100) / 100,
    totalVat: Math.round((sumWithVat - sumWithoutVat) * 100) / 100,
    totalWithVat: Math.round(sumWithVat * 100) / 100,
  };
}

function parseCymedicaCsv(lines: string[]): WholesalerDeliveryNote {
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
    const rawBatch = cols[2]?.trim();
    const batch = rawBatch && rawBatch.length > 0 ? rawBatch : "BEZ-SARZE";
    const exp = parseDate(cols[3]);
    const qty = parseSlovakNumber(cols[4]) || 1;
    const unit = cols[5] || "ks";
    const price = parseSlovakNumber(cols[6]);
    const vatRate = parseVatRate(cols[7]);
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
      isControlledSubstance: isControlledSubstanceName(name),
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
    const rawBatch = cols[2]?.trim();
    const batch = rawBatch && rawBatch.length > 0 ? rawBatch : "BEZ-SARZE";
    const exp = parseDate(cols[3]);
    const qty = parseSlovakNumber(cols[4]) || 1;
    const price = parseSlovakNumber(cols[5]);
    const vatRate = parseVatRate(cols[6]);
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
      isControlledSubstance: isControlledSubstanceName(name),
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
    const vatRate = 23;
    const totalWithoutVat = Math.round(qty * price * 100) / 100;
    const totalWithVat = Math.round(totalWithoutVat * 1.2 * 100) / 100;

    items.push({
      ean,
      name,
      batchNumber: "BEZ-SARZE",
      quantity: qty,
      unit: "ks",
      unitPriceWithoutVat: price,
      vatRate,
      totalWithoutVat,
      totalWithVat,
      isControlledSubstance: isControlledSubstanceName(name),
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
    const vatRate = 23;
    const totalWithoutVat = Math.round(qty * price * 100) / 100;
    const totalWithVat = Math.round(totalWithoutVat * 1.2 * 100) / 100;

    items.push({
      sku,
      name,
      batchNumber: "BEZ-SARZE",
      quantity: qty,
      unit: "ks",
      unitPriceWithoutVat: price,
      vatRate,
      totalWithoutVat,
      totalWithVat,
      isControlledSubstance: isControlledSubstanceName(name),
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

/**
 * Shared parser for the standard Slovak distributor delivery note CSV layout:
 *   SKU | NÁZOV | ŠARŽA | EXPIRÁCIA | KS | J.CENA | DPH%
 */
function parseStandardDeliveryLines(
  lines: string[],
  wholesaler: WholesalerType,
  supplierName: string,
  docPrefix: string,
  preferredDelimiter?: string
): WholesalerDeliveryNote {
  const items: WholesalerDeliveryItem[] = [];
  let docNumber = `${docPrefix}-${Date.now().toString().slice(-6)}`;
  const issueDate = new Date().toISOString().slice(0, 10);

  for (const line of lines) {
    if (line.includes("Dodací list") || line.includes("Faktúra")) {
      const match = line.match(/\d{7,12}/);
      if (match) docNumber = match[0];
    }
    if (line.startsWith("#") || line.startsWith("//")) continue;

    const cols = splitCsvLine(line, preferredDelimiter);
    if (cols.length < 5) continue;
    if (cols[0].toLowerCase().includes("kod") || cols[0].toLowerCase().includes("sku") || cols[1]?.toLowerCase().includes("nazov")) continue;

    const sku = cols[0];
    const name = cols[1];
    const rawBatch = cols[2]?.trim();
    const batch = rawBatch && rawBatch.length > 0 ? rawBatch : "BEZ-SARZE";
    const exp = parseDate(cols[3]);
    const qty = parseSlovakNumber(cols[4]) || 1;
    const price = parseSlovakNumber(cols[5]);
    const vatRate = parseVatRate(cols[6]);
    const totalWithoutVat = Math.round(qty * price * 100) / 100;
    const totalWithVat = Math.round(totalWithoutVat * (1 + vatRate / 100) * 100) / 100;

    items.push({
      sku,
      name,
      batchNumber: batch,
      expirationDate: exp,
      quantity: qty,
      unit: "ks",
      unitPriceWithoutVat: price,
      vatRate,
      totalWithoutVat,
      totalWithVat,
      isControlledSubstance: isControlledSubstanceName(name),
    });
  }

  const sumWithoutVat = items.reduce((acc, it) => acc + it.totalWithoutVat, 0);
  const sumWithVat = items.reduce((acc, it) => acc + it.totalWithVat, 0);

  return {
    wholesaler,
    deliveryNoteNumber: docNumber,
    issueDate,
    supplierName,
    supplierIco: "",
    items,
    totalWithoutVat: Math.round(sumWithoutVat * 100) / 100,
    totalVat: Math.round((sumWithVat - sumWithoutVat) * 100) / 100,
    totalWithVat: Math.round(sumWithVat * 100) / 100,
  };
}

function parseBiopharm(lines: string[]): WholesalerDeliveryNote {
  return parseStandardDeliveryLines(lines, "BIOPHARM", "BIOPHARM a.s.", "BIO");
}

function parseKomvet(lines: string[]): WholesalerDeliveryNote {
  // KOMVET exports tab-delimited .txt files WITHOUT a header row.
  return parseStandardDeliveryLines(lines, "KOMVET", "KOMVET s.r.o.", "KOM", "\t");
}

/** Extract a single XML tag's inner text (server-safe regex, no DOM). */
function extractXmlTag(block: string, tag: string): string | undefined {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  const value = match?.[1]?.trim();
  return value ? value : undefined;
}

function parseSgVet(rawContent: string): WholesalerDeliveryNote {
  // SG-Vet exports XML (not CSV). Parse every <item> or <polozka> element with regex
  // so the parser also works server-side where no DOM implementation is available.
  const items: WholesalerDeliveryItem[] = [];
  const issueDate = new Date().toISOString().slice(0, 10);

  let docNumber = `SGV-${Date.now().toString().slice(-6)}`;
  const noteMatch =
    rawContent.match(
      /<(?:deliveryNoteNumber|number|cislo|cislo_dokladu|cisloDokladu|faktura)[^>]*>([\s\S]*?)<\/(?:deliveryNoteNumber|number|cislo|cislo_dokladu|cisloDokladu|faktura)>/i
    );
  if (noteMatch?.[1]) {
    const digits = noteMatch[1].match(/\d{7,12}/);
    if (digits) docNumber = digits[0];
    else docNumber = noteMatch[1].trim();
  }

  const itemRegex = /<(?:item|polozka)[^>]*>([\s\S]*?)<\/(?:item|polozka)>/gi;
  let blockMatch: RegExpExecArray | null;
  while ((blockMatch = itemRegex.exec(rawContent)) !== null) {
    const block = blockMatch[1];

    const sku =
      extractXmlTag(block, "sku") ??
      extractXmlTag(block, "kod") ??
      extractXmlTag(block, "kod_tovaru") ??
      extractXmlTag(block, "kodTovaru");
    const name =
      extractXmlTag(block, "name") ??
      extractXmlTag(block, "nazov") ??
      extractXmlTag(block, "nazov_tovaru") ??
      extractXmlTag(block, "nazovTovaru") ??
      extractXmlTag(block, "description") ??
      "";
    if (!name) continue;

    const rawBatch = (
      extractXmlTag(block, "batch") ??
      extractXmlTag(block, "sarza") ??
      extractXmlTag(block, "lot") ??
      extractXmlTag(block, "cislo_sarze")
    )?.trim();
    const batch = rawBatch && rawBatch.length > 0 ? rawBatch : "BEZ-SARZE";
    const expRaw =
      extractXmlTag(block, "expiration") ??
      extractXmlTag(block, "expiracia") ??
      extractXmlTag(block, "expirace") ??
      extractXmlTag(block, "expiry") ??
      extractXmlTag(block, "exp");
    const exp = parseDate(expRaw);
    const qty =
      parseSlovakNumber(
        extractXmlTag(block, "qty") ??
          extractXmlTag(block, "ks") ??
          extractXmlTag(block, "mnozstvo") ??
          extractXmlTag(block, "pocet")
      ) || 1;
    const price = parseSlovakNumber(
      extractXmlTag(block, "price") ??
        extractXmlTag(block, "jcena") ??
        extractXmlTag(block, "cena") ??
        extractXmlTag(block, "cena_bez_dph")
    );
    const vatRate =
      parseVatRate(
        extractXmlTag(block, "vat") ??
          extractXmlTag(block, "dph") ??
          extractXmlTag(block, "sadzba_dph") ??
          "23"
      );
    const totalWithoutVat = Math.round(qty * price * 100) / 100;
    const totalWithVat = Math.round(totalWithoutVat * (1 + vatRate / 100) * 100) / 100;

    items.push({
      sku,
      name,
      batchNumber: batch,
      expirationDate: exp,
      quantity: qty,
      unit: "ks",
      unitPriceWithoutVat: price,
      vatRate,
      totalWithoutVat,
      totalWithVat,
      isControlledSubstance: isControlledSubstanceName(name),
    });
  }

  const sumWithoutVat = items.reduce((acc, it) => acc + it.totalWithoutVat, 0);
  const sumWithVat = items.reduce((acc, it) => acc + it.totalWithVat, 0);

  return {
    wholesaler: "SG_VET",
    deliveryNoteNumber: docNumber,
    issueDate,
    supplierName: "SG-VET s.r.o.",
    supplierIco: "",
    items,
    totalWithoutVat: Math.round(sumWithoutVat * 100) / 100,
    totalVat: Math.round((sumWithVat - sumWithoutVat) * 100) / 100,
    totalWithVat: Math.round(sumWithVat * 100) / 100,
  };
}


function parseTopvet(lines: string[]): WholesalerDeliveryNote {
  const items: WholesalerDeliveryItem[] = [];
  let docNumber = `TOP-${Date.now().toString().slice(-6)}`;
  let issueDate = new Date().toISOString().slice(0, 10);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const invMatch = line.match(/FAKTÚRA\s+č\.?:\s*(\d+)/i);
    if (invMatch) docNumber = invMatch[1];
    const dateMatch = line.match(/Dátum vystavenia:\s*(\d{1,2})\.(\d{1,2})\.(\d{4})/i);
    if (dateMatch) {
      issueDate = `${dateMatch[3]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[1].padStart(2, "0")}`;
    }

    const codeMatch = line.match(/^(T\d+)\s+(.+)/);
    if (!codeMatch) continue;

    const sku = codeMatch[1];
    const name = codeMatch[2].trim();
    let batchNumber = "BEZ-SARZE";
    let expirationDate: string | undefined;

    if (i + 1 < lines.length) {
      const nextLineParts = lines[i + 1].trim().split(/\s+/);
      if (nextLineParts.length >= 2 && /^\d{2}\/\d{2}$/.test(nextLineParts[0])) {
        expirationDate = parseDate(nextLineParts[0]);
        batchNumber = nextLineParts[1];
      }
    }

    let qty = 1;
    let unit = "ks";
    let unitPriceWithoutVat = 0;
    let vatRate = 5;
    let totalWithoutVat = 0;
    let totalWithVat = 0;

    for (let j = i + 1; j <= Math.min(i + 3, lines.length - 1); j++) {
      const parts = lines[j].trim().split(/\s+/);
      const unitIdx = parts.findIndex((p) => /^(ks|bal|ml|g|l|kg)$/i.test(p));
      if (unitIdx !== -1) {
        qty = parseSlovakNumber(parts[0]) || 1;
        unit = parts[unitIdx];
        unitPriceWithoutVat = parseSlovakNumber(parts[2]) || parseSlovakNumber(parts[1]);
        vatRate = parseVatRate(parts[3], 5);
        totalWithoutVat = Math.round(qty * unitPriceWithoutVat * 100) / 100;
        totalWithVat = Math.round(totalWithoutVat * (1 + vatRate / 100) * 100) / 100;
        break;
      }
    }

    items.push({
      sku,
      name,
      batchNumber,
      expirationDate,
      quantity: qty,
      unit,
      unitPriceWithoutVat,
      vatRate,
      totalWithoutVat,
      totalWithVat,
      isControlledSubstance: isControlledSubstanceName(name),
    });
  }

  const sumWithoutVat = items.reduce((acc, it) => acc + it.totalWithoutVat, 0);
  const sumWithVat = items.reduce((acc, it) => acc + it.totalWithVat, 0);

  return {
    wholesaler: "TOPVET",
    deliveryNoteNumber: docNumber,
    issueDate,
    supplierName: "TOPVET BB, spol. s.r.o.",
    supplierIco: "46277129",
    items,
    totalWithoutVat: Math.round(sumWithoutVat * 100) / 100,
    totalVat: Math.round((sumWithVat - sumWithoutVat) * 100) / 100,
    totalWithVat: Math.round(sumWithVat * 100) / 100,
  };
}

function parseSanvet(lines: string[]): WholesalerDeliveryNote {
  return parseStandardDeliveryLines(lines, "SANVET", "SANVET s.r.o.", "SAN");
}

function parsePhramed(lines: string[]): WholesalerDeliveryNote {
  return parseStandardDeliveryLines(lines, "PHRAMED", "PHRAMED s.r.o.", "PHM");
}
/**
 * PHARMACOPOLA s.r.o. — PDF invoice text parser.
 * Handles ZF-prefixed invoices. Product lines start with OBC code.
 * Format: "OBC018394 Product Name" followed by "qty MJ unitPrice_bezDPH unitPrice_sDPH DPH% zl% zl% bezDPH sDPH"
 */
function parsePharmacopolaText(lines: string[]): WholesalerDeliveryNote {
  const items: WholesalerDeliveryItem[] = [];
  let docNumber = `ZF-${Date.now().toString().slice(-6)}`;
  let issueDate = new Date().toISOString().slice(0, 10);

  for (const line of lines) {
    const invMatch = line.match(/Faktúra\s+(ZF\d+)/i);
    if (invMatch) docNumber = invMatch[1];
    if (line.toLowerCase().includes("dátum dokladu")) {
      const dateMatch = line.match(/(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/);
      if (dateMatch) {
        const [, d, m, y] = dateMatch;
        issueDate = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
      }
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const obcMatch = line.match(/^(OBC\d+)\s+(.+)/);
    if (!obcMatch) continue;

    const sku = obcMatch[1];
    const name = obcMatch[2].trim();
    if (!name) continue;

    // Find the quantity data line after the OBC line
    let qtyLine = "";
    for (let j = i + 1; j <= Math.min(i + 4, lines.length - 1); j++) {
      if (/^\d+\s+(Kus|ks|bal|ml|g|l|kg)\s+/i.test(lines[j])) {
        qtyLine = lines[j];
        break;
      }
    }
    if (!qtyLine) continue;

    const parts = qtyLine.trim().split(/\s+/);
    const qty = parseSlovakNumber(parts[0]) || 1;
    const unit = parts[1] || "ks";
    const unitPriceWithoutVat = parseSlovakNumber(parts[2]);
    const vatRate = parseVatRate(parts[4], 5);

    // Last two numeric tokens = totalBezDPH, totalSDPH
    const numericParts = parts.filter((p) => /^[\d,\.]+$/.test(p)).map(parseSlovakNumber);
    let totalWithoutVat: number;
    let totalWithVat: number;
    if (numericParts.length >= 2) {
      totalWithVat = numericParts[numericParts.length - 1];
      totalWithoutVat = numericParts[numericParts.length - 2];
    } else {
      totalWithoutVat = Math.round(qty * unitPriceWithoutVat * 100) / 100;
      totalWithVat = Math.round(totalWithoutVat * (1 + vatRate / 100) * 100) / 100;
    }

    items.push({
      sku,
      name,
      batchNumber: "BEZ-SARZE",
      quantity: qty,
      unit,
      unitPriceWithoutVat,
      vatRate,
      totalWithoutVat,
      totalWithVat,
      isControlledSubstance: isControlledSubstanceName(name),
    });
  }

  const sumWithoutVat = items.reduce((acc, it) => acc + it.totalWithoutVat, 0);
  const sumWithVat = items.reduce((acc, it) => acc + it.totalWithVat, 0);

  return {
    wholesaler: "PHARMACOPOLA",
    deliveryNoteNumber: docNumber,
    issueDate,
    supplierName: "PHARMACOPOLA s.r.o.",
    supplierIco: "31570895",
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
    const vatRate = parseVatRate(cols[3]);
    const totalWithoutVat = Math.round(qty * price * 100) / 100;
    const totalWithVat = Math.round(totalWithoutVat * (1 + vatRate / 100) * 100) / 100;

    items.push({
      name,
      batchNumber: "BEZ-SARZE",
      quantity: qty,
      unit: "ks",
      unitPriceWithoutVat: price,
      vatRate,
      totalWithoutVat,
      totalWithVat,
      isControlledSubstance: isControlledSubstanceName(name),
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

/**
 * Flexible date parser for Slovak wholesale delivery notes.
 * Supports:
 * - YYYY-MM-DD
 * - DD.MM.YYYY, DD/MM/YYYY, DD-MM-YYYY
 * - DD.MM.YY, DD/MM/YY, DD-MM-YY (e.g. 15.06.27 -> 2027-06-15)
 * - MM.YYYY, MM/YYYY, MM-YYYY (e.g. 12/2026 -> 2026-12-31, end of month)
 * - MM.YY, MM/YY, MM-YY (e.g. 12/26 -> 2026-12-31, end of month)
 * - YYYY.MM, YYYY/MM, YYYY-MM (e.g. 2026-12 -> 2026-12-31)
 * - ISO string: 2026-12-31T...
 */
export function parseDate(val?: string): string | undefined {
  if (!val) return undefined;
  const trimmed = val.trim();
  if (!trimmed) return undefined;

  // ISO string (e.g. 2026-12-31T...)
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.slice(0, 10);
  }

  // DD.MM.YYYY or DD/MM/YYYY or DD-MM-YYYY
  const dmy4Match = trimmed.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (dmy4Match) {
    const [, d, m, y] = dmy4Match;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // DD.MM.YY or DD/MM/YY or DD-MM-YY (2-digit year)
  const dmy2Match = trimmed.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2})$/);
  if (dmy2Match) {
    const [, d, m, yy] = dmy2Match;
    const yearNum = parseInt(yy, 10);
    const fullYear = yearNum >= 70 ? 1900 + yearNum : 2000 + yearNum;
    return `${fullYear}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // MM.YYYY or MM/YYYY or MM-YYYY (Month/Year -> last day of month)
  const my4Match = trimmed.match(/^(\d{1,2})[./-](\d{4})$/);
  if (my4Match) {
    const [, m, y] = my4Match;
    const monthNum = parseInt(m, 10);
    const yearNum = parseInt(y, 10);
    if (monthNum >= 1 && monthNum <= 12) {
      const lastDay = new Date(Date.UTC(yearNum, monthNum, 0)).getUTCDate();
      return `${yearNum}-${m.padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    }
  }

  // YYYY.MM or YYYY/MM or YYYY-MM
  const ym4Match = trimmed.match(/^(\d{4})[./-](\d{1,2})$/);
  if (ym4Match) {
    const [, y, m] = ym4Match;
    const monthNum = parseInt(m, 10);
    const yearNum = parseInt(y, 10);
    if (monthNum >= 1 && monthNum <= 12) {
      const lastDay = new Date(Date.UTC(yearNum, monthNum, 0)).getUTCDate();
      return `${yearNum}-${m.padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    }
  }

  // MM.YY or MM/YY or MM-YY (2-digit year)
  const my2Match = trimmed.match(/^(\d{1,2})[./-](\d{2})$/);
  if (my2Match) {
    const [, m, yy] = my2Match;
    const monthNum = parseInt(m, 10);
    const yearNum = parseInt(yy, 10);
    if (monthNum >= 1 && monthNum <= 12) {
      const fullYear = yearNum >= 70 ? 1900 + yearNum : 2000 + yearNum;
      const lastDay = new Date(Date.UTC(fullYear, monthNum, 0)).getUTCDate();
      return `${fullYear}-${m.padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    }
  }

  return undefined;
}
