import type {
  ClientImportRecord,
  PatientImportRecord,
  SoapNoteImportRecord,
  VaccinationImportRecord,
} from "../csv/import";
import {
  normalizeDateValue,
  normalizePatientStatusValue,
  normalizeSexValue,
  normalizeSpeciesValue,
} from "./normalize";

export interface VetsoftwareV2RawClient {
  id?: string | number;
  ID?: string | number;
  meno?: string;
  priezvisko?: string;
  name?: string;
  telefon?: string;
  mobil?: string;
  email?: string;
  ulica?: string;
  mesto?: string;
  psc?: string;
}

export interface VetsoftwareV2RawPatient {
  id?: string | number;
  ID?: string | number;
  clientId?: string | number;
  MAJITEL_ID?: string | number;
  meno?: string;
  druh?: string;
  plemeno?: string;
  pohlavie?: string;
  datumNarodenia?: string;
  cip?: string;
  cipCislo?: string;
  farba?: string;
  uhyn?: boolean | string | number;
  status?: string;
}

export interface VetsoftwareV2RawVaccination {
  patientId?: string | number;
  clientId?: string | number;
  vakcina?: string;
  datum?: string;
  datumExpiracie?: string;
  sarza?: string;
  vyrobca?: string;
}

export interface VetsoftwareV2RawRecord {
  patientId?: string | number;
  clientId?: string | number;
  datum?: string;
  anamneza?: string;
  nalezy?: string;
  diagnoza?: string;
  terapia?: string;
}

/**
 * Normalizes Slovak species names from VetSoftware V2 to OpenVPM enum
 */
export function normalizeSlovakSpecies(val?: string): PatientImportRecord["species"] {
  if (!val) return "other";
  const s = val.toLowerCase().trim();
  if (s.includes("pes") || s.includes("psík") || s.includes("canine") || s.includes("dog")) return "canine";
  if (s.includes("mačk") || s.includes("kocúr") || s.includes("feline") || s.includes("cat")) return "feline";
  if (s.includes("králik") || s.includes("zajac") || s.includes("rabbit")) return "rabbit";
  if (s.includes("vták") || s.includes("papagáj") || s.includes("avian") || s.includes("bird")) return "avian";
  if (s.includes("kôň") || s.includes("kobyla") || s.includes("equine") || s.includes("horse")) return "equine";
  if (s.includes("krava") || s.includes("býk") || s.includes("dobytok") || s.includes("bovine")) return "bovine";
  if (s.includes("plaz") || s.includes("korytna") || s.includes("reptile")) return "reptile";
  return normalizeSpeciesValue(val) ?? "other";
}

/**
 * Normalizes Slovak sex/neutered status
 */
export function normalizeSlovakSex(val?: string): PatientImportRecord["sex"] {
  if (!val) return undefined;
  const s = val.toLowerCase().trim();
  if (s === "pes" || s === "samec" || s === "m" || s === "male") return "male";
  if (s === "fena" || s === "suka" || s === "samica" || s === "f" || s === "female") return "female";
  if (s.includes("kastrov") && (s.includes("pes") || s.includes("samec"))) return "male_neutered";
  if (s.includes("kastrov") && (s.includes("suka") || s.includes("fena") || s.includes("samica"))) return "female_spayed";
  return normalizeSexValue(val);
}

/**
 * Adapts Vetsoftware V2 exported data into native OpenVPM import structures
 */
export function adaptVetsoftwareV2Data(params: {
  clients: VetsoftwareV2RawClient[];
  patients: VetsoftwareV2RawPatient[];
  vaccinations?: VetsoftwareV2RawVaccination[];
  records?: VetsoftwareV2RawRecord[];
}): {
  clients: ClientImportRecord[];
  patients: PatientImportRecord[];
  vaccinations: VaccinationImportRecord[];
  soapNotes: SoapNoteImportRecord[];
} {
  const adaptedClients: ClientImportRecord[] = params.clients.map((c) => {
    const rawId = c.id ?? c.ID;
    const firstName = c.meno ?? "";
    const lastName = c.priezvisko ?? c.name ?? "Klient";

    return {
      externalClientId: rawId !== undefined ? String(rawId) : undefined,
      firstName: firstName || "Neznáme",
      lastName: lastName,
      phone: c.mobil || c.telefon,
      email: c.email,
      address: c.ulica,
      city: c.mesto,
      zip: c.psc,
    };
  });

  const adaptedPatients: PatientImportRecord[] = params.patients.map((p) => {
    const rawId = p.id ?? p.ID;
    const clientId = p.clientId ?? p.MAJITEL_ID;
    const isDeceased =
      p.uhyn === true ||
      p.uhyn === 1 ||
      p.uhyn === "1" ||
      String(p.status ?? "").toLowerCase().includes("úhyn") ||
      String(p.status ?? "").toLowerCase().includes("eutan");

    return {
      externalPatientId: rawId !== undefined ? String(rawId) : undefined,
      externalClientId: clientId !== undefined ? String(clientId) : undefined,
      name: p.meno || "Pacient",
      species: normalizeSlovakSpecies(p.druh),
      breed: p.plemeno,
      sex: normalizeSlovakSex(p.pohlavie),
      dob: p.datumNarodenia ? normalizeDateValue(p.datumNarodenia) ?? undefined : undefined,
      color: p.farba,
      microchipNumber: p.cipCislo || p.cip,
      status: isDeceased ? "deceased" : "active",
    };
  });

  const adaptedVaccinations: VaccinationImportRecord[] = (params.vaccinations ?? [])
    .filter((v) => v.vakcina && v.datum)
    .map((v) => ({
      externalPatientId: v.patientId !== undefined ? String(v.patientId) : undefined,
      externalClientId: v.clientId !== undefined ? String(v.clientId) : undefined,
      vaccineName: v.vakcina!,
      administeredAt: normalizeDateValue(v.datum!) ?? new Date().toISOString().slice(0, 10),
      nextDueDate: v.datumExpiracie ? normalizeDateValue(v.datumExpiracie) ?? undefined : undefined,
      lotNumber: v.sarza,
      manufacturer: v.vyrobca,
    }));

  const adaptedSoapNotes: SoapNoteImportRecord[] = (params.records ?? [])
    .filter((r) => r.datum && (r.anamneza || r.nalezy || r.diagnoza || r.terapia))
    .map((r) => ({
      externalPatientId: r.patientId !== undefined ? String(r.patientId) : undefined,
      externalClientId: r.clientId !== undefined ? String(r.clientId) : undefined,
      date: normalizeDateValue(r.datum!) ?? new Date().toISOString().slice(0, 10),
      subjective: r.anamneza,
      objective: r.nalezy,
      assessment: r.diagnoza,
      plan: r.terapia,
    }));

  return {
    clients: adaptedClients,
    patients: adaptedPatients,
    vaccinations: adaptedVaccinations,
    soapNotes: adaptedSoapNotes,
  };
}
