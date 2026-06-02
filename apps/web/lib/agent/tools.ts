import { z } from "zod";
import { eq, and, isNull, or, ilike, gte, lte, lt, desc, asc, inArray } from "drizzle-orm";
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
} from "@openpims/db";
import { dispatchWebhookEvent } from "@/lib/webhook-dispatcher";
import { calculateDose } from "@/lib/dosing";
import { summarizePlanProgress, type PlanItemStatus } from "@/lib/treatment-plans/progress";
import { findOpenSlots } from "@/lib/scheduling/availability";
import { not, gt } from "drizzle-orm";

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
}

export interface AgentTool {
  name: string;
  description: string;
  /** JSON Schema sent to the model as the tool's input_schema. */
  inputSchema: Record<string, unknown>;
  /** Runtime validation of the model-supplied args. */
  zod: z.ZodTypeAny;
  readOnly: boolean;
  execute(args: unknown, ctx: AgentToolContext): Promise<unknown>;
}

function clientName(first?: string | null, last?: string | null): string {
  return [first, last].filter(Boolean).join(" ");
}

const findClient: AgentTool = {
  name: "find_client",
  description:
    "Search clients (pet owners) by name, email, or phone. Returns up to 10 matches with their ids.",
  inputSchema: {
    type: "object",
    properties: { query: { type: "string", description: "Name, email, or phone fragment" } },
    required: ["query"],
  },
  zod: z.object({ query: z.string().min(1) }),
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
            ilike(clients.email, `%${query}%`),
            ilike(clients.phone, `%${query}%`)
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
            isNull(vitalSigns.deletedAt)
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
            isNull(vaccinationRecords.deletedAt)
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
        patientName: patients.name,
        clientFirst: clients.firstName,
        clientLast: clients.lastName,
      })
      .from(appointments)
      .leftJoin(patients, eq(appointments.patientId, patients.id))
      .leftJoin(clients, eq(appointments.clientId, clients.id))
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
      notes: z.string().optional(),
    })
    .refine((b) => new Date(b.endTime) > new Date(b.startTime), {
      message: "endTime must be after startTime",
    }),
  readOnly: false,
  async execute(args, ctx) {
    const input = this.zod.parse(args) as {
      startTime: string;
      endTime: string;
      clientId?: string;
      patientId?: string;
      doctorId?: string;
      notes?: string;
    };
    const [created] = await ctx.db
      .insert(appointments)
      .values({
        practiceId: ctx.practiceId,
        startTime: new Date(input.startTime),
        endTime: new Date(input.endTime),
        clientId: input.clientId ?? null,
        patientId: input.patientId ?? null,
        doctorId: input.doctorId ?? null,
        notes: input.notes ?? null,
      })
      .returning();
    await dispatchWebhookEvent(ctx.practiceId, "appointment.created", {
      id: created!.id,
      startTime: created!.startTime,
      endTime: created!.endTime,
      source: "agent",
    });
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
    const today = new Date().toISOString().slice(0, 10);
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
      .innerJoin(patients, eq(vaccinationRecords.patientId, patients.id))
      .leftJoin(clients, eq(patients.clientId, clients.id))
      .where(
        and(
          eq(vaccinationRecords.practiceId, ctx.practiceId),
          isNull(vaccinationRecords.deletedAt),
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
      drugId: { type: "string", description: "Formulary drug id, e.g. 'carprofen'" },
      species: { type: "string", enum: ["canine", "feline"] },
      weightKg: { type: "number" },
      concentrationMgPerMl: { type: "number" },
    },
    required: ["drugId", "species", "weightKg"],
  },
  zod: z.object({
    drugId: z.string().min(1),
    species: z.enum(["canine", "feline"]),
    weightKg: z.number().positive(),
    concentrationMgPerMl: z.number().positive().optional(),
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
      temperatureC: { type: "number" },
      heartRateBpm: { type: "number" },
      respiratoryRateBpm: { type: "number" },
      weightKg: { type: "number" },
      bodyConditionScore: { type: "number", description: "1-9" },
      painScore: { type: "number", description: "0-10" },
      notes: { type: "string" },
    },
    required: ["patientId"],
  },
  zod: z.object({
    patientId: z.string().uuid(),
    temperatureC: z.number().min(20).max(45).optional(),
    heartRateBpm: z.number().int().min(0).max(400).optional(),
    respiratoryRateBpm: z.number().int().min(0).max(300).optional(),
    weightKg: z.number().positive().max(200).optional(),
    bodyConditionScore: z.number().int().min(1).max(9).optional(),
    painScore: z.number().int().min(0).max(10).optional(),
    notes: z.string().optional(),
  }),
  readOnly: false,
  async execute(args, ctx) {
    const input = this.zod.parse(args) as {
      patientId: string;
      temperatureC?: number;
      heartRateBpm?: number;
      respiratoryRateBpm?: number;
      weightKg?: number;
      bodyConditionScore?: number;
      painScore?: number;
      notes?: string;
    };
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
    },
    required: ["date"],
  },
  zod: z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    durationMinutes: z.number().int().min(10).max(240).optional(),
    doctorId: z.string().uuid().optional(),
    roomId: z.string().uuid().optional(),
  }),
  readOnly: true,
  async execute(args, ctx) {
    const input = this.zod.parse(args) as {
      date: string;
      durationMinutes?: number;
      doctorId?: string;
      roomId?: string;
    };
    const dayStart = new Date(`${input.date}T08:00:00`);
    const dayEnd = new Date(`${input.date}T18:00:00`);

    const rows = await ctx.db
      .select({
        startTime: appointments.startTime,
        endTime: appointments.endTime,
        doctorId: appointments.doctorId,
        roomId: appointments.roomId,
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
      return !input.doctorId && !input.roomId;
    });

    return findOpenSlots({
      dayStart,
      dayEnd,
      slotMinutes: input.durationMinutes ?? 30,
      busy,
    }).map((s) => ({ start: s.start.toISOString(), end: s.end.toISOString() }));
  },
};

export const AGENT_TOOLS: AgentTool[] = [
  findClient,
  getPatientSummary,
  listAppointments,
  findOpenSlotsTool,
  bookAppointment,
  listOverdueVaccinations,
  calculateDrugDose,
  listTreatmentPlans,
  recordVitalSigns,
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
