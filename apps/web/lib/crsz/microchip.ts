/**
 * Validácia transpondérov a cestovných pasov (CRSZ SR & PetPass).
 * V zmysle zákona č. 39/2007 Z. z. a Nariadenia EÚ č. 576/2013.
 */

export interface MicrochipValidationResult {
  valid: boolean;
  code: string;
  countryOrManufacturer?: string;
  isSlovakNationalCode: boolean;
  error?: string;
}

const KNOWN_PREFIXES: Record<string, string> = {
  "703": "Slovensko (Národný kód SR)",
  "203": "Česká republika",
  "040": "Rakúsko",
  "348": "Maďarsko",
  "616": "Poľsko",
  "985": "Destron Fearing / Digital Angel",
  "981": "Datamars / Petlink",
  "941": "Felixcan",
  "968": "Trovan",
  "977": "Avid",
  "953": "Animalcare",
  "900": "Univerzálny kód výrobcu",
};

/**
 * Validuje 15-miestny kód mikročipu podľa ISO 11784/11785.
 */
export function validateMicrochipNumber(chip: string): MicrochipValidationResult {
  const cleaned = chip.trim().replace(/\s+/g, "");

  if (!/^\d{15}$/.test(cleaned)) {
    return {
      valid: false,
      code: cleaned,
      isSlovakNationalCode: false,
      error: "Číslo mikročipu musí obsahovať presne 15 číslic (ISO 11784/11785).",
    };
  }

  const prefix = cleaned.substring(0, 3);
  const isSlovak = prefix === "703";
  const countryOrManufacturer = KNOWN_PREFIXES[prefix] || `Výrobca/krajina (kód ${prefix})`;

  return {
    valid: true,
    code: cleaned,
    countryOrManufacturer,
    isSlovakNationalCode: isSlovak,
  };
}

/**
 * Vypočíta dátum spôsobilosti na cestovanie v rámci EÚ (PetPass).
 * Podľa Nariadenia EÚ č. 576/2013:
 * - Pri primovakcinácii (prvá vakcína) je zviera spôsobilé cestovať 21 dní po vakcinácii.
 * - Pri revakcinácii v lehote platnosti predchádzajúcej vakcíny je platnosť okamžitá.
 */
export function calculateTravelEligibility(params: {
  microchipDate: string | Date;
  rabiesDate: string | Date;
  isRevaccination?: boolean;
}): {
  eligibleFrom: string;
  isEligibleNow: boolean;
  isValidSequence: boolean;
  warning?: string;
} {
  const chipDate = new Date(params.microchipDate);
  const rabiesDate = new Date(params.rabiesDate);

  // Čip musí byť aplikovaný pred alebo v ten istý deň ako vakcína proti besnote!
  const chipYmd = chipDate.toISOString().slice(0, 10);
  const rabiesYmd = rabiesDate.toISOString().slice(0, 10);
  const isValidSequence = chipYmd <= rabiesYmd;

  let warning: string | undefined;
  if (!isValidSequence) {
    warning = "UPOZORNENIE: Čipovanie bolo vykonané neskôr ako vakcinácia proti besnote. Podľa predpisov EÚ musí byť čip zavedený pred alebo súčasne s očkovaním!";
  }

  let eligibleFromDate: Date;
  if (params.isRevaccination) {
    eligibleFromDate = rabiesDate;
  } else {
    // 21 dní po primovakcinácii
    eligibleFromDate = new Date(rabiesDate.getTime() + 21 * 24 * 60 * 60 * 1000);
  }

  const today = new Date();
  const todayYmd = today.toISOString().slice(0, 10);
  const eligibleYmd = eligibleFromDate.toISOString().slice(0, 10);

  return {
    eligibleFrom: eligibleYmd,
    isEligibleNow: todayYmd >= eligibleYmd,
    isValidSequence,
    warning,
  };
}

/**
 * Generuje HTML potvrdenie o označení transpondérom pre tlač a odovzdanie majiteľovi (KVL SR formát).
 */
export function generateMicrochipCertificateHtml(data: {
  clinicName: string;
  clinicAddress?: string | null;
  clinicPhone?: string | null;
  vetName: string;
  vetKvlNumber?: string | null;
  patientName: string;
  species: string;
  breed?: string | null;
  sex?: string | null;
  dob?: string | null;
  color?: string | null;
  ownerName: string;
  ownerAddress?: string | null;
  ownerPhone?: string | null;
  microchipNumber: string;
  implantedAt: string;
  location: string;
  verifiedBefore: string;
  verifiedAfter: string;
  crszRecordId?: string | null;
}): string {
  const locationText =
    data.location === "LEFT_NECK"
      ? "Ľavá strana krku (štandard EÚ/SR)"
      : data.location === "INTERSCAPULAR"
      ? "Medzilopatkový priestor"
      : data.location === "RIGHT_NECK"
      ? "Pravá strana krku"
      : data.location;

  return `<!DOCTYPE html>
<html lang="sk">
<head>
  <meta charset="UTF-8" />
  <title>Potvrdenie o označení zvieraťa transpondérom - ${data.microchipNumber}</title>
  <style>
    @page { size: A4 portrait; margin: 15mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; font-size: 11pt; color: #111; line-height: 1.4; margin: 0; padding: 20px; }
    .header { text-align: center; border-bottom: 2px solid #0f766e; padding-bottom: 12px; margin-bottom: 20px; }
    .title { font-size: 16pt; font-weight: bold; text-transform: uppercase; color: #0f766e; margin-bottom: 4px; }
    .subtitle { font-size: 10pt; color: #555; }
    .section-title { font-size: 12pt; font-weight: bold; background: #f0fdfa; border-left: 4px solid #0f766e; padding: 4px 8px; margin: 16px 0 8px 0; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
    .row { margin-bottom: 4px; }
    .label { font-size: 9pt; color: #666; text-transform: uppercase; }
    .value { font-size: 11pt; font-weight: 600; }
    .chip-box { background: #f8fafc; border: 2px dashed #0f766e; border-radius: 8px; padding: 14px; text-align: center; margin: 16px 0; }
    .chip-number { font-size: 20pt; font-family: monospace; font-weight: bold; letter-spacing: 2px; color: #0f766e; }
    .footer { margin-top: 40px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; text-align: center; }
    .signature-line { border-top: 1px solid #999; margin-top: 50px; padding-top: 4px; font-size: 9pt; color: #666; }
    .legal-notice { font-size: 8pt; color: #777; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 8px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">Potvrdenie o trvalom označení zvieraťa transpondérom</div>
    <div class="subtitle">v zmysle § 19 zákona č. 39/2007 Z. z. o veterinárnej starostlivosti v platnom znení</div>
    <div style="margin-top: 8px; font-weight: 500;">${data.clinicName} ${data.clinicAddress ? "• " + data.clinicAddress : ""} ${data.clinicPhone ? "• Tel: " + data.clinicPhone : ""}</div>
  </div>

  <div class="chip-box">
    <div class="label">Číslo aplikovaného mikročipu (ISO 11784/11785)</div>
    <div class="chip-number">${data.microchipNumber}</div>
    <div style="font-size: 9pt; color: #0f766e; margin-top: 4px;">Miesto aplikácie: ${locationText} | Dátum: ${data.implantedAt}</div>
  </div>

  <div class="section-title">Údaje o označenom zvierati (pacientovi)</div>
  <div class="grid">
    <div class="row"><div class="label">Meno zvieraťa</div><div class="value">${data.patientName}</div></div>
    <div class="row"><div class="label">Druh zvieraťa</div><div class="value">${data.species}</div></div>
    <div class="row"><div class="label">Plemeno</div><div class="value">${data.breed || "Kríženec / Nešpecifikované"}</div></div>
    <div class="row"><div class="label">Pohlavie</div><div class="value">${data.sex || "Neuvedené"}</div></div>
    <div class="row"><div class="label">Dátum narodenia / Vek</div><div class="value">${data.dob || "Neznámy"}</div></div>
    <div class="row"><div class="label">Farba a osobitné znaky</div><div class="value">${data.color || "Štandardná"}</div></div>
  </div>

  <div class="section-title">Údaje o vlastníkovi / držiteľovi zvieraťa</div>
  <div class="grid">
    <div class="row"><div class="label">Meno a priezvisko</div><div class="value">${data.ownerName}</div></div>
    <div class="row"><div class="label">Telefónny kontakt</div><div class="value">${data.ownerPhone || "—"}</div></div>
    <div class="row" style="grid-column: span 2;"><div class="label">Adresa trvalého pobytu</div><div class="value">${data.ownerAddress || "—"}</div></div>
  </div>

  <div class="section-title">Vyhlásenie o overení transpondéra a registrácii v CRSZ</div>
  <div style="font-size: 10pt; margin-bottom: 8px;">
    Potvrdzujem, že pred aplikáciou transpondéra bola vykonaná kontrola odčítateľnosti čítačkou mikročipov (${data.verifiedBefore}) a bezprostredne po podkožnej aplikácii bolo opätovne overené správne umiestnenie a funkčnosť (${data.verifiedAfter}). Údaje boli zaznamenané do klinického systému a nahlásené do Centrálneho registra spoločenských zvierat (CRSZ) Komory veterinárnych lekárov SR.
  </div>
  ${data.crszRecordId ? `<div style="font-size: 10pt; font-weight: bold; color: #0f766e;">Evidenčné číslo v CRSZ: ${data.crszRecordId}</div>` : ""}

  <div class="footer">
    <div>
      <div class="signature-line">Podpis vlastníka / držiteľa zvieraťa</div>
    </div>
    <div>
      <div class="signature-line">Pečiatka a podpis veterinárneho lekára<br/><strong>${data.vetName}</strong> ${data.vetKvlNumber ? "(KVL: " + data.vetKvlNumber + ")" : ""}</div>
    </div>
  </div>

  <div class="legal-notice">
    Vlastník zvieraťa bol poučený o povinnosti nahlásiť každú zmenu vlastníka, zmenu miesta chovu alebo úhyn zvieraťa súkromnému veterinárnemu lekárovi do 21 dní v zmysle zákona č. 39/2007 Z. z. Vyhotovené v dvoch rovnopisoch (1x vlastník, 1x veterinárny lekár).
  </div>
</body>
</html>`;
}
