import "dotenv/config";
import postgres from "postgres";

const DB_URL =
  process.env.DATABASE_URL ??
  "postgresql://openpims:openpims@127.0.0.1:5434/openvpm_ai";

async function main() {
  const sql = postgres(DB_URL);
  const appts = await sql`
    SELECT a.id, a.start_time, a.end_time, a.status, a.notes, p.name as patient_name, u.name as doctor_name
    FROM appointments a
    LEFT JOIN patients p ON p.id = a.patient_id
    LEFT JOIN users u ON u.id = a.doctor_id
    WHERE a.practice_id = '5c4ebbbc-90e1-457a-87a7-7895f560317d'
    ORDER BY a.start_time ASC
  `;
  console.log("Appointments for MVDr. Martin Sýkora (count: " + appts.length + "):");
  for (const a of appts) {
    console.log(`- [${a.status}] ${a.start_time.toISOString()} -> ${a.end_time.toISOString()} | Pacient: ${a.patient_name} | Lekár: ${a.doctor_name} | ${a.notes || ""}`);
  }

  const types = await sql`
    SELECT id, name, duration_minutes, color FROM appointment_types WHERE practice_id = '5c4ebbbc-90e1-457a-87a7-7895f560317d'
  `;
  console.log("\nAppointment types:", types);

  const rooms = await sql`
    SELECT id, name FROM rooms WHERE practice_id = '5c4ebbbc-90e1-457a-87a7-7895f560317d'
  `;
  console.log("\nRooms:", rooms);

  const locations = await sql`
    SELECT id, name FROM locations WHERE practice_id = '5c4ebbbc-90e1-457a-87a7-7895f560317d'
  `;
  console.log("\nLocations:", locations);

  await sql.end();
}

main();
