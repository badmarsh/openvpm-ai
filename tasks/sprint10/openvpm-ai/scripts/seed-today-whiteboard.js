const path = require('path');
const postgres = require(path.resolve(__dirname, '../packages/db/node_modules/postgres'));
const sql = postgres(process.env.DATABASE_URL || 'postgresql://openpims:openpims@127.0.0.1:5434/openvpm_ai');
const crypto = require('crypto');

async function seedWhiteboard() {
  const practiceId = '5c4ebbbc-90e1-457a-87a7-7895f560317d';
  const locationId = 'ac85fd89-4c23-4b6e-b583-91a8b0d2c8cb';

  // Check Pupinka
  const [pupinka] = await sql`SELECT id, name, client_id, practice_id FROM patients WHERE name = 'Pupinka' AND practice_id = ${practiceId}`;
  console.log('Pupinka:', pupinka);

  let clientId = pupinka.client_id;
  if (!clientId) {
    const [firstClient] = await sql`SELECT id FROM clients WHERE practice_id = ${practiceId} LIMIT 1`;
    clientId = firstClient.id;
    await sql`UPDATE patients SET client_id = ${clientId} WHERE id = ${pupinka.id}`;
    console.log('Attached Pupinka to client:', clientId);
  }

  // Get other patients
  const otherPatients = await sql`SELECT id, name, client_id FROM patients WHERE practice_id = ${practiceId} AND client_id IS NOT NULL AND id != ${pupinka.id} LIMIT 10`;

  // Get rooms
  const rooms = await sql`SELECT id, name FROM rooms WHERE practice_id = ${practiceId}`;
  // Get types
  const types = await sql`SELECT id, name, color, duration_minutes FROM appointment_types WHERE practice_id = ${practiceId}`;
  // Get doctors
  const doctors = await sql`SELECT id, name FROM users WHERE practice_id = ${practiceId} AND role IN ('admin', 'veterinarian')`;

  const now = new Date();
  console.log('Current local date for appointments:', now.toISOString());

  // Delete today's existing appointments if any to avoid duplicates
  // First, delete any lab results that reference these appointments to avoid FK constraint
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  // Delete lab results tied to today's appointments (subquery avoids array param issues)
  await sql`
    DELETE FROM lab_results
    WHERE appointment_id IN (
      SELECT id FROM appointments
      WHERE practice_id = ${practiceId}
      AND start_time >= ${startOfDay}
      AND start_time <= ${endOfDay}
    )
  `;
  await sql`
    DELETE FROM appointments
    WHERE practice_id = ${practiceId}
    AND start_time >= ${startOfDay}
    AND start_time <= ${endOfDay}
  `;
  console.log('Cleared existing appointments (and dependent lab results) for today.');

  // Create appointments for today
  const appointmentsToCreate = [
    {
      patientId: pupinka.id,
      clientId: clientId,
      doctorId: doctors.find(d => d.name.includes('Sýkora'))?.id || doctors[0].id,
      roomId: rooms[0].id,
      typeId: types.find(t => t.name.includes('Kontrola'))?.id || types[0].id,
      status: 'in_exam', // V ambulancii
      startOffsetMin: -15,
      durationMin: 30,
      notes: 'Kontrola stavu po toalete uší a vyšetrenie labky'
    },
    {
      patientId: otherPatients[0].id,
      clientId: otherPatients[0].client_id,
      doctorId: doctors.find(d => d.name.includes('Horváthová'))?.id || doctors[0].id,
      roomId: rooms[1].id,
      typeId: types.find(t => t.name.includes('Preventívna'))?.id || types[0].id,
      status: 'checked_in', // V čakárni / prijatý
      startOffsetMin: -5,
      durationMin: 30,
      notes: 'Ročná preventívna prehliadka a vakcinácia'
    },
    {
      patientId: otherPatients[1].id,
      clientId: otherPatients[1].client_id,
      doctorId: doctors.find(d => d.name.includes('Kováč'))?.id || doctors[0].id,
      roomId: rooms[2].id,
      typeId: types.find(t => t.name.includes('Vyšetrenie'))?.id || types[0].id,
      status: 'confirmed', // Očakávaný
      startOffsetMin: 20,
      durationMin: 30,
      notes: 'Nechutenstvo a apatia od včerajšieho večera'
    },
    {
      patientId: otherPatients[2].id,
      clientId: otherPatients[2].client_id,
      doctorId: doctors.find(d => d.name.includes('Sýkora'))?.id || doctors[0].id,
      roomId: rooms[0].id,
      typeId: types.find(t => t.name.includes('Vakcinácia'))?.id || types[0].id,
      status: 'checked_out', // Vybavený
      startOffsetMin: -60,
      durationMin: 20,
      notes: 'Aplikovaná vakcína Nobivac DHPPi + L4, bez komplikácií'
    },
    {
      patientId: otherPatients[3].id,
      clientId: otherPatients[3].client_id,
      doctorId: doctors.find(d => d.name.includes('Vargová'))?.id || doctors[0].id,
      roomId: rooms[1].id,
      typeId: types.find(t => t.name.includes('Zubné'))?.id || types[0].id,
      status: 'confirmed', // Očakávaný
      startOffsetMin: 45,
      durationMin: 45,
      notes: 'Odstránenie zubného kameňa ultrazvukom'
    }
  ];

  for (const item of appointmentsToCreate) {
    const id = crypto.randomUUID();
    const startTime = new Date(now.getTime() + item.startOffsetMin * 60000);
    const endTime = new Date(startTime.getTime() + item.durationMin * 60000);

    await sql`
      INSERT INTO appointments (
        id, practice_id, location_id, room_id, patient_id, client_id, doctor_id, type_id,
        status, start_time, end_time, notes, created_at, updated_at
      ) VALUES (
        ${id}, ${practiceId}, ${locationId}, ${item.roomId}, ${item.patientId}, ${item.clientId}, ${item.doctorId}, ${item.typeId},
        ${item.status}, ${startTime}, ${endTime}, ${item.notes}, ${now}, ${now}
      )
    `;
    console.log(`✓ Inserted appointment for patient ${item.patientId} (${item.status}) at ${startTime.toISOString()}`);
  }

  console.log('\n✓ Whiteboard demo data seeded successfully!');
  await sql.end();
}

seedWhiteboard().catch(console.error);
