#!/usr/bin/env node
/**
 * Staging / local smoke test for OpenVPM.
 *
 * Runs black-box HTTP probes against a deployed (or locally started) instance
 * and one in-process check of the e-Kasa offline fallback that must work even
 * when the Financial Administration API is unreachable.
 *
 *   node scripts/staging-smoke-test.mjs                          # local, http://localhost:3000
 *   node scripts/staging-smoke-test.mjs --base-url https://staging.example
 *   SMOKE_BASE_URL=https://staging.example node scripts/staging-smoke-test.mjs
 *   node scripts/staging-smoke-test.mjs --skip-http              # only the offline e-Kasa check
 *   node scripts/staging-smoke-test.mjs --allow-not-ready        # tolerate 503 from /api/health/ready
 *   node scripts/staging-smoke-test.mjs --json                   # machine-readable summary
 *
 * Exit code 0 = all checks passed, 1 = at least one check failed, 2 = usage /
 * environment error. No credentials are required: the suite only asserts that
 * unauthenticated calls are rejected and that public probes respond.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const WEB_DIR = join(REPO_ROOT, "apps", "web");

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
const argv = process.argv.slice(2);
function flag(name) {
  return argv.includes(`--${name}`);
}
function option(name, fallback) {
  const idx = argv.indexOf(`--${name}`);
  if (idx !== -1 && argv[idx + 1] && !argv[idx + 1].startsWith("--")) {
    return argv[idx + 1];
  }
  const eq = argv.find((a) => a.startsWith(`--${name}=`));
  if (eq) return eq.slice(name.length + 3);
  return fallback;
}

if (flag("help") || flag("h")) {
  console.log(
    [
      "Usage: node scripts/staging-smoke-test.mjs [options]",
      "",
      "  --base-url <url>      Target instance (default: $SMOKE_BASE_URL or http://localhost:3000)",
      "  --timeout-ms <n>      Per-request timeout (default: 15000)",
      "  --allow-not-ready     Treat 503 from readiness as a warning, not a failure",
      "  --skip-http           Skip network probes (run only the in-process e-Kasa check)",
      "  --skip-ekasa          Skip the in-process e-Kasa offline check",
      "  --json                Emit a JSON summary on stdout",
      "",
    ].join("\n"),
  );
  process.exit(0);
}

const BASE_URL = (
  option("base-url", process.env.SMOKE_BASE_URL ?? "http://localhost:3000") ??
  ""
).replace(/\/+$/, "");
const TIMEOUT_MS = Number.parseInt(option("timeout-ms", "15000"), 10) || 15000;
const ALLOW_NOT_READY = flag("allow-not-ready") || process.env.SMOKE_ALLOW_NOT_READY === "1";
const SKIP_HTTP = flag("skip-http");
const SKIP_EKASA = flag("skip-ekasa");
const JSON_OUTPUT = flag("json");

try {
  // eslint-disable-next-line no-new
  new URL(BASE_URL);
} catch {
  console.error(`Invalid --base-url: ${BASE_URL}`);
  process.exit(2);
}

// ---------------------------------------------------------------------------
// Result collection
// ---------------------------------------------------------------------------
/** @type {{ name: string; status: "pass" | "fail" | "warn" | "skip"; detail: string; ms?: number }[]} */
const results = [];
function record(name, status, detail, ms) {
  results.push({ name, status, detail, ms });
  if (!JSON_OUTPUT) {
    const icon =
      status === "pass" ? "PASS" : status === "warn" ? "WARN" : status === "skip" ? "SKIP" : "FAIL";
    const timing = ms == null ? "" : ` (${ms}ms)`;
    console.log(`[${icon}] ${name}${timing}${detail ? ` — ${detail}` : ""}`);
  }
}

async function probe(path, init = {}) {
  const url = `${BASE_URL}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const startedAt = Date.now();
  try {
    const res = await fetch(url, {
      redirect: "manual",
      ...init,
      signal: controller.signal,
      headers: {
        accept: "application/json",
        "user-agent": "openvpm-smoke-test/1.0",
        ...(init.headers ?? {}),
      },
    });
    let body = null;
    const text = await res.text().catch(() => "");
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    return { ok: true, status: res.status, headers: res.headers, body, ms: Date.now() - startedAt };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      headers: new Headers(),
      body: null,
      error: error instanceof Error ? error.message : String(error),
      ms: Date.now() - startedAt,
    };
  } finally {
    clearTimeout(timer);
  }
}

function summarizeBody(body) {
  if (body == null) return "";
  if (typeof body === "string") return body.slice(0, 120).replace(/\s+/g, " ");
  try {
    return JSON.stringify(body).slice(0, 160);
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// Route inventory: every unauthenticated call must be rejected.
// ---------------------------------------------------------------------------
const CRON_ROUTES = [
  "activation-digest",
  "auth-cleanup",
  "backup",
  "billing-lifecycle",
  "conversion-reconcile",
  "ekasa-daily-closure",
  "ekasa-retry",
  "file-replicas",
  "first-clinic-win",
  "prescription-expiry",
  "rate-limit-cleanup",
  "reminders",
  "setup-recovery",
  "sms-operations",
  "sms-provider-events",
  "usage-reconcile",
  "voice-audio-retention",
  "wellness-billing",
].map((name) => `/api/cron/${name}`);

/** Public REST API v1 — API-key authenticated. */
const API_V1_ROUTES = [
  { path: "/api/v1/patients", method: "GET" },
  { path: "/api/v1/clients", method: "GET" },
  { path: "/api/v1/appointments", method: "GET" },
  {
    path: "/api/v1/soap-notes",
    method: "POST",
    body: {
      patient_id: "00000000-0000-4000-8000-000000000001",
      subjective: "smoke",
      clinician_confirmed: true,
    },
  },
  { path: "/api/v1/agent", method: "POST", body: { message: "smoke" } },
];

/** Method surface: a write-only endpoint must not expose a GET listing. */
const METHOD_SURFACE_ROUTES = [
  { path: "/api/v1/soap-notes", method: "GET", expect: [405] },
];

/** Other privileged surfaces that must fail closed without a session. */
const SESSION_ROUTES = [
  { path: "/api/upload", method: "POST", body: {}, expect: [401, 403] },
  {
    path: `/api/files/00000000-0000-4000-8000-000000000001/patient-photos/00000000-0000-4000-8000-000000000002.jpg`,
    method: "GET",
    expect: [401, 403, 404],
  },
  {
    path: "/api/trpc/patients.list?input=%7B%22json%22%3A%7B%7D%7D",
    method: "GET",
    expect: [401],
    // tRPC returns HTTP 401 for UNAUTHORIZED; if the procedure name changes the
    // router responds 404 which is still fail-closed for an anonymous caller.
    tolerate: [404],
  },
];

/** Capability URLs: unknown or malformed tokens must be a uniform 404. */
const TOKEN_ROUTES = [
  { path: `/api/sign/${"0".repeat(64)}`, method: "GET", expect: [404] },
  { path: `/api/sign/${"0".repeat(64)}`, method: "POST", body: {}, expect: [404] },
  { path: "/api/sign/not-a-token", method: "GET", expect: [404] },
  { path: "/api/portal/session", method: "POST", body: { token: "0".repeat(64) }, expect: [404] },
  { path: "/api/portal/session", method: "POST", body: {}, expect: [400, 404] },
];

// ---------------------------------------------------------------------------
// HTTP checks
// ---------------------------------------------------------------------------
async function runHttpChecks() {
  // 1. Liveness
  {
    const r = await probe("/api/health/live");
    if (!r.ok) {
      record("GET /api/health/live", "fail", `unreachable: ${r.error}`, r.ms);
      return false; // nothing else will work
    }
    const okBody = r.body && typeof r.body === "object" && r.body.ok === true && r.body.probe === "live";
    const noStore = (r.headers.get("cache-control") ?? "").includes("no-store");
    if (r.status === 200 && okBody && noStore) {
      record("GET /api/health/live", "pass", "200, ok:true, no-store", r.ms);
    } else {
      record(
        "GET /api/health/live",
        "fail",
        `status ${r.status}, cache-control=${r.headers.get("cache-control")}, body=${summarizeBody(r.body)}`,
        r.ms,
      );
    }
  }

  // 2. Readiness
  {
    const r = await probe("/api/health/ready");
    const checks = r.body && typeof r.body === "object" ? r.body.checks ?? {} : {};
    const failing = Object.entries(checks)
      .filter(([, c]) => c && c.ok === false && !c.advisory)
      .map(([k, c]) => `${k}${c.detail ? `: ${c.detail}` : ""}`);
    if (r.status === 200 && r.body?.ok === true) {
      record(
        "GET /api/health/ready",
        "pass",
        `200, mode=${r.body.mode}, ${Object.keys(checks).length} checks`,
        r.ms,
      );
    } else if (r.status === 503 && r.body && typeof r.body === "object") {
      record(
        "GET /api/health/ready",
        ALLOW_NOT_READY ? "warn" : "fail",
        `503 not ready — ${failing.join("; ") || "no failing check listed"}`,
        r.ms,
      );
    } else {
      record(
        "GET /api/health/ready",
        "fail",
        `unexpected status ${r.status}: ${r.error ?? summarizeBody(r.body)}`,
        r.ms,
      );
    }
    // Readiness must never leak secrets: only booleans/details.
    const raw = JSON.stringify(r.body ?? {});
    if (/sk_live_|sk_test_|postgres(ql)?:\/\/[^\s"]+:[^\s"]+@/.test(raw)) {
      record("readiness payload redaction", "fail", "response appears to contain a secret");
    } else {
      record("readiness payload redaction", "pass", "no credential patterns in body");
    }
  }

  // 3. Cron routes: unauthenticated and wrong-secret → 401
  for (const path of CRON_ROUTES) {
    const anon = await probe(path);
    const wrong = await probe(path, {
      headers: { authorization: "Bearer definitely-not-the-cron-secret" },
    });
    const legacy = await probe(path, { headers: { "x-cron-secret": "wrong" } });
    const all = [anon, wrong, legacy];
    if (all.every((r) => r.ok && r.status === 401)) {
      record(`GET ${path}`, "pass", "401 anon / bad bearer / bad x-cron-secret", anon.ms);
    } else {
      record(
        `GET ${path}`,
        "fail",
        `anon=${anon.status} bearer=${wrong.status} legacy=${legacy.status}${anon.error ? ` (${anon.error})` : ""}`,
        anon.ms,
      );
    }
  }

  // 4. Public REST API v1 without key / with malformed key → 401
  for (const route of API_V1_ROUTES) {
    const init = {
      method: route.method,
      headers: route.body ? { "content-type": "application/json" } : {},
      body: route.body ? JSON.stringify(route.body) : undefined,
    };
    const anon = await probe(route.path, init);
    const badKey = await probe(route.path, {
      ...init,
      headers: { ...init.headers, authorization: "Bearer ovpm_invalid_smoke_key_000000" },
    });
    const label = `${route.method} ${route.path}`;
    const bothRejected =
      anon.ok && badKey.ok && anon.status === 401 && badKey.status === 401;
    // Rate limiting (429) on the bad-key path is also fail-closed.
    const badKeyRateLimited = badKey.ok && badKey.status === 429 && anon.status === 401;
    if (bothRejected) {
      record(label, "pass", "401 without key and with invalid key", anon.ms);
    } else if (badKeyRateLimited) {
      record(label, "pass", "401 without key; invalid key rate-limited (429)", anon.ms);
    } else {
      record(
        label,
        "fail",
        `anon=${anon.status} badKey=${badKey.status} body=${summarizeBody(anon.body)}`,
        anon.ms,
      );
    }
    if (anon.ok && anon.status === 401) {
      const auth = anon.headers.get("www-authenticate");
      if (!auth) {
        record(`${label} WWW-Authenticate`, "warn", "401 without WWW-Authenticate header");
      }
    }
  }

  // 4b. Method surface
  for (const route of METHOD_SURFACE_ROUTES) {
    const r = await probe(route.path, { method: route.method });
    const label = `${route.method} ${route.path}`;
    if (r.ok && route.expect.includes(r.status)) {
      record(label, "pass", `${r.status} (method not exposed)`, r.ms);
    } else {
      record(label, "fail", `status ${r.status} ${r.error ?? summarizeBody(r.body)}`, r.ms);
    }
  }

  // 5. Session-protected and storage routes
  for (const route of SESSION_ROUTES) {
    const r = await probe(route.path, {
      method: route.method,
      headers: route.body ? { "content-type": "application/json" } : {},
      body: route.body ? JSON.stringify(route.body) : undefined,
    });
    const label = `${route.method} ${route.path.split("?")[0]}`;
    if (r.ok && route.expect.includes(r.status)) {
      record(label, "pass", `${r.status}`, r.ms);
    } else if (r.ok && route.tolerate?.includes(r.status)) {
      record(label, "warn", `${r.status} (tolerated; expected ${route.expect.join("/")})`, r.ms);
    } else {
      record(label, "fail", `status ${r.status} ${r.error ?? summarizeBody(r.body)}`, r.ms);
    }
  }

  // 6. Capability tokens
  for (const route of TOKEN_ROUTES) {
    const r = await probe(route.path, {
      method: route.method,
      headers: route.body ? { "content-type": "application/json" } : {},
      body: route.body ? JSON.stringify(route.body) : undefined,
    });
    const label = `${route.method} ${route.path.replace(/0{64}/, "<unknown-token>")}`;
    if (r.ok && route.expect.includes(r.status)) {
      record(label, "pass", `${r.status}`, r.ms);
    } else if (r.ok && r.status === 429) {
      record(label, "pass", "429 rate-limited before lookup (fail-closed)", r.ms);
    } else {
      record(label, "fail", `status ${r.status} ${r.error ?? summarizeBody(r.body)}`, r.ms);
    }
  }

  // 7. Security headers on a public page
  {
    const r = await probe("/api/health/live");
    if (r.ok) {
      const missing = [];
      if (!r.headers.get("x-content-type-options")) missing.push("x-content-type-options");
      if (BASE_URL.startsWith("https://") && !r.headers.get("strict-transport-security")) {
        missing.push("strict-transport-security");
      }
      if (missing.length === 0) {
        record("security headers", "pass", "x-content-type-options present");
      } else {
        record("security headers", "warn", `missing: ${missing.join(", ")}`);
      }
    }
  }

  return true;
}

// ---------------------------------------------------------------------------
// In-process e-Kasa offline fallback (no network).
//
// Loads the real `processEkasaReceipt` through tsx with `globalThis.fetch`
// replaced by a function that throws. Proves that with the FR SR API
// unreachable — or fiscalization disabled / key missing — a receipt is still
// persisted and ends in OFFLINE_STORED, never CONFIRMED, and no outbound call
// is made.
// ---------------------------------------------------------------------------
const EKASA_OFFLINE_CHECK = String.raw`
import { processEkasaReceipt, sendToEkasaApi } from "@/lib/ekasa/service";
import { generateKeyPairSync } from "node:crypto";

let fetchCalls = 0;
globalThis.fetch = async () => {
  fetchCalls += 1;
  throw new TypeError("fetch failed: network unreachable (smoke test)");
};

function fakeDb() {
  const rows = [];
  const updates = [];
  const db = {
    execute: async () => [],
    select: () => ({
      from: () => ({
        where: () => {
          const rows = [{ count: 0 }];
          return {
            orderBy: () => ({ limit: async () => rows }),
            limit: async () => rows,
            then: (res, rej) => Promise.resolve(rows).then(res, rej),
          };
        },
      }),
    }),
    insert: () => ({
      values: (v) => ({
        returning: async () => {
          const id = "receipt-" + (rows.length + 1);
          rows.push({ id, ...v });
          return [{ id }];
        },
      }),
    }),
    update: () => ({
      set: (v) => ({
        where: async () => {
          updates.push(v);
        },
      }),
    }),
    transaction: async (fn) => fn(db),
  };
  return { db, rows, updates };
}

const input = {
  practiceId: "00000000-0000-4000-8000-0000000000aa",
  amountBase: "100.00",
  amountVat: "23.00",
  amountTotal: "123.00",
  vatRate: "23",
  paymentMethod: "CASH",
  items: [{ name: "Vyšetrenie", qty: 1, unitPrice: "100.00", vatRate: "23" }],
};

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const pem = privateKey.export({ type: "pkcs1", format: "pem" }).toString();

const scenarios = [];

// Scenario 1: operator-enabled offline mode.
{
  process.env.EKASA_FISCALIZATION_ENABLED = "true";
  const { db, rows, updates } = fakeDb();
  const out = await processEkasaReceipt(db, input, {
    dic: "2020000000",
    pokladnicaId: "88812345678900001",
    ekasaApiUrl: "https://ekasa.financnasprava.sk",
    certBase64: pem,
    offlineModeEnabled: true,
  });
  scenarios.push({
    name: "offline mode enabled",
    status: out.status,
    persisted: rows.length === 1 && rows[0].status === "PENDING",
    finalStatus: updates.at(-1)?.status,
    fetchCalls,
  });
}

// Scenario 2: online mode, FR SR unreachable — must degrade, never CONFIRM.
{
  const before = fetchCalls;
  process.env.EKASA_FISCALIZATION_ENABLED = "true";
  const { db, rows, updates } = fakeDb();
  const out = await processEkasaReceipt(db, input, {
    dic: "2020000000",
    pokladnicaId: "88812345678900001",
    ekasaApiUrl: "https://ekasa.financnasprava.sk",
    certBase64: pem,
    offlineModeEnabled: false,
  });
  scenarios.push({
    name: "network unreachable",
    status: out.status,
    persisted: rows.length === 1,
    finalStatus: updates.at(-1)?.status,
    uid: out.uid ?? null,
    fetchCalls: fetchCalls - before,
    rawError: updates.at(-1)?.rawResponse?.error ?? null,
  });
}

// Scenario 3: fiscalization flag off — receipt stored offline, zero egress.
{
  const before = fetchCalls;
  process.env.EKASA_FISCALIZATION_ENABLED = "";
  const { db, rows, updates } = fakeDb();
  const out = await processEkasaReceipt(db, input, {
    dic: "2020000000",
    pokladnicaId: "88812345678900001",
    ekasaApiUrl: "https://ekasa.financnasprava.sk",
    certBase64: pem,
    offlineModeEnabled: false,
  });
  scenarios.push({
    name: "fiscalization disabled",
    status: out.status,
    persisted: rows.length === 1,
    finalStatus: updates.at(-1)?.status,
    fetchCalls: fetchCalls - before,
  });
}

// Scenario 4: missing RSA key — cannot sign, must not hit FR SR.
{
  const before = fetchCalls;
  process.env.EKASA_FISCALIZATION_ENABLED = "true";
  const { db, rows, updates } = fakeDb();
  const out = await processEkasaReceipt(db, input, {
    dic: "2020000000",
    pokladnicaId: "88812345678900001",
    ekasaApiUrl: "https://ekasa.financnasprava.sk",
    certBase64: null,
    offlineModeEnabled: false,
  });
  scenarios.push({
    name: "missing signing key",
    status: out.status,
    persisted: rows.length === 1 && rows[0].pkp === null,
    finalStatus: updates.at(-1)?.status,
    fetchCalls: fetchCalls - before,
  });
}

// Scenario 5: SSRF guard — non-FR-SR host never receives a request.
{
  const before = fetchCalls;
  process.env.EKASA_FISCALIZATION_ENABLED = "true";
  const res = await sendToEkasaApi({
    apiUrl: "https://attacker.example",
    receiptNumber: "X",
    dic: "2020000000",
    pokladnicaId: "88812345678900001",
    amountTotal: "1.00",
    amountVat: "0.00",
    paymentMethod: "CASH",
    okp: "OKP",
    pkp: "PKP",
    issuedAt: new Date(),
    items: [],
  });
  scenarios.push({
    name: "ssrf guard",
    status: res.success ? "SENT" : "BLOCKED",
    fetchCalls: fetchCalls - before,
  });
}

process.stdout.write(JSON.stringify({ scenarios }) + "\n");
`;

function runEkasaOfflineCheck() {
  const tsxName = process.platform === "win32" ? "tsx.cmd" : "tsx";
  const tsxBin = [
    join(WEB_DIR, "node_modules", ".bin", tsxName),
    join(REPO_ROOT, "node_modules", ".bin", tsxName),
  ].find((candidate) => existsSync(candidate));
  if (!tsxBin || !existsSync(WEB_DIR)) {
    record(
      "e-Kasa offline fallback",
      "skip",
      "repository checkout with node_modules required (run `pnpm install`)",
    );
    return;
  }
  const dir = mkdtempSync(join(tmpdir(), "openvpm-smoke-"));
  // The script must live inside apps/web so the "@/…" path alias resolves.
  const scriptPath = join(WEB_DIR, `.smoke-ekasa-${process.pid}.mts`);
  writeFileSync(scriptPath, EKASA_OFFLINE_CHECK);
  const startedAt = Date.now();
  try {
    const proc = spawnSync(tsxBin, ["--tsconfig", join(WEB_DIR, "tsconfig.json"), scriptPath], {
      cwd: WEB_DIR,
      encoding: "utf8",
      timeout: 120_000,
      env: {
        ...process.env,
        NODE_ENV: "test",
        // Never let the check reach a real database or provider.
        DATABASE_URL: "",
        EKASA_FISCALIZATION_ENABLED: "true",
      },
    });
    const ms = Date.now() - startedAt;
    if (proc.status !== 0) {
      record(
        "e-Kasa offline fallback",
        "fail",
        `tsx exited ${proc.status}: ${(proc.stderr || proc.stdout || "").trim().split("\n").slice(-3).join(" | ")}`,
        ms,
      );
      return;
    }
    const lastLine = proc.stdout.trim().split("\n").at(-1) ?? "";
    let parsed;
    try {
      parsed = JSON.parse(lastLine);
    } catch {
      record("e-Kasa offline fallback", "fail", `unparseable output: ${lastLine.slice(0, 160)}`, ms);
      return;
    }
    const byName = Object.fromEntries(parsed.scenarios.map((s) => [s.name, s]));

    const offline = byName["offline mode enabled"];
    assertScenario(
      "e-Kasa: offline mode stores receipt locally",
      offline &&
        offline.status === "OFFLINE_STORED" &&
        offline.finalStatus === "OFFLINE_STORED" &&
        offline.persisted &&
        offline.fetchCalls === 0,
      offline,
      ms,
    );

    const net = byName["network unreachable"];
    assertScenario(
      "e-Kasa: FR SR unreachable degrades without CONFIRMED",
      net &&
        net.persisted &&
        net.status === "FAILED" &&
        net.finalStatus === "FAILED" &&
        net.uid === null &&
        net.fetchCalls === 1 &&
        typeof net.rawError === "string",
      net,
    );

    const disabled = byName["fiscalization disabled"];
    assertScenario(
      "e-Kasa: fiscalization flag off → OFFLINE_STORED, zero egress",
      disabled &&
        disabled.status === "OFFLINE_STORED" &&
        disabled.persisted &&
        disabled.fetchCalls === 0,
      disabled,
    );

    const noKey = byName["missing signing key"];
    assertScenario(
      "e-Kasa: missing RSA key → OFFLINE_STORED, zero egress",
      noKey && noKey.status === "OFFLINE_STORED" && noKey.persisted && noKey.fetchCalls === 0,
      noKey,
    );

    const ssrf = byName["ssrf guard"];
    assertScenario(
      "e-Kasa: non-FR-SR host blocked before fetch",
      ssrf && ssrf.status === "BLOCKED" && ssrf.fetchCalls === 0,
      ssrf,
    );
  } finally {
    rmSync(scriptPath, { force: true });
    rmSync(dir, { recursive: true, force: true });
  }
}

function assertScenario(name, ok, scenario, ms) {
  record(name, ok ? "pass" : "fail", ok ? "" : JSON.stringify(scenario ?? null), ms);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
if (!JSON_OUTPUT) {
  console.log(`OpenVPM smoke test — target ${SKIP_HTTP ? "(http skipped)" : BASE_URL}`);
  console.log("");
}

// The in-process check is deterministic and independent of the target, so it
// runs first: a slow or restarting remote never masks a fiscal regression.
if (!SKIP_EKASA) {
  runEkasaOfflineCheck();
} else {
  record("e-Kasa offline fallback", "skip", "--skip-ekasa");
}

if (!SKIP_HTTP) {
  await runHttpChecks();
} else {
  record("http probes", "skip", "--skip-http");
}

const counts = results.reduce(
  (acc, r) => {
    acc[r.status] += 1;
    return acc;
  },
  { pass: 0, fail: 0, warn: 0, skip: 0 },
);

if (JSON_OUTPUT) {
  console.log(
    JSON.stringify(
      {
        baseUrl: SKIP_HTTP ? null : BASE_URL,
        ranAt: new Date().toISOString(),
        counts,
        verdict: counts.fail === 0 ? "PASS" : "FAIL",
        results,
      },
      null,
      2,
    ),
  );
} else {
  console.log("");
  console.log(
    `Summary: ${counts.pass} passed, ${counts.fail} failed, ${counts.warn} warnings, ${counts.skip} skipped → ${
      counts.fail === 0 ? "PASS" : "FAIL"
    }`,
  );
}

process.exit(counts.fail === 0 ? 0 : 1);
