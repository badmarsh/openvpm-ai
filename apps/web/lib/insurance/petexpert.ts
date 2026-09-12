/**
 * PetExpert & Slovak Veterinary Insurance Integration
 * 
 * Compliant with Slovak veterinary insurance standards (PetExpert SR, Generali, Union).
 * Supports direct clinic claim submission, co-pay calculation (spoluúčasť klienta),
 * microchip verification (ISO 11784/11785), and printable claim documentation.
 */

export interface PetExpertPolicyInput {
  policyNumber: string;
  providerName: string;
  effectiveDate?: string | null;
  expirationDate?: string | null;
  coveragePercent?: number | null; // e.g. 90% coverage
  deductible?: string | number | null; // e.g. 35 EUR
  maxAnnualBenefit?: string | number | null;
}

export interface PetExpertPatientInput {
  id: string;
  name: string;
  species: string; // canine, feline, other
  breed?: string | null;
  microchipNumber?: string | null;
  birthDate?: string | null;
  weightKg?: number | null;
}

export interface PetExpertClientInput {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
}

export interface PetExpertInvoiceItem {
  name: string;
  code?: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  totalPrice: number;
  isMedication?: boolean;
}

export interface PetExpertClaimData {
  claimNumber: string;
  policy: PetExpertPolicyInput;
  patient: PetExpertPatientInput;
  client: PetExpertClientInput;
  veterinarianName: string;
  veterinarianKvl?: string | null;
  diagnosisText: string;
  diagnosisCode?: string | null;
  incidentDate: string; // YYYY-MM-DD
  treatmentSummary: string;
  items: PetExpertInvoiceItem[];
  invoiceTotal: number;
  clientCoPayAmount: number;
  insurerPayoutAmount: number;
  clientConsentForDirectSettlement: boolean;
}

export interface EligibilityResult {
  eligible: boolean;
  errors: string[];
  warnings: string[];
  estimatedCoPay: number;
  estimatedInsurerCoverage: number;
}

/**
 * Validates whether a patient visit qualifies for direct PetExpert insurance settlement.
 */
export function validatePetExpertEligibility(
  policy: PetExpertPolicyInput,
  patient: PetExpertPatientInput,
  claimAmount: number
): EligibilityResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Check Policy Number
  if (!policy.policyNumber || policy.policyNumber.trim().length < 4) {
    errors.push("Číslo poistnej zmluvy PetExpert je povinné a musí mať aspoň 4 znaky.");
  }

  // 2. Check Microchip (Mandatory for Slovak pet insurance)
  if (!patient.microchipNumber || patient.microchipNumber.trim().length === 0) {
    errors.push("Zviera musí mať aplikovaný a zaregistrovaný mikročip pre uplatnenie poistného plnenia.");
  } else if (!/^\d{15}$/.test(patient.microchipNumber.trim())) {
    warnings.push(`Číslo mikročipu '${patient.microchipNumber}' nemá štandardných 15 číslic (ISO 11784/11785).`);
  }

  // 3. Check Policy Expiration
  const now = new Date();
  if (policy.expirationDate) {
    const exp = new Date(policy.expirationDate);
    if (exp < now) {
      errors.push(`Poistná zmluva expirovala dňa ${policy.expirationDate}.`);
    }
  }

  // 4. Species Check
  const normalizedSpecies = (patient.species || "").toLowerCase();
  if (normalizedSpecies !== "canine" && normalizedSpecies !== "feline" && normalizedSpecies !== "pes" && normalizedSpecies !== "mačka") {
    warnings.push("Poistenie PetExpert spravidla kryje iba psy a mačky.");
  }

  // 5. Co-Pay & Benefit Calculation
  // Standard PetExpert in Slovakia: 10% co-pay, minimum 35 €
  const coveragePercent = policy.coveragePercent ?? 90;
  const standardDeductible = policy.deductible ? Number(policy.deductible) : 35;

  let calculatedCoPay = claimAmount * ((100 - coveragePercent) / 100);
  if (calculatedCoPay < standardDeductible) {
    calculatedCoPay = standardDeductible;
  }
  if (calculatedCoPay > claimAmount) {
    calculatedCoPay = claimAmount;
  }

  const estimatedInsurerCoverage = Math.max(0, Math.round((claimAmount - calculatedCoPay) * 100) / 100);
  const estimatedCoPay = Math.round(calculatedCoPay * 100) / 100;

  return {
    eligible: errors.length === 0,
    errors,
    warnings,
    estimatedCoPay,
    estimatedInsurerCoverage,
  };
}

/**
 * Builds the structured JSON payload for PetExpert API claim registration.
 */
export function buildPetExpertClaimPayload(claim: PetExpertClaimData) {
  return {
    partnerApiVersion: "2.1",
    insurer: "PETEXPERT_SK",
    timestamp: new Date().toISOString(),
    claimReference: claim.claimNumber,
    policy: {
      number: claim.policy.policyNumber,
      provider: claim.policy.providerName,
    },
    insuredPet: {
      name: claim.patient.name,
      species: claim.patient.species,
      breed: claim.patient.breed || "Neznáme",
      microchipNumber: claim.patient.microchipNumber || "",
      birthDate: claim.patient.birthDate || null,
      weightKg: claim.patient.weightKg || null,
    },
    policyHolder: {
      fullName: `${claim.client.firstName} ${claim.client.lastName}`.trim(),
      phone: claim.client.phone || "",
      email: claim.client.email || "",
      address: claim.client.address || "",
    },
    clinicalCase: {
      veterinarian: {
        name: claim.veterinarianName,
        kvlRegistration: claim.veterinarianKvl || "N/A",
      },
      incidentDate: claim.incidentDate,
      diagnosis: claim.diagnosisText,
      diagnosisCode: claim.diagnosisCode || null,
      treatmentSummary: claim.treatmentSummary,
    },
    financials: {
      currency: "EUR",
      totalInvoiceAmount: claim.invoiceTotal,
      clientCoPay: claim.clientCoPayAmount,
      requestedPayout: claim.insurerPayoutAmount,
      directSettlementConsent: claim.clientConsentForDirectSettlement,
      items: claim.items.map((it) => ({
        description: it.name,
        code: it.code || "",
        qty: it.quantity,
        unitPrice: it.unitPrice,
        vatRate: it.vatRate,
        total: it.totalPrice,
        category: it.isMedication ? "MEDICATION" : "SERVICE_PROCEDURE",
      })),
    },
  };
}

/**
 * Generates an HTML printable confirmation/report for PetExpert & Slovak pet insurance claim.
 */
export function generatePetExpertClaimHtml(claim: PetExpertClaimData): string {
  const itemsRows = claim.items
    .map(
      (it) => `
    <tr>
      <td style="padding: 6px; border-bottom: 1px solid #e2e8f0;">${escapeHtml(it.name)}</td>
      <td style="padding: 6px; border-bottom: 1px solid #e2e8f0; text-align: center;">${it.quantity}</td>
      <td style="padding: 6px; border-bottom: 1px solid #e2e8f0; text-align: right;">${it.unitPrice.toFixed(2)} €</td>
      <td style="padding: 6px; border-bottom: 1px solid #e2e8f0; text-align: right;">${it.totalPrice.toFixed(2)} €</td>
    </tr>`
    )
    .join("");

  return `
<!DOCTYPE html>
<html lang="sk">
<head>
  <meta charset="UTF-8" />
  <title>Oznámenie poistnej udalosti — PetExpert Slovensko</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 13px; color: #1e293b; line-height: 1.5; padding: 24px; }
    .header { border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
    .title { font-size: 18px; font-weight: bold; color: #0f172a; }
    .meta { font-size: 11px; color: #64748b; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
    .box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; }
    .box-title { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #475569; margin-bottom: 6px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
    th { background: #f1f5f9; padding: 8px; text-align: left; font-weight: 600; border-bottom: 2px solid #cbd5e1; }
    .total-box { margin-top: 16px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 12px; }
    .signature-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-top: 40px; text-align: center; }
    .signature-line { border-top: 1px dashed #94a3b8; margin-top: 40px; padding-top: 6px; font-size: 11px; color: #64748b; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="title">Oznámenie poistnej udalosti — Veterinárna starostlivosť</div>
      <div class="meta">Poisťovňa: ${escapeHtml(claim.policy.providerName)} &middot; Číslo poistky: <strong>${escapeHtml(claim.policy.policyNumber)}</strong></div>
    </div>
    <div style="text-align: right;">
      <div style="font-weight: 700; color: #0284c7;">Doklad č. ${escapeHtml(claim.claimNumber)}</div>
      <div class="meta">Dátum ošetrenia: ${escapeHtml(claim.incidentDate)}</div>
    </div>
  </div>

  <div class="grid">
    <div class="box">
      <div class="box-title">1. Poistené zviera (Pacient)</div>
      <div><strong>Meno:</strong> ${escapeHtml(claim.patient.name)} (${escapeHtml(claim.patient.species)})</div>
      <div><strong>Plemeno:</strong> ${escapeHtml(claim.patient.breed || "neuvedené")}</div>
      <div><strong>Mikročip (ISO 11784/11785):</strong> <code style="font-size: 12px; font-weight: bold; color: #0369a1;">${escapeHtml(claim.patient.microchipNumber || "CHÝBA ČIP")}</code></div>
      <div><strong>Hmotnosť:</strong> ${claim.patient.weightKg ? `${claim.patient.weightKg} kg` : "neuvedená"}</div>
    </div>

    <div class="box">
      <div class="box-title">2. Poistník / Majiteľ</div>
      <div><strong>Meno a priezvisko:</strong> ${escapeHtml(claim.client.firstName)} ${escapeHtml(claim.client.lastName)}</div>
      <div><strong>Telefón:</strong> ${escapeHtml(claim.client.phone || "neuvedený")}</div>
      <div><strong>E-mail:</strong> ${escapeHtml(claim.client.email || "neuvedený")}</div>
      <div><strong>Adresa:</strong> ${escapeHtml(claim.client.address || "neuvedená")}</div>
    </div>
  </div>

  <div class="box" style="margin-bottom: 16px;">
    <div class="box-title">3. Klinická diagnóza a priebeh liečby</div>
    <div style="margin-bottom: 6px;"><strong>Ošetrujúci veterinárny lekár:</strong> ${escapeHtml(claim.veterinarianName)} ${claim.veterinarianKvl ? `(KVL SR: ${escapeHtml(claim.veterinarianKvl)})` : ""}</div>
    <div style="margin-bottom: 6px;"><strong>Klinická diagnóza:</strong> ${escapeHtml(claim.diagnosisText)} ${claim.diagnosisCode ? `[${escapeHtml(claim.diagnosisCode)}]` : ""}</div>
    <div><strong>Anamnéza a liečebný postup:</strong> ${escapeHtml(claim.treatmentSummary)}</div>
  </div>

  <div class="box">
    <div class="box-title">4. Účtované položky a veterinárne úkony</div>
    <table>
      <thead>
        <tr>
          <th>Popis výkonu / liečiva</th>
          <th style="text-align: center;">Množstvo</th>
          <th style="text-align: right;">Cena/jedn.</th>
          <th style="text-align: right;">Spolu s DPH</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows}
      </tbody>
    </table>

    <div class="total-box">
      <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 14px; margin-bottom: 4px;">
        <span>Celková suma faktúry:</span>
        <span>${claim.invoiceTotal.toFixed(2)} €</span>
      </div>
      <div style="display: flex; justify-content: space-between; color: #b45309; font-size: 12px; margin-bottom: 2px;">
        <span>Spoluúčasť klienta (priama úhrada v ambulancii):</span>
        <span>${claim.clientCoPayAmount.toFixed(2)} €</span>
      </div>
      <div style="display: flex; justify-content: space-between; color: #15803d; font-weight: bold; font-size: 13px;">
        <span>Nárokované poistné plnenie (úhrada poisťovňou klinike):</span>
        <span>${claim.insurerPayoutAmount.toFixed(2)} €</span>
      </div>
    </div>
  </div>

  <div style="margin-top: 14px; font-size: 11px; color: #64748b; background: #fff; padding: 8px; border: 1px dashed #cbd5e1; border-radius: 4px;">
    <strong>Vyhlásenie poistníka:</strong> Súhlasím s postúpením poistného plnenia priamo ošetrujúcej veterinárnej klinike v zmysle poistných podmienok PetExpert Slovensko. Potvrdzujem správnosť a úplnosť uvedených údajov.
  </div>

  <div class="signature-grid">
    <div>
      <div class="signature-line">Podpis poistníka / majiteľa zvieraťa</div>
    </div>
    <div>
      <div class="signature-line">Pečiatka a podpis veterinárneho lekára</div>
    </div>
  </div>
</body>
</html>
  `.trim();
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
