import { config } from "dotenv";
import { resolve } from "path";
import postgres from "postgres";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), "../../.env") });

const dbUrl = process.env.DATABASE_URL || "postgresql://openpims:openpims@127.0.0.1:5434/openvpm_ai";
const sql = postgres(dbUrl);

const CANONICAL_PRACTICE_ID = "5c4ebbbc-90e1-457a-87a7-7895f560317d";
const CANONICAL_DR_SYKORA_ID = "b1963bb2-ef34-470e-ab2d-a22a250984bb";

async function main() {
  console.log("🌾 Spúšťam seeding terénnych fariem a hospodárskych zvierat pre MVDr. Sýkoru...");

  const [practice] = await sql`SELECT id, name FROM practices WHERE id = ${CANONICAL_PRACTICE_ID} LIMIT 1`;
  if (!practice) {
    console.error("Klinika nenájdená.");
    process.exit(1);
  }
  console.log(`✓ Klinika: ${practice.name}`);

  let [drSykora] = await sql`SELECT id, name FROM users WHERE id = ${CANONICAL_DR_SYKORA_ID} LIMIT 1`;
  if (!drSykora) {
    const [anyVet] = await sql`SELECT id, name FROM users WHERE practice_id = ${practice.id} AND role = 'veterinarian' LIMIT 1`;
    drSykora = anyVet;
  }
  console.log(`✓ Veterinár: ${drSykora?.name} (${drSykora?.id})`);

  const [location] = await sql`SELECT id, name FROM locations WHERE practice_id = ${practice.id} LIMIT 1`;

  const largeAnimalProducts = [
    { name: "Ubrolexin intramammárna suspenzia (10 aplikátorov)", sku: "VET-LA-001", category: "Intramammáriá", unitPrice: 38.50, costPrice: 22.00, stockQuantity: 45, lotNumber: "UB-2026-08A", expirationDate: "2027-12-31" },
    { name: "Cobactan 2.5% inj. 100ml (cefquinome)", sku: "VET-LA-002", category: "Antibiotiká inj.", unitPrice: 64.00, costPrice: 41.50, stockQuantity: 30, lotNumber: "CB-88412", expirationDate: "2028-05-31" },
    { name: "Calciject 40 CM infúzia 500ml", sku: "VET-LA-003", category: "Infúzne roztoky", unitPrice: 16.50, costPrice: 8.90, stockQuantity: 60, lotNumber: "CJ-2601", expirationDate: "2027-09-30" },
    { name: "Alamycin LA 300mg/ml inj. 250ml (oxytetracyklín)", sku: "VET-LA-004", category: "Antibiotiká inj.", unitPrice: 42.00, costPrice: 24.00, stockQuantity: 25, lotNumber: "AL-9041", expirationDate: "2028-02-28" },
    { name: "Draxxin 100mg/ml inj. 100ml (tulathromycin)", sku: "VET-LA-005", category: "Antibiotiká inj.", unitPrice: 145.00, costPrice: 98.00, stockQuantity: 18, lotNumber: "DX-5521", expirationDate: "2027-11-30" },
    { name: "Melovem 20mg/ml inj. 100ml (meloxicam)", sku: "VET-LA-006", category: "Antiflogistiká", unitPrice: 48.00, costPrice: 28.50, stockQuantity: 20, lotNumber: "ML-3310", expirationDate: "2028-04-30" },
    { name: "Metricure intrauterinná suspenzia (10 aplikátorov)", sku: "VET-LA-007", category: "Gynekologiká", unitPrice: 52.00, costPrice: 32.00, stockQuantity: 22, lotNumber: "MC-7119", expirationDate: "2027-10-31" },
    { name: "Ivomec Classic inj. 500ml (ivermectin)", sku: "VET-LA-008", category: "Antiparazitiká", unitPrice: 78.00, costPrice: 45.00, stockQuantity: 15, lotNumber: "IV-1029", expirationDate: "2028-08-31" },
    { name: "Bovilis IBR Marker Live (50 dávok + riedidlo)", sku: "VET-LA-009", category: "Vakcíny HD", unitPrice: 95.00, costPrice: 65.00, stockQuantity: 24, lotNumber: "BV-4820", expirationDate: "2027-06-30" },
    { name: "Ketovet perorálny roztok (kanister 5 L)", sku: "VET-LA-010", category: "Dietetiká & Metaboliká", unitPrice: 55.00, costPrice: 31.00, stockQuantity: 10, lotNumber: "KV-0045", expirationDate: "2028-01-31" }
  ];

  const productMap: Record<string, string> = {};
  for (const p of largeAnimalProducts) {
    const [existing] = await sql`SELECT id FROM products WHERE practice_id = ${practice.id} AND sku = ${p.sku} LIMIT 1`;
    if (existing) {
      productMap[p.sku] = existing.id;
    } else {
      const [inserted] = await sql`
        INSERT INTO products (
          id, practice_id, location_id, name, sku, category,
          unit_price, cost_price, inventory_tracked, stock_quantity,
          reorder_point, lot_number, expiration_date, taxable, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), ${practice.id}, ${location ? location.id : null}, ${p.name}, ${p.sku}, ${p.category},
          ${p.unitPrice}, ${p.costPrice}, true, ${p.stockQuantity},
          5, ${p.lotNumber}, ${p.expirationDate}, true, now(), now()
        ) RETURNING id;
      `;
      productMap[p.sku] = inserted.id;
    }
  }

  const largeAnimalServices = [
    { name: "Klinické vyšetrenie HD na farme", code: "HD-EXAM", category: "Vyšetrenie", defaultPrice: 35.00 },
    { name: "Sonografické vyšetrenie gravidity HD (kus)", code: "HD-SONO", category: "Reprodukcia", defaultPrice: 6.50 },
    { name: "Ošetrenie paznechtov a flegmóny (panaritium)", code: "HD-HOOF", category: "Chirurgia & Končatiny", defaultPrice: 45.00 },
    { name: "Ošetrenie retencie sekundín / pôrodná asistencia", code: "HD-PARTUS", category: "Gynekológia", defaultPrice: 50.00 },
    { name: "Intramammárna / intravenózna aplikácia liečiv", code: "HD-APPL", category: "Terapia", defaultPrice: 15.00 },
    { name: "Vakcinácia stáda (kus)", code: "HD-VACC", category: "Imunoprofylaxia", defaultPrice: 2.50 },
    { name: "Dopravné do terénu / výjazdový paušál", code: "HD-TRAVEL", category: "Doprava", defaultPrice: 25.00 }
  ];

  const serviceMap: Record<string, string> = {};
  for (const s of largeAnimalServices) {
    const [existing] = await sql`SELECT id FROM services WHERE practice_id = ${practice.id} AND code = ${s.code} LIMIT 1`;
    if (existing) {
      serviceMap[s.code] = existing.id;
    } else {
      const [inserted] = await sql`
        INSERT INTO services (
          id, practice_id, name, code, category, default_price, taxable, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), ${practice.id}, ${s.name}, ${s.code}, ${s.category}, ${s.defaultPrice}, true, now(), now()
        ) RETURNING id;
      `;
      serviceMap[s.code] = inserted.id;
    }
  }

  const farmsData = [
    {
      farmKey: "podpolanie",
      firstName: "PD",
      lastName: "Podpoľanie (Farma Očová)",
      ico: "36012451",
      icDph: "SK2020084512",
      cehz: "104281",
      contactPerson: "Ing. Peter Kováčik (hl. zootechnik)",
      phone: "+421 905 442 110",
      email: "zootechnik@pdpodpolanie.sk",
      address: "Družstevná 14",
      city: "Očová",
      zip: "962 23",
      notes: "Mliečna farma, cca 320 holštajnských dojníc. Zmluva o poskytovaní vet. starostlivosti č. 2024/02. Fakturácia 2x mesačne.",
      cows: [
        { name: "Malina č. 2101", earTag: "SK 000801452101", dob: "2021-03-12", breed: "Holštajnsko-frízsky dobytok" },
        { name: "Hviezda č. 2102", earTag: "SK 000801452102", dob: "2020-05-18", breed: "Holštajnsko-frízsky dobytok" },
        { name: "Straka č. 2105", earTag: "SK 000801452105", dob: "2022-01-25", breed: "Holštajnsko-frízsky dobytok" },
        { name: "Rysuľa č. 2110", earTag: "SK 000801452110", dob: "2023-02-14", breed: "Holštajnsko-frízsky dobytok" }
      ]
    },
    {
      farmKey: "revuca",
      firstName: "Agrodružstvo",
      lastName: "Revúca - Farma Mokrá Lúka",
      ico: "31568412",
      icDph: "SK2020478190",
      cehz: "218492",
      contactPerson: "Vladimír Oravec (vedúci chovu)",
      phone: "+421 911 318 492",
      email: "chov@agrodruzstvo-revuca.sk",
      address: "Mokrá Lúka 88",
      city: "Mokrá Lúka",
      zip: "050 01",
      notes: "Mäsový dobytok (Slovenský strakatý + Charolais križenci), cca 180 ks. Fakturácia 1x mesačne k poslednému dňu v mesiaci.",
      cows: [
        { name: "Bela č. 0301", earTag: "SK 000802118301", dob: "2019-04-10", breed: "Slovenský strakatý dobytok" },
        { name: "Fatima č. 0314", earTag: "SK 000802118314", dob: "2021-08-22", breed: "Charolais" },
        { name: "Krása č. 0320", earTag: "SK 000802118320", dob: "2022-11-05", breed: "Slovenský strakatý dobytok" }
      ]
    },
    {
      farmKey: "tisovec",
      firstName: "BioFarma",
      lastName: "Hradová Tisovec, s.r.o.",
      ico: "44891204",
      icDph: "SK2022814560",
      cehz: "339105",
      contactPerson: "Marian Švantner (majiteľ farmy)",
      phone: "+421 908 559 105",
      email: "biofarma.hradova@gmail.com",
      address: "Rimavská 22",
      city: "Tisovec",
      zip: "980 61",
      notes: "Ekologický chov, pastevný odchov Pincgavského dobytka, cca 95 ks. Striktný dôraz na ochranné lehoty a bio certifikáciu.",
      cows: [
        { name: "Danka č. 1044", earTag: "SK 000803551044", dob: "2020-04-02", breed: "Pincgavský dobytok" },
        { name: "Janka č. 1045", earTag: "SK 000803551045", dob: "2020-04-05", breed: "Pincgavský dobytok" },
        { name: "Žofia č. 1050", earTag: "SK 000803551050", dob: "2018-09-19", breed: "Slovenský strakatý dobytok" }
      ]
    },
    {
      farmKey: "poloma",
      firstName: "Roľnícke družstvo",
      lastName: "Gemerská Poloma",
      ico: "00214582",
      icDph: "SK2020512844",
      cehz: "194820",
      contactPerson: "Ján Lipták (zootechnik)",
      phone: "+421 905 619 482",
      email: "poloma.druzstvo@stonline.sk",
      address: "SNP 45",
      city: "Gemerská Poloma",
      zip: "049 22",
      notes: "Kombinovaný chov dobytka (produkcia mlieka + výkrm býkov). Zmluvný veterinárny dohľad a reprodukcia.",
      cows: [
        { name: "Linda č. 1088", earTag: "SK 000804771088", dob: "2021-06-11", breed: "Holštajnsko-frízsky dobytok" },
        { name: "Štedrá č. 1092", earTag: "SK 000804771092", dob: "2022-03-30", breed: "Holštajnsko-frízsky dobytok" },
        { name: "Soňa č. 1099", earTag: "SK 000804771099", dob: "2023-01-18", breed: "Holštajnsko-frízsky dobytok" }
      ]
    }
  ];

  const farmMap: Record<string, { clientId: string; cows: Record<string, string> }> = {};

  for (const farm of farmsData) {
    let [existingClient] = await sql`
      SELECT id FROM clients
      WHERE practice_id = ${practice.id}
        AND external_id = ${farm.ico}
      LIMIT 1
    `;

    let clientId = existingClient?.id;
    if (!clientId) {
      const [insertedClient] = await sql`
        INSERT INTO clients (
          id, practice_id, first_name, last_name, external_source, external_id,
          email, phone, address, city, state, zip, notes, emergency_contact, emergency_phone,
          created_at, updated_at
        ) VALUES (
          gen_random_uuid(), ${practice.id}, ${farm.firstName}, ${farm.lastName}, 'cehz_farm', ${farm.ico},
          ${farm.email}, ${farm.phone}, ${farm.address}, ${farm.city}, 'SK', ${farm.zip},
          ${farm.notes}, ${farm.contactPerson}, ${farm.phone}, now(), now()
        ) RETURNING id;
      `;
      clientId = insertedClient.id;
    }

    const cowMap: Record<string, string> = {};
    for (const cow of farm.cows) {
      let [existingPatient] = await sql`
        SELECT id FROM patients
        WHERE practice_id = ${practice.id}
          AND client_id = ${clientId}
          AND microchip_number = ${cow.earTag}
        LIMIT 1
      `;

      let patientId = existingPatient?.id;
      if (!patientId) {
        const [insertedPatient] = await sql`
          INSERT INTO patients (
            id, practice_id, client_id, name, species, breed, sex,
            dob, microchip_number, status, created_at, updated_at
          ) VALUES (
            gen_random_uuid(), ${practice.id}, ${clientId}, ${cow.name}, 'bovine', ${cow.breed}, 'female',
            ${cow.dob}, ${cow.earTag}, 'active', now(), now()
          ) RETURNING id;
        `;
        patientId = insertedPatient.id;
      }
      cowMap[cow.earTag] = patientId;
    }

    farmMap[farm.farmKey] = { clientId, cows: cowMap };
    console.log(`✓ Farma ${farm.lastName} (${farm.ico}) pripravená s ${Object.keys(cowMap).length} kravami.`);
  }

  console.log("\n🚜 Vytváram terénne návštevy, podané/odovzdané lieky a KVEPIS záznamy za september 2026...");

  const f1 = farmMap["podpolanie"];
  const malinaId = f1.cows["SK 000801452101"];
  const hviezdaId = f1.cows["SK 000801452102"];

  const [appt1] = await sql`
    INSERT INTO appointments (
      id, practice_id, client_id, patient_id, doctor_id, start_time, end_time,
      status, origin, notes, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), ${practice.id}, ${f1.clientId}, ${malinaId}, ${drSykora.id},
      '2026-09-03 08:30:00+02', '2026-09-03 10:15:00+02',
      'checked_out', 'field',
      'Výjazd Očová: Malina č. 2101 (akútna mastitída LZ štvrte, CMT +++, Ubrolexin) + Hviezda č. 2102 (pôrodná paréza, Calciject 40 IV + Dexamed).',
      '2026-09-03 10:20:00+02', '2026-09-03 10:20:00+02'
    ) RETURNING id;
  `;

  await sql`
    INSERT INTO soap_notes (
      id, practice_id, patient_id, appointment_id, author_id, author_name,
      status, subjective, objective, assessment, plan, finalized_at, finalized_by, finalizer_name, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), ${practice.id}, ${malinaId}, ${appt1.id}, ${drSykora.id}, ${drSykora.name},
      'finalized',
      'Dojnica 3 dni po otelení, znížený nádoj na LZ štvrti, nepokoj pri dojení.',
      'Teplota 39.4°C, LZ štvrť zdurená, horúca, bolestivá. CMT test +++, vločky v mlieku.',
      'Mastitis catarrhalis acuta l. sin. post.',
      'Aplikovaný Ubrolexin. Ochranná lehota: mlieko 4 dni, mäso 7 dní. Vydané 1 celé balenie (10 ks) zootechnikovi na doliečenie.',
      '2026-09-03 10:30:00+02', ${drSykora.id}, ${drSykora.name}, '2026-09-03 10:20:00+02', '2026-09-03 10:30:00+02'
    );
  `;

  await sql`
    INSERT INTO ext_kvepis_submissions (
      id, practice_id, submission_type, status, reference_number, patient_id,
      farm_ico, cehz_code, ear_tag_number, kvl_number,
      payload_json, submitted_at, signed_at, receipt_received_at, notes, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), ${practice.id}, 'treatment_diary_batch', 'ACKNOWLEDGED',
      'KVEPIS-20260903-0010', ${malinaId}, '36012451', '104281', 'SK 000801452101', 'KVL-SR-1849',
      ${JSON.stringify({
        schemaVersion: "1.0",
        submissionType: "treatment_diary_batch",
        referenceNumber: "KVEPIS-20260903-0010",
        subject: { farmIco: "36012451", cehzCode: "104281", earTagNumber: "SK 000801452101", animalSpecies: "bovine" },
        clinical: {
          diagnosis: "Mastitis catarrhalis acuta",
          medicationName: "Ubrolexin intramammárna suspenzia",
          meatWithdrawalDays: 7,
          milkWithdrawalDays: 4,
          administeredAt: "2026-09-03T08:45:00Z"
        }
      })},
      '2026-09-03 11:00:00+02', '2026-09-03 10:55:00+02', '2026-09-03 11:05:00+02',
      'Potvrdená doručenka ÚPVS pre ambulantnú knihu ošetrení.',
      '2026-09-03 10:30:00+02', '2026-09-03 11:05:00+02'
    );
  `;

  await sql`
    INSERT INTO prescriptions (
      id, practice_id, patient_id, appointment_id, medication_name, dosage, frequency,
      quantity, product_id, prescribed_by, start_date, end_date, status, instructions, created_at, updated_at
    ) VALUES
    (
      gen_random_uuid(), ${practice.id}, ${malinaId}, ${appt1.id},
      'Ubrolexin intramammárna suspenzia', '1 aplikátor do LZ štvrte', 'á 12 hodín po vydojení',
      1, ${productMap["VET-LA-001"]}, ${drSykora.id}, '2026-09-03', '2026-09-06', 'completed',
      'Odovzdaná 1 krabička (10 aplikátorov) zootechnikovi. Ochranná lehota mlieko 96 hodín.',
      now(), now()
    ),
    (
      gen_random_uuid(), ${practice.id}, ${hviezdaId}, ${appt1.id},
      'Calciject 40 CM infúzia 500ml', '500ml IV pomaly', 'jednorazovo',
      2, ${productMap["VET-LA-003"]}, ${drSykora.id}, '2026-09-03', '2026-09-03', 'completed',
      'Podané priamo pri paréze. Krava vstala do 40 min.',
      now(), now()
    );
  `;

  const [appt2] = await sql`
    INSERT INTO appointments (
      id, practice_id, client_id, patient_id, doctor_id, start_time, end_time,
      status, origin, notes, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), ${practice.id}, ${f1.clientId}, ${f1.cows["SK 000801452105"]}, ${drSykora.id},
      '2026-09-11 09:00:00+02', '2026-09-11 11:30:00+02',
      'checked_out', 'field',
      'Sonografia gravidity 14 dojníc (stádo A). Odovzdané 2 fľaše Cobactan 2.5% do zásoby maštale.',
      '2026-09-11 11:45:00+02', '2026-09-11 11:45:00+02'
    ) RETURNING id;
  `;

  const [inv1] = await sql`
    INSERT INTO invoices (
      id, practice_id, client_id, status, subtotal, tax, total, paid_amount, due_date, is_estimate, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), ${practice.id}, ${f1.clientId}, 'paid',
      344.00, 79.12, 423.12, 423.12, '2026-09-29', false, '2026-09-15 14:00:00+02', '2026-09-18 10:00:00+02'
    ) RETURNING id;
  `;

  await sql`
    INSERT INTO invoice_items (
      id, invoice_id, description, quantity, unit_price, total, taxable, item_type, item_id, created_at, updated_at
    ) VALUES
    (gen_random_uuid(), ${inv1.id}, 'Klinické vyšetrenie HD na farme (Malina, Hviezda - 03.09.)', 2, 35.00, 70.00, true, 'service', ${serviceMap["HD-EXAM"]}, now(), now()),
    (gen_random_uuid(), ${inv1.id}, 'Ubrolexin intramammárna suspenzia (10 aplikátorov) - 1 bal.', 1, 38.50, 38.50, true, 'product', ${productMap["VET-LA-001"]}, now(), now()),
    (gen_random_uuid(), ${inv1.id}, 'Calciject 40 CM infúzia 500ml - 2 ks', 2, 16.50, 33.00, true, 'product', ${productMap["VET-LA-003"]}, now(), now()),
    (gen_random_uuid(), ${inv1.id}, 'Sonografické vyšetrenie gravidity HD (14 ks dojníc - 11.09.)', 14, 6.50, 91.00, true, 'service', ${serviceMap["HD-SONO"]}, now(), now()),
    (gen_random_uuid(), ${inv1.id}, 'Cobactan 2.5% inj. 100ml (vydané 2 fľaše do zásoby)', 2, 64.00, 128.00, true, 'product', ${productMap["VET-LA-002"]}, now(), now()),
    (gen_random_uuid(), ${inv1.id}, 'Dopravné do terénu (Očová a späť 2x výjazd)', 2, 17.50, 35.00, true, 'service', ${serviceMap["HD-TRAVEL"]}, now(), now());
  `;

  const strakaId = f1.cows["SK 000801452105"];
  const [appt3] = await sql`
    INSERT INTO appointments (
      id, practice_id, client_id, patient_id, doctor_id, start_time, end_time,
      status, origin, notes, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), ${practice.id}, ${f1.clientId}, ${strakaId}, ${drSykora.id},
      '2026-09-18 13:30:00+02', '2026-09-18 14:45:00+02',
      'checked_out', 'field',
      'Straka č. 2105: Retencia sekundín 36h post partum. Manuálna separácia, intrauterinná aplikácia Metricure 3 aplikátory + Oxytocín 50ml.',
      '2026-09-18 15:00:00+02', '2026-09-18 15:00:00+02'
    ) RETURNING id;
  `;

  const [inv1_open] = await sql`
    INSERT INTO invoices (
      id, practice_id, client_id, status, subtotal, tax, total, paid_amount, due_date, is_estimate, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), ${practice.id}, ${f1.clientId}, 'draft',
      126.00, 28.98, 154.98, 0.00, '2026-10-15', false, '2026-09-18 15:10:00+02', '2026-09-18 15:10:00+02'
    ) RETURNING id;
  `;

  await sql`
    INSERT INTO invoice_items (
      id, invoice_id, description, quantity, unit_price, total, taxable, item_type, item_id, created_at, updated_at
    ) VALUES
    (gen_random_uuid(), ${inv1_open.id}, 'Ošetrenie retencie sekundín / pôrodná asistencia (Straka č. 2105 - 18.09.)', 1, 50.00, 50.00, true, 'service', ${serviceMap["HD-PARTUS"]}, now(), now()),
    (gen_random_uuid(), ${inv1_open.id}, 'Metricure intrauterinná suspenzia (aplikované 3 aplikátory)', 1, 52.00, 52.00, true, 'product', ${productMap["VET-LA-007"]}, now(), now()),
    (gen_random_uuid(), ${inv1_open.id}, 'Dopravné do terénu (Očová)', 1, 24.00, 24.00, true, 'service', ${serviceMap["HD-TRAVEL"]}, now(), now());
  `;

  const f2 = farmMap["revuca"];
  const belaId = f2.cows["SK 000802118301"];
  const fatimaId = f2.cows["SK 000802118314"];

  const [apptRevuca1] = await sql`
    INSERT INTO appointments (
      id, practice_id, client_id, patient_id, doctor_id, start_time, end_time,
      status, origin, notes, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), ${practice.id}, ${f2.clientId}, ${belaId}, ${drSykora.id},
      '2026-09-05 10:00:00+02', '2026-09-05 12:30:00+02',
      'checked_out', 'field',
      'Mokrá Lúka: Bela č. 0301 (panaritium PZ končatiny, korektúra, dechtový obväz, Alamycin LA 40ml IM). Fatima č. 0314 (bronchopneumónia, Draxxin 15ml SC).',
      '2026-09-05 13:00:00+02', '2026-09-05 13:00:00+02'
    ) RETURNING id;
  `;

  await sql`
    INSERT INTO ext_kvepis_submissions (
      id, practice_id, submission_type, status, reference_number, patient_id,
      farm_ico, cehz_code, ear_tag_number, kvl_number,
      payload_json, submitted_at, signed_at, receipt_received_at, notes, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), ${practice.id}, 'treatment_diary_batch', 'ACKNOWLEDGED',
      'KVEPIS-20260905-0012', ${belaId}, '31568412', '218492', 'SK 000802118301', 'KVL-SR-1849',
      ${JSON.stringify({
        schemaVersion: "1.0",
        submissionType: "treatment_diary_batch",
        referenceNumber: "KVEPIS-20260905-0012",
        subject: { farmIco: "31568412", cehzCode: "218492", earTagNumber: "SK 000802118301", animalSpecies: "bovine" },
        clinical: {
          diagnosis: "Phlegmona interdigitalis (Panaritium)",
          medicationName: "Alamycin LA 300mg/ml inj. 250ml",
          meatWithdrawalDays: 28,
          milkWithdrawalDays: 7,
          administeredAt: "2026-09-05T08:30:00Z"
        }
      })},
      '2026-09-05 14:00:00+02', '2026-09-05 13:50:00+02', '2026-09-05 14:05:00+02',
      'Zaevidované v KVEPIS - kritická ochranná lehota mäso 28 dní.',
      '2026-09-05 13:00:00+02', '2026-09-05 14:05:00+02'
    );
  `;

  const [apptRevuca2] = await sql`
    INSERT INTO appointments (
      id, practice_id, client_id, patient_id, doctor_id, start_time, end_time,
      status, origin, notes, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), ${practice.id}, ${f2.clientId}, ${fatimaId}, ${drSykora.id},
      '2026-09-16 14:00:00+02', '2026-09-16 15:30:00+02',
      'checked_out', 'field',
      'Dovoz a odovzdanie liekov zootechnikovi p. Oravcovi na základe predpisu: Draxxin 100ml (2 fľaše), Melovem 100ml (2 fľaše) a Alamycin LA 250ml (1 fľaša).',
      '2026-09-16 16:00:00+02', '2026-09-16 16:00:00+02'
    ) RETURNING id;
  `;

  const [inv2_open] = await sql`
    INSERT INTO invoices (
      id, practice_id, client_id, status, subtotal, tax, total, paid_amount, due_date, is_estimate, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), ${practice.id}, ${f2.clientId}, 'draft',
      558.00, 128.34, 686.34, 0.00, '2026-10-14', false, '2026-09-16 16:30:00+02', '2026-09-16 16:30:00+02'
    ) RETURNING id;
  `;

  await sql`
    INSERT INTO invoice_items (
      id, invoice_id, description, quantity, unit_price, total, taxable, item_type, item_id, created_at, updated_at
    ) VALUES
    (gen_random_uuid(), ${inv2_open.id}, 'Ošetrenie paznechtov a flegmóny (Bela č. 0301 - 05.09.)', 1, 45.00, 45.00, true, 'service', ${serviceMap["HD-HOOF"]}, now(), now()),
    (gen_random_uuid(), ${inv2_open.id}, 'Klinické vyšetrenie HD na farme (Fatima č. 0314)', 1, 35.00, 35.00, true, 'service', ${serviceMap["HD-EXAM"]}, now(), now()),
    (gen_random_uuid(), ${inv2_open.id}, 'Alamycin LA 300mg/ml inj. 250ml (odovzdaná 1 fľaša 05.09.)', 1, 42.00, 42.00, true, 'product', ${productMap["VET-LA-004"]}, now(), now()),
    (gen_random_uuid(), ${inv2_open.id}, 'Draxxin 100mg/ml inj. 100ml (2 fľaše odovzdané 16.09.)', 2, 145.00, 290.00, true, 'product', ${productMap["VET-LA-005"]}, now(), now()),
    (gen_random_uuid(), ${inv2_open.id}, 'Melovem 20mg/ml inj. 100ml (2 fľaše odovzdané 16.09.)', 2, 48.00, 96.00, true, 'product', ${productMap["VET-LA-006"]}, now(), now()),
    (gen_random_uuid(), ${inv2_open.id}, 'Dopravné do terénu (Revúca a späť 2x výjazd)', 2, 25.00, 50.00, true, 'service', ${serviceMap["HD-TRAVEL"]}, now(), now());
  `;

  const f3 = farmMap["tisovec"];
  const zofiaId = f3.cows["SK 000803551050"];

  const [apptBio1] = await sql`
    INSERT INTO appointments (
      id, practice_id, client_id, patient_id, doctor_id, start_time, end_time,
      status, origin, notes, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), ${practice.id}, ${f3.clientId}, ${zofiaId}, ${drSykora.id},
      '2026-09-08 09:30:00+02', '2026-09-08 11:00:00+02',
      'checked_out', 'field',
      'BioFarma Tisovec: Krava Žofia (ketóza po otelení, acetón v dychu). Odovzdaný kanister Ketovet 5 L, podaná glukóza a Butasal.',
      '2026-09-08 11:30:00+02', '2026-09-08 11:30:00+02'
    ) RETURNING id;
  `;

  const [apptBio2] = await sql`
    INSERT INTO appointments (
      id, practice_id, client_id, patient_id, doctor_id, start_time, end_time,
      status, origin, notes, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), ${practice.id}, ${f3.clientId}, ${f3.cows["SK 000803551044"]}, ${drSykora.id},
      '2026-09-22 13:00:00+02', '2026-09-22 14:30:00+02',
      'checked_out', 'field',
      'Jesenná dehelmintizácia mladého dobytka. Odovzdaná fľaša Ivomec Classic 500ml chovateľovi Marianovi Švantnerovi.',
      '2026-09-22 15:00:00+02', '2026-09-22 15:00:00+02'
    ) RETURNING id;
  `;

  const [inv3_open] = await sql`
    INSERT INTO invoices (
      id, practice_id, client_id, status, subtotal, tax, total, paid_amount, due_date, is_estimate, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), ${practice.id}, ${f3.clientId}, 'draft',
      203.00, 46.69, 249.69, 0.00, '2026-10-15', false, '2026-09-22 15:10:00+02', '2026-09-22 15:10:00+02'
    ) RETURNING id;
  `;

  await sql`
    INSERT INTO invoice_items (
      id, invoice_id, description, quantity, unit_price, total, taxable, item_type, item_id, created_at, updated_at
    ) VALUES
    (gen_random_uuid(), ${inv3_open.id}, 'Klinické vyšetrenie HD na farme (Žofia č. 1050 - 08.09.)', 1, 35.00, 35.00, true, 'service', ${serviceMap["HD-EXAM"]}, now(), now()),
    (gen_random_uuid(), ${inv3_open.id}, 'Ketovet perorálny roztok (kanister 5 L) - 1 ks', 1, 55.00, 55.00, true, 'product', ${productMap["VET-LA-010"]}, now(), now()),
    (gen_random_uuid(), ${inv3_open.id}, 'Ivomec Classic inj. 500ml - 1 fľaša (odovzdané 22.09.)', 1, 78.00, 78.00, true, 'product', ${productMap["VET-LA-008"]}, now(), now()),
    (gen_random_uuid(), ${inv3_open.id}, 'Dopravné do terénu (Tisovec 2x výjazd)', 2, 17.50, 35.00, true, 'service', ${serviceMap["HD-TRAVEL"]}, now(), now());
  `;

  const f4 = farmMap["poloma"];
  const lindaId = f4.cows["SK 000804771088"];

  const [apptPoloma1] = await sql`
    INSERT INTO appointments (
      id, practice_id, client_id, patient_id, doctor_id, start_time, end_time,
      status, origin, notes, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), ${practice.id}, ${f4.clientId}, ${lindaId}, ${drSykora.id},
      '2026-09-10 11:00:00+02', '2026-09-10 13:00:00+02',
      'checked_out', 'field',
      'Akútna ťažká mastitída Linda č. 1088 (sepsa, teplota 40.8°C, Cobactan + Melovem). Hlásené do KVEPIS.',
      '2026-09-10 13:30:00+02', '2026-09-10 13:30:00+02'
    ) RETURNING id;
  `;

  await sql`
    INSERT INTO ext_kvepis_submissions (
      id, practice_id, submission_type, status, reference_number, patient_id,
      farm_ico, cehz_code, ear_tag_number, kvl_number,
      payload_json, submitted_at, signed_at, receipt_received_at, notes, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), ${practice.id}, 'treatment_diary_batch', 'ACKNOWLEDGED',
      'KVEPIS-20260910-0013', ${lindaId}, '00214582', '194820', 'SK 000804771088', 'KVL-SR-1849',
      ${JSON.stringify({
        schemaVersion: "1.0",
        submissionType: "treatment_diary_batch",
        referenceNumber: "KVEPIS-20260910-0013",
        subject: { farmIco: "00214582", cehzCode: "194820", earTagNumber: "SK 000804771088", animalSpecies: "bovine" },
        clinical: {
          diagnosis: "Mastitis toxica / coliformis acuta (sepsis)",
          medicationName: "Cobactan 2.5% + Melovem",
          meatWithdrawalDays: 8,
          milkWithdrawalDays: 5,
          administeredAt: "2026-09-10T09:30:00Z"
        }
      })},
      '2026-09-10 14:15:00+02', '2026-09-10 14:10:00+02', '2026-09-10 14:20:00+02',
      'Zaevidované v KVEPIS - akútna toxická mastitída.',
      '2026-09-10 13:30:00+02', '2026-09-10 14:20:00+02'
    );
  `;

  const [apptPoloma2] = await sql`
    INSERT INTO appointments (
      id, practice_id, client_id, patient_id, doctor_id, start_time, end_time,
      status, origin, notes, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), ${practice.id}, ${f4.clientId}, ${f4.cows["SK 000804771092"]}, ${drSykora.id},
      '2026-09-24 08:00:00+02', '2026-09-24 11:30:00+02',
      'checked_out', 'field',
      'Plošná vakcinácia stáda proti IBR (150 ks zvierat). Aplikované a odovzdané 3 balenia Bovilis IBR Marker Live (50 dávok).',
      '2026-09-24 12:00:00+02', '2026-09-24 12:00:00+02'
    ) RETURNING id;
  `;

  const [inv4_open] = await sql`
    INSERT INTO invoices (
      id, practice_id, client_id, status, subtotal, tax, total, paid_amount, due_date, is_estimate, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), ${practice.id}, ${f4.clientId}, 'draft',
      740.00, 170.20, 910.20, 0.00, '2026-10-15', false, '2026-09-24 12:15:00+02', '2026-09-24 12:15:00+02'
    ) RETURNING id;
  `;

  await sql`
    INSERT INTO invoice_items (
      id, invoice_id, description, quantity, unit_price, total, taxable, item_type, item_id, created_at, updated_at
    ) VALUES
    (gen_random_uuid(), ${inv4_open.id}, 'Klinické vyšetrenie a liečba mastitídy (Linda - 10.09.)', 1, 50.00, 50.00, true, 'service', ${serviceMap["HD-EXAM"]}, now(), now()),
    (gen_random_uuid(), ${inv4_open.id}, 'Cobactan 2.5% inj. 100ml (aplikované a vydané 1 fľaša)', 1, 64.00, 64.00, true, 'product', ${productMap["VET-LA-002"]}, now(), now()),
    (gen_random_uuid(), ${inv4_open.id}, 'Melovem 20mg/ml inj. 100ml (1 fľaša)', 1, 48.00, 48.00, true, 'product', ${productMap["VET-LA-006"]}, now(), now()),
    (gen_random_uuid(), ${inv4_open.id}, 'Bovilis IBR Marker Live (50 dávok) - 3 balenia (150 dávok)', 3, 95.00, 285.00, true, 'product', ${productMap["VET-LA-009"]}, now(), now()),
    (gen_random_uuid(), ${inv4_open.id}, 'Aplikácia vakcíny stádo (150 ks)', 150, 1.70, 255.00, true, 'service', ${serviceMap["HD-VACC"]}, now(), now()),
    (gen_random_uuid(), ${inv4_open.id}, 'Dopravné do terénu (Gemerská Poloma 2x výjazd)', 2, 19.00, 38.00, true, 'service', ${serviceMap["HD-TRAVEL"]}, now(), now());
  `;

  console.log("\n==========================================================================");
  console.log("✅ SIMULOVANÉ DÁTA ÚSPEŠNE VYGENEROVANÉ!");
  console.log("==========================================================================");
  console.log("1. PD Podpoľanie (Farma Očová):");
  console.log("   - Vyfakturované k 15.09.2026: 423,12 € s DPH (UHRADENÁ, 03.09. a 11.09.)");
  console.log("   - Otvorené nezafakturované (18.09. Retencia Straka): 154,98 € s DPH (DRAFT)");
  console.log("2. Agrodružstvo Revúca (Mokrá Lúka):");
  console.log("   - Otvorené nezafakturované (Panaritium Bela, Draxxin 2x100ml, Melovem): 686,34 € s DPH (DRAFT)");
  console.log("3. BioFarma Hradová (Tisovec):");
  console.log("   - Otvorené nezafakturované (Ketovet kanister 5L, Ivomec 500ml): 249,69 € s DPH (DRAFT)");
  console.log("4. Roľnícke družstvo Gemerská Poloma:");
  console.log("   - Otvorené nezafakturované (Mastitída Linda, Bovilis IBR 150 dávok): 910,20 € s DPH (DRAFT)");
  console.log("--------------------------------------------------------------------------");
  console.log("Celkový objem čakajúcich pohľadávok Dr. Sýkoru na vyfakturovanie: 2 001,21 € s DPH");
  console.log("Všetky zvieratá zaevidované individuálne (ušné známky CEHZ) + KVEPIS hlásenia s ochrannými lehotami.");

  await sql.end();
}

main().catch((err) => {
  console.error("Chyba:", err);
  process.exit(1);
});

