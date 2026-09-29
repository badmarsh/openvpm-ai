import { describe, expect, it } from "vitest";
import { adaptShepherdCore } from "../shepherd-core-adapter";

describe("Shepherd core adapter", () => {
  it("joins owners, patients, vaccines, and locked SOAP history without guessing", () => {
    const result = adaptShepherdCore({
      client: [
        {
          Id: "client-synthetic-1",
          FirstName: "Sample",
          LastName: "Owner",
          Email: "sample.owner@example.test",
          Deleted: "false",
        },
        {
          Id: "client-synthetic-deleted",
          FirstName: "Deleted",
          LastName: "Canary",
          Deleted: "true",
        },
      ],
      client_address: [
        {
          ClientId: "client-synthetic-1",
          Address: "1 Synthetic Way",
          City: "Testville",
          State: "VA",
          ZipCode: "00000",
        },
      ],
      client_phone: [
        {
          Id: "phone-synthetic-1",
          ClientId: "client-synthetic-1",
          PhoneNumber: "5550000000",
          IsPrimary: "true",
        },
      ],
      client_patient: [
        {
          Id: "link-synthetic-1",
          ClientId: "client-synthetic-1",
          PatientId: "patient-synthetic-1",
        },
      ],
      species: [{ Id: "species-synthetic-canine", Name: "Canine" }],
      breed: [
        {
          Id: "breed-synthetic-1",
          Name: "Sample breed",
          SpeciesId: "species-synthetic-canine",
        },
      ],
      sex: [{ Id: "sex-synthetic-mn", Name: "MN" }],
      patient_status: [{ Id: "status-synthetic-deceased", Name: "Deceased" }],
      patient: [
        {
          Id: "patient-synthetic-1",
          Name: "Sample Patient",
          BreedId: "breed-synthetic-1",
          SexId: "sex-synthetic-mn",
          StatusId: "status-synthetic-deceased",
          DateOfBirth: "2020-04-03T00:00:00Z",
          IsDeceased: "true",
          Deleted: "false",
        },
      ],
      vaccination: [
        {
          Id: "vaccine-synthetic-1",
          PatientId: "patient-synthetic-1",
          VaccineName: "Synthetic vaccine",
          AdministrationDate: "2025-01-02T12:00:00Z",
          DueDate: "2026-01-02T00:00:00Z",
          LotNumber: "LOT-SYNTHETIC",
        },
      ],
      soap_status: [
        { Id: "soap-status-locked", Name: "Locked" },
        { Id: "soap-status-active", Name: "Active" },
      ],
      soap: [
        {
          Id: "soap-synthetic-locked",
          PatientId: "patient-synthetic-1",
          SoapStatusId: "soap-status-locked",
          DateLocked: "2025-03-04T12:00:00Z",
          Deleted: "false",
        },
        {
          Id: "soap-synthetic-draft",
          PatientId: "patient-synthetic-1",
          SoapStatusId: "soap-status-active",
          DateCreated: "2025-03-05T12:00:00Z",
          Deleted: "false",
        },
      ],
      soap_subjective: [
        {
          SoapId: "soap-synthetic-locked",
          InitialComplaint: "Synthetic complaint",
          History: "Synthetic history",
        },
      ],
      soap_assessment: [
        {
          SoapId: "soap-synthetic-locked",
          Description: "Synthetic assessment",
        },
      ],
      soap_plan: [
        { SoapId: "soap-synthetic-locked", Recommendation: "Synthetic plan" },
      ],
      soap_vitals: [
        {
          Id: "vitals-synthetic-1",
          SoapObjectiveId: "soap-synthetic-locked",
          Weight: "10.5",
          Pulse: "90",
        },
      ],
      soap_treatment: [
        {
          Id: "treatment-synthetic-1",
          SoapPlanId: "soap-synthetic-locked",
          Name: "Synthetic treatment",
          Quantity: "1",
          IsDeclined: "false",
        },
      ],
    });

    expect(result.clients).toEqual([
      expect.objectContaining({
        externalClientId: "client-synthetic-1",
        phone: "5550000000",
        city: "Testville",
      }),
    ]);
    expect(result.patients).toEqual([
      expect.objectContaining({
        externalClientId: "client-synthetic-1",
        externalPatientId: "patient-synthetic-1",
        species: "canine",
        sex: "male_neutered",
        status: "deceased",
      }),
    ]);
    expect(result.vaccinations).toEqual([
      expect.objectContaining({
        externalPatientId: "patient-synthetic-1",
        administeredAt: "2025-01-02",
        nextDueDate: "2026-01-02",
      }),
    ]);
    expect(result.soapNotes).toEqual([
      expect.objectContaining({
        externalPatientId: "patient-synthetic-1",
        date: "2025-03-04",
        assessment: "Synthetic assessment",
        objective: expect.stringContaining("Weight (source units): 10.5"),
        plan: expect.stringContaining("Synthetic treatment"),
      }),
    ]);
    expect(result.coverage.clients).toEqual({
      sourceRows: 2,
      plannedRows: 1,
      deferredRows: 0,
      excludedRows: 1,
      errorRows: 0,
    });
    expect(result.coverage.soapNotes).toEqual({
      sourceRows: 2,
      plannedRows: 1,
      deferredRows: 1,
      excludedRows: 0,
      errorRows: 0,
    });
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "source_note_not_final" }),
    );
  });

  it("accounts for unresolved identities as fixed-code errors", () => {
    const result = adaptShepherdCore({
      client: [],
      patient: [{ Id: "patient-synthetic-unlinked", Name: "Unlinked" }],
      vaccination: [
        {
          Id: "vaccine-synthetic-unlinked",
          PatientId: "patient-synthetic-unlinked",
          VaccineName: "Synthetic vaccine",
          AdministrationDate: "2025-01-02",
        },
      ],
      soap: [],
    });
    expect(result.patients).toHaveLength(0);
    expect(result.vaccinations).toHaveLength(0);
    expect(result.coverage.patients.errorRows).toBe(1);
    expect(result.coverage.vaccinations.errorRows).toBe(1);
    expect(
      result.issues.every(
        (issue) => !JSON.stringify(issue).includes("Unlinked"),
      ),
    ).toBe(true);
  });
});
