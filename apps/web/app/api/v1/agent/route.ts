import { z } from "zod";
import { NextResponse } from "next/server";
import { db } from "@openpims/db/client";
import { authenticateApiKey } from "@/lib/api-auth";
import { withErrorHandling, apiError, validationError } from "@/lib/compat/shared/errors";
import { runAgent, AgentNotConfiguredError } from "@/lib/agent";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  instruction: z.string().min(1).max(2000),
  allow_writes: z.boolean().optional().default(false),
});

// POST /api/v1/agent — run the OpenVPM Agent over the API, scoped to the key's
// practice. This is what lets external automations (and an agent-led ops layer)
// drive the practice through one natural-language endpoint.
export async function POST(req: Request) {
  const auth = await authenticateApiKey(req, "agent:run");
  if (!auth.ok) return auth.response;

  return withErrorHandling(async () => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError("Request body must be valid JSON", 400);
    }

    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    try {
      const result = await runAgent({
        instruction: parsed.data.instruction,
        allowWrites: parsed.data.allow_writes,
        context: {
          db,
          practiceId: auth.ctx.practiceId,
          // No human user on an API call; identify the actor by key.
          userId: `apikey:${auth.ctx.apiKeyId}`,
        },
      });
      return NextResponse.json({ data: result });
    } catch (e) {
      if (e instanceof AgentNotConfiguredError) {
        return apiError(e.message, 503);
      }
      throw e;
    }
  });
}
