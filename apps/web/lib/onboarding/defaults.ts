import type { Database } from "@openpims/db/client";
import { appointmentTypes, rooms, services } from "@openpims/db";

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
