import { z } from "zod";
import { assertAgentRole } from "@/lib/authorization";

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
  extWithdrawalPeriods,
  extRabiesObservations,
  microchipRegistrations,
  petPassports,
  careReminders,
  controlledSubstanceLog,
  dischargeReports,
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
  /** Role of the authenticated user invoking the agent. Used for tool-level access control. */
  userRole?: string;
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
    assertAgentRole(
      ctx,
      ["admin", "veterinarian", "front_desk", "technician"],
      "Prístup k údajom klientov je obmedzený na personál kliniky. / Client data access is restricted to clinic staff.",
    );
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
    assertAgentRole(
      ctx,
      ["admin", "veterinarian", "front_desk", "technician"],
      "Prístup k údajom pacientov je obmedzený na personál kliniky. / Patient data access is restricted to clinic staff.",
    );
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
    assertAgentRole(
      ctx,
      ["admin", "veterinarian", "technician"],
      "Súhrn zdravotného záznamu pacienta je prístupný len klinickému personálu. / Patient clinical summary is restricted to clinical staff.",
    );
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
    assertAgentRole(
      ctx,
      ["admin", "veterinarian", "front_desk", "technician"],
      "Zoznam prevádzok je prístupný len personálu kliniky. / Location list is restricted to clinic staff.",
    );
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
    assertAgentRole(
      ctx,
      ["admin", "veterinarian", "front_desk", "technician"],
      "Zoznam termínov je prístupný len personálu kliniky. / Appointment list is restricted to clinic staff.",
    );
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
    assertAgentRole(
      ctx,
      ["admin", "veterinarian", "front_desk"],
      "Objednávanie termínov je povolené pre recepciu, veterinárov a administrátorov. / Booking appointments is permitted for front desk, veterinarians, and admins.",
    );
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
    assertAgentRole(
      ctx,
      ["admin", "veterinarian", "front_desk", "technician"],
      "Zoznam omeškaných očkovaní je prístupný personálu kliniky. / Overdue vaccinations list is restricted to clinic staff.",
    );
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
  async execute(args, ctx) {
    assertAgentRole(
      ctx,
      ["admin", "veterinarian", "technician"],
      "Kalkulácia dávkovania liečiv je vyhradená pre klinický personál. / Drug dose calculation is restricted to clinical staff.",
    );
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
    assertAgentRole(
      ctx,
      ["admin", "veterinarian", "technician"],
      "Zoznam liečebných plánov je prístupný len klinickému personálu. / Treatment plans are restricted to clinical staff.",
    );
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
    assertAgentRole(
      ctx,
      ["admin", "veterinarian", "technician"],
      "Zaznamenávanie vitálnych funkcií je vyhradené pre klinický personál. / Recording vital signs is restricted to clinical staff.",
    );
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
    assertAgentRole(
      ctx,
      ["admin", "veterinarian", "front_desk", "technician"],
      "Vyhľadávanie voľných termínov je prístupné len personálu kliniky. / Finding open slots is restricted to clinic staff.",
    );
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
    assertAgentRole(
      ctx,
      ["admin", "veterinarian", "technician"],
      "Laboratórne trendy sú prístupné len klinickému personálu. / Lab trends are restricted to clinical staff.",
    );
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

// ---------------------------------------------------------------------------
// check_drug_safety local knowledge base
//
// This is an explicit, auditable heuristic — NOT a pharmacology database.
// Every class below lists generic, common trade and Slovak name fragments.
// Anything the knowledge base cannot classify must fail safe with an
// "unknown" severity warning instead of silently reporting safe: true
// (silent false-negatives are the top clinical risk of this tool).
// ---------------------------------------------------------------------------

type DrugClass =
  | "nsaid"
  | "corticosteroid"
  | "tramadol"
  | "ssri"
  | "maoi"
  | "tca"
  | "aminoglycoside"
  | "loop_diuretic"
  | "fluoroquinolone";

const DRUG_CLASS_PATTERNS: ReadonlyArray<{ cls: DrugClass; re: RegExp }> = [
  {
    cls: "nsaid",
    re: /melox|carprofen|karprof[eé]n|firocoxib|robenacoxib|rob[eé]nakoxib|onsior|metacam|melovem|meloxidyl|loxicam|rimadyl|noxivat|novox|grapiprant|galliprant|ketoprofen|ketoprof[eé]n|tolfenam|vedaprofen|eltenac|piroxicam|diklofenak|diclofenac|flurbiprofen|ketorolak|ketorolac|aspir[ií]n|acetylsalicyl|acetylsalicylic|ibuprofen|naproxen|nimesulid|indometacin/i,
  },
  {
    cls: "corticosteroid",
    re: /prednis|prednison|dexamethason|dexametaz[oó]n|triamcinolon|triamcinol[oó]n|methylprednis|metylpred|hydrocortison|hydrokortiz[oó]n|betamethason|betametaz[oó]n|budesonid|kortikoid|kortizon|cortisone|flutikazon|fluticasone|mometazon|mometasone|metylprednizol[oó]n/i,
  },
  { cls: "tramadol", re: /tramadol|tramal/i },
  {
    cls: "ssri",
    re: /fluoxetin|sertralin|paroxetin|fluvoxamin|citalopram|escitalopram/i,
  },
  {
    cls: "maoi",
    re: /selegilin|selgian|anipryl|caselgyl|moklobemid|moclobemide|fenelzin|phenelzine|tranylcypromin/i,
  },
  {
    cls: "tca",
    re: /klomipramin|clomipramine|clomicalm|amitriptylin|amitriptyline|imipramin|doxepin|trazod[oó]n|trazodone/i,
  },
  {
    cls: "aminoglycoside",
    re: /gentamicin|gentamycin|amikacin|amikac[ií]n|neomycin|neomyc[ií]n|tobramycin|tobramyc[ií]n|streptomycin|streptomyc[ií]n|kanamycin|kanamyc[ií]n|framycetin|framycet[ií]n|paromomycin|polymyx/i,
  },
  {
    cls: "loop_diuretic",
    re: /furosemid|furosemide|torasemid|torsemide|torasemide|bumetanid|bumetanide/i,
  },
  {
    cls: "fluoroquinolone",
    re: /enrofloxacin|marbofloxacin|marbofloxac[ií]n|orbifloxacin|orbifloxac[ií]n|pradofloxacin|pradofloxac[ií]n|difloxacin|difloxac[ií]n|ciprofloxacin|ciprofloxac[ií]n|ibafloxacin|ibafloxac[ií]n|baytril|marbocyl/i,
  },
];

/**
 * Brand ↔ generic alias groups (common SK/CZ trade names included). Used to
 * match allergies recorded under a trade name against a generic proposal
 * (e.g. allergen "Metacam" vs candidate "meloxicam").
 */
const DRUG_ALIAS_GROUPS: ReadonlyArray<{ substance: string; re: RegExp }> = [
  { substance: "meloxicam", re: /melox|metacam|melovem|meloxidyl|loxicam/ },
  { substance: "carprofen", re: /carprofen|karprof[eé]n|rimadyl|noxivat|novox/ },
  { substance: "firocoxib", re: /firocoxib|previcox/ },
  { substance: "robenacoxib", re: /robenacoxib|rob[eé]nakoxib|onsior/ },
  { substance: "grapiprant", re: /grapiprant|galliprant/ },
  { substance: "enrofloxacin", re: /enrofloxac|baytril/ },
  { substance: "marbofloxacin", re: /marbofloxac|marbocyl/ },
  { substance: "amoxicillin_clavulanate", re: /amoxicil|klavulan|clavulan|synulox|kesium|noroclav/ },
  { substance: "metronidazole", re: /metronidazol|entizol/ },
  { substance: "doxycycline", re: /doxycykl|doxycyclin|vibramycin|ronaxan/ },
  { substance: "cephalexin", re: /cefalexin|cefalex[ií]n|cephalexin|rilexin|cefadroxil/ },
  { substance: "clindamycin", re: /klindamycin|clindamycin|antirobe/ },
  { substance: "cefovecin", re: /cefovecin|convenia/ },
  { substance: "maropitant", re: /maropitant|cerenia|prevomisol/ },
  { substance: "tramadol", re: /tramadol|tramal/ },
  { substance: "selegiline", re: /selegilin|selgian|anipryl|caselgyl/ },
  { substance: "clomipramine", re: /klomipramin|clomipramine|clomicalm/ },
  { substance: "fluoxetine", re: /fluoxetin|reconcile|prozac/ },
  { substance: "prednisolone", re: /prednisolon|prednison/ },
  { substance: "ketamine", re: /ketam[ií]n|ketalar|narkamon|calypsol/ },
  { substance: "medetomidine", re: /medetomidin|domitor|dexmedetomidin|dexdomitor|sileo/ },
  { substance: "atipamezole", re: /atipamezol|antisedan/ },
  { substance: "buprenorphine", re: /buprenorfin|temgesic|vetergesic|bupredyne/ },
  { substance: "butorphanol", re: /butorfanol|butorphanol|torbugesic|dolorex/ },
  { substance: "methadone", re: /metadon|methadon|metisedive|comfortion/ },
  { substance: "fentanyl", re: /fentanyl|fentanil/ },
  { substance: "gabapentin", re: /gabapent[ií]n|gabapen/ },
  { substance: "phenobarbital", re: /fenobarbital|phenobarbital|phenoleptil|libromide/ },
  { substance: "levetiracetam", re: /levetiracetam|levetiracet[aá]m|keppra/ },
  { substance: "imepitoin", re: /imepitoin|pexion/ },
  { substance: "diazepam", re: /diazepam|apauvi|seduxen/ },
  { substance: "propofol", re: /propofol/ },
  { substance: "alfaxalone", re: /alfaxalon|alfaxalone|alfaxan/ },
  { substance: "isoflurane", re: /izofluran|isoflurane/ },
  { substance: "sevoflurane", re: /sevofluran|sevoflurane/ },
  { substance: "acepromazine", re: /acepromaz[ií]n|acetylpromaz[ií]n|vetranquil|sedalin/ },
  { substance: "fenbendazole", re: /fenbendazol|panacur/ },
  { substance: "praziquantel", re: /prazikvantel|praziquantel|drontal|cestal|profender|profend|emodepsid/ },
  { substance: "pyrantel", re: /pyrantel|pirantel/ },
  { substance: "milbemycin", re: /milbemicin|milbemycin|milbemax|interceptor|milprazic|milprazon|broadline/ },
  { substance: "moxidectin", re: /moxidektin|moxidectin|advocate/ },
  { substance: "selamectin", re: /selamektin|selamectin|stronghold/ },
  { substance: "ivermectin", re: /ivermektin|ivermectin/ },
  { substance: "afoxolaner", re: /afoxolaner|nexgard/ },
  { substance: "fluralaner", re: /fluralaner|fluralaner|bravecto/ },
  { substance: "sarolaner", re: /sarolaner|simparica/ },
  { substance: "lotilaner", re: /lotilaner|credelio/ },
  { substance: "nitenpyram", re: /nitenpyram|capstar/ },
  { substance: "amitraz", re: /amitraz|preventic/ },
  { substance: "fipronil", re: /fipronil|frontline|effipro|fipron/ },
  { substance: "imidacloprid", re: /imidacloprid|imidakloprid|advantage/ },
  { substance: "permethrin", re: /permethrin|permetr[ií]n|kiltix|advantix/ },
  { substance: "oclacitinib", re: /oklacitinib|oclacitinib|apoquel/ },
  { substance: "lokivetmab", re: /lokivetmab|cytopoint/ },
  { substance: "cyclosporine", re: /cyklosporin|cyclosporin|cyclosporine|atopica|optimune/ },
  { substance: "pimobendan", re: /pimobendan|vetmedin|kardoret|cardisure/ },
  { substance: "benazepril", re: /benazepril|benazepril|fortekor/ },
  { substance: "enalapril", re: /enalapril|enap/ },
  { substance: "telmisartan", re: /telmisartan|semintra/ },
  { substance: "amlodipine", re: /amlodipin|amlodipine|norvasc/ },
  { substance: "spironolactone", re: /spironolakt[oó]n|spironolactone|prilactone|aldactone/ },
  { substance: "clopidogrel", re: /klopidogrel|clopidogrel|plavix/ },
  { substance: "levothyroxine", re: /levotyroxin|levothyroxine|thyforon|forthyron|thyroxine/ },
  { substance: "methimazole", re: /metimazol|methimazole|felimazole|vidalta|thiamazol/ },
  { substance: "trilostane", re: /trilostan|trilostane|vetoryl/ },
  { substance: "mitotane", re: /mitotan|mitotane|lysodren/ },
  { substance: "deslorelin", re: /deslorelin|suprelorin/ },
  { substance: "metoclopramide", re: /metoklopramid|metoclopramide|cerucal/ },
  { substance: "ondansetron", re: /ondansetr[oó]n|ondansetron|zofran/ },
  { substance: "famotidine", re: /famotidin|famotidine|kvamatel|pepcidin/ },
  { substance: "omeprazole", re: /omeprazol|omeprazole|gastrozol|losec|ulzol/ },
  { substance: "sucralfate", re: /sukralf[aá]t|sucralfate|venter/ },
  { substance: "lactulose", re: /laktul[oó]za|lactulose|duphalac/ },
  { substance: "loperamide", re: /loperamid|loperamide|imodium/ },
  { substance: "insulin", re: /inzul[ií]n|insulin|vetsulin|caninsulin|prozinc|lantus|glargine|detemir|levemir/ },
  { substance: "paracetamol", re: /paracetamol|acetaminophen|paralen|panadol|pamol/ },
  { substance: "ibuprofen", re: /ibuprofen|brufen|nurofen/ },
  { substance: "naproxen", re: /naproxen|nalgesin/ },
  { substance: "cyproheptadine", re: /cyproheptadin|cyproheptadine|peritol/ },
  { substance: "mirtazapine", re: /mirtazapin|mirtazapine/ },
  { substance: "desmopressin", re: /desmopresin|desmopressin|minirin|adursin/ },
  { substance: "cabergoline", re: /kabergolin|cabergoline|galastop/ },
  { substance: "aglepristone", re: /aglepriston|aglepristone|alizin/ },
  { substance: "oxytocin", re: /oxytocin|ocytocin|oxytoc[ií]n/ },
  { substance: "misoprostol", re: /misoprostol|cytotec/ },
  { substance: "dexamethasone", re: /dexamethason|dexametaz[oó]n|dexadreson|dexa/ },
];

/**
 * Common veterinary drugs with no hard interaction rules here; listing them
 * marks the candidate as "recognized" so routine, well-understood medicines
 * return safe:true while genuinely unknown substances fail safe.
 */
const KNOWN_DRUG_PATTERN =
  /maropitant|cerenia|metoklopramid|metoclopramide|ondansetr|ranitidin|ranitidine|famotidin|omeprazol|pantoprazol|sukralf|sucralfate|laktul|lactulose|loperamid|metronidazol|amoxicil|ampicilin|penicilin|benzylpenicillin|cefal|ceftiofur|cefpodox|cefovecin|convenia|doxycykl|tetracykl|oxytetracyklin|klindamycin|clindamycin|tylosin|tilosin|azithromycin|azitromycin|klaritromycin|erythromycin|spiramycin|lincomycin|vankomycin|meropenem|imipenem|rifaximin|nitrofurantoin|sulfonamid|sulfadimethoxin|sulfadiazin|trimethoprim|trimetoprim|toltrazuril|ponazuril|fenbendazol|pyrantel|prazikvantel|praziquantel|milbemicin|milbemycin|moxidektin|selamektin|ivermektin|afoxolaner|fluralaner|sarolaner|lotilaner|nitenpyram|amitraz|fipronil|imidakloprid|permethrin|spinosad|lufenuron|levamisol|albendazol|oxfendazol|febantel|closantel|niklosamid|niclosamide|ketokonazol|itrakonazol|flukonazol|terbinafin|griseofulvin|nystatin|klotrimazol|mikonazol|enilkonazol|chl[oó]rhexidin|chlorhexidine|oklacitinib|apoquel|lokivetmab|cytopoint|cyklosporin|pimobendan|benazepril|enalapril|ramipril|kaptopril|lisinopril|telmisartan|amlodipin|diltiazem|atenolol|sotalol|propranolol|spironolakt|klopidogrel|rivaroxaban|hepar[ií]n|digoxin|digox[in]|milrinon|amiodaron|furosemid|torasemid|hydrochlo[rt]tiazid|acetazolamid|manitol|mannitol|levotyroxin|metimazol|trilostan|mitotan|deslorelin|mibolerone|estriol|inkurin|fenylpropanolam[ií]n|propalin|fenoxybenzam[ií]n|terazosin|tamsulosin|betanechol|bethanechol|oxybutin|gabapent[ií]n|pregabal|amantadin|fenobarbital|levetiracetam|zonisamid|imepitoin|diazepam|midazolam|alprazolam|klonazepam|klorazep|propofol|alfaxalon|alfaxalone|etomidat|tiopental|ketam[ií]n|tiletamin|zoletil|izofluran|sevofluran|desfluran|oxid dusn[yý]|acepromaz[ií]n|medetomidin|xylazin|romifidin|detomidin|butorfanol|buprenorfin|morfin|morphine|metadon|fentanyl|hydromorfon|oxymorfon|petid[ií]n|meperidine|kode[ií]n|codeine|hydrokodon|oxykodon|naloxon|flumazenil|atipamezol|yohimbin|lidokain|lidocaine|bupivakain|mepivakain|ropivakain|prokain|tetrakain|atrakurium|rokuronium|vekuronium|sukcinylcholin|neostigmin|edrof[oó]nium|pyridostigmin|dantrol[eé]n|baklof|metokarbamol|atrop[ií]n|glykopyrol|glycopyrrolate|epinefrin|adrenal[ií]n|dobutam[ií]n|dopam[ií]n|noradrenal[ií]n|norepinefrin|fenylefrin|vazopresin|glukon[aá]t v[aá]penat|calcium gluconate|s[ií]ran horečnat|magn[eé]zium|hydrogenuhličit[aá]n|bicarbonate|chlorid draseln|mannitol|gluk[oó]za|dextrose|glukag|inzul[ií]n|insulin|metform[ií]n|glipizid|diazoxid|oktreotid|fludrokortiz|desoxycorticosterone|zycortal|percorten|salbutamol|albuterol|terbutal[ií]n|teofyl[ií]n|theophylline|aminofyl[ií]n|klenbuterol|flutikazon|montelukast|dextrometorf|acetylcyste[ií]n|sildenafil|difenhydramin|diphenhydramine|chl[oó]rfenam[ií]n|chlorpheniramine|cetiriz[ií]n|loratadin|fexofenadin|prometaz[ií]n|promethazine|hydroxyz[ií]n|mecliz[ií]n|mekliz[ií]n|dimenhydrin[aá]t|dramamine|ciklizin|maropitant|ondansetr|dolasetron|granisetron|prochl[oó]rperazin|chlopromazin|chlorpromazine|mirtazapin|cyproheptadin|kapromorelin|kaolin|pektin|bismut|psyllium|ps[yý]lium|bisakodyl|dokus[aá]t|sennosid|miner[aá]lny olej|akt[ií]vne uhlie|activated charcoal|uhlie|apomorf[ií]n|fomepizol|acetylcyste[ií]n|metyl[eé]nov[aá] modr[aá]|methylene blue|fytomenadion|vitam[ií]n k|protam[ií]n|lipidov[aá] emulzia|lipid emulsion|pralidox[ií]m|tiosulf[aá]t|hydroxokobalam[ií]n|glukozam[ií]n|glucosamine|chondroitin|omega-3|ryb[ií] olej|msm|silymarin|pestrec|ursodeoxychol|ursofalk|adenosylmetionin|denamarin|melaton[ií]n|tryptof[aá]n|kazozep[ií]n|zylkene|tean[ií]n|ferom|feliway|adaptil|thiamin|tiam[ií]n|pyridoxin|kyanokobalam[ií]n|kyselina listov[aá]|folic acid|tokoferol|askorb|eleutherococcus|zinc|zinok|sel[eé]n|železo|fero|probiotik|probiotic|saccharomyces|kaol[ií]n|diosmektit|smecta/i;

/** Fold accented characters to ASCII for name matching. */
function foldDrugName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function drugClasses(value: string): Set<DrugClass> {
  const folded = foldDrugName(value);
  const matches = new Set<DrugClass>();
  for (const { cls, re } of DRUG_CLASS_PATTERNS) {
    if (re.test(folded)) matches.add(cls);
  }
  return matches;
}

function isKnownDrug(value: string): boolean {
  const folded = foldDrugName(value);
  return (
    KNOWN_DRUG_PATTERN.test(folded) ||
    DRUG_CLASS_PATTERNS.some(({ re }) => re.test(folded)) ||
    DRUG_ALIAS_GROUPS.some(({ re }) => re.test(folded))
  );
}

function aliasSubstances(value: string): Set<string> {
  const folded = foldDrugName(value);
  const matches = new Set<string>();
  for (const { substance, re } of DRUG_ALIAS_GROUPS) {
    if (re.test(folded)) matches.add(substance);
  }
  return matches;
}

/**
 * Bidirectional, alias-aware allergy match. The old one-directional
 * `candidate.includes(allergen)` test missed generic proposals for a
 * trade-name allergy record (allergy "Metacam", drug "meloxicam").
 */
function drugMatchesAllergen(candidate: string, allergen: string): boolean {
  const c = foldDrugName(candidate);
  const a = foldDrugName(allergen).trim();
  if (a.length < 3) return false;
  if (c.includes(a) || a.includes(c)) return true;
  const candidateAliases = aliasSubstances(candidate);
  for (const substance of aliasSubstances(allergen)) {
    if (candidateAliases.has(substance)) return true;
  }
  // Token-level recall for long, specific allergen names (e.g. "Penicillin G").
  const tokens = a.split(/[^a-z0-9]+/).filter((token) => token.length >= 6);
  return tokens.some((token) => c.includes(token));
}

function ageInMonths(dob: string | null | undefined): number | null {
  if (!dob) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dob);
  if (!match) return null;
  const birth = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );
  if (Number.isNaN(birth)) return null;
  const now = Date.now();
  if (birth > now) return null;
  return Math.floor((now - birth) / (30.44 * 24 * 60 * 60 * 1000));
}

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
    assertAgentRole(
      ctx,
      ["admin", "veterinarian", "technician"],
      "Kontrola bezpečnosti liečiv je vyhradená pre klinický personál. / Drug safety check is restricted to clinical staff.",
    );
    const input = this.zod.parse(args) as {
      patientId: string;
      candidateDrug: string;
    };

    const patientRows = await ctx.db
      .select({
        id: patients.id,
        name: patients.name,
        species: patients.species,
        dob: patients.dob,
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
    let speciesRuleMatched = false;
    const candidateFolded = foldDrugName(input.candidateDrug);
    // The species column is an enum (canine|feline|avian|...), but accept
    // free-text/Slovak labels ("Mačka") defensively.
    const isFeline = /cat|feline|ma[cč]k/.test(foldDrugName(patient.species || ""));
    const isCanine = /dog|canine|\bpes\b/.test(foldDrugName(patient.species || ""));

    // 1. Feline-specific fatal toxicities
    if (isFeline) {
      if (
        /paracetamol|acetaminophen|paralen|panadol|pamol/.test(candidateFolded)
      ) {
        speciesRuleMatched = true;
        contraindications.push(
          "Acetaminophen (Paracetamol/Paralen) is fatal in feline patients due to deficient glucuronidation enzymes causing methemoglobinemia and acute hepatic necrosis."
        );
      }
      if (/permethrin|permetr[ií]n/.test(candidateFolded)) {
        speciesRuleMatched = true;
        contraindications.push(
          "Permethrin (e.g. canine Advantix/Kiltix spot-ons) is highly neurotoxic and potentially fatal to felines."
        );
      }
      if (/aspir[ií]n|acetylsalicyl/.test(candidateFolded)) {
        speciesRuleMatched = true;
        contraindications.push(
          "Aspirin (acetylsalicylic acid) has markedly prolonged half-life in cats and causes severe salicylate toxicity at standard doses; avoid without specialist dosing."
        );
      }
    }

    // 2. Human NSAID toxicities for dogs & cats
    if (/ibuprofen|brufen|nurofen|naproxen|nalgesin/.test(candidateFolded)) {
      speciesRuleMatched = true;
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

    const candidateClasses = drugClasses(input.candidateDrug);
    const candidateAliases = aliasSubstances(input.candidateDrug);
    const unrecognizedActiveMeds: string[] = [];

    const has = (set: Set<DrugClass>, cls: DrugClass) => set.has(cls);

    for (const rx of activePrescriptions) {
      const rxName = (
        (rx as { drugName?: string; medicationName?: string }).drugName ||
        (rx as { drugName?: string; medicationName?: string }).medicationName ||
        ""
      ).trim();
      if (!rxName) continue;
      const rxClasses = drugClasses(rxName);
      const rxAliases = aliasSubstances(rxName);

      // NSAID + Corticosteroid (either direction)
      if (
        (has(candidateClasses, "nsaid") && has(rxClasses, "corticosteroid")) ||
        (has(candidateClasses, "corticosteroid") && has(rxClasses, "nsaid"))
      ) {
        contraindications.push(
          `Concurrent administration of an NSAID and a corticosteroid (${rxName}) is contraindicated due to severe risk of GI ulceration and intestinal perforation.`
        );
      }

      // Dual NSAID therapy
      if (has(candidateClasses, "nsaid") && has(rxClasses, "nsaid")) {
        // Same active substance (e.g. generic + trade name) is not dual therapy.
        const sameSubstance = [...candidateAliases].some((s) =>
          rxAliases.has(s)
        );
        if (!sameSubstance) {
          contraindications.push(
            `Dual NSAID therapy with active prescription (${rxName}) is contraindicated. A washout period of 3-5 days is mandatory.`
          );
        }
      }

      // Serotonergic syndromes: tramadol/SSRI/TCA + MAOI; tramadol + SSRI.
      const candidateSerotonergic =
        has(candidateClasses, "tramadol") ||
        has(candidateClasses, "ssri") ||
        has(candidateClasses, "tca");
      const rxSerotonergic =
        has(rxClasses, "tramadol") ||
        has(rxClasses, "ssri") ||
        has(rxClasses, "tca");
      if (
        (candidateSerotonergic && has(rxClasses, "maoi")) ||
        (has(candidateClasses, "maoi") && rxSerotonergic)
      ) {
        contraindications.push(
          `Serotonergic drug combined with an MAOI (${rxName}) is contraindicated — risk of fatal serotonin syndrome / hypertensive crisis (e.g. tramadol or SSRIs with selegiline/Anipryl). A washout is mandatory.`
        );
      }
      if (
        (has(candidateClasses, "tramadol") && has(rxClasses, "ssri")) ||
        (has(candidateClasses, "ssri") && has(rxClasses, "tramadol"))
      ) {
        contraindications.push(
          `Tramadol combined with an SSRI (${rxName}) is contraindicated — high risk of serotonin syndrome (seizures, hyperthermia, collapse).`
        );
      }
      if (
        (has(candidateClasses, "tramadol") && has(rxClasses, "tca")) ||
        (has(candidateClasses, "tca") && has(rxClasses, "tramadol"))
      ) {
        warnings.push(
          `Tramadol combined with a tricyclic antidepressant (${rxName}) increases seizure and serotonin syndrome risk; verify with a veterinary pharmacology reference.`
        );
      }

      // Aminoglycoside + loop diuretic → ototoxicity / nephrotoxicity
      if (
        (has(candidateClasses, "aminoglycoside") &&
          has(rxClasses, "loop_diuretic")) ||
        (has(candidateClasses, "loop_diuretic") &&
          has(rxClasses, "aminoglycoside"))
      ) {
        contraindications.push(
          `Aminoglycoside with a loop diuretic (${rxName}) is contraindicated — synergistic irreversible ototoxicity and acute kidney injury.`
        );
      }

      // NSAID + aminoglycoside → additive nephrotoxicity
      if (
        (has(candidateClasses, "nsaid") &&
          has(rxClasses, "aminoglycoside")) ||
        (has(candidateClasses, "aminoglycoside") && has(rxClasses, "nsaid"))
      ) {
        warnings.push(
          `NSAID combined with an aminoglycoside (${rxName}) increases nephrotoxicity risk; ensure hydration and monitor renal values.`
        );
      }

      if (rxClasses.size === 0 && rxAliases.size === 0 && !isKnownDrug(rxName)) {
        unrecognizedActiveMeds.push(rxName);
      }
    }

    // Fluoroquinolones in growing animals — cartilage/joint damage.
    if (has(candidateClasses, "fluoroquinolone")) {
      const ageMonths = ageInMonths((patient as { dob?: string | null }).dob);
      if (ageMonths === null) {
        if (isCanine || isFeline) {
          warnings.push(
            "Fluoroquinolones can cause cartilage damage in growing animals; date of birth is unknown, so juvenile status could not be verified."
          );
        }
      } else if (ageMonths < 12) {
        contraindications.push(
          `Fluoroquinolones are contraindicated in growing animals (patient ~${ageMonths} months old) due to permanent cartilage/joint damage; allow up to 18 months for large/giant breeds.`
        );
      }
    }

    // 4. Known Patient Allergies (bidirectional, alias-aware)
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
        drugMatchesAllergen(input.candidateDrug, allergy.allergen)
      ) {
        contraindications.push(
          `Patient has a recorded allergy to '${allergy.allergen}' (reaction: ${allergy.reaction || "unspecified"}, severity: ${allergy.severity}).`
        );
      }
    }

    // 5. Fail-safe: the heuristic must never silently certify an unrecognized
    // drug as safe. Report "unknown" with an explicit coverage disclaimer.
    const recognized =
      speciesRuleMatched ||
      candidateClasses.size > 0 ||
      candidateAliases.size > 0 ||
      isKnownDrug(input.candidateDrug) ||
      contraindications.length > 0;

    if (!recognized) {
      warnings.push(
        `The local drug-safety knowledge base does not recognize '${input.candidateDrug.trim()}'. Interaction, toxicity and allergy coverage is limited to a built-in formulary, so this tool cannot certify the drug as safe. Verify the product SPC and a veterinary pharmacology reference (e.g. Plumb's) before administration.`
      );
    }

    if (unrecognizedActiveMeds.length > 0) {
      warnings.push(
        `Active prescription(s) not covered by the local interaction knowledge base: ${unrecognizedActiveMeds.join(
          ", "
        )}. Interactions against these medicines were not fully evaluated.`
      );
    }

    const safe = contraindications.length === 0;
    const severity = !safe
      ? "contraindicated"
      : warnings.length > 0
        ? recognized
          ? "warning"
          : "unknown"
        : "safe";

    return {
      safe: recognized ? safe : false,
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
    assertAgentRole(
      ctx,
      ["admin", "veterinarian"],
      "Finančný audit zmeškaných poplatkov je vyhradený pre administrátorov a veterinárov. / Missed charges audit is restricted to admins and veterinarians.",
    );
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
    assertAgentRole(
      ctx,
      ["admin", "veterinarian", "technician"],
      "Vytváranie prepúšťacích správ je vyhradené pre klinický personál. / Creating discharge summaries is restricted to clinical staff.",
    );
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
    assertAgentRole(
      ctx,
      ["admin", "veterinarian"],
      "Generovanie hlásení pre RVPS je vyhradené pre administrátorov a veterinárov. / Generating RVPS reports is restricted to admins and veterinarians.",
    );
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

// ---------------------------------------------------------------------------
// Statutory Compliance Tools — Zákon č. 39/2007 Z. z.
// ---------------------------------------------------------------------------

/**
 * check_withdrawal_periods
 * Query active or past withdrawal periods from the Kniha ošetrení register.
 * Useful when staff ask "Má krava Malina aktívnu ochrannú lehotu?" or similar.
 */
const checkWithdrawalPeriodsTool: AgentTool = {
  name: "check_withdrawal_periods",
  description:
    "Query the Slovak statutory withdrawal period register (Ochranné lehoty — Zákon č. 39/2007 Z. z.) for a patient or for all currently active withdrawal periods in the practice. Returns medication name, batch number, administered date, safe-until date, and remaining days.",
  inputSchema: {
    type: "object",
    properties: {
      patientId: {
        type: "string",
        description: "Patient UUID to filter by a specific animal. Omit to list all practice-wide active periods.",
      },
      activeOnly: {
        type: "boolean",
        description: "When true (default), return only currently active withdrawal periods (safeUntil in the future).",
      },
    },
    required: [],
  },
  zod: z.object({
    patientId: z.string().uuid().optional(),
    activeOnly: z.boolean().default(true),
  }),
  readOnly: true,
  async execute(args, ctx) {
    assertAgentRole(
      ctx,
      ["admin", "veterinarian"],
      "Kontrola ochranných lehôt je vyhradená pre veterinárov a administrátorov. / Checking withdrawal periods is restricted to veterinarians and admins.",
    );
    const input = this.zod.parse(args) as {
      patientId?: string;
      activeOnly: boolean;
    };

    const now = new Date();
    const conditions = [
      eq(extWithdrawalPeriods.practiceId, ctx.practiceId),
      isNull(extWithdrawalPeriods.deletedAt),
    ];
    if (input.patientId) {
      conditions.push(eq(extWithdrawalPeriods.patientId, input.patientId));
    }
    if (input.activeOnly) {
      conditions.push(gt(extWithdrawalPeriods.safeUntil, now));
    }

    const rows = await ctx.db
      .select({
        id: extWithdrawalPeriods.id,
        patientId: extWithdrawalPeriods.patientId,
        patientName: patients.name,
        patientSpecies: patients.species,
        medicationName: extWithdrawalPeriods.medicationName,
        batchNumber: extWithdrawalPeriods.batchNumber,
        targetAnimalType: extWithdrawalPeriods.targetAnimalType,
        meatWithdrawalDays: extWithdrawalPeriods.meatWithdrawalDays,
        milkWithdrawalDays: extWithdrawalPeriods.milkWithdrawalDays,
        administeredAt: extWithdrawalPeriods.administeredAt,
        safeUntil: extWithdrawalPeriods.safeUntil,
        notes: extWithdrawalPeriods.notes,
      })
      .from(extWithdrawalPeriods)
      .innerJoin(patients, eq(extWithdrawalPeriods.patientId, patients.id))
      .where(and(...conditions))
      .orderBy(asc(extWithdrawalPeriods.safeUntil))
      .limit(50);

    return rows.map((r) => {
      const safeUntil = r.safeUntil ? new Date(r.safeUntil) : null;
      const daysRemaining = safeUntil
        ? Math.ceil((safeUntil.getTime() - now.getTime()) / 86_400_000)
        : null;
      return {
        ...r,
        isActive: daysRemaining !== null && daysRemaining > 0,
        daysRemaining: daysRemaining !== null && daysRemaining > 0 ? daysRemaining : 0,
        safeUntilDate: safeUntil?.toISOString().slice(0, 10) ?? null,
      };
    });
  },
};

/**
 * check_rabies_observations
 * Query active 14-day rabies bite observation records (Zákon č. 39/2007 Z. z. § 19).
 * Detects which day-checkpoint is overdue today (Day 1, Day 5, Day 14).
 */
const checkRabiesObservationsTool: AgentTool = {
  name: "check_rabies_observations",
  description:
    "Query the Slovak statutory rabies bite observation register (14-dňové klinické pozorovanie — Zákon č. 39/2007 Z. z. § 19). Returns active IN_PROGRESS observations and flags any overdue day-checkpoints (Day 1, Day 5, Day 14) based on today's date.",
  inputSchema: {
    type: "object",
    properties: {
      patientId: {
        type: "string",
        description: "Patient UUID to filter by a specific animal. Omit to list all active observations.",
      },
      includeCompleted: {
        type: "boolean",
        description: "When true, also include completed observations (default false).",
      },
    },
    required: [],
  },
  zod: z.object({
    patientId: z.string().uuid().optional(),
    includeCompleted: z.boolean().default(false),
  }),
  readOnly: true,
  async execute(args, ctx) {
    assertAgentRole(
      ctx,
      ["admin", "veterinarian"],
      "Kontrola pozorovaní besnoty je vyhradená pre veterinárov a administrátorov. / Checking rabies observations is restricted to veterinarians and admins.",
    );
    const input = this.zod.parse(args) as {
      patientId?: string;
      includeCompleted: boolean;
    };

    const now = new Date();
    const conditions = [
      eq(extRabiesObservations.practiceId, ctx.practiceId),
      isNull(extRabiesObservations.deletedAt),
    ];
    if (input.patientId) {
      conditions.push(eq(extRabiesObservations.patientId, input.patientId));
    }
    if (!input.includeCompleted) {
      conditions.push(eq(extRabiesObservations.status, "IN_PROGRESS"));
    }

    const rows = await ctx.db
      .select({
        id: extRabiesObservations.id,
        patientId: extRabiesObservations.patientId,
        patientName: patients.name,
        biteDate: extRabiesObservations.biteDate,
        injuredPersonName: extRabiesObservations.injuredPersonName,
        injuredPersonContact: extRabiesObservations.injuredPersonContact,
        status: extRabiesObservations.status,
        day1ExaminedAt: extRabiesObservations.day1ExaminedAt,
        day1Passed: extRabiesObservations.day1Passed,
        day5ExaminedAt: extRabiesObservations.day5ExaminedAt,
        day5Passed: extRabiesObservations.day5Passed,
        day14ExaminedAt: extRabiesObservations.day14ExaminedAt,
        day14Passed: extRabiesObservations.day14Passed,
        rvpsNotified: extRabiesObservations.rvpsNotified,
        notes: extRabiesObservations.notes,
      })
      .from(extRabiesObservations)
      .innerJoin(patients, eq(extRabiesObservations.patientId, patients.id))
      .where(and(...conditions))
      .orderBy(desc(extRabiesObservations.biteDate))
      .limit(30);

    return rows.map((r) => {
      const biteDate = r.biteDate ? new Date(r.biteDate) : null;
      function daysDue(offsetDays: number) {
        if (!biteDate) return null;
        return new Date(biteDate.getTime() + offsetDays * 86_400_000);
      }

      const day1Due = daysDue(1);
      const day5Due = daysDue(5);
      const day14Due = daysDue(14);

      const overdueCheckpoints: string[] = [];
      if (!r.day1ExaminedAt && day1Due && now > day1Due) overdueCheckpoints.push("Day 1");
      if (!r.day5ExaminedAt && day5Due && now > day5Due) overdueCheckpoints.push("Day 5");
      if (!r.day14ExaminedAt && day14Due && now > day14Due) overdueCheckpoints.push("Day 14");

      return {
        ...r,
        biteDateIso: biteDate?.toISOString().slice(0, 10) ?? null,
        day1DueDate: day1Due?.toISOString().slice(0, 10) ?? null,
        day5DueDate: day5Due?.toISOString().slice(0, 10) ?? null,
        day14DueDate: day14Due?.toISOString().slice(0, 10) ?? null,
        overdueCheckpoints,
        isRvpsNotificationRequired: !r.rvpsNotified,
      };
    });
  },
};

/**
 * verify_microchip_crsz
 * Validate a 15-digit ISO 11784/11785 microchip number and query the CRSZ
 * registration status for that chip + PetPass EU travel readiness.
 */
const verifyMicrochipCrszTool: AgentTool = {
  name: "verify_microchip_crsz",
  description:
    "Validate a 15-digit ISO 11784/11785 microchip number (Slovak country prefix 703) and look up its CRSZ (Centrálny register spoločenských zvierat) registration status. Also checks EU PetPass travel eligibility (rabies vaccination valid, travel eligible date reached).",
  inputSchema: {
    type: "object",
    properties: {
      microchipNumber: {
        type: "string",
        description: "15-digit microchip number (ISO 11784/11785). May also be searched by patient name using patientId instead.",
      },
      patientId: {
        type: "string",
        description: "Patient UUID alternative — looks up the chip registered for this patient.",
      },
    },
    required: [],
  },
  zod: z.object({
    microchipNumber: z.string().regex(/^\d{15}$/).optional(),
    patientId: z.string().uuid().optional(),
  }).refine((v) => v.microchipNumber !== undefined || v.patientId !== undefined, {
    message: "Provide microchipNumber or patientId",
  }),
  readOnly: true,
  async execute(args, ctx) {
    assertAgentRole(
      ctx,
      ["admin", "veterinarian", "front_desk", "technician"],
      "Overenie mikročipu v CRSZ je prístupné personálu kliniky. / Microchip CRSZ verification is restricted to clinic staff.",
    );
    const input = this.zod.parse(args) as {
      microchipNumber?: string;
      patientId?: string;
    };

    // Build chip registration query
    const chipConditions = [
      eq(microchipRegistrations.practiceId, ctx.practiceId),
      isNull(microchipRegistrations.deletedAt),
    ];
    if (input.microchipNumber) {
      chipConditions.push(eq(microchipRegistrations.microchipNumber, input.microchipNumber));
    }
    if (input.patientId) {
      chipConditions.push(eq(microchipRegistrations.patientId, input.patientId));
    }

    const [chipReg] = await ctx.db
      .select({
        id: microchipRegistrations.id,
        patientId: microchipRegistrations.patientId,
        patientName: patients.name,
        microchipNumber: microchipRegistrations.microchipNumber,
        implantedAt: microchipRegistrations.implantedAt,
        crszStatus: microchipRegistrations.crszStatus,
        crszRegisteredAt: microchipRegistrations.crszRegisteredAt,
        crszRecordId: microchipRegistrations.crszRecordId,
        location: microchipRegistrations.location,
        verifiedBeforeImplant: microchipRegistrations.verifiedBeforeImplant,
        verifiedAfterImplant: microchipRegistrations.verifiedAfterImplant,
      })
      .from(microchipRegistrations)
      .innerJoin(patients, eq(microchipRegistrations.patientId, patients.id))
      .where(and(...chipConditions))
      .limit(1);

    // Validate chip number format (ISO 11784: 15 digits, first 3 = country code)
    const chipNumber = input.microchipNumber ?? chipReg?.microchipNumber;
    const isoValidation = chipNumber
      ? {
          valid: /^\d{15}$/.test(chipNumber),
          countryCode: chipNumber.slice(0, 3),
          isSlovakCountryCode: chipNumber.startsWith("703"),
          isoCompliant: /^\d{15}$/.test(chipNumber),
        }
      : null;

    if (!chipReg) {
      return {
        found: false,
        isoValidation,
        message: "No CRSZ chip registration found for this practice.",
      };
    }

    // Look up PetPass / EU travel eligibility
    const [passport] = await ctx.db
      .select({
        passportNumber: petPassports.passportNumber,
        issuedAt: petPassports.issuedAt,
        rabiesVaccineName: petPassports.rabiesVaccineName,
        rabiesValidUntil: petPassports.rabiesValidUntil,
        travelEligibleFrom: petPassports.travelEligibleFrom,
      })
      .from(petPassports)
      .where(
        and(
          eq(petPassports.patientId, chipReg.patientId),
          eq(petPassports.practiceId, ctx.practiceId),
          isNull(petPassports.deletedAt)
        )
      )
      .orderBy(desc(petPassports.createdAt))
      .limit(1);

    const now = new Date();
    const travelReady = passport
      ? !!(
          passport.rabiesValidUntil &&
          new Date(passport.rabiesValidUntil) > now &&
          passport.travelEligibleFrom &&
          new Date(passport.travelEligibleFrom) <= now
        )
      : false;

    return {
      found: true,
      isoValidation,
      chip: {
        microchipNumber: chipReg.microchipNumber,
        patientName: chipReg.patientName,
        implantedAt: chipReg.implantedAt,
        location: chipReg.location,
        verifiedBeforeImplant: chipReg.verifiedBeforeImplant,
        verifiedAfterImplant: chipReg.verifiedAfterImplant,
      },
      crsz: {
        status: chipReg.crszStatus,
        registeredAt: chipReg.crszRegisteredAt,
        recordId: chipReg.crszRecordId,
        isRegistered: chipReg.crszStatus === "REGISTERED",
      },
      petPass: passport
        ? {
            passportNumber: passport.passportNumber,
            rabiesVaccineName: passport.rabiesVaccineName,
            rabiesValidUntil: passport.rabiesValidUntil,
            travelEligibleFrom: passport.travelEligibleFrom,
            euTravelReady: travelReady,
          }
        : null,
    };
  },
};

// ---------------------------------------------------------------------------
// AI Voice Scribe — Vital Signs from Dictation
// ---------------------------------------------------------------------------

/**
 * record_vitals_from_speech
 * Parse vital signs from a free-text dictation string and insert them into
 * the vitalSigns table. The AI model extracts structured values from natural
 * language (Slovak or English) before calling this tool.
 *
 * Example dictation: "Telesná teplota 38,5 stupňa, pulz 72 za minútu,
 * frekvencia dýchania 20, hmotnosť 28 kg, kapilárny čas plnenia 1,5 sekundy."
 */
const recordVitalsFromSpeechTool: AgentTool = {
  name: "record_vitals_from_speech",
  description:
    "Extract vital signs from a free-text dictation string (Slovak or English) and record them for the patient. The model should parse the text and provide structured values. Supports: temperature (°C), heart rate (bpm), respiratory rate (bpm), weight (kg), body condition score (1–9), pain score (0–10), capillary refill time (seconds). Always confirm extracted values with the user before saving if in doubt.",
  inputSchema: {
    type: "object",
    properties: {
      patientId: {
        type: "string",
        description: "Patient UUID to record vitals for.",
      },
      dictationText: {
        type: "string",
        description: "Raw dictation text to extract vitals from. Include the original text for audit trail.",
        maxLength: 2000,
      },
      temperatureC: { type: "number", description: "Body temperature in °C (e.g. 38.5)" },
      heartRateBpm: { type: "number", description: "Heart rate in beats per minute" },
      respiratoryRateBpm: { type: "number", description: "Respiratory rate in breaths per minute" },
      weightKg: { type: "number", description: "Body weight in kilograms" },
      bodyConditionScore: { type: "number", description: "Body condition score 1–9" },
      painScore: { type: "number", description: "Pain score 0–10" },
      capillaryRefillSec: { type: "number", description: "Capillary refill time in seconds" },
    },
    required: ["patientId", "dictationText"],
  },
  zod: z.object({
    patientId: z.string().uuid(),
    dictationText: z.string().min(1).max(2000),
    temperatureC: z.number().finite().min(30).max(45).optional(),
    heartRateBpm: z.number().int().min(0).max(400).optional(),
    respiratoryRateBpm: z.number().int().min(0).max(300).optional(),
    weightKg: z.number().finite().positive().max(2000).optional(),
    bodyConditionScore: z.number().int().min(1).max(9).optional(),
    painScore: z.number().int().min(0).max(10).optional(),
    capillaryRefillSec: z.number().finite().min(0).max(10).optional(),
  }),
  readOnly: false,
  requiredApiScopes: ["records:write"],
  async execute(args, ctx) {
    assertAgentRole(
      ctx,
      ["admin", "veterinarian", "technician"],
      "Zaznamenávanie vitálnych funkcií z hlasu je vyhradené pre klinický personál. / Recording vitals from speech is restricted to clinical staff.",
    );
    const input = this.zod.parse(args) as {
      patientId: string;
      dictationText: string;
      temperatureC?: number;
      heartRateBpm?: number;
      respiratoryRateBpm?: number;
      weightKg?: number;
      bodyConditionScore?: number;
      painScore?: number;
      capillaryRefillSec?: number;
    };

    if (!(await activePatient(ctx, input.patientId))) {
      return { error: "Patient not found" };
    }

    // Require at least one vital value to avoid empty inserts
    const hasAnyVital =
      input.temperatureC !== undefined ||
      input.heartRateBpm !== undefined ||
      input.respiratoryRateBpm !== undefined ||
      input.weightKg !== undefined ||
      input.bodyConditionScore !== undefined ||
      input.painScore !== undefined ||
      input.capillaryRefillSec !== undefined;

    if (!hasAnyVital) {
      return {
        error: "No vital signs could be extracted from the dictation. Please provide at least one measurement.",
        dictationText: input.dictationText,
      };
    }

    const [row] = await ctx.db
      .insert(vitalSigns)
      .values({
        practiceId: ctx.practiceId,
        patientId: input.patientId,
        recordedBy: null, // AI agent — no user row
        temperatureC: input.temperatureC?.toString(),
        heartRateBpm: input.heartRateBpm,
        respiratoryRateBpm: input.respiratoryRateBpm,
        weightKg: input.weightKg?.toString(),
        bodyConditionScore: input.bodyConditionScore,
        painScore: input.painScore,
        capillaryRefillSec: input.capillaryRefillSec?.toString(),
        notes: `[Voice Scribe] ${input.dictationText.slice(0, 500)}`,
      })
      .returning({ id: vitalSigns.id, recordedAt: vitalSigns.recordedAt });

    return {
      id: row!.id,
      recordedAt: row!.recordedAt,
      extractedVitals: {
        temperatureC: input.temperatureC,
        heartRateBpm: input.heartRateBpm,
        respiratoryRateBpm: input.respiratoryRateBpm,
        weightKg: input.weightKg,
        bodyConditionScore: input.bodyConditionScore,
        painScore: input.painScore,
        capillaryRefillSec: input.capillaryRefillSec,
      },
    };
  },
};

// ---------------------------------------------------------------------------
// Clinical Workflow & Practice Management Tools
// ---------------------------------------------------------------------------

const getInvoiceSummaryTool: AgentTool = {
  name: "get_invoice_summary",
  description:
    "Get invoice and billing summary for a client or patient: total billed, paid amounts, outstanding balance, and list of recent invoices.",
  inputSchema: {
    type: "object",
    properties: {
      patientId: { type: "string", description: "Optional Patient UUID" },
      clientId: { type: "string", description: "Optional Client UUID" },
    },
  },
  zod: z.object({
    patientId: z.string().uuid().optional(),
    clientId: z.string().uuid().optional(),
  }),
  readOnly: true,
  async execute(args, ctx) {
    assertAgentRole(
      ctx,
      ["admin", "veterinarian", "front_desk"],
      "Prehľad fakturácie je prístupný pre recepciu, administrátorov a veterinárov. / Invoice summary is restricted to front desk, admins, and veterinarians.",
    );
    const input = this.zod.parse(args) as {
      patientId?: string;
      clientId?: string;
    };
    const conditions = [
      eq(invoices.practiceId, ctx.practiceId),
      isNull(invoices.deletedAt),
    ];
    if (input.patientId) conditions.push(eq(invoices.patientId, input.patientId));
    if (input.clientId) conditions.push(eq(invoices.clientId, input.clientId));

    const rows = await ctx.db
      .select({
        id: invoices.id,
        patientId: invoices.patientId,
        clientId: invoices.clientId,
        status: invoices.status,
        total: invoices.total,
        paidAmount: invoices.paidAmount,
        createdAt: invoices.createdAt,
      })
      .from(invoices)
      .where(and(...conditions))
      .orderBy(desc(invoices.createdAt))
      .limit(10);

    let totalBilled = 0;
    let totalPaid = 0;
    let unpaidCount = 0;

    for (const inv of rows) {
      const tot = parseFloat(inv.total || "0");
      const paid = parseFloat(inv.paidAmount || "0");
      totalBilled += tot;
      totalPaid += paid;
      if (inv.status !== "paid" && inv.status !== "void") {
        unpaidCount++;
      }
    }

    return {
      totalInvoicesCount: rows.length,
      unpaidInvoicesCount: unpaidCount,
      totalBilledEur: Math.round(totalBilled * 100) / 100,
      totalPaidEur: Math.round(totalPaid * 100) / 100,
      outstandingBalanceEur: Math.round((totalBilled - totalPaid) * 100) / 100,
      invoices: rows,
    };
  },
};

const listOpenRemindersTool: AgentTool = {
  name: "list_open_reminders",
  description:
    "List open clinical care reminders and follow-up tasks for a patient or practice.",
  inputSchema: {
    type: "object",
    properties: {
      patientId: { type: "string", description: "Optional Patient UUID" },
    },
  },
  zod: z.object({
    patientId: z.string().uuid().optional(),
  }),
  readOnly: true,
  async execute(args, ctx) {
    assertAgentRole(
      ctx,
      ["admin", "veterinarian", "front_desk", "technician"],
      "Zoznam pripomienok je prístupný personálu kliniky. / Reminders list is restricted to clinic staff.",
    );
    const input = this.zod.parse(args) as { patientId?: string };
    const conditions = [
      eq(careReminders.practiceId, ctx.practiceId),
      eq(careReminders.status, "open"),
      isNull(careReminders.deletedAt),
    ];
    if (input.patientId) conditions.push(eq(careReminders.patientId, input.patientId));

    const rows = await ctx.db
      .select({
        id: careReminders.id,
        patientId: careReminders.patientId,
        patientName: patients.name,
        title: careReminders.title,
        dueDate: careReminders.dueDate,
        notes: careReminders.notes,
      })
      .from(careReminders)
      .innerJoin(patients, eq(careReminders.patientId, patients.id))
      .where(and(...conditions))
      .orderBy(asc(careReminders.dueDate))
      .limit(20);

    return rows;
  },
};

const getLabResultsTool: AgentTool = {
  name: "get_lab_results",
  description:
    "Get comprehensive laboratory analyzer reports and parsed analyte results for a patient.",
  inputSchema: {
    type: "object",
    properties: {
      patientId: { type: "string", description: "Patient UUID" },
      limit: { type: "number", description: "Max reports to inspect (default 5)" },
    },
    required: ["patientId"],
  },
  zod: z.object({
    patientId: z.string().uuid(),
    limit: z.number().int().min(1).max(20).default(5),
  }),
  readOnly: true,
  async execute(args, ctx) {
    assertAgentRole(
      ctx,
      ["admin", "veterinarian", "technician"],
      "Výsledky laboratórnych vyšetrení sú prístupné len klinickému personálu. / Lab results are restricted to clinical staff.",
    );
    const input = this.zod.parse(args) as {
      patientId: string;
      limit: number;
    };
    const rows = await ctx.db
      .select({
        id: labAnalyzerReports.id,
        sampleDate: labAnalyzerReports.sampleDate,
        deviceModel: labAnalyzerReports.deviceModel,
        parsedResults: labAnalyzerReports.parsedResults,
      })
      .from(labAnalyzerReports)
      .where(
        and(
          eq(labAnalyzerReports.practiceId, ctx.practiceId),
          eq(labAnalyzerReports.patientId, input.patientId),
          isNull(labAnalyzerReports.deletedAt),
        ),
      )
      .orderBy(desc(labAnalyzerReports.sampleDate))
      .limit(input.limit);

    return rows.map((r) => ({
      reportId: r.id,
      sampleDate: r.sampleDate,
      device: r.deviceModel,
      results: r.parsedResults,
    }));
  },
};

/**
 * prescriptions.prescribed_by is a NOT NULL UUID foreign key to users.id.
 * A non-UUID actor id (e.g. the REST API's "apikey:<id>" placeholder) would
 * crash the insert with PostgreSQL 22P02 ("invalid input syntax for type
 * uuid") / foreign-key failure. Validate up front so API callers get an
 * actionable error; the REST route resolves a real signing veterinarian via
 * `veterinarian_user_id`.
 */
const USER_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const createPrescriptionTool: AgentTool = {
  name: "create_prescription",
  description:
    "Create a medical prescription for a patient. Requires write mode. Drug name, dosage, and frequency are mandatory.",
  inputSchema: {
    type: "object",
    properties: {
      patientId: { type: "string", description: "Patient UUID" },
      medicationName: { type: "string", description: "Name of the prescribed medication" },
      dosage: { type: "string", description: "Dosage (e.g. 50mg, 1 tablet)" },
      frequency: { type: "string", description: "Frequency (e.g. 2x daily, q12h)" },
      instructions: { type: "string", description: "Optional administration instructions" },
      startDate: { type: "string", description: "YYYY-MM-DD start date (default today)" },
    },
    required: ["patientId", "medicationName", "dosage", "frequency"],
  },
  zod: z.object({
    patientId: z.string().uuid(),
    medicationName: z.string().min(1).max(255),
    dosage: z.string().min(1).max(128),
    frequency: z.string().min(1).max(128),
    instructions: z.string().max(2000).optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }),
  readOnly: false,
  requiredApiScopes: ["records:write"],
  async execute(args, ctx) {
    // Prescriptions (Zákon č. 362/2011 Z. z.) — restricted to veterinarians and admins only.
    // Front desk staff and technicians cannot create active prescriptions.
    // SECURITY: uses fail-closed assertAgentRole — absent/unknown/disallowed roles all deny.
    assertAgentRole(
      ctx,
      ["veterinarian", "admin"],
      "Recepty môže vystavovať výhradne veterinárny lekár alebo administrátor. / Prescriptions may only be created by veterinarians and admins.",
    );

    // Defense-in-depth: prescribed_by is a UUID FK to users.id. A role is
    // present but the actor is not a real user (e.g. an API-key run without
    // veterinarian_user_id resolved) — fail with guidance instead of the
    // database 22P02 UUID syntax error.
    if (!ctx.userId || !USER_UUID_RE.test(ctx.userId)) {
      throw Object.assign(
        new Error(
          "Prescriptions require an identified veterinarian user. API callers must supply veterinarian_user_id referencing an active veterinarian or administrator in the practice. / Predpis vyžaduje identifikovaného veterinára – API volanie musí uviesť veterinarian_user_id.",
        ),
        { code: "FORBIDDEN" as const },
      );
    }

    const input = this.zod.parse(args) as {
      patientId: string;
      medicationName: string;
      dosage: string;
      frequency: string;
      instructions?: string;
      startDate?: string;
    };

    if (!(await activePatient(ctx, input.patientId))) {
      return { error: "Patient not found" };
    }

    const startDate = input.startDate || (await practiceDateInput(ctx));

    const [created] = await ctx.db
      .insert(prescriptions)
      .values({
        practiceId: ctx.practiceId,
        patientId: input.patientId,
        prescribedBy: ctx.userId,
        medicationName: input.medicationName,
        dosage: input.dosage,
        frequency: input.frequency,
        instructions: input.instructions ?? null,
        startDate,
        status: "active",
      })
      .returning();

    return {
      id: created!.id,
      patientId: created!.patientId,
      medicationName: created!.medicationName,
      dosage: created!.dosage,
      frequency: created!.frequency,
      status: created!.status,
    };
  },
};

const getControlledSubstancesLogTool: AgentTool = {
  name: "get_controlled_substances_log",
  description:
    "Query the statutory Controlled Substances Register (Kniha omamných a psychotropných látok — Zákon č. 362/2011 Z. z. / DEA Schedule) for the practice.",
  inputSchema: {
    type: "object",
    properties: {
      drugName: { type: "string", description: "Optional medication name filter" },
      limit: { type: "number", description: "Max log entries (default 25)" },
    },
  },
  zod: z.object({
    drugName: z.string().optional(),
    limit: z.number().int().min(1).max(100).default(25),
  }),
  readOnly: true,
  async execute(args, ctx) {
    // OPL register (Zákon č. 362/2011 Z. z.) — restricted to veterinarians and admins only.
    // front_desk staff must not have access to the controlled substances ledger.
    // SECURITY: uses fail-closed assertAgentRole — absent/unknown/disallowed roles all deny.
    assertAgentRole(
      ctx,
      ["veterinarian", "admin"],
      "Kniha omamných a psychotropných látok je prístupná len veterinárnym lekárom a administrátorom. / Controlled substances log is restricted to veterinarians and admins.",
    );

    const input = this.zod.parse(args) as {
      drugName?: string;
      limit: number;
    };
    const conditions = [
      eq(controlledSubstanceLog.practiceId, ctx.practiceId),
      isNull(controlledSubstanceLog.deletedAt),
    ];
    if (input.drugName) {
      conditions.push(ilike(controlledSubstanceLog.drugName, `%${input.drugName}%`));
    }

    const rows = await ctx.db
      .select({
        id: controlledSubstanceLog.id,
        drugName: controlledSubstanceLog.drugName,
        deaSchedule: controlledSubstanceLog.deaSchedule,
        action: controlledSubstanceLog.action,
        quantity: controlledSubstanceLog.quantity,
        unit: controlledSubstanceLog.unit,
        patientName: patients.name,
        performedAt: controlledSubstanceLog.performedAt,
        notes: controlledSubstanceLog.notes,
      })
      .from(controlledSubstanceLog)
      .leftJoin(patients, eq(controlledSubstanceLog.patientId, patients.id))
      .where(and(...conditions))
      .orderBy(desc(controlledSubstanceLog.performedAt))
      .limit(input.limit);

    return rows;
  },
};

const listDischargeReportsTool: AgentTool = {
  name: "list_discharge_reports",
  description:
    "List previous patient discharge reports and home-care instructions.",
  inputSchema: {
    type: "object",
    properties: {
      patientId: { type: "string", description: "Optional Patient UUID" },
    },
  },
  zod: z.object({
    patientId: z.string().uuid().optional(),
  }),
  readOnly: true,
  async execute(args, ctx) {
    assertAgentRole(
      ctx,
      ["admin", "veterinarian", "technician"],
      "Zoznam prepúšťacích správ je prístupný len klinickému personálu. / Discharge reports list is restricted to clinical staff.",
    );
    const input = this.zod.parse(args) as { patientId?: string };
    const conditions = [
      eq(dischargeReports.practiceId, ctx.practiceId),
      isNull(dischargeReports.deletedAt),
    ];
    if (input.patientId) {
      conditions.push(eq(dischargeReports.patientId, input.patientId));
    }

    const rows = await ctx.db
      .select({
        id: dischargeReports.id,
        patientId: dischargeReports.patientId,
        petName: dischargeReports.petName,
        diagnosis: dischargeReports.diagnosis,
        treatment: dischargeReports.treatment,
        followUp: dischargeReports.followUp,
        status: dischargeReports.status,
        createdAt: dischargeReports.createdAt,
      })
      .from(dischargeReports)
      .where(and(...conditions))
      .orderBy(desc(dischargeReports.createdAt))
      .limit(10);

    return rows;
  },
};

export const AGENT_TOOLS: AgentTool[] = [
  findClient, // readOnly: true [VERIFIED: apps/web/lib/agent/tools.ts:L330-401]
  findPatient, // readOnly: true [VERIFIED: apps/web/lib/agent/tools.ts:L403-464]
  getPatientSummary, // readOnly: true [VERIFIED: apps/web/lib/agent/tools.ts:L466-559]
  listLocations, // readOnly: true [VERIFIED: apps/web/lib/agent/tools.ts:L562-577]
  listAppointments, // readOnly: true [VERIFIED: apps/web/lib/agent/tools.ts:L579-662]
  findOpenSlotsTool, // readOnly: true [VERIFIED: apps/web/lib/agent/tools.ts:L1039-1146]
  bookAppointment, // readOnly: false [VERIFIED: apps/web/lib/agent/tools.ts:L664-768] - INSERTS into appointments table
  listOverdueVaccinations, // readOnly: true [VERIFIED: apps/web/lib/agent/tools.ts:L770-858]
  calculateDrugDose, // readOnly: true [VERIFIED: apps/web/lib/agent/tools.ts:L861-906]
  listTreatmentPlans, // readOnly: true [VERIFIED: apps/web/lib/agent/tools.ts:L908-963]
  recordVitalSigns, // readOnly: false [VERIFIED: apps/web/lib/agent/tools.ts:L965-1037] - INSERTS into vitalSigns table
  queryLabTrendsTool, // readOnly: true [VERIFIED: apps/web/lib/agent/tools.ts:L1148-1258]
  checkDrugSafetyTool, // readOnly: true [VERIFIED: apps/web/lib/agent/tools.ts:L1260-1442]
  auditMissedChargesTool, // readOnly: true [VERIFIED: apps/web/lib/agent/tools.ts:L1444-1582]
  createDischargeSummaryTool, // readOnly: true [VERIFIED: apps/web/lib/agent/tools.ts:L1584-1712] - only generates markdown, does not store to DB
  generateRvpsReportTool, // readOnly: true [VERIFIED: apps/web/lib/agent/tools.ts:L1714-1807]
  checkWithdrawalPeriodsTool, // readOnly: true [VERIFIED: apps/web/lib/agent/tools.ts:L1818-1898]
  checkRabiesObservationsTool, // readOnly: true [VERIFIED: apps/web/lib/agent/tools.ts:L1900-2002]
  verifyMicrochipCrszTool, // readOnly: true [VERIFIED: apps/web/lib/agent/tools.ts:L2009-2153]
  recordVitalsFromSpeechTool, // readOnly: false [VERIFIED: apps/web/lib/agent/tools.ts:L2169-2277] - INSERTS into vitalSigns table
  getInvoiceSummaryTool, // readOnly: true [VERIFIED: apps/web/lib/agent/tools.ts:L2283-2354]
  listOpenRemindersTool, // readOnly: true [VERIFIED: apps/web/lib/agent/tools.ts:L2356-2401]
  getLabResultsTool, // readOnly: true [VERIFIED: apps/web/lib/agent/tools.ts:L2403-2455]
  createPrescriptionTool, // readOnly: false [VERIFIED: apps/web/lib/agent/tools.ts:L2457-2532] - INSERTS into prescriptions table
  getControlledSubstancesLogTool, // readOnly: true [VERIFIED: apps/web/lib/agent/tools.ts:L2534-2592]
  listDischargeReportsTool, // readOnly: true [VERIFIED: apps/web/lib/agent/tools.ts:L2594-2641]
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
