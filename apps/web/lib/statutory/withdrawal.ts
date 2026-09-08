/**
 * Slovak Statutory Compliance: Kniha ochranných lehôt pre potravinové zvieratá
 * V zmysle zákona č. 39/2007 Z. z. o veterinárnej starostlivosti (§ 22)
 * a zákona č. 139/1998 Z. z. o omamných a psychotropných látkach.
 */

export interface VeterinaryDrugCatalogItem {
  id: string;
  name: string;
  activeSubstance: string;
  defaultAnimalType: "bovine" | "porcine" | "ovine" | "equine" | "poultry" | "companion";
  meatWithdrawalDays: number;
  milkWithdrawalDays: number;
  description?: string;
}

export const COMMON_VETERINARY_DRUGS: VeterinaryDrugCatalogItem[] = [
  {
    id: "draxxin",
    name: "Draxxin 100 mg/ml inj.",
    activeSubstance: "Tulatromycín",
    defaultAnimalType: "bovine",
    meatWithdrawalDays: 22,
    milkWithdrawalDays: 0,
    description: "Zákaz podávania dojniciam produkujúcim mlieko na ľudský konzum.",
  },
  {
    id: "cobactan",
    name: "Cobactan 2.5% inj.",
    activeSubstance: "Cefchinóm",
    defaultAnimalType: "bovine",
    meatWithdrawalDays: 5,
    milkWithdrawalDays: 1, // 24 hodín
    description: "Mäso: 5 dní, Mlieko: 24 hodín (1 deň).",
  },
  {
    id: "shotapen",
    name: "Shotapen L.A. inj.",
    activeSubstance: "Benzatín benzylpenicilín + Prokaín benzylpenicilín",
    defaultAnimalType: "bovine",
    meatWithdrawalDays: 30,
    milkWithdrawalDays: 10,
    description: "Mäso: 30 dní, Mlieko: 10 dní.",
  },
  {
    id: "noroclav",
    name: "Noroclav / Synulox RTU inj.",
    activeSubstance: "Amoxicilín + Kyselina klavulánová",
    defaultAnimalType: "bovine",
    meatWithdrawalDays: 42,
    milkWithdrawalDays: 3, // 60 hodín
    description: "Mäso: 42 dní, Mlieko: 60 hodín (3 dni).",
  },
  {
    id: "animox",
    name: "Animox 200 mg/ml inj.",
    activeSubstance: "Amoxicilín trihydrát",
    defaultAnimalType: "porcine",
    meatWithdrawalDays: 28,
    milkWithdrawalDays: 0,
    description: "Ošípané: mäso 28 dní.",
  },
  {
    id: "flunixin",
    name: "Flunixin 50 mg/ml inj.",
    activeSubstance: "Flunixín meglumín",
    defaultAnimalType: "bovine",
    meatWithdrawalDays: 4,
    milkWithdrawalDays: 1,
    description: "Mäso: 4 dni, Mlieko: 24 hodín.",
  },
  {
    id: "baytril",
    name: "Baytril 10% inj.",
    activeSubstance: "Enrofloxacín",
    defaultAnimalType: "bovine",
    meatWithdrawalDays: 14,
    milkWithdrawalDays: 4,
    description: "Mäso: 14 dní, Mlieko: 4 dni (8 dojení).",
  },
  {
    id: "melovem",
    name: "Melovem 20 mg/ml inj.",
    activeSubstance: "Meloxikam",
    defaultAnimalType: "bovine",
    meatWithdrawalDays: 15,
    milkWithdrawalDays: 5,
    description: "Mäso: 15 dní, Mlieko: 5 dní.",
  },
  {
    id: "duphalyte",
    name: "Duphalyte infúzny roztok",
    activeSubstance: "Aminokyseliny, vitamíny, elektrolyty",
    defaultAnimalType: "bovine",
    meatWithdrawalDays: 0,
    milkWithdrawalDays: 0,
    description: "Ochranná lehota: 0 dní (bez ochrannej lehoty).",
  },
];

export interface WithdrawalCalculationResult {
  safeUntil: Date;
  maxDays: number;
  isActive: boolean;
  daysRemaining: number;
  safeUntilFormatted: string;
}

/**
 * Vypočíta dátum ukončenia ochrannej lehoty na základe dňa podania
 * a maximálnej ochrannej lehoty (mäso vs. mlieko).
 */
export function calculateWithdrawalSafeUntil(
  administeredAt: Date | string,
  meatWithdrawalDays: number = 0,
  milkWithdrawalDays: number = 0,
  currentDate: Date = new Date()
): WithdrawalCalculationResult {
  const adminDate = new Date(administeredAt);
  const maxDays = Math.max(Math.max(0, meatWithdrawalDays), Math.max(0, milkWithdrawalDays));
  const safeUntilTime = adminDate.getTime() + maxDays * 24 * 60 * 60 * 1000;
  const safeUntil = new Date(safeUntilTime);

  const diffMs = safeUntilTime - currentDate.getTime();
  const daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  const isActive = diffMs > 0 && maxDays > 0;

  const safeUntilFormatted = safeUntil.toLocaleDateString("sk-SK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return {
    safeUntil,
    maxDays,
    isActive,
    daysRemaining,
    safeUntilFormatted,
  };
}

export interface WithdrawalCertificateParams {
  clinicName: string;
  clinicAddress?: string | null;
  clinicPhone?: string | null;
  clinicIco?: string | null;
  vetName?: string | null;
  patientName: string;
  species: string;
  breed?: string | null;
  earTagOrChip?: string | null;
  targetAnimalType: string;
  clientName: string;
  clientAddress?: string | null;
  clientPhone?: string | null;
  medicationName: string;
  batchNumber?: string | null;
  meatWithdrawalDays: number;
  milkWithdrawalDays: number;
  administeredAt: Date | string;
  safeUntil: Date | string;
  notes?: string | null;
}

/**
 * Generuje oficiálne tlačové potvrdenie pre chovateľa a inšpekciu RVPS
 * v zmysle § 22 zákona č. 39/2007 Z. z. o veterinárnej starostlivosti.
 */
export function formatWithdrawalCertificateHtml(params: WithdrawalCertificateParams): string {
  const adminDateStr = new Date(params.administeredAt).toLocaleDateString("sk-SK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const safeUntilStr = new Date(params.safeUntil).toLocaleDateString("sk-SK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const todayStr = new Date().toLocaleDateString("sk-SK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const animalTypeLabel: Record<string, string> = {
    bovine: "Hovädzí dobytok (bovinný)",
    porcine: "Ošípané (porcínny)",
    ovine: "Ovce a kozy (ovinný/kaprínny)",
    equine: "Kone (ekvinný)",
    poultry: "Hydina",
    companion: "Spoločenské zviera",
  };

  return `<!DOCTYPE html>
<html lang="sk">
<head>
  <meta charset="UTF-8" />
  <title>Potvrdenie o ochrannej lehote – ${params.patientName}</title>
  <style>
    @page { size: A4 portrait; margin: 15mm 20mm; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      color: #111;
      font-size: 12px;
      line-height: 1.5;
      margin: 0;
      padding: 0;
    }
    .header {
      border-bottom: 2px solid #000;
      padding-bottom: 10px;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .title {
      font-size: 15px;
      font-weight: bold;
      text-transform: uppercase;
      text-align: center;
      margin: 12px 0 4px;
    }
    .subtitle {
      font-size: 10.5px;
      text-align: center;
      color: #444;
      font-style: italic;
      margin-bottom: 16px;
    }
    .section {
      margin-bottom: 14px;
      border: 1px solid #ccc;
      border-radius: 4px;
      padding: 10px 12px;
      background: #fafafa;
    }
    .section-title {
      font-size: 11px;
      font-weight: bold;
      text-transform: uppercase;
      color: #222;
      border-bottom: 1px solid #ddd;
      padding-bottom: 4px;
      margin-bottom: 8px;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .row {
      margin-bottom: 4px;
    }
    .label {
      font-size: 10.5px;
      color: #666;
      font-weight: normal;
    }
    .val {
      font-size: 11.5px;
      font-weight: 600;
      color: #000;
    }
    .highlight-box {
      background: #fff8f0;
      border: 2px solid #e65100;
      border-radius: 6px;
      padding: 12px;
      margin: 16px 0;
    }
    .highlight-title {
      color: #bf360c;
      font-weight: bold;
      font-size: 12px;
      text-transform: uppercase;
      margin-bottom: 6px;
    }
    .safe-date {
      font-size: 16px;
      font-weight: bold;
      color: #b71c1c;
      font-family: monospace;
    }
    .notice {
      font-size: 9.5px;
      color: #444;
      background: #f5f5f5;
      border: 1px solid #ddd;
      padding: 8px 10px;
      margin-top: 14px;
      line-height: 1.4;
    }
    .signatures {
      margin-top: 40px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
      page-break-inside: avoid;
    }
    .sig-line {
      border-top: 1px solid #000;
      padding-top: 6px;
      text-align: center;
      font-size: 10.5px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <strong style="font-size: 13px;">${params.clinicName}</strong><br />
      ${params.clinicAddress || ""}<br />
      ${params.clinicPhone ? `Tel: ${params.clinicPhone}` : ""}
      ${params.clinicIco ? ` | IČO: ${params.clinicIco}` : ""}
    </div>
    <div style="text-align: right; font-size: 10.5px; color: #555;">
      Dátum vystavenia: <strong>${todayStr}</strong><br />
      V zmysle § 22 zákona č. 39/2007 Z. z.
    </div>
  </div>

  <div class="title">POTVRDENIE O APLIKÁCII LIEČIVA A OCHRANNÝCH LEHOTÁCH</div>
  <div class="subtitle">Úradný záznam pre chovateľa a inšpekciu Regionálnej veterinárnej a potravinovej správy (RVPS)</div>

  <div class="grid-2">
    <div class="section">
      <div class="section-title">1. Identifikácia zvieraťa / stáda</div>
      <div class="row"><span class="label">Meno / Označenie:</span> <span class="val">${params.patientName}</span></div>
      <div class="row"><span class="label">Živočíšny druh:</span> <span class="val">${params.species} ${params.breed ? `(${params.breed})` : ""}</span></div>
      <div class="row"><span class="label">Kategória:</span> <span class="val">${animalTypeLabel[params.targetAnimalType] || params.targetAnimalType}</span></div>
      <div class="row"><span class="label">Ušné číslo / Mikročip:</span> <span class="val">${params.earTagOrChip || "—"}</span></div>
    </div>

    <div class="section">
      <div class="section-title">2. Vlastník / Chovateľ zvieraťa</div>
      <div class="row"><span class="label">Meno / Názov farmy:</span> <span class="val">${params.clientName}</span></div>
      <div class="row"><span class="label">Adresa chovu:</span> <span class="val">${params.clientAddress || "—"}</span></div>
      <div class="row"><span class="label">Kontakt / Telefón:</span> <span class="val">${params.clientPhone || "—"}</span></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">3. Podané veterinárne liečivo a aplikácia</div>
    <div class="grid-2">
      <div>
        <div class="row"><span class="label">Názov liečiva:</span> <span class="val">${params.medicationName}</span></div>
        <div class="row"><span class="label">Výrobná šarža (Lot No.):</span> <span class="val">${params.batchNumber || "neuvedená"}</span></div>
      </div>
      <div>
        <div class="row"><span class="label">Dátum a čas aplikácie:</span> <span class="val">${adminDateStr}</span></div>
        <div class="row"><span class="label">Aplikoval lekár:</span> <span class="val">${params.vetName || "Ošetrujúci veterinárny lekár"}</span></div>
      </div>
    </div>
    ${params.notes ? `<div style="margin-top: 6px; font-size: 10.5px; color: #555;"><strong>Poznámka / Dávka:</strong> ${params.notes}</div>` : ""}
  </div>

  <div class="highlight-box">
    <div class="highlight-title">4. Stanovená ochranná lehota</div>
    <div class="grid-2">
      <div>
        <div class="row"><span class="label">Ochranná lehota na MÄSO:</span> <span class="val">${params.meatWithdrawalDays} dní</span></div>
        <div class="row"><span class="label">Ochranná lehota na MLIEKO:</span> <span class="val">${params.milkWithdrawalDays} dní</span></div>
      </div>
      <div>
        <div class="row"><span class="label">Koniec ochrannej lehoty (bezpečné od):</span></div>
        <div class="safe-date">${safeUntilStr}</div>
      </div>
    </div>
  </div>

  <div class="notice">
    <strong>ZÁKONNÉ UPOZORNENIE PRE CHOVATEĽA:</strong><br />
    Podľa § 22 ods. 3 zákona č. 39/2007 Z. z. o veterinárnej starostlivosti v znení neskorších predpisov je chovateľ
    povinný dodržať stanovenú ochrannú lehotu. <strong>Zákaz dodávať na ľudskú spotrebu zvieratá na porážku, ich mäso, mlieko,
    vajcia alebo iné produkty pred uplynutím stanovenej ochrannej lehoty.</strong> Porušenie tejto povinnosti je priestupkom /
    správnym deliktom podľa § 48 zákona č. 39/2007 Z. z. s možnosťou uloženia pokuty orgánmi štátnej veterinárnej správy.
  </div>

  <div class="signatures">
    <div class="sig-line">
      Vlastník / Chovateľ zvieraťa<br />
      <span style="font-size: 9px; color: #777;">(Podpisom potvrdzuje prevzatie informácie o ochrannej lehote)</span>
    </div>
    <div class="sig-line">
      ${params.vetName || "Veterinárny lekár"}<br />
      <span style="font-size: 9px; color: #777;">(Pečiatka kliniky a podpis ošetrujúceho lekára)</span>
    </div>
  </div>
</body>
</html>`;
}
