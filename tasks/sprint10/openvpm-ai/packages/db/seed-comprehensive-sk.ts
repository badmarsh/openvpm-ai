/**
 * seed-comprehensive-sk.ts
 * ──────────────────────────────────────────────────────────────────────────────
 * Komplexný seed chýbajúcich dát pre všetky doteraz prázdne a podvýživené moduly:
 *
 *  1. 🏷️ CRSZ & Mikročipy — microchip_registrations (ISO 11784/11785)
 *  2. 📘 PetPassy EÚ & KVL ČR — pet_passports, kvl_cr_passports
 *  3. 🏛️ KVEPIS & ÚPVS — ext_kvepis_credentials, ext_kvepis_submissions
 *  4. 🦷 Dentálny diagram — dental_charts (Triadan odontogram pre psov a mačky)
 *  5. 👥 Archív migrácie: Spolumajitelia — client_contacts (matched s klientmi)
 *  6. 💊 Archív migrácie: Výdaje — external_prescription_fills
 *  7. 📋 Plány liečby a rozpočty — visit_treatment_plans, treatment_plans, treatment_plan_items
 *  8. ⏳ Čakáreň: Waitlist — appointment_waitlist
 *  9. 🌐 Marketing: Web kliniky dopyty — ext_marketing_website_inquiries
 * 10. ⏱️ Marketing: Recall schedules — ext_marketing_recall_schedules
 * 11. 🛡️ Klinický strážca — ext_clinical_guardian_alerts
 * 12. ⚠️ Liekové interakcie — drug_interactions
 * 13. ✍️ KVL AI podpisy — ext_clinician_confirmations
 * 14. 💶 Fakturácia: Cenové ponuky a storná — invoices (estimate & void) + položky
 * 15. 📈 Krivky hmotnosti a vitálne funkcie — patient_weights, vital_signs, patient_allergies, problem_list
 * 16. 🐕 Hlásenia besnoty RVPS — ext_rabies_notifications
 * 17. 🎯 CRM Segmenty — materiálizácia členstiev ext_crm_segment_memberships
 * ──────────────────────────────────────────────────────────────────────────────
 */

import { config } from "dotenv";
import { resolve } from "path";
import { writeFileSync } from "fs";
import { execSync } from "child_process";
import crypto from "crypto";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), "../../.env") });

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgresql://openpims:openpims@127.0.0.1:5434/openvpm_ai";
}

import postgres from "postgres";

async function main() {
  console.log("==========================================================================");
  console.log("🚀 Spúšťam komplexný seed chýbajúcich dát pre OpenVPM AI...");
  console.log("==========================================================================\n");

  const localSql = postgres(process.env.DATABASE_URL!);

  // 1. Získaj primárnu slovenskú kliniku (MVDr. Martin Sýkora)
  const [practice] = await localSql`
    SELECT id, name FROM practices
    WHERE id = '5c4ebbbc-90e1-457a-87a7-7895f560317d'
       OR name ILIKE '%Martin Sýkora%'
    LIMIT 1;
  `;

  if (!practice) {
    console.error("❌ Slovenská klinika MVDr. Martin Sýkora nebola nájdená.");
    process.exit(1);
  }

  const practiceId = practice.id;
  console.log(`✓ Klinika: ${practice.name} (${practiceId})\n`);

  // 2. Získaj personál kliniky
  const staff = await localSql`
    SELECT id, name, role, email FROM users
    WHERE practice_id = ${practiceId}
    ORDER BY role, name;
  `;

  const admin = staff.find((u) => u.role === "admin") ?? staff[0];
  const vets = staff.filter((u) => u.role === "veterinarian" || u.role === "admin");
  const vet1 = vets[0] ?? admin;
  const vet2 = vets[1] ?? vet1;
  const vet3 = vets[2] ?? vet1;

  console.log(`✓ Personál: Admin (${admin.name}), Veterinári: ${vets.map((v) => v.name).join(", ")}`);

  // 3. Získaj pacientov a klientov pre rôzne moduly
  const chippedPatients = await localSql`
    SELECT p.id, p.name, p.species, p.breed, p.client_id, p.microchip_number,
           c.first_name as client_first, c.last_name as client_last
    FROM patients p
    JOIN clients c ON p.client_id = c.id
    WHERE p.practice_id = ${practiceId}
      AND p.microchip_number IS NOT NULL
      AND length(btrim(p.microchip_number)) > 0
    ORDER BY p.id
    LIMIT 20;
  `;

  const regularPatients = await localSql`
    SELECT p.id, p.name, p.species, p.breed, p.client_id,
           c.first_name as client_first, c.last_name as client_last
    FROM patients p
    JOIN clients c ON p.client_id = c.id
    WHERE p.practice_id = ${practiceId}
    ORDER BY p.id
    LIMIT 30;
  `;

  const sampleClients = await localSql`
    SELECT id, first_name, last_name, email, phone
    FROM clients
    WHERE practice_id = ${practiceId}
    ORDER BY id
    LIMIT 15;
  `;

  const appointmentTypes = await localSql`
    SELECT id, name FROM appointment_types
    WHERE practice_id = ${practiceId}
    ORDER BY id;
  `;

  const activeAppointments = await localSql`
    SELECT id, patient_id, client_id, doctor_id, type_id, status
    FROM appointments
    WHERE practice_id = ${practiceId}
    ORDER BY id
    LIMIT 10;
  `;

  const sampleServices = await localSql`
    SELECT id, name, category, default_price FROM services
    WHERE practice_id = ${practiceId}
    ORDER BY id
    LIMIT 10;
  `;

  const sampleProducts = await localSql`
    SELECT id, name, category, unit_price FROM products
    WHERE practice_id = ${practiceId}
    ORDER BY id
    LIMIT 10;
  `;

  const rabiesVaccinations = await localSql`
    SELECT vr.id, vr.patient_id, vr.vaccine_name, vr.lot_number, vr.administered_at
    FROM vaccination_records vr
    WHERE vr.practice_id = ${practiceId}
      AND (vr.vaccine_name ILIKE '%besnota%' OR vr.vaccine_name ILIKE '%rabies%' OR vr.vaccine_name ILIKE '%lr%' OR vr.vaccine_name ILIKE '%biocan%')
    ORDER BY vr.id
    LIMIT 10;
  `;

  const externalPrescriptions = await localSql`
    SELECT id, patient_id, medication_name, external_source, external_id, prescribed_at, expires_at
    FROM external_prescriptions
    WHERE practice_id = ${practiceId}
    ORDER BY id
    LIMIT 15;
  `;

  console.log(`✓ Načítané podklady: ${chippedPatients.length} čipovaných pacientov, ${sampleServices.length} služieb, ${sampleProducts.length} produktov.\n`);

  // Začíname generovať SQL príkazy
  const sqlStatements: string[] = [
    "-- ==========================================================================",
    "-- OpenVPM AI — Komplexný seed dát pre všetky prázdne moduly",
    `-- Dátum generovania: ${new Date().toISOString()}`,
    `-- Klinika ID: ${practiceId} (${practice.name})`,
    "-- ==========================================================================",
    "BEGIN;",
    "",
  ];

  // ---------------------------------------------------------------------------
  // 1. 🏷️ CRSZ & MIKROČIPY (microchip_registrations)
  // ---------------------------------------------------------------------------
  console.log("1️⃣ Pripravujem register mikročipov CRSZ...");
  sqlStatements.push("-- 1. Mikročipy CRSZ");
  for (let i = 0; i < Math.min(12, chippedPatients.length); i++) {
    const p = chippedPatients[i];
    const vet = vets[i % vets.length]!;
    const regStatus = i === 11 ? "PENDING_SUBMISSION" : "REGISTERED";
    const crszId = `CRSZ-2026-SK-${String(104820 + i)}`;
    const implantDate = new Date(Date.now() - (180 + i * 30) * 86400000).toISOString().slice(0, 10);
    const regTimestamp = new Date(Date.now() - (175 + i * 30) * 86400000).toISOString();

    sqlStatements.push(`
      INSERT INTO microchip_registrations (
        id, practice_id, patient_id, client_id, veterinarian_id,
        microchip_number, location, implanted_at, verified_before_implant,
        verified_after_implant, vet_kvl_number, crsz_status, crsz_registered_at,
        crsz_record_id, notes, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), '${practiceId}', '${p.id}', '${p.client_id}', '${vet.id}',
        '${p.microchip_number}', 'LEFT_NECK', '${implantDate}', 'YES',
        'YES', 'KVL-SR-${1800 + i}', '${regStatus}', '${regTimestamp}',
        '${crszId}', 'Aplikácia subkutánne na ľavej strane krku v súlade s ISO 11784/11785. Zviera pokojné, overené čítačkou pred aj po.', NOW(), NOW()
      ) ON CONFLICT DO NOTHING;
    `);
  }

  // ---------------------------------------------------------------------------
  // 2. 📘 PETPASSY EÚ & KVL ČR PASY (pet_passports, kvl_cr_passports)
  // ---------------------------------------------------------------------------
  console.log("2️⃣ Pripravujem PetPassy EÚ a pasy KVL ČR...");
  sqlStatements.push("-- 2. PetPassy EÚ & KVL ČR");
  for (let i = 0; i < Math.min(6, chippedPatients.length); i++) {
    const p = chippedPatients[i];
    const vet = vets[i % vets.length]!;
    const passportNo = `SK 04${String(8190 + i)}`;
    const issueDate = new Date(Date.now() - (150 + i * 20) * 86400000).toISOString().slice(0, 10);
    const rabiesDate = new Date(Date.now() - (145 + i * 20) * 86400000).toISOString().slice(0, 10);
    const validUntil = new Date(Date.now() + (220 - i * 20) * 86400000).toISOString().slice(0, 10);
    const travelEligible = new Date(Date.now() - (124 + i * 20) * 86400000).toISOString().slice(0, 10);
    const vaxRecordId = rabiesVaccinations[i % rabiesVaccinations.length]?.id ?? null;

    sqlStatements.push(`
      INSERT INTO pet_passports (
        id, practice_id, patient_id, client_id, issued_by, passport_number,
        issued_at, issuing_clinic_name, issuing_vet_name, issuing_vet_kvl,
        rabies_vaccine_name, rabies_batch_number, rabies_administered_at,
        rabies_valid_until, travel_eligible_from, vaccination_record_id, notes,
        created_at, updated_at
      ) VALUES (
        gen_random_uuid(), '${practiceId}', '${p.id}', '${p.client_id}', '${vet.id}',
        '${passportNo}', '${issueDate}', 'Súkromná veterinárna klinika MVDr. Martin Sýkora',
        '${vet.name}', 'KVL-SR-1849', 'Nobivac Rabies', 'W048B01', '${rabiesDate}',
        '${validUntil}', '${travelEligible}', ${vaxRecordId ? `'${vaxRecordId}'` : "NULL"},
        'Vystavený úradný pas spoločenského zvieraťa EÚ. Vakcinácia platná pre cezhraničné cestovanie.', NOW(), NOW()
      ) ON CONFLICT DO NOTHING;
    `);
  }

  for (let i = 0; i < 3; i++) {
    const p = chippedPatients[6 + i] ?? chippedPatients[i];
    const vet = vets[i % vets.length]!;
    const passportNo = `CZ 12${String(9400 + i)}`;
    const issueDate = new Date(Date.now() - (200 + i * 30) * 86400000).toISOString().slice(0, 10);

    sqlStatements.push(`
      INSERT INTO kvl_cr_passports (
        id, practice_id, patient_id, client_id, issued_by, passport_number,
        issued_at, issuing_clinic_name, issuing_vet_name, issuing_vet_kvl_cr,
        microchip_number, notes, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), '${practiceId}', '${p.id}', '${p.client_id}', '${vet.id}',
        '${passportNo}', '${issueDate}', 'Veterinární klinika Brno / KVL ČR',
        'MVDr. Jan Dvořák', 'ČZP-4102', '${p.microchip_number}',
        'Cestovný pas vydaný v ČR, evidovaný v Komore veterinárnych lekárov ČR.', NOW(), NOW()
      ) ON CONFLICT DO NOTHING;
    `);
  }

  // ---------------------------------------------------------------------------
  // 3. 🏛️ KVEPIS & ÚPVS (ext_kvepis_credentials, ext_kvepis_submissions)
  // ---------------------------------------------------------------------------
  console.log("3️⃣ Pripravujem KVEPIS poverenia a podania...");
  sqlStatements.push("-- 3. KVEPIS & ÚPVS");
  sqlStatements.push(`
    INSERT INTO ext_kvepis_credentials (
      id, practice_id, ico, kvl_id, upvs_schranka, integration_mode,
      signing_preference, is_active, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), '${practiceId}', '47239102', 'KVL-SR-1849',
      'ICO/47239102', 'GUIDED', 'DSIGNER', true, NOW(), NOW()
    ) ON CONFLICT (practice_id) DO UPDATE SET
      ico = EXCLUDED.ico, kvl_id = EXCLUDED.kvl_id, upvs_schranka = EXCLUDED.upvs_schranka;
  `);

  const kvepisSubmissions = [
    {
      ref: "KVEPIS-20260915-0001",
      type: "treatment_diary_batch",
      status: "ACKNOWLEDGED",
      desc: "Dávka ambulantnej knihy ošetrení za predchádzajúci týždeň (12 pacientov)",
      upvsMsg: "UPVS-MSG-2026-9481029",
      receiptTime: "2026-09-15 10:14:22+00",
    },
    {
      ref: "KVEPIS-20260916-0002",
      type: "rabies_notification",
      status: "ACKNOWLEDGED",
      desc: "Hlásenie o vakcinácii proti besnote do 3 dní od aplikácie (RVPS Senec)",
      upvsMsg: "UPVS-MSG-2026-9502841",
      receiptTime: "2026-09-16 14:32:10+00",
    },
    {
      ref: "KVEPIS-20260917-0003",
      type: "animal_movement",
      status: "SUBMITTED",
      desc: "Hlásenie o trvalom premiestnení a zmene držiteľa chovného koňa (CEHZ 204918)",
      upvsMsg: "UPVS-MSG-2026-9529940",
      receiptTime: null,
    },
    {
      ref: "KVEPIS-20260918-0004",
      type: "treatment_diary_batch",
      status: "VALIDATED",
      desc: "Dávka ambulantnej knihy ošetrení — validovaná schéma XSD, pripravené na KEP podpis",
      upvsMsg: null,
      receiptTime: null,
    },
    {
      ref: "KVEPIS-20260918-0005",
      type: "rabies_notification",
      status: "DRAFT",
      desc: "Koncept hlásenia prebiehajúceho pozorovania besnoty — 5. deň po pohryznutí",
      upvsMsg: null,
      receiptTime: null,
    },
  ];

  for (const sub of kvepisSubmissions) {
    const payloadHash = crypto.createHash("sha256").update(sub.ref + sub.desc).digest("hex");
    const receiptPayload = sub.receiptTime
      ? JSON.stringify({ status: "DELIVERED", upvsId: sub.upvsMsg, timestamp: sub.receiptTime, authority: "ŠVPS SR / ÚPVS GovBox" })
      : null;

    sqlStatements.push(`
      INSERT INTO ext_kvepis_submissions (
        id, practice_id, submission_type, status, reference_number,
        source_entity_type, transponder_number, kvl_number,
        payload_xml, payload_hash, signature_method, signed_by, signed_at,
        submitted_at, upvs_message_id, receipt_received_at, receipt_payload,
        notes, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), '${practiceId}', '${sub.type}', '${sub.status}', '${sub.ref}',
        'statutory_sync', '941000014114203', 'KVL-SR-1849',
        '<KvepisMessage xmlns="http://schemas.svps.sk/kvepis/2026"><Header><Ref>${sub.ref}</Ref></Header><Body><Description>${sub.desc}</Description></Body></KvepisMessage>',
        '${payloadHash}', 'DSIGNER', '${vet1.id}', ${sub.status !== 'DRAFT' ? "NOW()" : "NULL"},
        ${sub.status === 'SUBMITTED' || sub.status === 'ACKNOWLEDGED' ? "NOW()" : "NULL"},
        ${sub.upvsMsg ? `'${sub.upvsMsg}'` : "NULL"},
        ${sub.receiptTime ? `'${sub.receiptTime}'` : "NULL"},
        ${receiptPayload ? `'${receiptPayload}'::jsonb` : "NULL"},
        '${sub.desc}', NOW(), NOW()
      ) ON CONFLICT DO NOTHING;
    `);
  }

  // ---------------------------------------------------------------------------
  // 4. 🦷 DENTÁLNE ZÁZNAMY — ODONTOGRAM (dental_charts)
  // ---------------------------------------------------------------------------
  console.log("4️⃣ Pripravujem zubné diagramy (Triadan kódovanie)...");
  sqlStatements.push("-- 4. Zubné diagramy (Odontogram)");

  const dentalTeethConfigs = [
    // Pacient 1 (Pes): Blesk / Cooper
    {
      patient: regularPatients[0] ?? chippedPatients[0],
      chartDate: new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10),
      teeth: [
        { code: "104", cond: "HEALTHY", treatment: null, notes: "Pravý horný očný zub, sklovina intaktná" },
        { code: "108", cond: "DECAYED", treatment: "Ultrazvukové odstránenie zubného kameňa a leštenie pastou", notes: "Trhák — masívny nános zubného kameňa, mierna gingivitída" },
        { code: "204", cond: "HEALTHY", treatment: null, notes: "Ľavý horný očný zub" },
        { code: "208", cond: "DECAYED", treatment: "Odstránenie zubného kameňa a laváž chlórhexidínom", notes: "Subgingiválny plak, vrecko 2mm" },
        { code: "304", cond: "HEALTHY", treatment: null, notes: "Ľavý dolný očný zub" },
        { code: "309", cond: "MOBILE", treatment: "Chirurgická extrakcia a vstrebateľná sutúra", notes: "Parodontitída 3. stupňa, mobilita zuba" },
        { code: "404", cond: "FRACTURED", treatment: "Zahladenie ostrých hrán a aplikácia fluoridového laku", notes: "Neúplná fraktúra korunky bez obnaženia drene" },
        { code: "409", cond: "HEALTHY", treatment: null, notes: "Pravý dolný molár" },
      ],
    },
    // Pacient 2 (Mačka): Lili / Sisa
    {
      patient: regularPatients.find((p) => p.species === "feline") ?? regularPatients[1],
      chartDate: new Date(Date.now() - 12 * 86400000).toISOString().slice(0, 10),
      teeth: [
        { code: "104", cond: "HEALTHY", treatment: null, notes: "Horný očný zub intaktný" },
        { code: "108", cond: "MOBILE", treatment: "Extrakcia zuba v celkovej anestézii", notes: "FRO (Feline Resorptive Lesion) krčková lézia 2. typu" },
        { code: "204", cond: "HEALTHY", treatment: null, notes: "Horný očný zub v poriadku" },
        { code: "304", cond: "HEALTHY", treatment: null, notes: "Dolný očák" },
        { code: "307", cond: "MISSING", treatment: null, notes: "Premolár extrahovaný v minulosti" },
        { code: "404", cond: "DECAYED", treatment: "Čistenie a leštenie", notes: "Zubný kameň supragingiválne" },
      ],
    },
    // Pacient 3: Bella
    {
      patient: regularPatients[2] ?? chippedPatients[1],
      chartDate: new Date(Date.now() - 25 * 86400000).toISOString().slice(0, 10),
      teeth: [
        { code: "101", cond: "HEALTHY", treatment: null, notes: "Rezáky v norme" },
        { code: "104", cond: "HEALTHY", treatment: null, notes: "Očný zub čistý" },
        { code: "208", cond: "ABRADED", treatment: "Monitorovanie stavu", notes: "Obrúsený hryzením tvrdých predmetov" },
        { code: "309", cond: "HEALTHY", treatment: null, notes: "Molár bez patológie" },
      ],
    },
  ];

  for (const dc of dentalTeethConfigs) {
    if (!dc.patient) continue;
    for (const t of dc.teeth) {
      sqlStatements.push(`
        INSERT INTO dental_charts (
          id, practice_id, patient_id, veterinarian_id, tooth_code,
          charted_at, condition, treatment, notes, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), '${practiceId}', '${dc.patient.id}', '${vet1.id}',
          '${t.code}', '${dc.chartDate}', '${t.cond}',
          ${t.treatment ? `'${t.treatment}'` : "NULL"},
          ${t.notes ? `'${t.notes}'` : "NULL"}, NOW(), NOW()
        ) ON CONFLICT DO NOTHING;
      `);
    }
  }

  // ---------------------------------------------------------------------------
  // 5. 👥 ARCHÍV MIGRÁCIE: SPOLUMAJITELIA (client_contacts)
  // ---------------------------------------------------------------------------
  console.log("5️⃣ Pripravujem spolumajiteľov a kontakty klientov...");
  sqlStatements.push("-- 5. Spolumajitelia (client_contacts)");

  const contactsData = [
    { first: "Ing. Peter", last: "Kováč", phone: "+421 905 112 233", email: "peter.kovac@gmail.com", kind: "co_owner" },
    { first: "Mgr. Lucia", last: "Vargová", phone: "+421 911 445 566", email: "lucia.vargova@azet.sk", kind: "co_owner" },
    { first: "Zuzana", last: "Tóthová", phone: "+421 908 778 899", email: "z.tothova@centrum.sk", kind: "emergency_contact" },
    { first: "Tomáš", last: "Molnár", phone: "+421 903 223 344", email: "tomas.molnar@post.sk", kind: "authorized_contact" },
    { first: "Katarína", last: "Balážová", phone: "+421 915 667 788", email: "katarina.b@gmail.com", kind: "co_owner" },
    { first: "Martin", last: "Horváth", phone: "+421 907 990 011", email: "m.horvath@zoznam.sk", kind: "co_owner" },
    { first: "Eva", last: "Nagyová", phone: "+421 918 334 455", email: "eva.nagyova@chello.sk", kind: "emergency_contact" },
    { first: "Marek", last: "Sloboda", phone: "+421 902 556 677", email: "sloboda.marek@gmail.com", kind: "authorized_contact" },
  ];

  for (let i = 0; i < contactsData.length; i++) {
    const c = sampleClients[i % sampleClients.length];
    const item = contactsData[i]!;
    const fp = crypto.createHash("sha256").update(`contact-winvet-${c.id}-${i}`).digest("hex");

    sqlStatements.push(`
      INSERT INTO client_contacts (
        id, practice_id, client_id, attribution_status, kind,
        first_name, last_name, email, phone, external_source, external_id,
        import_fingerprint, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), '${practiceId}', '${c.id}', 'matched', '${item.kind}',
        '${item.first}', '${item.last}', '${item.email}', '${item.phone}',
        'winvet', 'wv_contact_${1000 + i}', '${fp}', NOW(), NOW()
      ) ON CONFLICT DO NOTHING;
    `);
  }

  // ---------------------------------------------------------------------------
  // 6. 💊 ARCHÍV MIGRÁCIE: VÝDAJE LIEKOV (external_prescription_fills)
  // ---------------------------------------------------------------------------
  console.log("6️⃣ Pripravujem históriu výdajov predpisov v archíve...");
  sqlStatements.push("-- 6. Výdaje liekov (external_prescription_fills)");

  for (let i = 0; i < Math.min(12, externalPrescriptions.length); i++) {
    const rx = externalPrescriptions[i];
    const fillDate = new Date(Date.now() - (40 + i * 5) * 86400000).toISOString();
    const fp = crypto.createHash("sha256").update(`fill-winvet-${rx.id}-${i}`).digest("hex");

    sqlStatements.push(`
      INSERT INTO external_prescription_fills (
        id, practice_id, prescription_id, filled_at, quantity_dispensed,
        directions, source_status, prescriber_display_name, external_source,
        external_id, import_fingerprint, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), '${practiceId}', '${rx.id}', '${fillDate}', 1.000,
        '1 tableta denne po jedle, využívať celé balenie', 'dispensed',
        'MVDr. Martin Sýkora', 'winvet', 'wv_fill_${2000 + i}', '${fp}',
        NOW(), NOW()
      ) ON CONFLICT DO NOTHING;
    `);
  }

  // ---------------------------------------------------------------------------
  // 7. 📋 PLÁNY LIEČBY A ROZPOČTY (treatment_plans, visit_treatment_plans)
  // ---------------------------------------------------------------------------
  console.log("7️⃣ Pripravujem liečebné plány a cenové návrhy...");
  sqlStatements.push("-- 7. Plány liečby a rozpočty");

  const treatmentPlansConfigs = [
    {
      title: "Liečebný plán: Sanácia ústnej dutiny a extrakcie zubov",
      desc: "Predoperačné biochemické vyšetrenie krvi, inhalačná anestézia, ultrazvukové odstránenie zubného kameňa a extrakcia kývajúcich sa molárov.",
      status: "active",
      patient: regularPatients[0] ?? chippedPatients[0],
      items: [
        { desc: "Predoperačný biochemický a hematologický profil", inst: "Nalačno 12 hodín pred odberom", order: 1 },
        { desc: "Celková inhalačná anestézia s intubáciou a monitoringom", inst: "Úvod propofol, udržiavanie izoflurán", order: 2 },
        { desc: "Ultrazvukové čistenie zubov a leštenie pastou", inst: "Očistenie všetkých kvadrantov", order: 3 },
        { desc: "Extrakcia molárov 309 a sutúra vstrebateľným materiálom", inst: "Lokálny zubný blok lidokaínom", order: 4 },
      ],
    },
    {
      title: "Manažment chronického renálneho zlyhania (IRIS štádium II)",
      desc: "Dlhodobý terapeutický protokol zameraný na spomalenie progresie renálnej insuficiencie.",
      status: "active",
      patient: regularPatients[1] ?? chippedPatients[1],
      items: [
        { desc: "Prechod na striktnú renálnu diétu (Royal Canin Renal / Hill''s k/d)", inst: "Postupný prechod počas 7 dní", order: 1 },
        { desc: "Podávanie viazača fosfátov (Pronefra perorálne)", inst: "1 ml na 4 kg ž.hm. dvakrát denne s jedlom", order: 2 },
        { desc: "Kontrolný odber krvi a moču (SDMA, kreatinín, UPC)", inst: "O 30 dní nalačno", order: 3 },
      ],
    },
  ];

  for (const tp of treatmentPlansConfigs) {
    const planId = crypto.randomUUID();
    sqlStatements.push(`
      INSERT INTO treatment_plans (
        id, practice_id, patient_id, title, description, status,
        start_date, created_by, created_at, updated_at
      ) VALUES (
        '${planId}', '${practiceId}', '${tp.patient.id}', '${tp.title}',
        '${tp.desc}', '${tp.status}', CURRENT_DATE - 10, '${vet1.id}', NOW(), NOW()
      ) ON CONFLICT DO NOTHING;
    `);

    for (const item of tp.items) {
      sqlStatements.push(`
        INSERT INTO treatment_plan_items (
          id, plan_id, description, instructions, status, sort_order, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), '${planId}', '${item.desc}', '${item.inst}', 'done',
          ${item.order}, NOW(), NOW()
        ) ON CONFLICT DO NOTHING;
      `);
    }

    // Vytvor aj visit treatment plan pre encounter
    const appt = activeAppointments.find((a) => a.patient_id === tp.patient.id) ?? activeAppointments[0];
    if (appt) {
      const opId = crypto.randomUUID();
      const opHash = crypto.createHash("sha256").update(opId + tp.title).digest("hex");
      sqlStatements.push(`
        INSERT INTO visit_treatment_plans (
          id, practice_id, client_id, patient_id, appointment_id, created_by,
          title, status, operation_id, operation_payload_hash, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), '${practiceId}', '${appt.client_id}', '${appt.patient_id}',
          '${appt.id}', '${vet1.id}', '${tp.title}', 'open', '${opId}', '${opHash}', NOW(), NOW()
        ) ON CONFLICT DO NOTHING;
      `);
    }
  }

  // ---------------------------------------------------------------------------
  // 8. ⏳ ČAKÁREŇ: WAITLIST (appointment_waitlist)
  // ---------------------------------------------------------------------------
  console.log("8️⃣ Pripravujem čakací zoznam pre čakáreň...");
  sqlStatements.push("-- 8. Čakací zoznam (appointment_waitlist)");

  const waitlistConfigs = [
    { p: regularPatients[3] ?? chippedPatients[0], typeId: appointmentTypes[0]?.id, notes: "Čaká na uvoľnenie ranného termínu na operáciu (nalačno)" },
    { p: regularPatients[4] ?? chippedPatients[1], typeId: appointmentTypes[1]?.id, notes: "Záujem o skoršiu kontrolu pooperačnej rany" },
    { p: regularPatients[5] ?? chippedPatients[2], typeId: appointmentTypes[2]?.id, notes: "Preferuje poobedňajší termín po 16:00 na vakcináciu" },
    { p: regularPatients[6] ?? chippedPatients[3], typeId: appointmentTypes[3]?.id, notes: "Akútne svrbenie uší — pri zrušení termínu ihneď volať" },
  ];

  for (const w of waitlistConfigs) {
    if (!w.p) continue;
    sqlStatements.push(`
      INSERT INTO appointment_waitlist (
        id, practice_id, client_id, patient_id, type_id, status,
        preferred_from, preferred_to, notes, created_by, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), '${practiceId}', '${w.p.client_id}', '${w.p.id}',
        ${w.typeId ? `'${w.typeId}'` : "NULL"}, 'waiting', CURRENT_DATE, CURRENT_DATE + 7,
        '${w.notes}', '${admin.id}', NOW(), NOW()
      ) ON CONFLICT DO NOTHING;
    `);
  }

  // ---------------------------------------------------------------------------
  // 9. 🌐 MARKETING: WEB KLINIKY DOPYTY (ext_marketing_website_inquiries)
  // ---------------------------------------------------------------------------
  console.log("9️⃣ Pripravujem prichádzajúce online dopyty z webu...");
  sqlStatements.push("-- 9. Online dopyty z webu kliniky");

  const inquiries = [
    { name: "Martina Kováčová", email: "martina.kovacova@gmail.com", phone: "+421 905 123 456", msg: "Dobrý deň, chcela by som objednať mačičku na kastráciu a čipovanie na budúci utorok.", status: "new", meta: { petName: "Micka", preferredDate: "2026-09-22", service: "Kastrácia mačky" } },
    { name: "Ing. Juraj Bánsky", email: "juraj.bansky@centrum.sk", phone: "+421 918 654 321", msg: "Potrebujem vystaviť PetPass pred cestou do Rakúska a skontrolovať očkovanie besnoty.", status: "in_progress", meta: { petName: "Aron", preferredDate: "2026-09-23", service: "PetPass a besnota" } },
    { name: "Alena Veselej", email: "alena.vesela@post.sk", phone: "+421 903 987 654", msg: "Náš pes začal večer krívať na zadnú ľavú nohu, môžeme prísť na vyšetrenie hneď ráno?", status: "resolved", meta: { petName: "Boby", preferredDate: "2026-09-19", service: "Ortopedické vyšetrenie" } },
    { name: "MUDr. Robert Fekete", email: "fekete.robert@gmail.com", phone: "+421 907 555 444", msg: "Prosím o termín na ultrazvukové čistenie zubov pre 8-ročného maltézskeho psíka.", status: "new", meta: { petName: "Teddy", preferredDate: "2026-09-24", service: "Zubná hygiena" } },
    { name: "Zuzana Palková", email: "zuzana.palkova@azet.sk", phone: "+421 911 222 333", msg: "Otázka k antiparazitárnym obojkom: aký odporúčate pre šteniatko zlatého retrievera?", status: "resolved", meta: { petName: "Rony", service: "Poradenstvo" } },
  ];

  for (let i = 0; i < inquiries.length; i++) {
    const inq = inquiries[i]!;
    const client = sampleClients[i % sampleClients.length];

    sqlStatements.push(`
      INSERT INTO ext_marketing_website_inquiries (
        id, practice_id, client_id, name, email, phone, message, status, source,
        metadata, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), '${practiceId}', '${client.id}', '${inq.name}',
        '${inq.email}', '${inq.phone}', '${inq.msg}', '${inq.status}', 'website_contact',
        '${JSON.stringify(inq.meta)}'::jsonb, NOW() - INTERVAL '${i * 4} hours', NOW()
      ) ON CONFLICT DO NOTHING;
    `);
  }

  // ---------------------------------------------------------------------------
  // 10. ⏱️ MARKETING: RECALL SCHEDULES (ext_marketing_recall_schedules)
  // ---------------------------------------------------------------------------
  console.log("🔟 Pripravujem nastavenie recall plánov kliniky...");
  sqlStatements.push("-- 10. Recall plány kliniky");
  sqlStatements.push(`
    INSERT INTO ext_marketing_recall_schedules (
      id, practice_id, vaccination_recall_enabled, vaccination_recall_lead_days,
      post_visit_review_enabled, post_visit_review_delay_hours, post_visit_handout_enabled,
      inactive_recall_enabled, inactive_recall_months, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), '${practiceId}', true, 14, true, 48, true, true, 18, NOW(), NOW()
    ) ON CONFLICT (practice_id) DO UPDATE SET
      vaccination_recall_enabled = true, vaccination_recall_lead_days = 14;
  `);

  // ---------------------------------------------------------------------------
  // 11. 🛡️ KLINICKÝ STRÁŽCA (ext_clinical_guardian_alerts)
  // ---------------------------------------------------------------------------
  console.log("1️⃣1️⃣ Pripravujem klinické bezpečnostné upozornenia...");
  sqlStatements.push("-- 11. Klinický strážca");

  const guardianAlerts = [
    {
      cat: "statutory_deadline",
      sev: "warning",
      title: "Zákonná lehota: Hlásenie vakcinácie besnoty RVPS (3 dni)",
      msg: "Pre pacienta bol zaznamenaný záznam vakcinácie proti besnote. V zmysle § 19 ods. 1 zákona 39/2007 Z. z. je potrebné podanie autorizovať a odoslať do KVEPIS do 3 pracovných dní.",
      action: "Otvoriť KVEPIS Hub a potvrdiť odoslanie hlásenia",
      status: "open",
    },
    {
      cat: "medication_safety",
      sev: "critical",
      title: "Kritická lieková interakcia: Meloxikam + Prednizolón",
      msg: "Zaznamenané súčasné podanie nesteroidného antiflogistika a kortikosteroidu. Závažné riziko gastrointestinálnych ulcerácií až perforácie.",
      action: "Zrušiť jedno z liečiv alebo nasadiť gastroprotektívum (Omeprazol)",
      status: "open",
    },
    {
      cat: "statutory_deadline",
      sev: "info",
      title: "Ochranná lehota: Mäso a mlieko hospodárskych zvierat",
      msg: "Aplikované antibiotikum Cobactan LC s ochrannou lehotou 72 hodín na mlieko. Ochranná lehota končí 20.9.2026.",
      action: "Skontrolovať záznam v Knihe ošetrení hospodárskych zvierat",
      status: "open",
    },
    {
      cat: "vet_intelligence",
      sev: "info",
      title: "Pozorovanie besnoty — 5. deň ukončený bez príznakov",
      msg: "Pacient Bruno absolvoval 2. kontrolu po pohryznutí človeka. Zviera klinicky zdravé, bez neurologických porúch.",
      action: "Naplánovať záverečnú kontrolu na 14. deň",
      status: "resolved",
    },
  ];

  for (let i = 0; i < guardianAlerts.length; i++) {
    const a = guardianAlerts[i]!;
    const p = regularPatients[i] ?? chippedPatients[0];
    sqlStatements.push(`
      INSERT INTO ext_clinical_guardian_alerts (
        id, practice_id, patient_id, category, severity, title, message,
        suggested_action, status, resolved_by, resolved_at, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), '${practiceId}', '${p.id}', '${a.cat}', '${a.sev}',
        '${a.title}', '${a.msg}', '${a.action}', '${a.status}',
        ${a.status === 'resolved' ? `'${vet1.id}'` : "NULL"},
        ${a.status === 'resolved' ? "NOW()" : "NULL"},
        NOW() - INTERVAL '${i * 12} hours', NOW()
      ) ON CONFLICT DO NOTHING;
    `);
  }

  // ---------------------------------------------------------------------------
  // 12. ⚠️ LIEKOVÉ INTERAKCIE (drug_interactions)
  // ---------------------------------------------------------------------------
  console.log("1️⃣2️⃣ Pripravujem databázu liekových interakcií...");
  sqlStatements.push("-- 12. Liekové interakcie");

  const interactions = [
    { a: "Meloxicam", b: "Prednisolone", sev: "major", desc: "Súčasné podávanie NSAID a kortikosteroidov výrazne zvyšuje riziko gastrointestinálnych ulcerácií a krvácania. Dodržte vymývaciu lehotu min. 48-72 hodín." },
    { a: "Enrofloxacin", b: "Theophylline", sev: "moderate", desc: "Fluórochinolóny inhibujú hepatálny metabolizmus teofylínu, čo vedie k zvýšeniu jeho plazmatickej koncentrácie a toxicite (tachykardia, kŕče)." },
    { a: "Furosemide", b: "Gentamicin", sev: "major", desc: "Zvýšené riziko ireverzibilnej ototoxicitity a nefrotoxicity pri kombinácii kľučkových diuretík a aminoglykozidov." },
    { a: "Phenobarbital", b: "Doxycycline", sev: "moderate", desc: "Fenobarbital indukuje hepatálne mikrozomálne enzýmy a skracuje polčas eliminácie doxycyklínu." },
    { a: "Metronidazole", b: "Phenobarbital", sev: "moderate", desc: "Zrýchlený metabolizmus metronidazolu znižuje jeho antimikrobiálnu účinnosť." },
    { a: "Ketoconazole", b: "Cyclosporine", sev: "moderate", desc: "Ketokonazol výrazne zvyšuje biologickú dostupnosť a hladinu cyklosporínu inhibíciou CYP3A4." },
    { a: "Clomipramine", b: "Tramadol", sev: "major", desc: "Riziko serotonínového syndrómu a zvýšená pohotovosť ku kŕčom." },
    { a: "Amlodipine", b: "Atenolol", sev: "minor", desc: "Aditívny hypotenzívny účinok, monitorujte systémový arteriálny tlak." },
  ];

  for (const inter of interactions) {
    sqlStatements.push(`
      INSERT INTO drug_interactions (
        id, drug_a, drug_b, severity, description, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), '${inter.a}', '${inter.b}', '${inter.sev}',
        '${inter.desc}', NOW(), NOW()
      ) ON CONFLICT DO NOTHING;
    `);
  }

  // ---------------------------------------------------------------------------
  // 13. ✍️ KVL AI PODPISY (ext_clinician_confirmations)
  // ---------------------------------------------------------------------------
  console.log("1️⃣3️⃣ Pripravujem KVL schvaľovacie podpisy AI konceptov...");
  sqlStatements.push("-- 13. KVL AI podpisy veterinárom");

  for (let i = 0; i < 4; i++) {
    const vet = vets[i % vets.length]!;
    const dummyHash = crypto.createHash("sha256").update(`clinical-draft-${i}`).digest("hex");
    const confirmHash = crypto.createHash("sha256").update(`clinical-confirmed-${i}`).digest("hex");

    sqlStatements.push(`
      INSERT INTO ext_clinician_confirmations (
        id, practice_id, actor_id, actor_role, action_type, entity_type,
        entity_id, expected_revision, original_draft_hash, confirmed_content_hash,
        status, issued_at, expires_at, consumed_at, consumed_by, correlation_id,
        created_at, updated_at
      ) VALUES (
        gen_random_uuid(), '${practiceId}', '${vet.id}', 'veterinarian', 'sign_soap_note',
        'soap_note', gen_random_uuid(), 1, '${dummyHash}', '${confirmHash}',
        'CONSUMED', NOW() - INTERVAL '${i * 2} days', NOW() + INTERVAL '7 days',
        NOW() - INTERVAL '${i * 2} days', '${vet.id}', 'corr_${200 + i}',
        NOW(), NOW()
      ) ON CONFLICT DO NOTHING;
    `);
  }

  // ---------------------------------------------------------------------------
  // 14. 💶 FAKTURÁCIA: CENOVÉ PONUKY & STORNOVANÉ FAKTÚRY (invoices)
  // ---------------------------------------------------------------------------
  console.log("1️⃣4️⃣ Pripravujem cenové ponuky (estimates) a storná...");
  sqlStatements.push("-- 14. Fakturácia: Cenové ponuky a storná");

  // 3 cenové ponuky
  const estimateConfigs = [
    { p: regularPatients[0] ?? chippedPatients[0], sub: 215.00, tax: 43.00, tot: 258.00, desc: "Cenový návrh: Sanácia chrupu a parodontálny zákrok" },
    { p: regularPatients[1] ?? chippedPatients[1], sub: 650.00, tax: 130.00, tot: 780.00, desc: "Cenový návrh: TPLO operácia ruptúry predného skríženého väzu" },
    { p: regularPatients[2] ?? chippedPatients[2], sub: 120.00, tax: 24.00, tot: 144.00, desc: "Cenový návrh: Dermatologický diagnostický plán a alergény" },
  ];

  for (const est of estimateConfigs) {
    const invId = crypto.randomUUID();
    sqlStatements.push(`
      INSERT INTO invoices (
        id, practice_id, client_id, patient_id, status, subtotal, tax, total,
        paid_amount, due_date, is_estimate, created_at, updated_at
      ) VALUES (
        '${invId}', '${practiceId}', '${est.p.client_id}', '${est.p.id}', 'draft',
        ${est.sub}, ${est.tax}, ${est.tot}, 0.00, CURRENT_DATE + 14, true, NOW(), NOW()
      ) ON CONFLICT DO NOTHING;

      INSERT INTO invoice_items (
        id, invoice_id, description, quantity, unit_price, total, item_type, taxable, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), '${invId}', '${est.desc}', 1.000, ${est.sub}, ${est.sub}, 'service', true, NOW(), NOW()
      ) ON CONFLICT DO NOTHING;
    `);
  }

  // 2 stornované faktúry
  for (let i = 0; i < 2; i++) {
    const p = regularPatients[3 + i] ?? chippedPatients[i];
    const invId = crypto.randomUUID();
    sqlStatements.push(`
      INSERT INTO invoices (
        id, practice_id, client_id, patient_id, status, subtotal, tax, total,
        paid_amount, due_date, is_estimate, created_at, updated_at
      ) VALUES (
        '${invId}', '${practiceId}', '${p.client_id}', '${p.id}', 'void',
        45.00, 9.00, 54.00, 0.00, CURRENT_DATE - 5, false, NOW() - INTERVAL '6 days', NOW()
      ) ON CONFLICT DO NOTHING;

      INSERT INTO invoice_items (
        id, invoice_id, description, quantity, unit_price, total, item_type, taxable, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), '${invId}', 'Kontrolné vyšetrenie (stornované z dôvodu duplicity dokladu)', 1.000, 45.00, 45.00, 'service', true, NOW(), NOW()
      ) ON CONFLICT DO NOTHING;
    `);
  }

  // ---------------------------------------------------------------------------
  // 15. 📈 KRIVKY HMOTNOSTI, VITÁLNE FUNKCIE, ALERGIE, PROBLÉMY
  // ---------------------------------------------------------------------------
  console.log("1️⃣5️⃣ Pripravujem časové rady hmotností, vitálne funkcie a alergie...");
  sqlStatements.push("-- 15. Hmotnosť, vitálne funkcie, alergie, diagnózy");

  for (let i = 0; i < Math.min(10, regularPatients.length); i++) {
    const p = regularPatients[i]!;
    const baseWeight = p.species === "feline" ? 4.2 : 18.5;

    // 4 body hmotnosti v čase pre krivku
    for (let m = 4; m >= 1; m--) {
      const weight = (baseWeight + (4 - m) * (p.species === "feline" ? 0.15 : 0.6)).toFixed(2);
      sqlStatements.push(`
        INSERT INTO patient_weights (
          id, patient_id, weight_kg, recorded_at, recorded_by, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), '${p.id}', ${weight}, NOW() - INTERVAL '${m * 45} days', '${vet1.id}', NOW(), NOW()
        ) ON CONFLICT DO NOTHING;
      `);
    }

    // Vitálne funkcie
    sqlStatements.push(`
      INSERT INTO vital_signs (
        id, practice_id, patient_id, recorded_by, recorded_at,
        temperature_c, heart_rate_bpm, respiratory_rate_bpm, weight_kg,
        body_condition_score, body_condition_scale, pain_score, mucous_membrane,
        capillary_refill_sec, notes, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), '${practiceId}', '${p.id}', '${vet1.id}', NOW() - INTERVAL '${i * 3} days',
        38.6, ${p.species === "feline" ? 160 : 95}, ${p.species === "feline" ? 28 : 22}, ${baseWeight.toFixed(2)},
        5, 9, 0, 'ružové, vlhké', 1.5,
        'Klinicky stabilný pacient, vezikulárne dýchanie, srdcové ozvy ohraničené bez šelestu.', NOW(), NOW()
      ) ON CONFLICT DO NOTHING;
    `);

    // Alergie pre vybraných pacientov
    if (i % 2 === 0) {
      const allergens = [
        { name: "Amoxicilín / Kyselina klavulánová", react: "Kožný pruritus, generalizovaná urtikária a opuch tváre do 30 min.", sev: "severe" },
        { name: "Hovädzia bielkovina (potravinová intolerancia)", react: "Chronická otitída a interdigitálny erytém", sev: "moderate" },
        { name: "Metronidazol", react: "Nauzea, mierna ataxia pri vyšších dávkach", sev: "moderate" },
      ];
      const a = allergens[(i / 2) % allergens.length]!;
      sqlStatements.push(`
        INSERT INTO patient_allergies (
          id, patient_id, allergen, reaction, severity, noted_by, noted_at, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), '${p.id}', '${a.name}', '${a.react}', '${a.sev}', '${vet1.id}', NOW() - INTERVAL '90 days', NOW(), NOW()
        ) ON CONFLICT DO NOTHING;
      `);
    }

    // Aktívny problém v zozname problémov
    if (i % 2 === 1) {
      const problems = [
        "Atopická dermatitída — sezónny pruritus",
        "Chronická renálna insuficiencia IRIS II",
        "Gingivostomatitída a zubný kameň",
        "Osteoartritída bedrového kĺbu",
      ];
      const prob = problems[i % problems.length]!;
      sqlStatements.push(`
        INSERT INTO problem_list (
          id, practice_id, patient_id, description, status, onset_date, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), '${practiceId}', '${p.id}', '${prob}', 'active', CURRENT_DATE - 60, NOW(), NOW()
        ) ON CONFLICT DO NOTHING;
      `);
    }
  }

  // ---------------------------------------------------------------------------
  // 16. 🐕 HLÁSENIA BESNOTY NA RVPS (ext_rabies_notifications)
  // ---------------------------------------------------------------------------
  console.log("1️⃣6️⃣ Pripravujem hlásenia o očkovaní besnoty pre RVPS...");
  sqlStatements.push("-- 16. Hlásenia besnoty RVPS");

  const rvpsOffices = ["RVPS Bratislava-mesto", "RVPS Senec", "RVPS Dunajská Streda"];
  for (let i = 0; i < Math.min(3, rabiesVaccinations.length); i++) {
    const vr = rabiesVaccinations[i]!;
    const office = rvpsOffices[i % rvpsOffices.length]!;

    sqlStatements.push(`
      INSERT INTO ext_rabies_notifications (
        id, practice_id, vaccination_record_id, rvps_notified_at, rvps_office_name,
        status, submission_reference, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), '${practiceId}', '${vr.id}', NOW() - INTERVAL '${i + 1} days',
        '${office}', 'confirmed', 'RVPS-NOTIF-2026-${String(810 + i)}', NOW(), NOW()
      ) ON CONFLICT DO NOTHING;
    `);
  }

  // ---------------------------------------------------------------------------
  // 17. 🎯 CRM SEGMENTY — MATERIÁLIZÁCIA ČLENOV
  // ---------------------------------------------------------------------------
  console.log("1️⃣7️⃣ Pripravujem priradenie klientov do CRM segmentov...");
  sqlStatements.push("-- 17. CRM segmenty členstvá");

  const existingSegments = await localSql`
    SELECT id, segment_key, name FROM ext_crm_segments
    WHERE practice_id = ${practiceId}
    ORDER BY id;
  `;

  if (existingSegments.length > 0) {
    for (let sIdx = 0; sIdx < existingSegments.length; sIdx++) {
      const seg = existingSegments[sIdx]!;
      // Priraď 3-6 klientov do každého segmentu
      const memberClients = sampleClients.slice(sIdx % 4, (sIdx % 4) + 4);
      for (const mc of memberClients) {
        sqlStatements.push(`
          INSERT INTO ext_crm_segment_memberships (
            id, practice_id, segment_id, client_id, enrolled_at, created_at, updated_at
          ) VALUES (
            gen_random_uuid(), '${practiceId}', '${seg.id}', '${mc.id}', NOW() - INTERVAL '10 days', NOW(), NOW()
          ) ON CONFLICT DO NOTHING;
        `);
      }
      // Aktualizuj cache počtu členov
      sqlStatements.push(`
        UPDATE ext_crm_segments
        SET member_count_cache = ${memberClients.length}, last_refreshed_at = NOW()
        WHERE id = '${seg.id}';
      `);
    }
  }

  sqlStatements.push("", "COMMIT;");

  const fullSql = sqlStatements.join("\n");
  const sqlFilePath = resolve(process.cwd(), "seed-comprehensive-sk.sql");
  writeFileSync(sqlFilePath, fullSql, "utf8");
  console.log(`\n💾 Vygenerovaný SQL skript: ${sqlFilePath} (${(fullSql.length / 1024).toFixed(1)} KB)\n`);

  // ---------------------------------------------------------------------------
  // APLIKÁCIA NA LOKÁLNU DATABÁZU
  // ---------------------------------------------------------------------------
  console.log("📦 [1/2] Aplikujem SQL na LOKÁLNU databázu (openvpm-postgres-1 -> openvpm_ai)...");
  try {
    execSync(`docker exec -i openvpm-postgres-1 psql -U openpims -d openvpm_ai -v ON_ERROR_STOP=1`, {
      input: fullSql,
      stdio: ["pipe", "inherit", "inherit"],
    });
    console.log("✅ LOKÁLNA databáza úspešne aktualizovaná!\n");
  } catch (err: any) {
    console.error("❌ Chyba pri lokálnom seedovaní:", err.message);
    process.exit(1);
  }

  // ---------------------------------------------------------------------------
  // APLIKÁCIA NA PRODUKČNÚ DATABÁZU
  // ---------------------------------------------------------------------------
  console.log("🌐 [2/2] Aplikujem SQL na PRODUKČNÚ databázu (dev.significa.sk -> openvpm-postgres-cfoqxx -> openpims)...");
  let remoteCid = "";
  try {
    remoteCid = execSync(`ssh root@dev.significa.sk "docker ps -q -f name=openvpm-postgres-cfoqxx"`, {
      encoding: "utf8",
    }).trim();
    if (!remoteCid) {
      throw new Error("Kontajner openvpm-postgres-cfoqxx nebol na serveri nájdený!");
    }
    console.log(`✓ Vzdialený kontajner ID: ${remoteCid}`);

    execSync(`ssh root@dev.significa.sk "docker exec -i ${remoteCid} psql -U openpims -d openpims -v ON_ERROR_STOP=1"`, {
      input: fullSql,
      stdio: ["pipe", "inherit", "inherit"],
    });
    console.log("✅ PRODUKČNÁ databáza úspešne aktualizovaná!\n");
  } catch (err: any) {
    console.error("❌ Chyba pri produkčnom seedovaní:", err.message);
    process.exit(1);
  }

  // ---------------------------------------------------------------------------
  // KONTROLA PARITY OBIDVOCH PROSTREDÍ
  // ---------------------------------------------------------------------------
  console.log("🔍 Overujem počty záznamov na oboch prostrediach súčasne...");

  const verifyQuery = `
    SELECT 'microchip_registrations' AS tbl, count(*) FROM microchip_registrations
    UNION ALL SELECT 'pet_passports', count(*) FROM pet_passports
    UNION ALL SELECT 'kvl_cr_passports', count(*) FROM kvl_cr_passports
    UNION ALL SELECT 'ext_kvepis_submissions', count(*) FROM ext_kvepis_submissions
    UNION ALL SELECT 'ext_kvepis_credentials', count(*) FROM ext_kvepis_credentials
    UNION ALL SELECT 'dental_charts', count(*) FROM dental_charts
    UNION ALL SELECT 'client_contacts', count(*) FROM client_contacts
    UNION ALL SELECT 'external_prescription_fills', count(*) FROM external_prescription_fills
    UNION ALL SELECT 'treatment_plans', count(*) FROM treatment_plans
    UNION ALL SELECT 'visit_treatment_plans', count(*) FROM visit_treatment_plans
    UNION ALL SELECT 'appointment_waitlist', count(*) FROM appointment_waitlist
    UNION ALL SELECT 'ext_marketing_website_inquiries', count(*) FROM ext_marketing_website_inquiries
    UNION ALL SELECT 'ext_crm_segment_memberships', count(*) FROM ext_crm_segment_memberships
    UNION ALL SELECT 'ext_clinical_guardian_alerts', count(*) FROM ext_clinical_guardian_alerts
    UNION ALL SELECT 'drug_interactions', count(*) FROM drug_interactions
    UNION ALL SELECT 'ext_clinician_confirmations', count(*) FROM ext_clinician_confirmations
    UNION ALL SELECT 'ext_rabies_notifications', count(*) FROM ext_rabies_notifications
    UNION ALL SELECT 'patient_weights', count(*) FROM patient_weights
    UNION ALL SELECT 'vital_signs', count(*) FROM vital_signs
    UNION ALL SELECT 'patient_allergies', count(*) FROM patient_allergies
    UNION ALL SELECT 'problem_list', count(*) FROM problem_list
    UNION ALL SELECT 'invoices_estimates', count(*) FROM invoices WHERE is_estimate = true
    UNION ALL SELECT 'invoices_void', count(*) FROM invoices WHERE status = 'void'
    ORDER BY tbl;
  `;

  console.log("\n--- LOKÁLNA DATABÁZA (openvpm_ai) ---");
  execSync(`docker exec -i openvpm-postgres-1 psql -U openpims -d openvpm_ai -c "${verifyQuery.replace(/\n/g, ' ')}"`, { stdio: "inherit" });

  console.log("\n--- PRODUKČNÁ DATABÁZA (openpims na dev.significa.sk) ---");
  execSync(`ssh root@dev.significa.sk "docker exec -i ${remoteCid} psql -U openpims -d openpims -c \\"${verifyQuery.replace(/\n/g, ' ')}\\""`, { stdio: "inherit" });

  console.log("\n==========================================================================");
  console.log("🎉 VŠETKY PRÁZDNE MODULY BOLI ÚSPEŠNE A KONZISTENTNE NAPLNENÉ NA OBOCH PROSTREDIACH!");
  console.log("==========================================================================\n");

  await localSql.end();
}

main().catch((err) => {
  console.error("Fatálna chyba:", err);
  process.exit(1);
});
