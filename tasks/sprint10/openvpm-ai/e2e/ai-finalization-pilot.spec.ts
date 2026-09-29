import { expect, test } from "@playwright/test";

/**
 * AI Finalization Pilot Smoke (PILOT_E2E=1).
 *
 * Proves the controlled-pilot critical path against a running server with a
 * real disposable database — no LLM calls (the AI draft is pre-seeded):
 *
 *   1. Veterinarian login via UI
 *   2. /agent/voice renders the dictation workspace
 *   3. prepareConfirmation issues a one-time envelope (tRPC, authed session)
 *   4. saveAsSoapNote finalizes with the envelope (tRPC, authed session)
 *   5. Replaying the same envelope is rejected with CONFLICT
 *   6. The dictation is linked to the finalized SOAP note
 *   7. No page errors / console errors along the way
 *
 * Setup (isolated throwaway database only):
 *   CREATE DATABASE openpims_pilot_<suffix>;
 *   DATABASE_URL=... pnpm db:migrate && pnpm db:rls
 *   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f e2e/fixtures/ai-finalization-pilot.sql
 *   PILOT_E2E=1 PILOT_E2E_DATABASE_URL="$DATABASE_URL" DATABASE_URL="$DATABASE_URL" \
 *     PLAYWRIGHT_BASE_URL=http://localhost:3001 pnpm test:e2e ai-finalization-pilot
 * (The web dev server listens on 3001 — `next dev -p 3001`; the Playwright
 * default of 3000 does NOT apply. Override PLAYWRIGHT_BASE_URL if the server
 * runs elsewhere.)
 */

const enabled = process.env.PILOT_E2E === "1";
const email = process.env.PILOT_E2E_EMAIL ?? "pilot.vet@example.test";
const password = process.env.PILOT_E2E_PASSWORD ?? "PilotSmoke123!";
const dictationId =
  process.env.PILOT_E2E_DICTATION_ID ??
  "20000000-0000-0000-0000-000000000007";
const patientId =
  process.env.PILOT_E2E_PATIENT_ID ??
  "20000000-0000-0000-0000-000000000005";

test.skip(!enabled, "Set PILOT_E2E=1 against an isolated synthetic DB");

function requireDisposableLocalUrl(
  raw: string | undefined,
  kind: "database" | "web",
) {
  if (!raw) {
    throw new Error(
      `${kind === "database" ? "PILOT_E2E_DATABASE_URL" : "PLAYWRIGHT_BASE_URL"} is required when PILOT_E2E=1`,
    );
  }
  const url = new URL(raw);
  const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
  if (!localHosts.has(url.hostname)) {
    throw new Error(`Refusing pilot E2E against non-local ${kind} host`);
  }
  if (kind === "database" && !url.pathname.slice(1).startsWith("openpims_pilot_")) {
    throw new Error(
      "Refusing pilot E2E against a database without the openpims_pilot_ prefix",
    );
  }
}

if (enabled) {
  const actualDatabaseUrl = process.env.DATABASE_URL;
  const assertedDatabaseUrl = process.env.PILOT_E2E_DATABASE_URL;
  requireDisposableLocalUrl(assertedDatabaseUrl, "database");
  requireDisposableLocalUrl(actualDatabaseUrl, "database");
  if (actualDatabaseUrl !== assertedDatabaseUrl) {
    throw new Error(
      "DATABASE_URL must exactly match PILOT_E2E_DATABASE_URL for pilot E2E",
    );
  }
  requireDisposableLocalUrl(process.env.PLAYWRIGHT_BASE_URL, "web");
}

function expectedDevelopmentNoise(message: string) {
  return (
    message.includes("Download the React DevTools") ||
    message.includes("Content-Security-Policy") ||
    message.includes("Content Security Policy directive")
  );
}

test("pilot: login, prepare, finalize, replay-rejected", async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && !expectedDevelopmentNoise(message.text())) {
      errors.push(message.text());
    }
  });

  // 1. Login via UI (locale-agnostic selectors: the app defaults to sk and
  // switches client-side from the NEXT_LOCALE cookie / localStorage)
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.getByLabel(/e-?mail/i).fill(email);
  await page.getByLabel(/heslo|password/i).fill(password);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.startsWith("/login"), {
      timeout: 30_000,
    }),
    page.getByRole("button", { name: /prihlásiť|sign in/i }).click(),
  ]);

  // 2. Voice workspace renders ("Voice Dictation" / "Hlasové diktovanie")
  await page.goto("/agent/voice", { waitUntil: "networkidle" });
  await expect(
    page.getByRole("heading", { name: /voice dictation|hlasové diktovanie/i })
  ).toBeVisible();

  // 3. Prepare: issue a one-time confirmation envelope (authed tRPC call)
  const clinicianSections = {
    subjective: "Owner reports vomiting for two days. Appetite reduced.",
    objective: "Lethargic, abdomen soft, CRT < 2s.",
    assessment: "Acute gastroenteritis.",
    plan: "Antiemetic, bland diet, recheck in 24 hours.",
  };
  // NOTE: tRPC uses the superjson transformer — POST bodies must wrap the
  // input as { json: input }, and GET queries as ?input={"json":{...}}.
  const prepareResponse = await page.request.post(
    "/api/trpc/extensions.voice.prepareConfirmation",
    { data: { json: { dictationId, ...clinicianSections } } },
  );
  expect(prepareResponse.ok()).toBe(true);
  const prepared = (await prepareResponse.json()).result.data.json as {
    confirmationId: string;
    expectedRevision: number;
  };
  expect(prepared.confirmationId).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
  );
  expect(prepared.expectedRevision).toBe(0);

  // 4. Finalize with the envelope
  const finalizeResponse = await page.request.post(
    "/api/trpc/extensions.voice.saveAsSoapNote",
    {
      data: {
        json: {
          dictationId,
          expectedRevision: prepared.expectedRevision,
          ...clinicianSections,
          clinicianConfirmed: { confirmationId: prepared.confirmationId },
        },
      },
    },
  );
  expect(finalizeResponse.ok()).toBe(true);
  const finalized = (await finalizeResponse.json()).result.data.json as {
    id: string;
    status: string;
  };
  expect(finalized.status).toBe("finalized");

  // 5. Replay of the consumed envelope is rejected with CONFLICT
  const replayResponse = await page.request.post(
    "/api/trpc/extensions.voice.saveAsSoapNote",
    {
      data: {
        json: {
          dictationId,
          expectedRevision: prepared.expectedRevision,
          ...clinicianSections,
          clinicianConfirmed: { confirmationId: prepared.confirmationId },
        },
      },
    },
  );
  expect(replayResponse.ok()).toBe(false);
  const replayBody = (await replayResponse.json()) as {
    error?: { json?: { code?: number; data?: { code?: string } } };
  };
  // tRPC serializes the error code in data.code (HTTP 409 for CONFLICT)
  expect(replayResponse.status()).toBe(409);
  expect(replayBody.error?.json?.data?.code).toBe("CONFLICT");

  // 6. The dictation is linked to the finalized note
  const listResponse = await page.request.get(
    `/api/trpc/extensions.voice.listByPatient?input=${encodeURIComponent(JSON.stringify({ json: { patientId } }))}`,
  );
  expect(listResponse.ok()).toBe(true);
  const dictations = (await listResponse.json()).result.data.json as Array<{
    id: string;
    soapNoteId: string | null;
  }>;
  const finished = dictations.find((d) => d.id === dictationId);
  expect(finished?.soapNoteId).toBe(finalized.id);

  // 7. Clean console
  expect(errors).toEqual([]);
});
