import { z } from "zod";
import { generateText } from "ai";
import { configuredModel } from "@/lib/agent/runner";

export interface ExtractedBillItem {
  id: string;
  name: string;
  category: "service" | "medication" | "consumable";
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  vatRate: number;
  dosageOrRoute?: string;
  isAppliedOnSite: boolean;
}

const billItemSchema = z.object({
  name: z.string(),
  category: z.enum(["service", "medication", "consumable"]),
  quantity: z.number().min(0.01).default(1),
  unit: z.string().default("ks"),
  unitPrice: z.number().min(0).default(0),
  vatRate: z.number().default(23),
  dosageOrRoute: z.string().optional(),
  isAppliedOnSite: z.boolean().default(true),
});

const billExtractionSchema = z.object({
  items: z.array(billItemSchema),
});

// Zoznam najčastejších veterinárnych úkonov a orientačných cien (SR)
const KNOWN_SERVICES_CATALOG: Array<{
  pattern: RegExp;
  name: string;
  unit: string;
  price: number;
  vat: number;
}> = [
  { pattern: /klinick[ée]\s+vyšetrenie/i, name: "Klinické vyšetrenie", unit: "úkon", price: 18.0, vat: 23 },
  { pattern: /kontroln[ée]\s+vyšetrenie/i, name: "Kontrolné vyšetrenie", unit: "úkon", price: 12.0, vat: 23 },
  { pattern: /aplik[aá]cia\s+(?:injekcie|lieku|s\.c\.|i\.m\.|i\.v\.)/i, name: "Aplikácia injekcie", unit: "úkon", price: 4.5, vat: 23 },
  { pattern: /odber\s+krvi/i, name: "Odber krvi na laboratórne vyšetrenie", unit: "úkon", price: 8.0, vat: 23 },
  { pattern: /inf[uú]zn[aá]\s+terapia/i, name: "Infúzna terapia (zavedenie kanyly + infúzia)", unit: "úkon", price: 22.0, vat: 23 },
  { pattern: /rtg\s+vyšetrenie|rontgen/i, name: "RTG vyšetrenie (1 projekcia)", unit: "snímka", price: 25.0, vat: 23 },
  { pattern: /usg|sono|ultrazvuk/i, name: "USG / Ultrasonografické vyšetrenie", unit: "úkon", price: 28.0, vat: 23 },
  { pattern: /čistenie\s+(?:zubn[eé]ho\s+kameňa|zubov)/i, name: "Odstránenie zubného kameňa ultrazvukom", unit: "úkon", price: 55.0, vat: 23 },
  { pattern: /toaleta\s+u[sš][ií]|výplach\s+u[sš][ií]/i, name: "Toaleta a výplach vonkajšieho zvukovodu", unit: "úkon", price: 9.0, vat: 23 },
  { pattern: /strihanie\s+paz[uú]rov/i, name: "Krátenie pazúrikov", unit: "úkon", price: 5.0, vat: 23 },
  { pattern: /sed[aá]cia/i, name: "Sedácia pacienta", unit: "úkon", price: 15.0, vat: 23 },
  { pattern: /čipovanie|aplik[aá]cia\s+mikročipu/i, name: "Aplikácia mikročipu vrátane registrácie CRSZ", unit: "úkon", price: 20.0, vat: 23 },
  { pattern: /vakcin[aá]cia|očkovanie/i, name: "Vakcinácia vrátane klinického posúdenia", unit: "úkon", price: 24.0, vat: 23 },
  { pattern: /eutan[aá]zia/i, name: "Eutanázia pacienta", unit: "úkon", price: 35.0, vat: 23 },
];

// Zoznam bežných veterinárnych liečiv pre heuristický fallback
const KNOWN_MEDICATIONS_CATALOG: Array<{
  pattern: RegExp;
  name: string;
  unit: string;
  defaultPricePerUnit: number;
  vat: number;
}> = [
  { pattern: /cerenia/i, name: "Cerenia inj. (maropitant)", unit: "ml", defaultPricePerUnit: 6.5, vat: 19 },
  { pattern: /melovem|metacam/i, name: "Melovem 5 mg/ml inj. (meloxikam)", unit: "ml", defaultPricePerUnit: 3.8, vat: 19 },
  { pattern: /synulox|noroclav|amoksiklav/i, name: "Synulox RTU inj.", unit: "ml", defaultPricePerUnit: 2.9, vat: 19 },
  { pattern: /betamox/i, name: "Betamox L.A. inj.", unit: "ml", defaultPricePerUnit: 2.2, vat: 19 },
  { pattern: /marbocyl/i, name: "Marbocyl 10% inj.", unit: "ml", defaultPricePerUnit: 4.2, vat: 19 },
  { pattern: /kesium/i, name: "Kesium tbl.", unit: "tbl", defaultPricePerUnit: 1.2, vat: 19 },
  { pattern: /onsior/i, name: "Onsior inj. / tbl.", unit: "tbl", defaultPricePerUnit: 2.4, vat: 19 },
  { pattern: /previcox/i, name: "Previcox tbl.", unit: "tbl", defaultPricePerUnit: 2.8, vat: 19 },
  { pattern: /apoquel/i, name: "Apoquel tbl.", unit: "tbl", defaultPricePerUnit: 2.9, vat: 19 },
  { pattern: /simparica/i, name: "Simparica Trio", unit: "tbl", defaultPricePerUnit: 14.5, vat: 19 },
  { pattern: /bravecto/i, name: "Bravecto žuvacia tbl.", unit: "tbl", defaultPricePerUnit: 32.0, vat: 19 },
  { pattern: /nexgard/i, name: "NexGard Spectra", unit: "tbl", defaultPricePerUnit: 15.0, vat: 19 },
  { pattern: /milprazon|dehinel/i, name: "Milprazon odčervenie", unit: "tbl", defaultPricePerUnit: 4.5, vat: 19 },
  { pattern: /duphalyte/i, name: "Duphalyte infúzny roztok", unit: "ml", defaultPricePerUnit: 0.15, vat: 19 },
  { pattern: /ringer|fyziologick[yý]/i, name: "Ringerov / Fyz. roztok 500ml", unit: "fľaša", defaultPricePerUnit: 6.0, vat: 19 },
  { pattern: /t61|pentobarbital/i, name: "T61 / Eutanázne liečivo", unit: "ml", defaultPricePerUnit: 2.5, vat: 19 },
];

function fallbackExtraction(text: string): ExtractedBillItem[] {
  const items: ExtractedBillItem[] = [];
  let counter = 1;

  // 1. Vyhľadávanie úkonov
  for (const s of KNOWN_SERVICES_CATALOG) {
    if (s.pattern.test(text)) {
      items.push({
        id: `extracted-${counter++}`,
        name: s.name,
        category: "service",
        quantity: 1,
        unit: s.unit,
        unitPrice: s.price,
        totalPrice: s.price,
        vatRate: s.vat,
        isAppliedOnSite: true,
      });
    }
  }

  // 2. Vyhľadávanie liekov
  for (const m of KNOWN_MEDICATIONS_CATALOG) {
    const match = text.match(m.pattern);
    if (match) {
      // Skús nájsť množstvo napr. "1 ml", "0.5 ml", "10 tbl", "2 bal"
      const windowAround = text.substring(Math.max(0, match.index! - 20), Math.min(text.length, match.index! + 50));
      const qtyMatch = windowAround.match(/(\d+(?:[.,]\d+)?)\s*(ml|tbl|bal|ks)/i);
      const qty = qtyMatch ? parseFloat(qtyMatch[1].replace(",", ".")) : 1;
      const unit = qtyMatch ? qtyMatch[2].toLowerCase() : m.unit;

      const unitPrice = m.defaultPricePerUnit;
      const totalPrice = Math.round(qty * unitPrice * 100) / 100;

      items.push({
        id: `extracted-${counter++}`,
        name: m.name,
        category: "medication",
        quantity: qty,
        unit,
        unitPrice,
        totalPrice,
        vatRate: m.vat,
        dosageOrRoute: qtyMatch ? `${qty} ${unit}` : undefined,
        isAppliedOnSite: !/doma|predp[ií]san[ée]|vydan[ée]/i.test(windowAround),
      });
    }
  }

  // Ak sa nenašiel žiadny úkon ani liek, pridáme aspoň základné vyšetrenie
  if (items.length === 0) {
    items.push({
      id: "extracted-1",
      name: "Klinické vyšetrenie pacienta",
      category: "service",
      quantity: 1,
      unit: "úkon",
      unitPrice: 18.0,
      totalPrice: 18.0,
      vatRate: 23,
      isAppliedOnSite: true,
    });
  }

  return items;
}

export async function extractBillableItemsFromSoap(params: {
  plan: string;
  transcript?: string;
  assessment?: string;
}): Promise<ExtractedBillItem[]> {
  const combinedText = [
    params.plan ? `PLÁN A TERAPIA:\n${params.plan}` : "",
    params.assessment ? `DIAGNÓZA:\n${params.assessment}` : "",
    params.transcript ? `TRANSKRIPCIA DIKTOVANIA:\n${params.transcript}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  if (!combinedText.trim()) {
    return [];
  }

  const systemPrompt = `Si špecialista na veterinárnu fakturáciu a pokladňu (e-Kasa) na Slovensku.
Tvojou úlohou je analyzovať klinický plán (SOAP Plan) a diktovanie veterinárneho lekára a extrahovať všetky spoplatniteľné položky:
1. Veterinárne služby a vyšetrenia (napr. klinické vyšetrenie, aplikácia injekcie, čipovanie, RTG, sono, čistenie zubov...)
2. Aplikované lieky na ambulancii (s.c., i.m., i.v., napr. Cerenia, Meloxikam, Synulox...)
3. Vydané lieky a antiparazitiká na domov (napr. tablety, balenia, pipety...)
4. Spotrebný materiál (obväzy, kanyly, goliere...)

Pravidlá:
- "name": Presný slovenský názov položky
- "category": "service" | "medication" | "consumable"
- "quantity": Číslo (napr. 1, 0.5, 2)
- "unit": "ks" | "ml" | "tbl" | "bal" | "úkon" | "snímka"
- "unitPrice": Odhadovaná obvyklá cena v EUR bez DPH (alebo koncová orientačná, napr. vyšetrenie 15-25 €, injekcia aplikácia 4-6 €, bežné inj. lieky 2-8 €/ml)
- "vatRate": Štandardná sadzba DPH na Slovensku (23% pre služby, 19% pre lieky)
- "dosageOrRoute": napr. "1 ml s.c.", "2x denne 1 tbl"
- "isAppliedOnSite": true ak bolo podané na klinike, false ak vydané na domáce použitie

Odpovedz VÝHRADNE JSON objektom v tvare:
{
  "items": [
    {
      "name": "Klinické vyšetrenie",
      "category": "service",
      "quantity": 1,
      "unit": "úkon",
      "unitPrice": 18.0,
      "vatRate": 23,
      "dosageOrRoute": "",
      "isAppliedOnSite": true
    }
  ]
}`;

  try {
    const ac = new AbortController();
    const timeout = setTimeout(() => ac.abort(), 20_000);

    const result = await generateText({
      model: configuredModel(),
      system: systemPrompt,
      prompt: `Extrahuj položky na vyúčtovanie z tohto záznamu:\n\n${combinedText}`,
      abortSignal: ac.signal,
    });
    clearTimeout(timeout);

    let cleaned = result.text.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned
        .replace(/^```(?:json)?\s*\n?/i, "")
        .replace(/\n?```\s*$/i, "")
        .trim();
    }

    const parsed = billExtractionSchema.safeParse(JSON.parse(cleaned));
    if (parsed.success && parsed.data.items.length > 0) {
      return parsed.data.items.map((item, idx) => {
        const qty = item.quantity > 0 ? item.quantity : 1;
        const uPrice = item.unitPrice >= 0 ? item.unitPrice : 10;
        return {
          id: `ai-item-${idx + 1}`,
          name: item.name,
          category: item.category,
          quantity: qty,
          unit: item.unit || "ks",
          unitPrice: uPrice,
          totalPrice: Math.round(qty * uPrice * 100) / 100,
          vatRate: item.vatRate || 23,
          dosageOrRoute: item.dosageOrRoute,
          isAppliedOnSite: item.isAppliedOnSite,
        };
      });
    }
  } catch {
    // Pád AI volania -> okamžitý robustný heuristický fallback
  }

  return fallbackExtraction(combinedText);
}
