import { describe, it, expect } from "vitest";
import type { patients } from "@openpims/db";
import {
  ApiClientSchema,
  ApiPatientSchema,
  ApiAppointmentSchema,
  AppointmentCreateSchema,
} from "../schema";
import { toApiClient, toApiPatient, toApiAppointment } from "../mappers";
import { clientRow, patientRow, appointmentRow } from "./fixtures";

type PatientRow = typeof patients.$inferSelect;

/**
 * Contract guardrail: mapper output MUST satisfy the public schema. If an
 * internal change makes a mapper produce a shape the contract forbids, these
 * fail loudly before the change can break an integrator.
 */
describe("mapper output satisfies the public contract", () => {
  it("toApiClient -> ApiClientSchema", () => {
    expect(() => ApiClientSchema.parse(toApiClient(clientRow()))).not.toThrow();
  });

  it("toApiClient with nulls -> ApiClientSchema", () => {
    const row = clientRow({ email: null, phone: null, notes: null, preferredContactMethod: null });
    expect(() => ApiClientSchema.parse(toApiClient(row))).not.toThrow();
  });

  const speciesValues: PatientRow["species"][] = [
    "canine", "feline", "avian", "rabbit", "reptile", "equine", "other",
  ];
  it.each(speciesValues)("toApiPatient (%s) -> ApiPatientSchema", (species) => {
    expect(() => ApiPatientSchema.parse(toApiPatient(patientRow({ species })))).not.toThrow();
  });

  const sexValues: PatientRow["sex"][] = [
    "male", "female", "male_neutered", "female_spayed", null,
  ];
  it.each(sexValues.map((s) => [String(s), s] as const))(
    "toApiPatient (sex=%s) -> ApiPatientSchema",
    (_label, sex) => {
      expect(() => ApiPatientSchema.parse(toApiPatient(patientRow({ sex })))).not.toThrow();
    }
  );

  it("toApiAppointment -> ApiAppointmentSchema", () => {
    expect(() => ApiAppointmentSchema.parse(toApiAppointment(appointmentRow()))).not.toThrow();
  });
});

describe("AppointmentCreateSchema validation", () => {
  it("accepts a valid body", () => {
    const r = AppointmentCreateSchema.safeParse({
      start_time: "2026-03-01T09:00:00.000Z",
      end_time: "2026-03-01T09:30:00.000Z",
    });
    expect(r.success).toBe(true);
  });

  it("rejects end_time before start_time", () => {
    const r = AppointmentCreateSchema.safeParse({
      start_time: "2026-03-01T10:00:00.000Z",
      end_time: "2026-03-01T09:30:00.000Z",
    });
    expect(r.success).toBe(false);
  });

  it("rejects non-ISO timestamps", () => {
    const r = AppointmentCreateSchema.safeParse({
      start_time: "March 1 2026",
      end_time: "2026-03-01T09:30:00.000Z",
    });
    expect(r.success).toBe(false);
  });

  it("rejects a non-uuid client_id", () => {
    const r = AppointmentCreateSchema.safeParse({
      start_time: "2026-03-01T09:00:00.000Z",
      end_time: "2026-03-01T09:30:00.000Z",
      client_id: "not-a-uuid",
    });
    expect(r.success).toBe(false);
  });
});
