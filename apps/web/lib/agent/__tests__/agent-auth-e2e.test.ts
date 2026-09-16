import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/webhook-dispatcher", () => ({
  dispatchWebhookEvent: vi.fn(async () => undefined),
}));
vi.mock("@/lib/funnel-events-server", () => ({
  recordActivationAfterAppointmentCreated: vi.fn(async () => true),
}));
vi.mock("@/lib/conversion-milestones", () => ({
  recordActivationAfterAppointmentCreated: vi.fn(async () => true),
}));

import { getTool } from "../tools";
import type { AgentToolContext } from "../tools";

const PRACTICE_ID = "00000000-0000-0000-0000-000000000001";
const CLIENT_ID = "00000000-0000-0000-0000-000000000002";
const PATIENT_ID = "00000000-0000-0000-0000-000000000003";
const DOCTOR_ID = "00000000-0000-0000-0000-000000000004";
const LOCATION_ID = "00000000-0000-0000-0000-000000000007";
const ROOM_ID = "00000000-0000-0000-0000-000000000008";

function createMockToolCtx(userRole?: string | null, userId: string = "agent-user-1"): AgentToolContext {
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
            : fieldNames === "clientId,id"
              ? [{ id: PATIENT_ID, clientId: CLIENT_ID }]
              : fieldNames === "id"
                ? [{ id: CLIENT_ID }]
                : fieldNames.includes("startTime") && fieldNames.includes("endTime")
                  ? []
                  : [
                      {
                        id: CLIENT_ID,
                        firstName: "Janko",
                        lastName: "Hrasko",
                        phone: "+421900123456",
                        email: "janko@example.sk",
                        status: "active",
                      },
                    ];

    const builder = {
      from: vi.fn(() => builder),
      innerJoin: vi.fn(() => builder),
      leftJoin: vi.fn(() => builder),
      where: vi.fn(() => builder),
      orderBy: vi.fn(() => builder),
      limit: vi.fn(async () => result),
      then: (
        resolve: (value: unknown[]) => unknown,
        reject?: (error: unknown) => unknown,
      ) => Promise.resolve(result).then(resolve, reject),
    };
    return builder;
  });

  const insertReturning = vi.fn(async () => [
    {
      id: "appt-new",
      practiceId: PRACTICE_ID,
      clientId: CLIENT_ID,
      patientId: PATIENT_ID,
      locationId: LOCATION_ID,
      startTime: new Date("2026-09-17T10:00:00Z"),
      endTime: new Date("2026-09-17T10:30:00Z"),
      status: "scheduled",
    },
  ]);
  const insertValues = vi.fn(() => ({ returning: insertReturning }));
  const insert = vi.fn(() => ({ values: insertValues }));

  return {
    practiceId: PRACTICE_ID,
    userId,
    userRole: userRole as any,
    db: { select, insert, execute: vi.fn(async () => undefined) },
  } as unknown as AgentToolContext;
}

describe("Service Agent Authorization Boundaries & Tool Access (F1 & F3)", () => {
  describe("Staff Read/Write Tools execution for service_agent", () => {
    it("allows 'service_agent' to execute find_client", async () => {
      const tool = getTool("find_client")!;
      const ctx = createMockToolCtx("service_agent");
      const result = await tool.execute({ query: "Janko" }, ctx);
      expect(result).toBeDefined();
    });

    it("allows 'service_agent' to execute find_patient", async () => {
      const tool = getTool("find_patient")!;
      const ctx = createMockToolCtx("service_agent");
      const result = await tool.execute({ query: "Dunco" }, ctx);
      expect(result).toBeDefined();
    });

    it("allows 'service_agent' to execute list_locations", async () => {
      const tool = getTool("list_locations")!;
      const ctx = createMockToolCtx("service_agent");
      const result = await tool.execute({}, ctx);
      expect(result).toBeDefined();
    });

    it("allows 'service_agent' to execute list_appointments", async () => {
      const tool = getTool("list_appointments")!;
      const ctx = createMockToolCtx("service_agent");
      const result = await tool.execute(
        {
          startDate: "2026-09-17T00:00:00.000Z",
          endDate: "2026-09-17T23:59:59.999Z",
        },
        ctx,
      );
      expect(result).toBeDefined();
    });

    it("allows 'service_agent' to execute find_open_slots", async () => {
      const tool = getTool("find_open_slots")!;
      const ctx = createMockToolCtx("service_agent");
      const result = await tool.execute({ date: "2026-09-17" }, ctx);
      expect(result).toBeDefined();
    });

    it("allows 'service_agent' to execute list_overdue_vaccinations", async () => {
      const tool = getTool("list_overdue_vaccinations")!;
      const ctx = createMockToolCtx("service_agent");
      const result = await tool.execute({}, ctx);
      expect(result).toBeDefined();
    });

    it("allows 'service_agent' to execute verify_microchip_crsz", async () => {
      const tool = getTool("verify_microchip_crsz")!;
      const ctx = createMockToolCtx("service_agent");
      const result = await tool.execute({ microchipNumber: "900182000012345" }, ctx);
      expect(result).toBeDefined();
    });

    it("allows 'service_agent' to execute get_invoice_summary", async () => {
      const tool = getTool("get_invoice_summary")!;
      const ctx = createMockToolCtx("service_agent");
      const result = await tool.execute({ clientId: CLIENT_ID }, ctx);
      expect(result).toBeDefined();
    });

    it("allows 'service_agent' to execute list_open_reminders", async () => {
      const tool = getTool("list_open_reminders")!;
      const ctx = createMockToolCtx("service_agent");
      const result = await tool.execute({}, ctx);
      expect(result).toBeDefined();
    });

    it("allows 'service_agent' to execute staff write tool book_appointment", async () => {
      const tool = getTool("book_appointment")!;
      const ctx = createMockToolCtx("service_agent");
      const result = (await tool.execute(
        {
          clientId: CLIENT_ID,
          patientId: PATIENT_ID,
          startTime: "2026-09-17T10:00:00.000Z",
          endTime: "2026-09-17T10:30:00.000Z",
        },
        ctx,
      )) as { id: string; status: string };

      expect(result).toBeDefined();
      expect(result.id).toBe("appt-new");
      expect(result.status).toBe("scheduled");
    });
  });

  describe("Clinical fail-closed boundaries for service_agent", () => {
    it("STRICTLY BLOCKS 'service_agent' from create_prescription (prescriptions restricted to vet/admin)", async () => {
      const tool = getTool("create_prescription")!;
      const ctx = createMockToolCtx("service_agent", DOCTOR_ID);

      await expect(
        tool.execute(
          {
            patientId: PATIENT_ID,
            medicationName: "Meloxicam",
            dosage: "0.1mg/kg",
            frequency: "1x daily",
          },
          ctx,
        ),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("STRICTLY BLOCKS 'service_agent' from get_controlled_substances_log", async () => {
      const tool = getTool("get_controlled_substances_log")!;
      const ctx = createMockToolCtx("service_agent");

      await expect(
        tool.execute({ drugName: "Ketamín" }, ctx),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
  });

  describe("Fail-closed behavior on missing or unauthenticated role", () => {
    it("denies tool execution when userRole is undefined", async () => {
      const tool = getTool("find_client")!;
      const ctx = createMockToolCtx(undefined);

      await expect(tool.execute({ query: "Janko" }, ctx)).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    });

    it("denies tool execution when userRole is null", async () => {
      const tool = getTool("find_patient")!;
      const ctx = createMockToolCtx(null);

      await expect(tool.execute({ query: "Dunco" }, ctx)).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    });

    it("denies tool execution when userRole is empty string", async () => {
      const tool = getTool("book_appointment")!;
      const ctx = createMockToolCtx("");

      await expect(
        tool.execute(
          {
            clientId: CLIENT_ID,
            patientId: PATIENT_ID,
            startTime: "2026-09-17T10:00:00.000Z",
            endTime: "2026-09-17T10:30:00.000Z",
          },
          ctx,
        ),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
  });

  describe("Clinician privileges preservation", () => {
    it("allows 'veterinarian' to execute create_prescription", async () => {
      const tool = getTool("create_prescription")!;
      const ctx = createMockToolCtx("veterinarian", DOCTOR_ID);

      const result = (await tool.execute(
        {
          patientId: PATIENT_ID,
          medicationName: "Meloxicam",
          dosage: "0.1mg/kg",
          frequency: "1x daily",
        },
        ctx,
      )) as { id: string };

      expect(result).toBeDefined();
    });

    it("allows 'veterinarian' to execute get_controlled_substances_log", async () => {
      const tool = getTool("get_controlled_substances_log")!;
      const ctx = createMockToolCtx("veterinarian", DOCTOR_ID);

      const result = await tool.execute({}, ctx);
      expect(result).toBeDefined();
    });
  });
});
