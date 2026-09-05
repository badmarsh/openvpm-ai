import { afterEach, describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";

const webhookMocks = vi.hoisted(() => ({
  dispatchWebhookEvent: vi.fn(async () => undefined),
  recordActivationAfterAppointmentCreated: vi.fn(async () => true),
}));

vi.mock("@/lib/webhook-dispatcher", () => ({
  dispatchWebhookEvent: webhookMocks.dispatchWebhookEvent,
}));

vi.mock("@/lib/funnel-events-server", () => ({
  recordActivationAfterAppointmentCreated:
    webhookMocks.recordActivationAfterAppointmentCreated,
}));

import {
  AGENT_TOOLS,
  anthropicToolDefs,
  getTool,
  AGENT_NOTES_MAX_LENGTH,
  AGENT_SEARCH_QUERY_MAX_LENGTH,
} from "../tools";
import type { AgentToolContext } from "../tools";
import {
  DOSING_WEIGHT_MAX_KG,
  FORMULARY_DRUG_ID_MAX_LENGTH,
} from "@/lib/dosing";

// The DB is never touched by these tests — only pure tools (calculate_drug_dose)
// are executed; DB-backed tools are exercised at the validation layer.
const fakeCtx = { practiceId: "p", userId: "u" } as unknown as AgentToolContext;
const PRACTICE_ID = "00000000-0000-0000-0000-000000000001";
const CLIENT_ID = "00000000-0000-0000-0000-000000000002";
const PATIENT_ID = "00000000-0000-0000-0000-000000000003";
const DOCTOR_ID = "00000000-0000-0000-0000-000000000004";
const ROOM_ID = "00000000-0000-0000-0000-000000000006";
const LOCATION_ID = "00000000-0000-0000-0000-000000000007";
const OTHER_CLIENT_ID = "00000000-0000-0000-0000-000000000099";

function toolDb(selectResults: unknown[][], insertRow: Record<string, unknown>) {
  const results = [...selectResults];
  const select = vi.fn((fields?: Record<string, unknown>) => {
    const fieldNames = Object.keys(fields ?? {})
      .sort()
      .join(",");
    const result =
      fieldNames === "address,id,isPrimary,name,phone"
        ? [
            {
              id: LOCATION_ID,
              name: "Main Clinic",
              address: "1 Main St",
              phone: null,
              isPrimary: true,
            },
          ]
        : fieldNames === "id,locationId"
          ? [{ id: ROOM_ID, locationId: LOCATION_ID }]
          : fieldNames === "locationId"
            ? [{ locationId: LOCATION_ID }]
            : (results.shift() ?? []);
    const builder = {
      from: vi.fn(() => builder),
      innerJoin: vi.fn(() => builder),
      leftJoin: vi.fn(() => builder),
      where: vi.fn(() => builder),
      orderBy: vi.fn(() => builder),
      limit: vi.fn(async () => result),
      then: (
        resolve: (value: unknown[]) => unknown,
        reject?: (error: unknown) => unknown
      ) => Promise.resolve(result).then(resolve, reject),
    };
    return builder;
  });
  const insertReturning = vi.fn(async () => [insertRow]);
  const insertValues = vi.fn(() => ({ returning: insertReturning }));
  const insert = vi.fn(() => ({ values: insertValues }));
  const ctx = {
    practiceId: PRACTICE_ID,
    userId: "agent-user",
    db: { select, insert, execute: vi.fn(async () => undefined) },
  } as unknown as AgentToolContext;

  return { ctx, insert, insertValues, select };
}

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("agent tool registry", () => {
  it("has unique tool names", () => {
    const names = AGENT_TOOLS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("flags exactly the write tools as not read-only", () => {
    const writeTools = AGENT_TOOLS.filter((t) => !t.readOnly).map((t) => t.name).sort();
    expect(writeTools).toEqual([
      "book_appointment",
      "record_vital_signs",
    ]);
  });

  it("maps every write tool to the public API resource scopes it can mutate", () => {
    const writeToolScopes = Object.fromEntries(
      AGENT_TOOLS.filter((t) => !t.readOnly).map((t) => [
        t.name,
        t.requiredApiScopes,
      ])
    );

    expect(writeToolScopes).toEqual({
      book_appointment: ["appointments:write"],
      record_vital_signs: ["records:write"],
    });
  });

  it("exposes Anthropic-format defs with required fields", () => {
    for (const def of anthropicToolDefs()) {
      expect(typeof def.name).toBe("string");
      expect(typeof def.description).toBe("string");
      expect(def.input_schema).toMatchObject({ type: "object" });
    }
  });

  it("getTool resolves by name and returns undefined otherwise", () => {
    expect(getTool("find_client")?.name).toBe("find_client");
    expect(getTool("find_patient")?.name).toBe("find_patient");
    expect(getTool("record_soap_note")).toBeUndefined();
    expect(getTool("nope")).toBeUndefined();
  });
});

describe("calculate_drug_dose tool (pure)", () => {
  const tool = getTool("calculate_drug_dose")!;

  it("returns a dose range for valid input", async () => {
    const result = (await tool.execute(
      { drugId: "carprofen", species: "canine", weightKg: 10 },
      fakeCtx
    )) as { doseLowMg: number; doseHighMg: number };
    expect(result.doseLowMg).toBe(22);
    expect(result.doseHighMg).toBe(44);
  });

  it("rejects invalid args via its zod schema", () => {
    const parsed = tool.zod.safeParse({ drugId: "carprofen", species: "canine", weightKg: -1 });
    expect(parsed.success).toBe(false);
  });

  it("rejects unknown and oversized formulary IDs via its zod schema", () => {
    expect(tool.inputSchema).toMatchObject({
      properties: {
        drugId: {
          enum: expect.arrayContaining(["carprofen"]),
          maxLength: FORMULARY_DRUG_ID_MAX_LENGTH,
        },
        weightKg: {
          exclusiveMinimum: 0,
          maximum: DOSING_WEIGHT_MAX_KG,
        },
        concentrationMgPerMl: {
          exclusiveMinimum: 0,
        },
      },
    });

    expect(
      tool.zod.safeParse({
        drugId: "not-in-formulary",
        species: "canine",
        weightKg: 10,
      }).success
    ).toBe(false);

    expect(
      tool.zod.safeParse({
        drugId: "A".repeat(FORMULARY_DRUG_ID_MAX_LENGTH + 1),
        species: "canine",
        weightKg: 10,
      }).success
    ).toBe(false);
  });

  it("rejects implausible weights and non-finite concentrations via its zod schema", () => {
    expect(
      tool.zod.safeParse({
        drugId: "carprofen",
        species: "canine",
        weightKg: DOSING_WEIGHT_MAX_KG + 1,
      }).success
    ).toBe(false);

    expect(
      tool.zod.safeParse({
        drugId: "maropitant",
        species: "canine",
        weightKg: 10,
        concentrationMgPerMl: Number.POSITIVE_INFINITY,
      }).success
    ).toBe(false);
  });
});

describe("agent tool input bounds", () => {
  it("bounds and trims free-form tool strings", () => {
    const findClient = getTool("find_client")!;
    const bookAppointment = getTool("book_appointment")!;
    const recordVitals = getTool("record_vital_signs")!;

    const query = findClient.zod.safeParse({ query: "  Ada  " });
    expect(query.success).toBe(true);
    if (!query.success) throw new Error("expected query parse to succeed");
    expect(query.data.query).toBe("Ada");

    const findPatient = getTool("find_patient")!;
    const patientQuery = findPatient.zod.safeParse({ query: "  Pupinka  " });
    expect(patientQuery.success).toBe(true);
    if (!patientQuery.success) throw new Error("expected patient query parse to succeed");
    expect(patientQuery.data.query).toBe("Pupinka");

    expect(
      findClient.zod.safeParse({
        query: "A".repeat(AGENT_SEARCH_QUERY_MAX_LENGTH + 1),
      }).success
    ).toBe(false);

    expect(
      bookAppointment.zod.safeParse({
        startTime: "2026-03-01T09:00:00.000Z",
        endTime: "2026-03-01T09:30:00.000Z",
        notes: "A".repeat(AGENT_NOTES_MAX_LENGTH + 1),
      }).success
    ).toBe(false);

    expect(
      recordVitals.zod.safeParse({
        patientId: PATIENT_ID,
        notes: "A".repeat(AGENT_NOTES_MAX_LENGTH + 1),
      }).success
    ).toBe(false);

  });
});

describe("book_appointment validation", () => {
  const tool = getTool("book_appointment")!;

  it("rejects end before start", () => {
    const parsed = tool.zod.safeParse({
      startTime: "2026-03-01T10:00:00.000Z",
      endTime: "2026-03-01T09:00:00.000Z",
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts a valid window", () => {
    const parsed = tool.zod.safeParse({
      startTime: "2026-03-01T09:00:00.000Z",
      endTime: "2026-03-01T09:30:00.000Z",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects patient/client mismatches before inserting", async () => {
    const { ctx, insert } = toolDb(
      [[{ id: PATIENT_ID, clientId: OTHER_CLIENT_ID }]],
      {}
    );

    const result = await tool.execute(
      {
        startTime: "2026-03-01T09:00:00.000Z",
        endTime: "2026-03-01T09:30:00.000Z",
        patientId: PATIENT_ID,
        clientId: CLIENT_ID,
      },
      ctx
    );

    expect(result).toEqual({ error: "Patient not found" });
    expect(insert).not.toHaveBeenCalled();
    expect(webhookMocks.dispatchWebhookEvent).not.toHaveBeenCalled();
  });

  it("rejects inactive or non-tenant doctors before inserting", async () => {
    const { ctx, insert } = toolDb(
      [
        [{ id: PATIENT_ID, clientId: CLIENT_ID }],
        [{ id: CLIENT_ID }],
        [],
      ],
      {}
    );

    const result = await tool.execute(
      {
        startTime: "2026-03-01T09:00:00.000Z",
        endTime: "2026-03-01T09:30:00.000Z",
        patientId: PATIENT_ID,
        doctorId: DOCTOR_ID,
      },
      ctx
    );

    expect(result).toEqual({ error: "Doctor not found" });
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects overlapping doctor bookings before inserting", async () => {
    const { ctx, insert } = toolDb(
      [
        [{ id: PATIENT_ID, clientId: CLIENT_ID }],
        [{ id: CLIENT_ID }],
        [{ id: DOCTOR_ID }],
        [
          {
            id: "00000000-0000-0000-0000-0000000000b1",
            startTime: new Date("2026-03-01T09:15:00.000Z"),
            endTime: new Date("2026-03-01T09:45:00.000Z"),
            doctorId: DOCTOR_ID,
            roomId: null,
            status: "scheduled",
          },
        ],
      ],
      {}
    );

    const result = await tool.execute(
      {
        startTime: "2026-03-01T09:00:00.000Z",
        endTime: "2026-03-01T09:30:00.000Z",
        patientId: PATIENT_ID,
        doctorId: DOCTOR_ID,
      },
      ctx
    );

    expect(result).toEqual({
      error: "This time conflicts with another appointment for this doctor.",
    });
    expect(insert).not.toHaveBeenCalled();
  });

  it("infers the client from a validated patient before creating", async () => {
    const { ctx, insertValues } = toolDb(
      [[{ id: PATIENT_ID, clientId: CLIENT_ID }], [{ id: CLIENT_ID }]],
      {
        id: "00000000-0000-0000-0000-0000000000a1",
        status: "scheduled",
        startTime: new Date("2026-03-01T09:00:00.000Z"),
        endTime: new Date("2026-03-01T09:30:00.000Z"),
      }
    );

    const result = await tool.execute(
      {
        startTime: "2026-03-01T09:00:00.000Z",
        endTime: "2026-03-01T09:30:00.000Z",
        patientId: PATIENT_ID,
        notes: " Follow-up call ",
      },
      ctx
    );

    expect(result).toEqual({
      id: "00000000-0000-0000-0000-0000000000a1",
      status: "scheduled",
    });
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        practiceId: PRACTICE_ID,
        clientId: CLIENT_ID,
        patientId: PATIENT_ID,
        locationId: LOCATION_ID,
        notes: "Follow-up call",
      })
    );
    expect(webhookMocks.dispatchWebhookEvent).toHaveBeenCalledWith(
      PRACTICE_ID,
      "appointment.created",
      expect.objectContaining({ source: "agent" })
    );
    expect(
      webhookMocks.recordActivationAfterAppointmentCreated
    ).toHaveBeenCalledWith(ctx.db, PRACTICE_ID, "agent.book_appointment");
  });
});

describe("record_vital_signs validation", () => {
  const tool = getTool("record_vital_signs")!;

  it("rejects values that do not fit vital-sign numeric columns", () => {
    expect(
      tool.zod.safeParse({
        patientId: "00000000-0000-0000-0000-000000000001",
        temperatureC: 38.66,
      }).success
    ).toBe(false);
    expect(
      tool.zod.safeParse({
        patientId: "00000000-0000-0000-0000-000000000001",
        weightKg: 12.3456,
      }).success
    ).toBe(false);
    expect(
      tool.zod.safeParse({
        patientId: "00000000-0000-0000-0000-000000000001",
        capillaryRefillSec: 1.55,
      }).success
    ).toBe(false);
  });

  it("accepts values that fit vital-sign numeric columns", () => {
    const parsed = tool.zod.safeParse({
      patientId: "00000000-0000-0000-0000-000000000001",
      temperatureC: 38.6,
      weightKg: 12.345,
      capillaryRefillSec: 1.5,
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects missing or inactive patients before inserting vitals", async () => {
    const { ctx, insert } = toolDb([[]], {});

    const result = await tool.execute(
      { patientId: PATIENT_ID, weightKg: 12.3 },
      ctx
    );

    expect(result).toEqual({ error: "Patient not found" });
    expect(insert).not.toHaveBeenCalled();
  });

  it("records vitals only after validating the patient belongs to the practice", async () => {
    const { ctx, insertValues } = toolDb(
      [[{ id: PATIENT_ID, clientId: CLIENT_ID }]],
      {
        id: "00000000-0000-0000-0000-0000000000c1",
        recordedAt: new Date("2026-03-01T09:10:00.000Z"),
      }
    );

    const result = await tool.execute(
      { patientId: PATIENT_ID, weightKg: 12.3, notes: " Bright and alert " },
      ctx
    );

    expect(result).toEqual({
      id: "00000000-0000-0000-0000-0000000000c1",
      recordedAt: new Date("2026-03-01T09:10:00.000Z"),
    });
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        practiceId: PRACTICE_ID,
        patientId: PATIENT_ID,
        weightKg: "12.3",
        notes: "Bright and alert",
      })
    );
  });
});

describe("list_overdue_vaccinations tool", () => {
  const tool = getTool("list_overdue_vaccinations")!;

  it("uses the practice timezone for overdue vaccination cutoffs", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-15T02:30:00.000Z"));
    const { ctx } = toolDb(
      [
        [{ timezone: "America/Los_Angeles" }],
        [
          {
            patientId: PATIENT_ID,
            patientName: "Miso",
            clientFirst: "Ada",
            clientLast: "Lovelace",
            vaccineName: "Rabies",
            nextDueDate: "2026-07-13",
          },
        ],
      ],
      {}
    );

    await expect(tool.execute({}, ctx)).resolves.toEqual([
      {
        patientId: PATIENT_ID,
        patient: "Miso",
        client: "Ada Lovelace",
        vaccine: "Rabies",
        dueDate: "2026-07-13",
      },
    ]);
  });
});

describe("find_open_slots validation", () => {
  const tool = getTool("find_open_slots")!;

  it("rejects inactive or non-tenant doctors before calculating slots", async () => {
    const { ctx, select } = toolDb([[]], {});

    const result = await tool.execute(
      { date: "2026-03-01", doctorId: DOCTOR_ID },
      ctx
    );

    expect(result).toEqual({ error: "Doctor not found" });
    expect(select).toHaveBeenCalledTimes(1);
  });

  it("rejects inactive or non-tenant rooms before calculating slots", async () => {
    const { ctx, select } = toolDb([[]], {});

    const result = await tool.execute(
      { date: "2026-03-01", roomId: ROOM_ID },
      ctx
    );

    expect(result).toEqual({ error: "Room not found" });
    expect(select).toHaveBeenCalledTimes(1);
  });

  it("uses the practice timezone when finding open slots", async () => {
    const { ctx } = toolDb([[{ timezone: "America/Los_Angeles" }], []], {});

    const result = await tool.execute(
      { date: "2026-07-01", durationMinutes: 60 },
      ctx
    );

    expect(result).toEqual([
      {
        start: "2026-07-01T15:00:00.000Z",
        end: "2026-07-01T16:00:00.000Z",
      },
      {
        start: "2026-07-01T16:00:00.000Z",
        end: "2026-07-01T17:00:00.000Z",
      },
      {
        start: "2026-07-01T17:00:00.000Z",
        end: "2026-07-01T18:00:00.000Z",
      },
      {
        start: "2026-07-01T18:00:00.000Z",
        end: "2026-07-01T19:00:00.000Z",
      },
      {
        start: "2026-07-01T19:00:00.000Z",
        end: "2026-07-01T20:00:00.000Z",
      },
      {
        start: "2026-07-01T20:00:00.000Z",
        end: "2026-07-01T21:00:00.000Z",
      },
      {
        start: "2026-07-01T21:00:00.000Z",
        end: "2026-07-01T22:00:00.000Z",
      },
      {
        start: "2026-07-01T22:00:00.000Z",
        end: "2026-07-01T23:00:00.000Z",
      },
      {
        start: "2026-07-01T23:00:00.000Z",
        end: "2026-07-02T00:00:00.000Z",
      },
      {
        start: "2026-07-02T00:00:00.000Z",
        end: "2026-07-02T01:00:00.000Z",
      },
    ]);
  });
});

describe("agent read tool query safety", () => {
  const source = readFileSync(new URL("../tools.ts", import.meta.url), "utf8");

  function scopedJoinPattern(
    joinMethod: "innerJoin" | "leftJoin",
    table: string,
    foreignKey: string
  ) {
    return new RegExp(
      `${joinMethod}\\(\\s*${table},\\s*and\\(\\s*eq\\(${foreignKey.replace(
        ".",
        "\\."
      )}, ${table}\\.id\\),\\s*eq\\(${table}\\.practiceId, ctx\\.practiceId\\),\\s*isNull\\(${table}\\.deletedAt\\)\\s*\\)\\s*\\)`,
      "gs"
    );
  }

  it("scopes appointment list display joins to active tenant rows", () => {
    expect(
      source.match(
        /leftJoin\(\s*patients,\s*and\(\s*eq\(appointments\.patientId, patients\.id\),\s*eq\(patients\.clientId, appointments\.clientId\),\s*eq\(patients\.practiceId, ctx\.practiceId\),\s*isNull\(patients\.deletedAt\)\s*\)\s*\)/gs
      )?.length
    ).toBeGreaterThanOrEqual(1);
    expect(
      source.match(
        scopedJoinPattern("leftJoin", "clients", "appointments.clientId")
      )?.length
    ).toBeGreaterThanOrEqual(1);
  });

  it("scopes overdue vaccination display joins to active tenant rows", () => {
    expect(
      source.match(
        scopedJoinPattern(
          "innerJoin",
          "patients",
          "vaccinationRecords.patientId"
        )
      )?.length
    ).toBeGreaterThanOrEqual(1);
    expect(
      source.match(scopedJoinPattern("leftJoin", "clients", "patients.clientId"))
        ?.length
    ).toBeGreaterThanOrEqual(1);
    expect(source).toContain("async function practiceDateInput");
    expect(source).toContain("async function practiceTimeZone");
    expect(source).toContain("AgentPracticeNotFoundError");
    expect(source).toContain("throw new AgentPracticeNotFoundError()");
    expect(source).toContain("return practice.timezone ?? null");
    expect(source).not.toContain("practice?.timezone");
    expect(source).toContain(
      "formatDateInputForTimeZone(new Date(), timezone)"
    );
    expect(source).toContain("const today = await practiceDateInput(ctx)");
    expect(source).not.toContain("new Date().toISOString().slice(0, 10)");
  });

  it("uses the practice timezone for open-slot searches", () => {
    expect(source).toContain("const timezone = await practiceTimeZone(ctx)");
    expect(source).toContain("dateInputTimeUtcInstant(");
    expect(source).not.toContain("new Date(`${input.date}T08:00:00`)");
  });
});

describe("find_client and find_patient execution", () => {
  it("find_client includes registered patients for each returned client", async () => {
    const tool = getTool("find_client")!;
    const { ctx } = toolDb(
      [
        [
          {
            id: CLIENT_ID,
            firstName: "Margaréta",
            lastName: "Keľová",
            email: "kelova@example.sk",
            phone: "+421900111222",
          },
        ],
        [
          {
            id: PATIENT_ID,
            clientId: CLIENT_ID,
            name: "Pupinka",
            species: "canine",
            breed: "Yorkshire Terrier",
            status: "active",
          },
        ],
      ],
      {}
    );

    const result = (await tool.execute({ query: "Keľová" }, ctx)) as Array<{
      id: string;
      firstName: string;
      lastName: string;
      patients: Array<{ id: string; name: string }>;
    }>;

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(CLIENT_ID);
    expect(result[0]?.patients).toHaveLength(1);
    expect(result[0]?.patients[0]?.id).toBe(PATIENT_ID);
    expect(result[0]?.patients[0]?.name).toBe("Pupinka");
  });

  it("find_patient returns matching patient signalment and owner info", async () => {
    const tool = getTool("find_patient")!;
    const { ctx } = toolDb(
      [
        [
          {
            patientId: PATIENT_ID,
            name: "Pupinka",
            species: "canine",
            breed: "Yorkshire Terrier",
            sex: "female",
            dob: "2021-06-15",
            status: "active",
            owner: {
              id: CLIENT_ID,
              firstName: "Margaréta",
              lastName: "Keľová",
              email: "kelova@example.sk",
              phone: "+421900111222",
            },
          },
        ],
      ],
      {}
    );

    const result = (await tool.execute({ query: "Pupinka" }, ctx)) as Array<{
      patientId: string;
      name: string;
      owner: { id: string; lastName: string };
    }>;

    expect(result).toHaveLength(1);
    expect(result[0]?.patientId).toBe(PATIENT_ID);
    expect(result[0]?.name).toBe("Pupinka");
    expect(result[0]?.owner?.lastName).toBe("Keľová");
  });
});

describe("new clinical agent tools", () => {
  it("registers all 5 new tools in AGENT_TOOLS", () => {
    expect(getTool("query_lab_trends")).toBeDefined();
    expect(getTool("check_drug_safety")).toBeDefined();
    expect(getTool("audit_missed_charges")).toBeDefined();
    expect(getTool("create_discharge_summary")).toBeDefined();
    expect(getTool("generate_rvps_report")).toBeDefined();
  });

  it("check_drug_safety rejects invalid input", () => {
    const tool = getTool("check_drug_safety")!;
    expect(() => tool.zod.parse({})).toThrow();
    expect(() => tool.zod.parse({ patientId: "not-a-uuid", candidateDrug: "Melox" })).toThrow();
  });

  it("check_drug_safety detects paracetamol toxicity in feline", async () => {
    const tool = getTool("check_drug_safety")!;
    const { ctx } = toolDb(
      [
        // patient query
        [{ id: PATIENT_ID, name: "Micka", species: "feline" }],
        // active prescriptions
        [],
        // allergies
        [],
      ],
      {}
    );

    const result = (await tool.execute(
      { patientId: PATIENT_ID, candidateDrug: "Paracetamol 500mg" },
      ctx
    )) as { safe: boolean; severity: string; contraindications: string[] };

    expect(result.safe).toBe(false);
    expect(result.severity).toBe("contraindicated");
    expect(result.contraindications.some((c) => c.includes("Acetaminophen"))).toBe(true);
  });

  it("check_drug_safety detects NSAID + Corticosteroid interaction", async () => {
    const tool = getTool("check_drug_safety")!;
    const { ctx } = toolDb(
      [
        // patient query
        [{ id: PATIENT_ID, name: "Rex", species: "canine" }],
        // active prescriptions
        [{ id: "rx-1", drugName: "Prednisolon 5mg", status: "active" }],
        // allergies
        [],
      ],
      {}
    );

    const result = (await tool.execute(
      { patientId: PATIENT_ID, candidateDrug: "Meloxidyl 1.5mg/ml" },
      ctx
    )) as { safe: boolean; severity: string; contraindications: string[] };

    expect(result.safe).toBe(false);
    expect(result.severity).toBe("contraindicated");
    expect(result.contraindications.some((c) => c.includes("Corticosteroid"))).toBe(true);
  });

  it("audit_missed_charges validates schema", () => {
    const tool = getTool("audit_missed_charges")!;
    expect(() => tool.zod.parse({})).toThrow();
    expect(tool.zod.parse({ appointmentId: PATIENT_ID })).toEqual({
      appointmentId: PATIENT_ID,
    });
  });

  it("generate_rvps_report validates reporting month and year", () => {
    const tool = getTool("generate_rvps_report")!;
    expect(() => tool.zod.parse({})).toThrow();
    expect(() => tool.zod.parse({ year: 2026, month: 13 })).toThrow();
    expect(tool.zod.parse({ year: 2026, month: 9 })).toEqual({
      year: 2026,
      month: 9,
    });
  });
});

