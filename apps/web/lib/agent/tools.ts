import { z } from "zod";
import {
  eq,
  and,
  isNull,
  or,
  ilike,
  gte,
  lte,
  lt,
  desc,
  asc,
  inArray,
  not,
  gt,
  sql,
} from "drizzle-orm";
import type { Database } from "@openpims/db/client";
import {
  clients,
  patients,
  appointments,
  vitalSigns,
  vaccinationRecords,
  problemList,
  treatmentPlans,
  treatmentPlanItems,
  users,
  rooms,
  locations,
  practices,
  clinicalRecordCorrections,
  labAnalyzerReports,
  prescriptions,
  patientAllergies,
  soapNotes,
  invoices,
  invoiceItems,
  dispenseChargeQueue,
} from "@openpims/db";
import {
  appointmentCreatedWebhookPayload,
  dispatchAppointmentWebhookAfterCommit,
} from "@/lib/appointment-webhooks";
import { recordActivationAfterAppointmentCreated } from "@/lib/funnel-events-server";
import {
  dateInputTimeUtcInstant,
  formatDateInputForTimeZone,
} from "@/lib/date-input";
import {
  FORMULARY,
  DOSING_WEIGHT_MAX_KG,
  FORMULARY_DRUG_ID_MAX_LENGTH,
  calculateDose,
  isFormularyDrugId,
} from "@/lib/dosing";
import {
  summarizePlanProgress,
  type PlanItemStatus,
} from "@/lib/treatment-plans/progress";
import {
  findOpenSlotsAcrossWindows,
  intersectAvailabilityWindows,
} from "@/lib/scheduling/availability";
import { providerCoverageForDate } from "@/lib/scheduling/provider-availability";
import {
  conflictMessage,
  detectConflicts,
  type ExistingBooking,
} from "@/lib/scheduling/conflicts";
import {
  clinicalDecimalInput,
  optionalClinicalTextInput,
} from "@/lib/records/clinical-inputs";
import {
  listActiveAppointmentLocations,
  resolveAppointmentLocation,
  takeAppointmentSchedulingLock,
} from "@/lib/scheduling/location";

/**
 * The agent's "hands": typed tools that operate the practice's data, always
 * scoped to a single practiceId. Each tool carries a JSON schema (for the
 * model) and a Zod schema (for runtime validation). Read tools are safe to
 * auto-run; write tools are flagged so the runner can gate them.
 */
export interface AgentToolContext {
  db: Database;
  practiceId: string;
  userId: string;
  postCommitEffect?: (effect: (rootDb: Database) => Promise<void>) => void;
}

export interface AgentTool {
  name: string;
  description: string;
  /** JSON Schema sent to the model as the tool's input_schema. */
  inputSchema: Record<string, unknown>;
  /** Runtime validation of the model-supplied args. */
  zod: z.ZodTypeAny;
  readOnly: boolean;
  requiredApiScopes?: AgentWriteApiScope[];
  execute(args: unknown, ctx: AgentToolContext): Promise<unknown>;
}

export type AgentWriteApiScope = "appointments:write" | "records:write";

export class AgentPracticeNotFoundError extends Error {
  constructor() {
    super("Practice not found");
    this.name = "AgentPracticeNotFoundError";
  }
}

export const AGENT_SEARCH_QUERY_MAX_LENGTH = 100;
export const AGENT_NOTES_MAX_LENGTH = 2000;
const FORMULARY_DRUG_IDS = FORMULARY.map((drug) => drug.id);

const agentSearchQueryInput = z
  .string()
  .trim()
  .min(1)
  .max(AGENT_SEARCH_QUERY_MAX_LENGTH);

const agentOptionalNotesInput = z
  .string()
  .trim()
  .max(AGENT_NOTES_MAX_LENGTH)
  .optional();

const formularyDrugIdInput = z
  .string()
  .trim()
  .min(1)
  .max(FORMULARY_DRUG_ID_MAX_LENGTH)
  .refine(isFormularyDrugId, "Drug must be in the formulary.");

const vitalTemperatureInput = clinicalDecimalInput("Temperature", {
  min: 20,
  max: 45,
  scale: 1,
});
const vitalWeightInput = clinicalDecimalInput("Weight", { positive: true, max: 200, scale: 3 });
const vitalCapillaryRefillInput = clinicalDecimalInput("Capillary refill", {
  min: 0,
  max: 10,
  scale: 1,
});

async function practiceTimeZone(
  ctx: AgentToolContext
): Promise<string | null> {
  const [practice] = await ctx.db
    .select({ timezone: practices.timezone })
    .from(practices)
    .where(and(eq(practices.id, ctx.practiceId), isNull(practices.deletedAt)))
    .limit(1);
  if (!practice) {
    throw new AgentPracticeNotFoundError();
  }
  return practice.timezone ?? null;
}

async function practiceDateInput(ctx: AgentToolContext): Promise<string> {
  const timezone = await practiceTimeZone(ctx);
  return formatDateInputForTimeZone(new Date(), timezone);
}

function clientName(first?: string | null, last?: string | null): string {
  return [first, last].filter(Boolean).join(" ");
}

async function activeClientExists(
  ctx: AgentToolContext,
  clientId: string
): Promise<boolean> {
  const [client] = await ctx.db
    .select({ id: clients.id })
    .from(clients)
    .where(
      and(
        eq(clients.id, clientId),
        eq(clients.practiceId, ctx.practiceId),
        isNull(clients.deletedAt)
      )
    )
    .limit(1);
  return Boolean(client);
}

async function activePatient(
  ctx: AgentToolContext,
  patientId: string
): Promise<{ id: string; clientId: string } | null> {
  const [patient] = await ctx.db
    .select({ id: patients.id, clientId: patients.clientId })
    .from(patients)
    .where(
      and(
        eq(patients.id, patientId),
        eq(patients.practiceId, ctx.practiceId),
        isNull(patients.deletedAt)
      )
    )
    .limit(1);
  return patient ?? null;
}

async function activeDoctorExists(
  ctx: AgentToolContext,
  doctorId: string
): Promise<boolean> {
  const [doctor] = await ctx.db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.id, doctorId),
        eq(users.practiceId, ctx.practiceId),
        eq(users.isVeterinarian, true),
        isNull(users.deletedAt)
      )
    )
    .limit(1);
  return Boolean(doctor);
}

async function activeRoomExists(
  ctx: AgentToolContext,
  roomId: string
): Promise<boolean> {
  const [room] = await ctx.db
    .select({ id: rooms.id })
    .from(rooms)
    .where(
      and(
        eq(rooms.id, roomId),
        eq(rooms.practiceId, ctx.practiceId),
        isNull(rooms.deletedAt)
      )
    )
    .limit(1);
  return Boolean(room);
}

async function validateScheduleResources(
  ctx: AgentToolContext,
  input: { doctorId?: string; roomId?: string }
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (input.doctorId && !(await activeDoctorExists(ctx, input.doctorId))) {
    return { ok: false, error: "Doctor not found" };
  }

  if (input.roomId && !(await activeRoomExists(ctx, input.roomId))) {
    return { ok: false, error: "Room not found" };
  }

  return { ok: true };
}

async function validateAppointmentTargets(
  ctx: AgentToolContext,
  input: { clientId?: string; patientId?: string; doctorId?: string }
): Promise<
  | { ok: true; clientId: string | null }
  | { ok: false; error: string }
> {
  let patientClientId: string | undefined;
  if (input.patientId) {
    const patient = await activePatient(ctx, input.patientId);
    if (!patient) return { ok: false, error: "Patient not found" };
    patientClientId = patient.clientId;
  }

  if (input.clientId && patientClientId && input.clientId !== patientClientId) {
    return { ok: false, error: "Patient not found" };
  }

  const clientId = input.clientId ?? patientClientId;
  if (clientId && !(await activeClientExists(ctx, clientId))) {
    return { ok: false, error: "Client not found" };
  }

  const resources = await validateScheduleResources(ctx, {
    doctorId: input.doctorId,
  });
  if (!resources.ok) return resources;

  return { ok: true, clientId: clientId ?? null };
}

async function fetchOverlappingAppointments(
  ctx: AgentToolContext,
  startTime: Date,
  endTime: Date
): Promise<ExistingBooking[]> {
  return ctx.db
    .select({
      id: appointments.id,
      startTime: appointments.startTime,
      endTime: appointments.endTime,
      doctorId: appointments.doctorId,
      roomId: appointments.roomId,
      locationId: appointments.locationId,
      status: appointments.status,
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.practiceId, ctx.practiceId),
        isNull(appointments.deletedAt),
        not(inArray(appointments.status, ["cancelled", "no_show"])),
        lt(appointments.startTime, endTime),
        gt(appointments.endTime, startTime)
      )
    );
}

const findClient: AgentTool = {
  name: "find_client",
  description:
    "Search clients (pet owners) by name, email, or phone. Returns up to 10 matches with their ids and registered patients.",
  inputSchema: {
    type: "object",
    properties: { query: { type: "string", description: "Name, email, or phone fragment" } },
    required: ["query"],
  },
  zod: z.object({ query: agentSearchQueryInput }),
  readOnly: true,
  async execute(args, ctx) {
    const { query } = this.zod.parse(args) as { query: string };
    const rows = await ctx.db
      .select({
        id: clients.id,
        firstName: clients.firstName,
        lastName: clients.lastName,
        email: clients.email,
        phone: clients.phone,
      })
      .from(clients)
      .where(
        and(
          eq(clients.practiceId, ctx.practiceId),
          isNull(clients.deletedAt),
          or(
            ilike(clients.firstName, `%${query}%`),
            ilike(clients.lastName, `%${query}%`),
            ilike(sql`concat(${clients.firstName}, ' ', ${clients.lastName})`, `%${query}%`),
            ilike(sql`concat(${clients.lastName}, ' ', ${clients.firstName})`, `%${query}%`),
            ilike(clients.email, `%${query}%`),
            ilike(clients.phone, `%${query}%`)
          )
        )
      )
      .limit(10);

    if (rows.length === 0) return [];

    const clientIds = rows.map((r) => r.id);
    const clientPatients = await ctx.db
      .select({
        id: patients.id,
        clientId: patients.clientId,
        name: patients.name,
        species: patients.species,
        breed: patients.breed,
        status: patients.status,
      })
      .from(patients)
      .where(
        and(
          eq(patients.practiceId, ctx.practiceId),
          inArray(patients.clientId, clientIds),
          isNull(patients.deletedAt)
        )
      );

    return rows.map((client) => ({
      ...client,
      patients: clientPatients
        .filter((p) => p.clientId === client.id)
        .map(({ clientId: _, ...p }) => p),
    }));
  },
};

const findPatient: AgentTool = {
  name: "find_patient",
  description:
    "Search patients (pets/animals) by name, breed, species, or owner name. Returns up to 10 matching patients with their patientId, signalment, status, and owner details.",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Patient name, breed, species, or owner name fragment",
      },
    },
    required: ["query"],
  },
  zod: z.object({ query: agentSearchQueryInput }),
  readOnly: true,
  async execute(args, ctx) {
    const { query } = this.zod.parse(args) as { query: string };
    const rows = await ctx.db
      .select({
        patientId: patients.id,
        name: patients.name,
        species: patients.species,
        breed: patients.breed,
        sex: patients.sex,
        dob: patients.dob,
        status: patients.status,
        owner: {
          id: clients.id,
          firstName: clients.firstName,
          lastName: clients.lastName,
          email: clients.email,
          phone: clients.phone,
        },
      })
      .from(patients)
      .innerJoin(clients, eq(patients.clientId, clients.id))
      .where(
        and(
          eq(patients.practiceId, ctx.practiceId),
          isNull(patients.deletedAt),
          isNull(clients.deletedAt),
          or(
            ilike(patients.name, `%${query}%`),
            ilike(patients.breed, `%${query}%`),
            ilike(sql`${patients.species}::text`, `%${query}%`),
            ilike(clients.firstName, `%${query}%`),
            ilike(clients.lastName, `%${query}%`),
            ilike(sql`concat(${clients.firstName}, ' ', ${clients.lastName})`, `%${query}%`),
            ilike(sql`concat(${clients.lastName}, ' ', ${clients.firstName})`, `%${query}%`)
          )
        )
      )
      .limit(10);
    return rows;
  },
};

const getPatientSummary: AgentTool = {
  name: "get_patient_summary",
  description:
    "Get a clinical summary for a patient: signalment, latest vitals, vaccinations, and active problems.",
  inputSchema: {
    type: "object",
    properties: { patientId: { type: "string", description: "Patient UUID" } },
    required: ["patientId"],
  },
  zod: z.object({ patientId: z.string().uuid() }),
  readOnly: true,
  async execute(args, ctx) {
    const { patientId } = this.zod.parse(args) as { patientId: string };
    const scope = and(eq(patients.practiceId, ctx.practiceId), isNull(patients.deletedAt));

    const [patient] = await ctx.db
      .select()
      .from(patients)
      .where(and(eq(patients.id, patientId), scope))
      .limit(1);
    if (!patient) return { error: "Patient not found" };

    const [latestVitals, vaccinations, problems] = await Promise.all([
      ctx.db
        .select()
        .from(vitalSigns)
        .where(
          and(
            eq(vitalSigns.patientId, patientId),
            eq(vitalSigns.practiceId, ctx.practiceId),
            isNull(vitalSigns.deletedAt),
            sql`not exists (
              select 1
              from ${clinicalRecordCorrections}
              where ${clinicalRecordCorrections.practiceId} = ${ctx.practiceId}
                and ${clinicalRecordCorrections.vitalSignId} = ${vitalSigns.id}
            )`
          )
        )
        .orderBy(desc(vitalSigns.recordedAt))
        .limit(1),
      ctx.db
        .select({
          vaccineName: vaccinationRecords.vaccineName,
          administeredAt: vaccinationRecords.administeredAt,
          nextDueDate: vaccinationRecords.nextDueDate,
        })
        .from(vaccinationRecords)
        .where(
          and(
            eq(vaccinationRecords.patientId, patientId),
            eq(vaccinationRecords.practiceId, ctx.practiceId),
            isNull(vaccinationRecords.deletedAt),
            sql`not exists (
              select 1
              from ${clinicalRecordCorrections}
              where ${clinicalRecordCorrections.practiceId} = ${ctx.practiceId}
                and ${clinicalRecordCorrections.vaccinationRecordId} = ${vaccinationRecords.id}
            )`
          )
        ),
      ctx.db
        .select({ description: problemList.description, status: problemList.status })
        .from(problemList)
        .where(
          and(
            eq(problemList.patientId, patientId),
            eq(problemList.practiceId, ctx.practiceId),
            isNull(problemList.deletedAt),
            eq(problemList.status, "active")
          )
        ),
    ]);

    return {
      patient: {
        id: patient.id,
        name: patient.name,
        species: patient.species,
        breed: patient.breed,
        sex: patient.sex,
        dob: patient.dob,
        status: patient.status,
      },
      latestVitals: latestVitals[0] ?? null,
      vaccinations,
      activeProblems: problems,
    };
  },
};

const listLocations: AgentTool = {
  name: "list_locations",
  description:
    "List active clinic locations. Use the location id when finding slots or booking in a multi-location practice.",
  inputSchema: { type: "object", properties: {} },
  zod: z.object({}),
  readOnly: true,
  async execute(_args, ctx) {
    return listActiveAppointmentLocations(ctx.db, ctx.practiceId);
  },
};

const listAppointments: AgentTool = {
  name: "list_appointments",
  description: "List appointments within a date range (inclusive). Dates are ISO-8601.",
  inputSchema: {
    type: "object",
    properties: {
      startDate: { type: "string", description: "ISO start datetime" },
      endDate: { type: "string", description: "ISO end datetime" },
    },
    required: ["startDate", "endDate"],
  },
  zod: z.object({
    startDate: z.string().datetime({ offset: true }),
    endDate: z.string().datetime({ offset: true }),
  }),
  readOnly: true,
  async execute(args, ctx) {
    const { startDate, endDate } = this.zod.parse(args) as {
      startDate: string;
      endDate: string;
    };
    const rows = await ctx.db
      .select({
        id: appointments.id,
        startTime: appointments.startTime,
        endTime: appointments.endTime,
        status: appointments.status,
        locationId: appointments.locationId,
        locationName: locations.name,
        patientName: patients.name,
        clientFirst: clients.firstName,
        clientLast: clients.lastName,
      })
      .from(appointments)
      .leftJoin(
        locations,
        and(
          eq(appointments.locationId, locations.id),
          eq(locations.practiceId, ctx.practiceId),
        ),
      )
      .leftJoin(
        patients,
        and(
          eq(appointments.patientId, patients.id),
          eq(patients.clientId, appointments.clientId),
          eq(patients.practiceId, ctx.practiceId),
          isNull(patients.deletedAt)
        )
      )
      .leftJoin(
        clients,
        and(
          eq(appointments.clientId, clients.id),
          eq(clients.practiceId, ctx.practiceId),
          isNull(clients.deletedAt)
        )
      )
      .where(
        and(
          eq(appointments.practiceId, ctx.practiceId),
          isNull(appointments.deletedAt),
          gte(appointments.startTime, new Date(startDate)),
          lte(appointments.startTime, new Date(endDate))
        )
      )
      .orderBy(appointments.startTime);
    return rows.map((r) => ({
      id: r.id,
      startTime: r.startTime,
      endTime: r.endTime,
      status: r.status,
      locationId: r.locationId,
      location: r.locationName,
      patient: r.patientName,
      client: clientName(r.clientFirst, r.clientLast),
    }));
  },
};

const bookAppointment: AgentTool = {
  name: "book_appointment",
  description:
    "Create an appointment. Times are ISO-8601; end must be after start. client_id and patient_id are optional but recommended.",
  inputSchema: {
    type: "object",
    properties: {
      startTime: { type: "string" },
      endTime: { type: "string" },
      clientId: { type: "string" },
      patientId: { type: "string" },
      doctorId: { type: "string" },
      roomId: { type: "string" },
      locationId: { type: "string" },
      notes: { type: "string" },
    },
    required: ["startTime", "endTime"],
  },
  zod: z
    .object({
      startTime: z.string().datetime({ offset: true }),
      endTime: z.string().datetime({ offset: true }),
      clientId: z.string().uuid().optional(),
      patientId: z.string().uuid().optional(),
      doctorId: z.string().uuid().optional(),
      roomId: z.string().uuid().optional(),
      locationId: z.string().uuid().optional(),
      notes: agentOptionalNotesInput,
    })
    .refine((b) => new Date(b.endTime) > new Date(b.startTime), {
      message: "endTime must be after startTime",
    }),
  readOnly: false,
  requiredApiScopes: ["appointments:write"],
  async execute(args, ctx) {
    const input = this.zod.parse(args) as {
      startTime: string;
      endTime: string;
      clientId?: string;
      patientId?: string;
      doctorId?: string;
      roomId?: string;
      locationId?: string;
      notes?: string;
    };
    await takeAppointmentSchedulingLock(ctx.db, ctx.practiceId);
    const targets = await validateAppointmentTargets(ctx, input);
    if (!targets.ok) return { error: targets.error };
    const location = await resolveAppointmentLocation(ctx.db, {
      practiceId: ctx.practiceId,
      locationId: input.locationId,
      doctorId: input.doctorId,
      roomId: input.roomId,
    });
    if (!location.ok) return { error: location.message };

    const startTime = new Date(input.startTime);
    const endTime = new Date(input.endTime);
    const message = conflictMessage(
      detectConflicts(
        {
          startTime,
          endTime,
          doctorId: input.doctorId,
          roomId: input.roomId,
          locationId: location.locationId,
        },
        await fetchOverlappingAppointments(ctx, startTime, endTime)
      )
    );
    if (message) return { error: message };

    const [created] = await ctx.db
      .insert(appointments)
      .values({
        practiceId: ctx.practiceId,
        startTime,
        endTime,
        clientId: targets.clientId,
        patientId: input.patientId ?? null,
        doctorId: input.doctorId ?? null,
        roomId: input.roomId ?? null,
        locationId: location.locationId,
        notes: input.notes ?? null,
      })
      .returning();
    await recordActivationAfterAppointmentCreated(
      ctx.db,
      ctx.practiceId,
      "agent.book_appointment"
    );
    await dispatchAppointmentWebhookAfterCommit(
      ctx,
      ctx.practiceId,
      "appointment.created",
      appointmentCreatedWebhookPayload(created!, "agent")
    );
    return { id: created!.id, status: created!.status };
  },
};

const listOverdueVaccinations: AgentTool = {
  name: "list_overdue_vaccinations",
  description: "List patients whose vaccinations are past due, for recall outreach.",
  inputSchema: { type: "object", properties: {} },
  zod: z.object({}),
  readOnly: true,
  async execute(_args, ctx) {
    const today = await practiceDateInput(ctx);
    const rows = await ctx.db
      .select({
        patientId: patients.id,
        patientName: patients.name,
        clientFirst: clients.firstName,
        clientLast: clients.lastName,
        vaccineName: vaccinationRecords.vaccineName,
        nextDueDate: vaccinationRecords.nextDueDate,
      })
      .from(vaccinationRecords)
      .innerJoin(
        patients,
        and(
          eq(vaccinationRecords.patientId, patients.id),
          eq(patients.practiceId, ctx.practiceId),
          isNull(patients.deletedAt)
        )
      )
      .leftJoin(
        clients,
        and(
          eq(patients.clientId, clients.id),
          eq(clients.practiceId, ctx.practiceId),
          isNull(clients.deletedAt)
        )
      )
      .where(
        and(
          eq(vaccinationRecords.practiceId, ctx.practiceId),
          isNull(vaccinationRecords.deletedAt),
          sql`not exists (
            select 1
            from ${clinicalRecordCorrections}
            where ${clinicalRecordCorrections.practiceId} = ${ctx.practiceId}
              and ${clinicalRecordCorrections.vaccinationRecordId} = ${vaccinationRecords.id}
          )`,
          sql`not exists (
            select 1
            from vaccination_records as newer_vaccination
            where newer_vaccination.practice_id = ${ctx.practiceId}
              and newer_vaccination.patient_id = ${vaccinationRecords.patientId}
              and newer_vaccination.deleted_at is null
              and lower(btrim(newer_vaccination.vaccine_name)) = lower(btrim(${vaccinationRecords.vaccineName}))
              and not exists (
                select 1
                from clinical_record_corrections as newer_correction
                where newer_correction.practice_id = ${ctx.practiceId}
                  and newer_correction.vaccination_record_id = newer_vaccination.id
              )
              and (
                newer_vaccination.administered_at > ${vaccinationRecords.administeredAt}
                or (
                  newer_vaccination.administered_at = ${vaccinationRecords.administeredAt}
                  and newer_vaccination.created_at > ${vaccinationRecords.createdAt}
                )
                or (
                  newer_vaccination.administered_at = ${vaccinationRecords.administeredAt}
                  and newer_vaccination.created_at = ${vaccinationRecords.createdAt}
                  and newer_vaccination.id::text > ${vaccinationRecords.id}::text
                )
              )
          )`,
          isNull(patients.deletedAt),
          lt(vaccinationRecords.nextDueDate, today)
        )
      )
      .orderBy(vaccinationRecords.nextDueDate)
      .limit(100);
    return rows.map((r) => ({
      patientId: r.patientId,
      patient: r.patientName,
      client: clientName(r.clientFirst, r.clientLast),
      vaccine: r.vaccineName,
      dueDate: r.nextDueDate,
    }));
  },
};

const calculateDrugDose: AgentTool = {
  name: "calculate_drug_dose",
  description:
    "Calculate a weight-based drug dose from the formulary. Returns a reference range; the clinician must verify before prescribing.",
  inputSchema: {
    type: "object",
    properties: {
      drugId: {
        type: "string",
        enum: FORMULARY_DRUG_IDS,
        maxLength: FORMULARY_DRUG_ID_MAX_LENGTH,
        description: "Formulary drug id, e.g. 'carprofen'",
      },
      species: { type: "string", enum: ["canine", "feline"] },
      weightKg: {
        type: "number",
        exclusiveMinimum: 0,
        maximum: DOSING_WEIGHT_MAX_KG,
      },
      concentrationMgPerMl: { type: "number", exclusiveMinimum: 0 },
    },
    required: ["drugId", "species", "weightKg"],
  },
  zod: z.object({
    drugId: formularyDrugIdInput,
    species: z.enum(["canine", "feline"]),
    weightKg: z.number().finite().positive().max(DOSING_WEIGHT_MAX_KG),
    concentrationMgPerMl: z.number().finite().positive().optional(),
  }),
  readOnly: true,
  async execute(args) {
    const input = this.zod.parse(args) as {
      drugId: string;
      species: "canine" | "feline";
      weightKg: number;
      concentrationMgPerMl?: number;
    };
    // calculateDose throws on bad input; the runner catches and returns the message.
    return calculateDose(input);
  },
};

const listTreatmentPlans: AgentTool = {
  name: "list_treatment_plans",
  description:
    "List a patient's treatment plans with their items and a progress summary.",
  inputSchema: {
    type: "object",
    properties: { patientId: { type: "string", description: "Patient UUID" } },
    required: ["patientId"],
  },
  zod: z.object({ patientId: z.string().uuid() }),
  readOnly: true,
  async execute(args, ctx) {
    const { patientId } = this.zod.parse(args) as { patientId: string };
    const plans = await ctx.db
      .select()
      .from(treatmentPlans)
      .where(
        and(
          eq(treatmentPlans.patientId, patientId),
          eq(treatmentPlans.practiceId, ctx.practiceId),
          isNull(treatmentPlans.deletedAt)
        )
      )
      .orderBy(desc(treatmentPlans.createdAt));
    if (plans.length === 0) return [];

    const items = await ctx.db
      .select()
      .from(treatmentPlanItems)
      .where(
        and(
          inArray(treatmentPlanItems.planId, plans.map((p) => p.id)),
          isNull(treatmentPlanItems.deletedAt)
        )
      )
      .orderBy(asc(treatmentPlanItems.sortOrder));

    return plans.map((plan) => {
      const planItems = items.filter((i) => i.planId === plan.id);
      return {
        id: plan.id,
        title: plan.title,
        status: plan.status,
        items: planItems.map((i) => ({ description: i.description, status: i.status })),
        progress: summarizePlanProgress(
          planItems.map((i) => ({ status: i.status as PlanItemStatus }))
        ),
      };
    });
  },
};

const recordVitalSigns: AgentTool = {
  name: "record_vital_signs",
  description:
    "Record a vital-signs entry for a patient. All measurements are optional; provide what was taken.",
  inputSchema: {
    type: "object",
    properties: {
      patientId: { type: "string", description: "Patient UUID" },
      temperatureC: { type: "number", description: "Celsius, one decimal place max" },
      heartRateBpm: { type: "number" },
      respiratoryRateBpm: { type: "number" },
      weightKg: { type: "number", description: "Kilograms, three decimal places max" },
      bodyConditionScore: { type: "number", description: "1-9" },
      painScore: { type: "number", description: "0-10" },
      capillaryRefillSec: { type: "number", description: "Seconds, one decimal place max" },
      notes: { type: "string" },
    },
    required: ["patientId"],
  },
  zod: z.object({
    patientId: z.string().uuid(),
    temperatureC: vitalTemperatureInput.optional(),
    heartRateBpm: z.number().int().min(0).max(400).optional(),
    respiratoryRateBpm: z.number().int().min(0).max(300).optional(),
    weightKg: vitalWeightInput.optional(),
    bodyConditionScore: z.number().int().min(1).max(9).optional(),
    painScore: z.number().int().min(0).max(10).optional(),
    capillaryRefillSec: vitalCapillaryRefillInput.optional(),
    notes: agentOptionalNotesInput,
  }),
  readOnly: false,
  requiredApiScopes: ["records:write"],
  async execute(args, ctx) {
    const input = this.zod.parse(args) as {
      patientId: string;
      temperatureC?: number;
      heartRateBpm?: number;
      respiratoryRateBpm?: number;
      weightKg?: number;
      bodyConditionScore?: number;
      painScore?: number;
      capillaryRefillSec?: number;
      notes?: string;
    };
    if (!(await activePatient(ctx, input.patientId))) {
      return { error: "Patient not found" };
    }

    const [row] = await ctx.db
      .insert(vitalSigns)
      .values({
        practiceId: ctx.practiceId,
        patientId: input.patientId,
        // The agent is not a user row; leave recordedBy null.
        recordedBy: null,
        temperatureC: input.temperatureC?.toString(),
        heartRateBpm: input.heartRateBpm,
        respiratoryRateBpm: input.respiratoryRateBpm,
        weightKg: input.weightKg?.toString(),
        bodyConditionScore: input.bodyConditionScore,
        painScore: input.painScore,
        capillaryRefillSec: input.capillaryRefillSec?.toString(),
        notes: input.notes ?? null,
      })
      .returning({ id: vitalSigns.id, recordedAt: vitalSigns.recordedAt });
    return { id: row!.id, recordedAt: row!.recordedAt };
  },
};

const findOpenSlotsTool: AgentTool = {
  name: "find_open_slots",
  description:
    "Find open appointment times on a date (optionally for a specific doctor or room). Use before book_appointment to pick a free time.",
  inputSchema: {
    type: "object",
    properties: {
      date: { type: "string", description: "YYYY-MM-DD" },
      durationMinutes: { type: "number" },
      doctorId: { type: "string" },
      roomId: { type: "string" },
      locationId: { type: "string" },
    },
    required: ["date"],
  },
  zod: z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    durationMinutes: z.number().int().min(10).max(240).optional(),
    doctorId: z.string().uuid().optional(),
    roomId: z.string().uuid().optional(),
    locationId: z.string().uuid().optional(),
  }),
  readOnly: true,
  async execute(args, ctx) {
    const input = this.zod.parse(args) as {
      date: string;
      durationMinutes?: number;
      doctorId?: string;
      roomId?: string;
      locationId?: string;
    };
    const resources = await validateScheduleResources(ctx, input);
    if (!resources.ok) return { error: resources.error };
    const location = await resolveAppointmentLocation(ctx.db, {
      practiceId: ctx.practiceId,
      locationId: input.locationId,
      doctorId: input.doctorId,
      roomId: input.roomId,
    });
    if (!location.ok) return { error: location.message };

    const timezone = await practiceTimeZone(ctx);
    const dayStart = dateInputTimeUtcInstant(
      input.date,
      { hour: 8 },
      timezone
    );
    const dayEnd = dateInputTimeUtcInstant(
      input.date,
      { hour: 18 },
      timezone
    );
    const coverage = input.doctorId
      ? await providerCoverageForDate(ctx.db, {
          practiceId: ctx.practiceId,
          date: input.date,
          timezone,
          locationId: location.locationId,
          doctorId: input.doctorId,
        })
      : { configured: false as const, windows: [] };
    const windows = coverage.configured
      ? intersectAvailabilityWindows(coverage.windows, {
          start: dayStart,
          end: dayEnd,
        })
      : [{ start: dayStart, end: dayEnd }];
    if (windows.length === 0) return [];

    const rows = await ctx.db
      .select({
        startTime: appointments.startTime,
        endTime: appointments.endTime,
        doctorId: appointments.doctorId,
        roomId: appointments.roomId,
        locationId: appointments.locationId,
      })
      .from(appointments)
      .where(
        and(
          eq(appointments.practiceId, ctx.practiceId),
          isNull(appointments.deletedAt),
          not(inArray(appointments.status, ["cancelled", "no_show"])),
          lt(appointments.startTime, dayEnd),
          gt(appointments.endTime, dayStart)
        )
      );

    const busy = rows.filter((r) => {
      if (input.doctorId && r.doctorId === input.doctorId) return true;
      if (input.roomId && r.roomId === input.roomId) return true;
      return (
        !input.doctorId && !input.roomId && r.locationId === location.locationId
      );
    });

    return findOpenSlotsAcrossWindows({
      windows,
      slotMinutes: input.durationMinutes ?? 30,
      busy,
    }).map((s) => ({ start: s.start.toISOString(), end: s.end.toISOString() }));
  },
};

const queryLabTrendsTool: AgentTool = {
  name: "query_lab_trends",
  description:
    "Query historical laboratory analyte trends (blood chemistry, hematology) for a patient to monitor disease progression (e.g., BUN, Creatinine, ALT, SDMA).",
  inputSchema: {
    type: "object",
    properties: {
      patientId: { type: "string", description: "Patient UUID" },
      analyte: {
        type: "string",
        description: "Optional specific analyte name (e.g., 'CREA', 'BUN', 'ALT')",
      },
      limit: {
        type: "number",
        description: "Max reports to inspect (default 20)",
      },
    },
    required: ["patientId"],
  },
  zod: z.object({
    patientId: z.string().uuid(),
    analyte: z.string().optional(),
    limit: z.number().int().min(1).max(100).optional(),
  }),
  readOnly: true,
  async execute(args, ctx) {
    const input = this.zod.parse(args) as {
      patientId: string;
      analyte?: string;
      limit?: number;
    };
    const reports = await ctx.db
      .select({
        id: labAnalyzerReports.id,
        sampleDate: labAnalyzerReports.sampleDate,
        createdAt: labAnalyzerReports.createdAt,
        parsedResults: labAnalyzerReports.parsedResults,
      })
      .from(labAnalyzerReports)
      .where(
        and(
          eq(labAnalyzerReports.practiceId, ctx.practiceId),
          eq(labAnalyzerReports.patientId, input.patientId),
          isNull(labAnalyzerReports.deletedAt)
        )
      )
      .orderBy(desc(labAnalyzerReports.sampleDate))
      .limit(input.limit ?? 20);

    const analyteTarget = input.analyte?.trim().toUpperCase();
    const timeline: Array<{
      date: string;
      analyte: string;
      value: number | string;
      unit?: string;
      flag?: string;
      referenceRange?: string;
    }> = [];

    for (const rep of reports) {
      const date = (rep.sampleDate || rep.createdAt || new Date()).toISOString();
      const results = Array.isArray(rep.parsedResults) ? rep.parsedResults : [];
      for (const item of results) {
        const itemAnalyte = (item.name || item.code || "").toUpperCase();
        if (!analyteTarget || itemAnalyte.includes(analyteTarget)) {
          timeline.push({
            date,
            analyte: item.name || item.code,
            value: item.value,
            unit: item.unit,
            flag: item.flag,
            referenceRange:
              item.refLow != null && item.refHigh != null
                ? `${item.refLow} - ${item.refHigh}`
                : undefined,
          });
        }
      }
    }

    let trend: "increasing" | "decreasing" | "stable" | "insufficient_data" =
      "insufficient_data";
    const numericValues = timeline
      .map((t) =>
        typeof t.value === "number" ? t.value : parseFloat(t.value as string)
      )
      .filter((v) => !isNaN(v));

    if (numericValues.length >= 2) {
      const first = numericValues[numericValues.length - 1]; // oldest
      const last = numericValues[0]; // newest
      const diffPercent = ((last - first) / (first || 1)) * 100;
      if (diffPercent > 10) trend = "increasing";
      else if (diffPercent < -10) trend = "decreasing";
      else trend = "stable";
    }

    return {
      patientId: input.patientId,
      analyte: input.analyte ?? "all",
      trend,
      dataPointsCount: timeline.length,
      history: timeline.slice(0, 30),
    };
  },
};

const checkDrugSafetyTool: AgentTool = {
  name: "check_drug_safety",
  description:
    "Check drug safety for a patient, auditing species-specific toxicities (e.g., Paracetamol or Permethrin in felines), drug-drug interactions (e.g. concurrent NSAIDs + Corticosteroids), and patient allergy records.",
  inputSchema: {
    type: "object",
    properties: {
      patientId: { type: "string", description: "Patient UUID" },
      candidateDrug: {
        type: "string",
        description: "Proposed medication or active substance name",
      },
    },
    required: ["patientId", "candidateDrug"],
  },
  zod: z.object({
    patientId: z.string().uuid(),
    candidateDrug: z.string().min(1),
  }),
  readOnly: true,
  async execute(args, ctx) {
    const input = this.zod.parse(args) as {
      patientId: string;
      candidateDrug: string;
    };

    const patientRows = await ctx.db
      .select({
        id: patients.id,
        name: patients.name,
        species: patients.species,
      })
      .from(patients)
      .where(
        and(
          eq(patients.id, input.patientId),
          eq(patients.practiceId, ctx.practiceId),
          isNull(patients.deletedAt)
        )
      )
      .limit(1);

    const patient = patientRows[0];
    if (!patient) {
      return {
        safe: false,
        severity: "error",
        contraindications: ["Patient not found"],
      };
    }

    const contraindications: string[] = [];
    const warnings: string[] = [];
    const candidateLower = input.candidateDrug.toLowerCase();
    const speciesLower = (patient.species || "").toLowerCase();

    // 1. Feline-specific fatal toxicities
    if (speciesLower.includes("cat") || speciesLower.includes("feline")) {
      if (
        candidateLower.includes("paracetamol") ||
        candidateLower.includes("acetaminophen")
      ) {
        contraindications.push(
          "Acetaminophen (Paracetamol) is fatal in feline patients due to deficient glucuronidation enzymes causing methemoglobinemia and acute hepatic necrosis."
        );
      }
      if (candidateLower.includes("permethrin")) {
        contraindications.push(
          "Permethrin is highly neurotoxic and potentially fatal to felines."
        );
      }
    }

    // 2. Human NSAID toxicities for dogs & cats
    if (
      candidateLower.includes("ibuprofen") ||
      candidateLower.includes("naproxen")
    ) {
      contraindications.push(
        "Human NSAIDs (Ibuprofen, Naproxen) cause acute renal failure and severe gastrointestinal ulceration in veterinary patients."
      );
    }

    // 3. Active prescriptions & drug interactions
    const activePrescriptions = await ctx.db
      .select({
        id: prescriptions.id,
        drugName: prescriptions.medicationName,
        status: prescriptions.status,
      })
      .from(prescriptions)
      .where(
        and(
          eq(prescriptions.practiceId, ctx.practiceId),
          eq(prescriptions.patientId, input.patientId),
          isNull(prescriptions.deletedAt),
          eq(prescriptions.status, "active")
        )
      );

    const isCandidateNsaid =
      /melox|carprofen|firocoxib|robenacoxib|onsior|metacam|rimadyl|galliprant|ketoprofen/i.test(
        candidateLower
      );
    const isCandidateSteroid =
      /prednis|dexamethason|triamcinolon|methylprednis|hydrocortison/i.test(
        candidateLower
      );

    for (const rx of activePrescriptions) {
      const rxName = (
        (rx as any).drugName ||
        (rx as any).medicationName ||
        ""
      ).toLowerCase();
      const isRxNsaid =
        /melox|carprofen|firocoxib|robenacoxib|onsior|metacam|rimadyl|galliprant|ketoprofen/i.test(
          rxName
        );
      const isRxSteroid =
        /prednis|dexamethason|triamcinolon|methylprednis|hydrocortison/i.test(
          rxName
        );

      if ((isCandidateNsaid && isRxSteroid) || (isCandidateSteroid && isRxNsaid)) {
        contraindications.push(
          `Concurrent administration of NSAID and Corticosteroid (${rxName}) is contraindicated due to severe risk of GI ulceration and intestinal perforation.`
        );
      }

      if (isCandidateNsaid && isRxNsaid) {
        contraindications.push(
          `Dual NSAID therapy with active prescription (${rxName}) is contraindicated. A washout period of 3-5 days is mandatory.`
        );
      }
    }

    // 4. Known Patient Allergies
    const allergies = await ctx.db
      .select({
        allergen: patientAllergies.allergen,
        reaction: patientAllergies.reaction,
        severity: patientAllergies.severity,
      })
      .from(patientAllergies)
      .where(
        and(
          eq(patientAllergies.patientId, input.patientId),
          isNull(patientAllergies.deletedAt)
        )
      );

    for (const allergy of allergies) {
      if (
        allergy.allergen &&
        candidateLower.includes(allergy.allergen.toLowerCase())
      ) {
        contraindications.push(
          `Patient has a recorded allergy to '${allergy.allergen}' (reaction: ${allergy.reaction || "unspecified"}, severity: ${allergy.severity}).`
        );
      }
    }

    const safe = contraindications.length === 0;
    const severity = !safe
      ? "contraindicated"
      : warnings.length > 0
        ? "warning"
        : "safe";

    return {
      safe,
      severity,
      contraindications,
      warnings,
    };
  },
};

const auditMissedChargesTool: AgentTool = {
  name: "audit_missed_charges",
  description:
    "Audit an appointment/visit to detect missed billing charges by cross-referencing documented SOAP procedures, administered meds, and dispense queue items against invoiced items.",
  inputSchema: {
    type: "object",
    properties: {
      appointmentId: { type: "string", description: "Appointment UUID" },
    },
    required: ["appointmentId"],
  },
  zod: z.object({
    appointmentId: z.string().uuid(),
  }),
  readOnly: true,
  async execute(args, ctx) {
    const input = this.zod.parse(args) as {
      appointmentId: string;
    };

    // 1. Get SOAP notes
    const soapList = await ctx.db
      .select({
        id: soapNotes.id,
        plan: soapNotes.plan,
        objective: soapNotes.objective,
        assessment: soapNotes.assessment,
      })
      .from(soapNotes)
      .where(
        and(
          eq(soapNotes.practiceId, ctx.practiceId),
          eq(soapNotes.appointmentId, input.appointmentId),
          isNull(soapNotes.deletedAt)
        )
      );

    // 2. Get unbilled dispense charge queue items
    const queueItems = await ctx.db
      .select({
        id: dispenseChargeQueue.id,
        descriptionSnapshot: dispenseChargeQueue.descriptionSnapshot,
        quantity: dispenseChargeQueue.quantity,
        status: dispenseChargeQueue.status,
      })
      .from(dispenseChargeQueue)
      .where(
        and(
          eq(dispenseChargeQueue.practiceId, ctx.practiceId),
          eq(dispenseChargeQueue.appointmentId, input.appointmentId),
          eq(dispenseChargeQueue.status, "pending")
        )
      );

    // 3. Get invoice items
    const invoicedItems = await ctx.db
      .select({
        id: invoiceItems.id,
        description: invoiceItems.description,
        total: invoiceItems.total,
      })
      .from(invoiceItems)
      .innerJoin(invoices, eq(invoiceItems.invoiceId, invoices.id))
      .where(
        and(
          eq(invoices.practiceId, ctx.practiceId),
          eq(invoices.appointmentId, input.appointmentId),
          isNull(invoices.deletedAt),
          isNull(invoiceItems.deletedAt)
        )
      );

    const billedDescriptions = invoicedItems.map((i) =>
      i.description.toLowerCase()
    );
    const potentialMissedCharges: Array<{
      description: string;
      source: string;
      confidence: "high" | "medium";
    }> = [];

    // Check pending dispense charges
    for (const q of queueItems) {
      const billed = billedDescriptions.some((b) =>
        b.includes(q.descriptionSnapshot.toLowerCase())
      );
      if (!billed) {
        potentialMissedCharges.push({
          description: `Dispensed: ${q.descriptionSnapshot} (Qty: ${q.quantity})`,
          source: "dispense_charge_queue",
          confidence: "high",
        });
      }
    }

    // Check clinical keywords in plan
    const planText = soapList
      .map((s) => `${s.plan || ""} ${s.objective || ""}`)
      .join(" ")
      .toLowerCase();

    const commonProcedures = [
      { name: "Blood Collection / Venipuncture", keyword: "odber krvi" },
      { name: "Radiography / RTG", keyword: "rtg" },
      { name: "Ultrasonography / USG", keyword: "usg" },
      { name: "Cytology", keyword: "cytol" },
      { name: "Nail Trim", keyword: "strihanie pazúrikov" },
      { name: "Microchipping", keyword: "čipovanie" },
    ];

    for (const proc of commonProcedures) {
      if (planText.includes(proc.keyword)) {
        const billed = billedDescriptions.some(
          (b) =>
            b.includes(proc.keyword) || b.includes(proc.name.toLowerCase())
        );
        if (!billed) {
          potentialMissedCharges.push({
            description: proc.name,
            source: "soap_notes",
            confidence: "medium",
          });
        }
      }
    }

    return {
      appointmentId: input.appointmentId,
      potentialMissedCount: potentialMissedCharges.length,
      potentialMissedCharges,
      invoicedItemsCount: invoicedItems.length,
    };
  },
};

const createDischargeSummaryTool: AgentTool = {
  name: "create_discharge_summary",
  description:
    "Generate a structured, owner-friendly Markdown discharge summary for a patient visit, summarizing diagnosis, clinical course, home care, medication schedule, and red-flag symptoms requiring emergency attention.",
  inputSchema: {
    type: "object",
    properties: {
      appointmentId: { type: "string", description: "Appointment UUID" },
      patientId: {
        type: "string",
        description: "Optional Patient UUID if not linked to appointment",
      },
    },
    required: ["appointmentId"],
  },
  zod: z.object({
    appointmentId: z.string().uuid(),
    patientId: z.string().uuid().optional(),
  }),
  readOnly: true,
  async execute(args, ctx) {
    const input = this.zod.parse(args) as {
      appointmentId: string;
      patientId?: string;
    };

    const aptRows = await ctx.db
      .select({
        id: appointments.id,
        patientId: appointments.patientId,
        startTime: appointments.startTime,
      })
      .from(appointments)
      .where(
        and(
          eq(appointments.id, input.appointmentId),
          eq(appointments.practiceId, ctx.practiceId),
          isNull(appointments.deletedAt)
        )
      )
      .limit(1);

    const patientId = input.patientId || aptRows[0]?.patientId;
    if (!patientId) {
      return { error: "Patient not found for this appointment" };
    }

    const patientRows = await ctx.db
      .select({
        id: patients.id,
        name: patients.name,
        species: patients.species,
        breed: patients.breed,
      })
      .from(patients)
      .where(
        and(
          eq(patients.id, patientId),
          eq(patients.practiceId, ctx.practiceId)
        )
      )
      .limit(1);

    const patient = patientRows[0];

    const soapList = await ctx.db
      .select({
        assessment: soapNotes.assessment,
        plan: soapNotes.plan,
      })
      .from(soapNotes)
      .where(
        and(
          eq(soapNotes.practiceId, ctx.practiceId),
          eq(soapNotes.appointmentId, input.appointmentId),
          isNull(soapNotes.deletedAt)
        )
      )
      .limit(1);

    const activeRx = await ctx.db
      .select({
        medicationName: prescriptions.medicationName,
        dosage: prescriptions.dosage,
        frequency: prescriptions.frequency,
      })
      .from(prescriptions)
      .where(
        and(
          eq(prescriptions.practiceId, ctx.practiceId),
          eq(prescriptions.patientId, patientId),
          isNull(prescriptions.deletedAt),
          eq(prescriptions.status, "active")
        )
      );

    const diag = soapList[0]?.assessment || "Klinické vyšetrenie";
    const instructions =
      soapList[0]?.plan || "Kľudový režim a monitorovanie celkového stavu.";

    const dischargeMarkdown = [
      `# Prepúšťacia správa: ${patient?.name || "Pacient"} (${patient?.species || "zviera"})`,
      `**Dátum ošetrenia:** ${aptRows[0]?.startTime ? new Date(aptRows[0].startTime).toLocaleDateString("sk-SK") : "Dnes"}`,
      `\n## Diagnóza a záver vyšetrenia`,
      diag,
      `\n## Domáca starostlivosť a režimové opatrenia`,
      instructions,
      `\n## Rozpis podávania liekov`,
      activeRx.length > 0
        ? activeRx
            .map((r) => `- **${r.medicationName}**: ${r.dosage}, ${r.frequency}`)
            .join("\n")
        : "Bez nutnosti domácej medikácie.",
      `\n## Varovné príznaky (kedy bezodkladne kontaktovať pohotovosť)`,
      "- Apatia, kolaps, neschopnosť vstať\n- Opakované zvracanie alebo neustupujúca hnačka\n- Dýchavičnosť, sťažené dýchanie alebo modranie slizníc\n- Krvácanie z rany alebo výrazný opuch",
    ].join("\n");

    return {
      appointmentId: input.appointmentId,
      patientName: patient?.name,
      markdown: dischargeMarkdown,
    };
  },
};

const generateRvpsReportTool: AgentTool = {
  name: "generate_rvps_report",
  description:
    "Generate the official Slovak RVPS (Regionálna veterinárna a potravinová správa) rabies vaccination statutory register report (Zákon č. 39/2007 Z. z.) for a given month and year.",
  inputSchema: {
    type: "object",
    properties: {
      year: { type: "number", description: "Reporting year (e.g. 2026)" },
      month: { type: "number", description: "Reporting month (1 - 12)" },
    },
    required: ["year", "month"],
  },
  zod: z.object({
    year: z.number().int().min(2020).max(2050),
    month: z.number().int().min(1).max(12),
  }),
  readOnly: true,
  async execute(args, ctx) {
    const input = this.zod.parse(args) as {
      year: number;
      month: number;
    };

    const startDate = new Date(Date.UTC(input.year, input.month - 1, 1, 0, 0, 0));
    const endDate = new Date(Date.UTC(input.year, input.month, 1, 0, 0, 0));

    const records = await ctx.db
      .select({
        id: vaccinationRecords.id,
        administeredAt: vaccinationRecords.administeredAt,
        vaccineName: vaccinationRecords.vaccineName,
        lotNumber: vaccinationRecords.lotNumber,
        rabiesTagNumber: vaccinationRecords.rabiesTagNumber,
        patientName: patients.name,
        patientSpecies: patients.species,
        microchipNumber: patients.microchipNumber,
        clientFirstName: clients.firstName,
        clientLastName: clients.lastName,
        clientAddress: clients.address,
      })
      .from(vaccinationRecords)
      .innerJoin(patients, eq(vaccinationRecords.patientId, patients.id))
      .leftJoin(clients, eq(patients.clientId, clients.id))
      .where(
        and(
          eq(vaccinationRecords.practiceId, ctx.practiceId),
          isNull(vaccinationRecords.deletedAt),
          gte(vaccinationRecords.administeredAt, startDate),
          lt(vaccinationRecords.administeredAt, endDate),
          ilike(vaccinationRecords.vaccineName, "%rabies%")
        )
      )
      .orderBy(asc(vaccinationRecords.administeredAt));

    const compliantRecords = [];
    const unchippedViolations = [];

    for (const r of records) {
      const item = {
        date: r.administeredAt
          ? new Date(r.administeredAt).toISOString().slice(0, 10)
          : "",
        owner: `${r.clientLastName || ""} ${r.clientFirstName || ""}`.trim(),
        ownerAddress: r.clientAddress || "Neznáma",
        animal: `${r.patientName} (${r.patientSpecies || "pes"})`,
        microchipNumber: r.microchipNumber || "CHÝBA",
        vaccine: `${r.vaccineName} (Šarža: ${r.lotNumber || "N/A"})`,
        tagNumber: r.rabiesTagNumber || "N/A",
      };

      if (!r.microchipNumber) {
        unchippedViolations.push(item);
      } else {
        compliantRecords.push(item);
      }
    }

    return {
      legalBasis:
        "Zákon č. 39/2007 Z. z. o veterinárnej starostlivosti - Hlásenie besnoty RVPS",
      reportingPeriod: `${input.year}-${String(input.month).padStart(2, "0")}`,
      totalVaccinated: records.length,
      compliantCount: compliantRecords.length,
      missingMicrochipViolationsCount: unchippedViolations.length,
      records: compliantRecords,
      violations: unchippedViolations,
    };
  },
};

export const AGENT_TOOLS: AgentTool[] = [
  findClient,
  findPatient,
  getPatientSummary,
  listLocations,
  listAppointments,
  findOpenSlotsTool,
  bookAppointment,
  listOverdueVaccinations,
  calculateDrugDose,
  listTreatmentPlans,
  recordVitalSigns,
  queryLabTrendsTool,
  checkDrugSafetyTool,
  auditMissedChargesTool,
  createDischargeSummaryTool,
  generateRvpsReportTool,
];

export function getTool(name: string): AgentTool | undefined {
  return AGENT_TOOLS.find((t) => t.name === name);
}

/** Tool definitions in Anthropic Messages API format. */
export function anthropicToolDefs() {
  return AGENT_TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema,
  }));
}
