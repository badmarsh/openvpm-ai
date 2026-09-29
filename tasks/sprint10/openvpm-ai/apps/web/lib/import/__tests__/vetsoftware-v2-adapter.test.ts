import { describe, it, expect } from "vitest";
import {
  adaptVetsoftwareV2Data,
  normalizeSlovakSpecies,
  normalizeSlovakSex,
} from "../vetsoftware-v2-adapter";

describe("Vetsoftware V2 Migration Adapter", () => {
  it("normalizes Slovak species correctly", () => {
    expect(normalizeSlovakSpecies("Pes")).toBe("canine");
    expect(normalizeSlovakSpecies("Psík kríženec")).toBe("canine");
    expect(normalizeSlovakSpecies("Mačka domáca")).toBe("feline");
    expect(normalizeSlovakSpecies("Kocúr")).toBe("feline");
    expect(normalizeSlovakSpecies("Králik")).toBe("rabbit");
    expect(normalizeSlovakSpecies("Papagáj")).toBe("avian");
    expect(normalizeSlovakSpecies("Kôň")).toBe("equine");
    expect(normalizeSlovakSpecies("Neznámy tvor")).toBe("other");
  });

  it("normalizes Slovak sex correctly", () => {
    expect(normalizeSlovakSex("Pes")).toBe("male");
    expect(normalizeSlovakSex("Samec")).toBe("male");
    expect(normalizeSlovakSex("Fena")).toBe("female");
    expect(normalizeSlovakSex("Suka")).toBe("female");
    expect(normalizeSlovakSex("Kastrovaný pes")).toBe("male_neutered");
    expect(normalizeSlovakSex("Kastrovaná suka")).toBe("female_spayed");
  });

  it("transforms raw VetSoftware V2 export data into OpenVPM records and detects deceased status", () => {
    const rawClients = [
      {
        id: 101,
        meno: "Ján",
        priezvisko: "Kováč",
        mobil: "+421905123456",
        email: "jan.kovac@example.sk",
        ulica: "Hlavná 12",
        mesto: "Rimavská Sobota",
        psc: "97901",
      },
    ];

    const rawPatients = [
      {
        id: 201,
        clientId: 101,
        meno: "Dunčo",
        druh: "Pes",
        plemeno: "Nemecký ovčiak",
        pohlavie: "Samec",
        datumNarodenia: "2020-05-10",
        cip: "900123456789012",
        uhyn: false,
      },
      {
        id: 202,
        clientId: 101,
        meno: "Micka",
        druh: "Mačka",
        plemeno: "Európska krátkosrstá",
        pohlavie: "Kastrovaná samica",
        datumNarodenia: "2015-02-01",
        cip: "900123456789013",
        status: "Úhyn 2024",
      },
    ];

    const rawVaccinations = [
      {
        patientId: 201,
        clientId: 101,
        vakcina: "Nobivac DHPPi + L4",
        datum: "2024-06-15",
        datumExpiracie: "2025-06-15",
        sarza: "LOT12345",
        vyrobca: "MSD Animal Health",
      },
    ];

    const rawRecords = [
      {
        patientId: 201,
        clientId: 101,
        datum: "2024-06-15",
        anamneza: "Pravidelná ročná vakcinácia",
        nalezy: "Klinicky zdravý, TT 38.5C",
        diagnoza: "Preventívna prehliadka",
        terapia: "Aplikovaná vakcína Nobivac s.c.",
      },
    ];

    const result = adaptVetsoftwareV2Data({
      clients: rawClients,
      patients: rawPatients,
      vaccinations: rawVaccinations,
      records: rawRecords,
    });

    // Verify Clients
    expect(result.clients).toHaveLength(1);
    expect(result.clients[0]).toEqual({
      externalClientId: "101",
      firstName: "Ján",
      lastName: "Kováč",
      phone: "+421905123456",
      email: "jan.kovac@example.sk",
      address: "Hlavná 12",
      city: "Rimavská Sobota",
      zip: "97901",
    });

    // Verify Patients & Deceased Status (Safety Gating)
    expect(result.patients).toHaveLength(2);
    expect(result.patients[0]?.status).toBe("active");
    expect(result.patients[0]?.species).toBe("canine");
    expect(result.patients[0]?.sex).toBe("male");

    // Micka has status "Úhyn 2024" -> MUST be marked deceased
    expect(result.patients[1]?.status).toBe("deceased");
    expect(result.patients[1]?.species).toBe("feline");
    expect(result.patients[1]?.sex).toBe("female_spayed");

    // Verify Vaccinations
    expect(result.vaccinations).toHaveLength(1);
    expect(result.vaccinations[0]?.vaccineName).toBe("Nobivac DHPPi + L4");
    expect(result.vaccinations[0]?.administeredAt).toBe("2024-06-15");
    expect(result.vaccinations[0]?.nextDueDate).toBe("2025-06-15");

    // Verify Medical Records (SOAP)
    expect(result.soapNotes).toHaveLength(1);
    expect(result.soapNotes[0]?.subjective).toBe("Pravidelná ročná vakcinácia");
    expect(result.soapNotes[0]?.assessment).toBe("Preventívna prehliadka");
  });
});
