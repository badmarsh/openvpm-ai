import { describe, it, expect } from "vitest";
import type { patients } from "@openpims/db";
import {
  toApiClient,
  toApiPatient,
  toApiAppointment,
  fromApiAppointmentCreate,
} from "../mappers";
import { clientRow, patientRow, appointmentRow } from "./fixtures";

type PatientRow = typeof patients.$inferSelect;

describe("toApiClient", () => {
  it("maps fields to snake_case and ISO timestamps", () => {
    const result = toApiClient(clientRow());
    expect(result).toMatchObject({
      id: "11111111-1111-1111-1111-111111111111",
      first_name: "Jane",
      last_name: "Doe",
      email: "jane@example.com",
      preferred_contact_method: "email",
      created_at: "2026-01-02T03:04:05.000Z",
      updated_at: "2026-02-03T04:05:06.000Z",
    });
  });

  it("preserves nulls for optional fields", () => {
    const result = toApiClient(
      clientRow({ email: null, phone: null, notes: null, preferredContactMethod: null })
    );
    expect(result.email).toBeNull();
    expect(result.phone).toBeNull();
    expect(result.notes).toBeNull();
    expect(result.preferred_contact_method).toBeNull();
  });
});

describe("toApiPatient species crosswalk", () => {
  const cases: Array<[PatientRow["species"], string]> = [
    ["canine", "dog"],
    ["feline", "cat"],
    ["avian", "bird"],
    ["rabbit", "rabbit"],
    ["reptile", "reptile"],
    ["equine", "horse"],
    ["other", "other"],
  ];
  it.each(cases)("maps internal %s -> api %s", (internal, api) => {
    expect(toApiPatient(patientRow({ species: internal })).species).toBe(api);
  });
});

describe("toApiPatient sex crosswalk", () => {
  it("splits collapsed sex enum into sex + neutered", () => {
    expect(toApiPatient(patientRow({ sex: "male" }))).toMatchObject({ sex: "male", neutered: false });
    expect(toApiPatient(patientRow({ sex: "female" }))).toMatchObject({ sex: "female", neutered: false });
    expect(toApiPatient(patientRow({ sex: "male_neutered" }))).toMatchObject({ sex: "male", neutered: true });
    expect(toApiPatient(patientRow({ sex: "female_spayed" }))).toMatchObject({ sex: "female", neutered: true });
  });

  it("maps null sex to unknown with null neutered", () => {
    expect(toApiPatient(patientRow({ sex: null }))).toMatchObject({ sex: "unknown", neutered: null });
  });
});

describe("toApiPatient dob passthrough", () => {
  it("passes the date string through unchanged", () => {
    expect(toApiPatient(patientRow({ dob: "2020-05-15" })).date_of_birth).toBe("2020-05-15");
  });
  it("preserves null dob", () => {
    expect(toApiPatient(patientRow({ dob: null })).date_of_birth).toBeNull();
  });
});

describe("toApiAppointment", () => {
  it("serializes timestamps to ISO-8601", () => {
    const result = toApiAppointment(appointmentRow());
    expect(result.start_time).toBe("2026-03-01T09:00:00.000Z");
    expect(result.end_time).toBe("2026-03-01T09:30:00.000Z");
    expect(result.status).toBe("scheduled");
    expect(result.patient_id).toBe("22222222-2222-2222-2222-222222222222");
  });
});

describe("fromApiAppointmentCreate", () => {
  it("parses ISO strings into Date objects and defaults optionals to null", () => {
    const result = fromApiAppointmentCreate({
      start_time: "2026-03-01T09:00:00.000Z",
      end_time: "2026-03-01T09:30:00.000Z",
    });
    expect(result.startTime).toBeInstanceOf(Date);
    expect((result.startTime as Date).toISOString()).toBe("2026-03-01T09:00:00.000Z");
    expect(result.clientId).toBeNull();
    expect(result.patientId).toBeNull();
    expect(result.doctorId).toBeNull();
    expect(result.notes).toBeNull();
  });

  it("maps provided optional ids through", () => {
    const result = fromApiAppointmentCreate({
      start_time: "2026-03-01T09:00:00.000Z",
      end_time: "2026-03-01T09:30:00.000Z",
      client_id: "11111111-1111-1111-1111-111111111111",
      patient_id: "22222222-2222-2222-2222-222222222222",
      notes: "follow-up",
    });
    expect(result.clientId).toBe("11111111-1111-1111-1111-111111111111");
    expect(result.patientId).toBe("22222222-2222-2222-2222-222222222222");
    expect(result.notes).toBe("follow-up");
  });
});
