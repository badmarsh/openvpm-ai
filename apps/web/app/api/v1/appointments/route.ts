import { NextResponse } from "next/server";
import { db } from "@openpims/db/client";
import { appointments } from "@openpims/db";
import { authenticateApiKey } from "@/lib/api-auth";
import { dispatchWebhookEvent } from "@/lib/webhook-dispatcher";
import { withErrorHandling, apiError, validationError } from "@/lib/compat/shared/errors";
import {
  AppointmentCreateSchema,
  fromApiAppointmentCreate,
  toApiAppointment,
} from "@/lib/compat/openvpm";

export const dynamic = "force-dynamic";

// POST /api/v1/appointments — create an appointment for the authenticated practice.
export async function POST(req: Request) {
  const auth = await authenticateApiKey(req, "appointments:write");
  if (!auth.ok) return auth.response;

  return withErrorHandling(async () => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError("Request body must be valid JSON", 400);
    }

    const parsed = AppointmentCreateSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const [created] = await db
      .insert(appointments)
      .values({
        ...fromApiAppointmentCreate(parsed.data),
        practiceId: auth.ctx.practiceId,
      })
      .returning();

    const apiAppointment = toApiAppointment(created!);

    // Fire the (previously never-triggered) webhook for this practice.
    await dispatchWebhookEvent(
      auth.ctx.practiceId,
      "appointment.created",
      apiAppointment
    );

    return NextResponse.json({ data: apiAppointment }, { status: 201 });
  });
}
