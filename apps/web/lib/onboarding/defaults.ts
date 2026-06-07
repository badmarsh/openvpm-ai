import type { Database } from "@openpims/db/client";
import {
  appointmentTypes,
  rooms,
  services,
  clients,
  patients,
  appointments,
} from "@openpims/db";

/**
 * Sensible defaults seeded for a brand-new practice so it's usable immediately
 * instead of landing in a blank dashboard. Data is plain/pure (easy to test);
 * `seedPractice` inserts it scoped to the new practice.
 */

export interface DefaultAppointmentType {
  name: string;
  durationMinutes: number;
  color: string;
  requiresDoctor: 0 | 1;
  defaultRoomType: "exam" | "surgery" | "treatment" | "boarding";
}

export const DEFAULT_APPOINTMENT_TYPES: DefaultAppointmentType[] = [
  { name: "Wellness Exam", durationMinutes: 30, color: "#0d9488", requiresDoctor: 1, defaultRoomType: "exam" },
  { name: "Sick Visit", durationMinutes: 30, color: "#dc2626", requiresDoctor: 1, defaultRoomType: "exam" },
  { name: "Vaccination", durationMinutes: 15, color: "#2563eb", requiresDoctor: 0, defaultRoomType: "exam" },
  { name: "Surgery", durationMinutes: 120, color: "#7c3aed", requiresDoctor: 1, defaultRoomType: "surgery" },
  { name: "Dental Cleaning", durationMinutes: 90, color: "#0891b2", requiresDoctor: 1, defaultRoomType: "surgery" },
  { name: "Recheck / Follow-up", durationMinutes: 15, color: "#65a30d", requiresDoctor: 1, defaultRoomType: "exam" },
];

export interface DefaultRoom {
  name: string;
  type: "exam" | "surgery" | "treatment" | "boarding";
}

export const DEFAULT_ROOMS: DefaultRoom[] = [
  { name: "Exam Room 1", type: "exam" },
  { name: "Exam Room 2", type: "exam" },
  { name: "Surgery Suite", type: "surgery" },
  { name: "Treatment Area", type: "treatment" },
];

export interface DefaultService {
  name: string;
  category: string;
  defaultPrice: string; // numeric column stores as string
  taxable: boolean;
}

export const DEFAULT_SERVICES: DefaultService[] = [
  { name: "Wellness Exam", category: "Exam", defaultPrice: "65.00", taxable: false },
  { name: "Sick / Problem Exam", category: "Exam", defaultPrice: "75.00", taxable: false },
  { name: "Recheck Exam", category: "Exam", defaultPrice: "45.00", taxable: false },
  { name: "Rabies Vaccine", category: "Vaccination", defaultPrice: "35.00", taxable: true },
  { name: "DHPP Vaccine", category: "Vaccination", defaultPrice: "40.00", taxable: true },
  { name: "Bordetella Vaccine", category: "Vaccination", defaultPrice: "38.00", taxable: true },
  { name: "FVRCP Vaccine", category: "Vaccination", defaultPrice: "40.00", taxable: true },
  { name: "Microchip", category: "Procedure", defaultPrice: "55.00", taxable: true },
  { name: "Nail Trim", category: "Procedure", defaultPrice: "20.00", taxable: true },
  { name: "Dental Cleaning", category: "Surgery", defaultPrice: "450.00", taxable: false },
  { name: "Spay / Neuter", category: "Surgery", defaultPrice: "350.00", taxable: false },
  { name: "Heartworm Test", category: "Diagnostics", defaultPrice: "45.00", taxable: false },
];

/**
 * Insert the default catalog for a freshly created practice. Idempotency is the
 * caller's responsibility (only call once, at registration).
 */
export async function seedPractice(
  db: Database,
  opts: { practiceId: string; locationId?: string | null }
): Promise<void> {
  await db.insert(appointmentTypes).values(
    DEFAULT_APPOINTMENT_TYPES.map((t) => ({
      practiceId: opts.practiceId,
      name: t.name,
      durationMinutes: t.durationMinutes,
      color: t.color,
      requiresDoctor: t.requiresDoctor,
      defaultRoomType: t.defaultRoomType,
    }))
  );

  await db.insert(rooms).values(
    DEFAULT_ROOMS.map((r) => ({
      practiceId: opts.practiceId,
      locationId: opts.locationId ?? null,
      name: r.name,
      type: r.type,
    }))
  );

  await db.insert(services).values(
    DEFAULT_SERVICES.map((s) => ({
      practiceId: opts.practiceId,
      name: s.name,
      category: s.category,
      defaultPrice: s.defaultPrice,
      taxable: s.taxable,
    }))
  );
}

export interface DemoDataIds {
  clientIds: string[];
  patientIds: string[];
  appointmentIds: string[];
}

/**
 * Seed a small set of demo clients/patients/appointments so a hosted trial
 * lands on a lively dashboard instead of empty states. The returned IDs are
 * stored on the practice so the onboarding wizard can clear them with one click.
 * Call only on hosted trials; non-fatal.
 */
export async function seedDemoData(
  db: Database,
  opts: { practiceId: string }
): Promise<DemoDataIds> {
  const insertedClients = await db
    .insert(clients)
    .values([
      { practiceId: opts.practiceId, firstName: "Jordan", lastName: "Avery", email: "jordan.avery@example.com", phone: "(555) 200-1001" },
      { practiceId: opts.practiceId, firstName: "Sam", lastName: "Rivera", email: "sam.rivera@example.com", phone: "(555) 200-1002" },
      { practiceId: opts.practiceId, firstName: "Taylor", lastName: "Brooks", email: "taylor.brooks@example.com", phone: "(555) 200-1003" },
    ])
    .returning({ id: clients.id });

  const insertedPatients = await db
    .insert(patients)
    .values([
      { practiceId: opts.practiceId, clientId: insertedClients[0]!.id, name: "Biscuit", species: "canine" as const, sex: "male_neutered" as const, breed: "Golden Retriever" },
      { practiceId: opts.practiceId, clientId: insertedClients[1]!.id, name: "Luna", species: "feline" as const, sex: "female_spayed" as const, breed: "Domestic Shorthair" },
      { practiceId: opts.practiceId, clientId: insertedClients[2]!.id, name: "Mango", species: "avian" as const, breed: "Sun Conure" },
    ])
    .returning({ id: patients.id });

  const now = Date.now();
  const mkAppt = (clientIdx: number, patientIdx: number, offsetHours: number) => {
    const start = new Date(now + offsetHours * 60 * 60 * 1000);
    const end = new Date(start.getTime() + 30 * 60 * 1000);
    return {
      practiceId: opts.practiceId,
      clientId: insertedClients[clientIdx]!.id,
      patientId: insertedPatients[patientIdx]!.id,
      startTime: start,
      endTime: end,
    };
  };
  const insertedAppts = await db
    .insert(appointments)
    .values([mkAppt(0, 0, 26), mkAppt(1, 1, 50)])
    .returning({ id: appointments.id });

  return {
    clientIds: insertedClients.map((c) => c.id),
    patientIds: insertedPatients.map((p) => p.id),
    appointmentIds: insertedAppts.map((a) => a.id),
  };
}
