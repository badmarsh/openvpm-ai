/**
 * OpenVPM AI — KVEPIS Canonical XML / D.Signer Payload Builder
 * 
 * Generates valid XML payloads formatted according to ŠVPS SR specifications
 * and UPVS (Ústredný portál verejnej správy) electronic filing standards.
 */

import crypto from "node:crypto";
import {
  RabiesNotificationData,
  TreatmentDiaryBatchData,
  AnimalMovementData,
} from "./validator";

export function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&apos;";
      case '"':
        return "&quot;";
      default:
        return c;
    }
  });
}

/**
 * Zostaví kánonické XML pre Oznámenie o očkovaní proti besnote
 */
export function buildRabiesNotificationXml(
  submissionRef: string,
  data: RabiesNotificationData
): { xml: string; hash: string } {
  const adminDateStr = new Date(data.vaccination.administeredAt).toISOString().split("T")[0];
  const validUntilStr = new Date(data.vaccination.validUntil).toISOString().split("T")[0];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<KvepisSubmission xmlns="http://schemas.svps.sk/kvepis/2026/rabies" version="1.0">
  <Header>
    <SubmissionId>${escapeXml(submissionRef)}</SubmissionId>
    <SubmissionType>RABIES_VACCINATION</SubmissionType>
    <GeneratedAt>${new Date().toISOString()}</GeneratedAt>
    <RvpsOfficeCode>${escapeXml(data.rvpsCode)}</RvpsOfficeCode>
  </Header>
  <Veterinarian>
    <Name>${escapeXml(data.veterinarian.name)}</Name>
    <KvlNumber>${escapeXml(data.veterinarian.kvlNumber)}</KvlNumber>
  </Veterinarian>
  <Patient>
    <Name>${escapeXml(data.patient.name)}</Name>
    <Species>${escapeXml(data.patient.species)}</Species>
    <MicrochipNumber>${escapeXml(data.patient.microchipNumber || "")}</MicrochipNumber>
    <PassportNumber>${escapeXml(data.patient.passportNumber || "")}</PassportNumber>
  </Patient>
  <Owner>
    <Name>${escapeXml(data.client.name)}</Name>
    <Address>${escapeXml(data.client.address || "")}</Address>
    <City>${escapeXml(data.client.city || "")}</City>
    <Phone>${escapeXml(data.client.phone || "")}</Phone>
  </Owner>
  <VaccinationDetails>
    <VaccineName>${escapeXml(data.vaccination.vaccineName)}</VaccineName>
    <BatchNumber>${escapeXml(data.vaccination.batchNumber)}</BatchNumber>
    <AdministeredAt>${adminDateStr}</AdministeredAt>
    <ValidUntil>${validUntilStr}</ValidUntil>
    <RabiesStatutoryNotice>Potvrdené podľa § 17 ods. 3 Zákona č. 39/2007 Z. z.</RabiesStatutoryNotice>
  </VaccinationDetails>
</KvepisSubmission>`.trim();

  const hash = crypto.createHash("sha256").update(xml, "utf8").digest("hex");
  return { xml, hash };
}

/**
 * Zostaví kánonické XML pre Kniha ošetrení hospodárskych zvierat
 */
export function buildTreatmentDiaryBatchXml(
  submissionRef: string,
  data: TreatmentDiaryBatchData
): { xml: string; hash: string } {
  const treatmentsXml = data.treatments
    .map(
      (t) => `    <TreatmentRecord>
      <AnimalEarTag>${escapeXml(t.animalIdentification)}</AnimalEarTag>
      <Species>${escapeXml(t.species)}</Species>
      <Diagnosis>${escapeXml(t.diagnosis)}</Diagnosis>
      <MedicationName>${escapeXml(t.medicationName)}</MedicationName>
      <BatchNumber>${escapeXml(t.batchNumber)}</BatchNumber>
      <AdministeredAt>${new Date(t.administeredAt).toISOString().split("T")[0]}</AdministeredAt>
      <WithdrawalMeatDays>${t.meatWithdrawalDays}</WithdrawalMeatDays>
      <WithdrawalMilkDays>${t.milkWithdrawalDays}</WithdrawalMilkDays>
      <SafeUntilMeat>${new Date(t.safeUntilMeat).toISOString().split("T")[0]}</SafeUntilMeat>
      <SafeUntilMilk>${new Date(t.safeUntilMilk).toISOString().split("T")[0]}</SafeUntilMilk>
    </TreatmentRecord>`
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<KvepisTreatmentBatch xmlns="http://schemas.svps.sk/kvepis/2026/treatment" version="1.0">
  <Header>
    <SubmissionId>${escapeXml(submissionRef)}</SubmissionId>
    <SubmissionType>TREATMENT_DIARY_BATCH</SubmissionType>
    <GeneratedAt>${new Date().toISOString()}</GeneratedAt>
    <FarmCehzCode>${escapeXml(data.farm.cehzCode)}</FarmCehzCode>
    <OwnerName>${escapeXml(data.farm.ownerName)}</OwnerName>
  </Header>
  <Veterinarian>
    <Name>${escapeXml(data.veterinarian.name)}</Name>
    <KvlNumber>${escapeXml(data.veterinarian.kvlNumber)}</KvlNumber>
  </Veterinarian>
  <Treatments count="${data.treatments.length}">
${treatmentsXml}
  </Treatments>
</KvepisTreatmentBatch>`.trim();

  const hash = crypto.createHash("sha256").update(xml, "utf8").digest("hex");
  return { xml, hash };
}

/**
 * Zostaví kánonické XML pre Sprievodný doklad na premiestnenie / bitúnok
 */
export function buildAnimalMovementXml(
  submissionRef: string,
  data: AnimalMovementData
): { xml: string; hash: string } {
  const animalsXml = data.animals
    .map(
      (a) => `    <Animal>
      <EarTag>${escapeXml(a.identification)}</EarTag>
      <Species>${escapeXml(a.species)}</Species>
      <ActiveWithdrawalPeriod>${a.activeWithdrawalPeriod ? "true" : "false"}</ActiveWithdrawalPeriod>
    </Animal>`
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<KvepisAnimalMovement xmlns="http://schemas.svps.sk/kvepis/2026/movement" version="1.0">
  <Header>
    <SubmissionId>${escapeXml(submissionRef)}</SubmissionId>
    <SubmissionType>ANIMAL_MOVEMENT</SubmissionType>
    <GeneratedAt>${new Date().toISOString()}</GeneratedAt>
    <SourceCehz>${escapeXml(data.sourceCehz)}</SourceCehz>
    <DestinationCehz>${escapeXml(data.destinationCehz)}</DestinationCehz>
    <DestinationType>${escapeXml(data.destinationType)}</DestinationType>
  </Header>
  <VeterinaryDeclaration>
    <InspectedAt>${new Date(data.inspectionDate).toISOString().split("T")[0]}</InspectedAt>
    <VeterinarianName>${escapeXml(data.veterinarian.name)}</VeterinarianName>
    <KvlNumber>${escapeXml(data.veterinarian.kvlNumber)}</KvlNumber>
    <HealthDeclaration>Zvieratá sú bez klinických príznakov nákaz a spôsobilé na prepravu.</HealthDeclaration>
  </VeterinaryDeclaration>
  <Animals count="${data.animals.length}">
${animalsXml}
  </Animals>
</KvepisAnimalMovement>`.trim();

  const hash = crypto.createHash("sha256").update(xml, "utf8").digest("hex");
  return { xml, hash };
}
