import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PgDialect } from "drizzle-orm/pg-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Adversarial multi-tenant isolation suite.
 *
 * Threat model: an authenticated user of Clinic A (the attacker) holds valid
 * UUIDs, storage keys, and capability tokens belonging to Clinic B (the
 * victim) — obtained from a leaked URL, a shared browser, or a former
 * employee — and tries to read or mutate the victim's data.
 *
 * Every router under test runs against a *predicate-evaluating* DB double:
 * the drizzle `where` clause is compiled to SQL and the parameter list is
 * inspected for the caller's practice id. A query that does not bind the
 * caller's tenant is treated as returning the victim's row, which is exactly
 * what an unscoped query would do in production. This makes cross-tenant
 * leakage observable without a live Postgres.
 *
 * Expected outcome for every attempt: 401 / 403 / 404 (or an empty list) —
 * never the victim's data, never a write.
 */

const mocks = vi.hoisted(() => ({
  readPrimaryObject: vi.fn(),
  readReplicaObject: vi.fn(),
  uploadFile: vi.fn(),
  configuredModel: vi.fn(),
  generateText: vi.fn(),
  getServerSession: vi.fn(),
  schedulePrimaryRepair: vi.fn(async () => true),
  recordAuditLog: vi.fn(async () => undefined),
  rateLimit: vi.fn(async () => ({
    success: true,
    remaining: 10,
    resetAt: new Date(Date.now() + 60_000),
  })),
  lockPracticeForExternalSideEffects: vi.fn(async () => true),
}));

vi.mock("@/lib/s3", () => ({
  FILE_REPLICA_TARGET: "independent-v1",
  normalizeS3VersionId: (v: unknown) =>
    typeof v === "string" && v.trim() && v.trim().toLowerCase() !== "null"
      ? v.trim()
      : undefined,
  readPrimaryObject: mocks.readPrimaryObject,
  readReplicaObject: mocks.readReplicaObject,
  uploadFile: mocks.uploadFile,
}));
vi.mock("@/lib/agent/runner", () => ({
  configuredModel: mocks.configuredModel,
}));
vi.mock("ai", () => ({ generateText: mocks.generateText }));
vi.mock("next-auth", () => ({ getServerSession: mocks.getServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/audit", () => ({ recordAuditLog: mocks.recordAuditLog }));
vi.mock("@/lib/rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rate-limit")>();
  return {
    ...actual,
    rateLimit: mocks.rateLimit,
  };
});
vi.mock("@/lib/recovery-hold", () => ({
  lockPracticeForExternalSideEffects: mocks.lockPracticeForExternalSideEffects,
  RECOVERY_HOLD_BLOCK_MESSAGE: "recovery hold",
}));
vi.mock("@/lib/file-replication", () => ({
  checksumSha256Hex: () => "deadbeef",
  schedulePrimaryRepair: mocks.schedulePrimaryRepair,
}));

// The tenant DB double below is shared by the REST handlers through the
// mocked db client and by tRPC routers via ctx.db.
const tenantDb = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@openpims/db/client", () => ({
  get db() {
    return tenantDb.current;
  },
}));
vi.mock("@/lib/tenant-db", () => ({
  // tRPC procedures pass ctx.db; REST handlers pass the (mocked) module
  // client, which resolves to the same double.
  withSystem: async (dbArg: unknown, fn: (tx: unknown) => unknown) =>
    fn(dbArg ?? tenantDb.current),
  withTenant: async (
    dbArg: unknown,
    _practiceId: string,
    fn: (tx: unknown) => unknown,
  ) => fn(dbArg ?? tenantDb.current),
}));

const { voiceRouter } = await import("../routers/extensions/voice");
const { imagingRouter } = await import("../routers/extensions/imaging");
const { ekasaRouter } = await import("../routers/extensions/ekasa");
const { statutoryRouter } = await import("../routers/extensions/statutory");
const { dischargeRouter } = await import("../routers/extensions/discharge");
const { GET: filesGET } = await import("../../app/api/files/[...path]/route");
const { GET: signGET, POST: signPOST } = await import(
  "../../app/api/sign/[token]/route"
);
const { resolvePortalSession } = await import("@/lib/portal/session");
const { hashPortalSessionToken } = await import("@/lib/portal/tokens");
const {
  hashConsentToken,
  hashConsentReceiptToken,
  deriveTreatmentPlanConsentToken,
  generateCaptureToken,
} = await import("@/lib/consult/tokens");

// ---------------------------------------------------------------------------
// Two clinics. Everything the attacker targets belongs to CLINIC_B.
// ---------------------------------------------------------------------------
const CLINIC_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CLINIC_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const USER_A = "aaaaaaaa-0000-4000-8000-000000000001";
const USER_B = "bbbbbbbb-0000-4000-8000-000000000001";
const PATIENT_B = "bbbbbbbb-0000-4000-8000-000000000002";
const CLIENT_B = "bbbbbbbb-0000-4000-8000-000000000003";
const APPOINTMENT_B = "bbbbbbbb-0000-4000-8000-000000000004";
const DICTATION_B = "bbbbbbbb-0000-4000-8000-000000000005";
const ANALYSIS_B = "bbbbbbbb-0000-4000-8000-000000000006";
const RECEIPT_B = "bbbbbbbb-0000-4000-8000-000000000007";
const FILE_B = "bbbbbbbb-0000-4000-8000-000000000008";
const VAX_B = "bbbbbbbb-0000-4000-8000-000000000009";
const CONSENT_B = "bbbbbbbb-0000-4000-8000-00000000000a";
const SESSION_B = "bbbbbbbb-0000-4000-8000-00000000000b";
const FILE_KEY_B = `${CLINIC_B}/patient-photos/${FILE_B}.jpg`;

const VICTIM_ROWS = {
  patient: {
    id: PATIENT_B,
    practiceId: CLINIC_B,
    clientId: CLIENT_B,
    name: "Victim Rex",
    species: "dog",
    status: "active",
    deletedAt: null,
  },
  dictation: {
    id: DICTATION_B,
    practiceId: CLINIC_B,
    patientId: PATIENT_B,
    appointmentId: APPOINTMENT_B,
    rawTranscript: "CONFIDENTIAL victim transcript",
    audioFileKey: `${CLINIC_B}/voice/${DICTATION_B}.webm`,
    audioMimeType: "audio/webm",
    audioDeletedAt: null,
    createdAt: new Date(),
    deletedAt: null,
  },
  analysis: {
    id: ANALYSIS_B,
    practiceId: CLINIC_B,
    patientId: PATIENT_B,
    imageType: "xray",
    result: "CONFIDENTIAL victim radiograph findings",
    deletedAt: null,
  },
  receipt: {
    id: RECEIPT_B,
    practiceId: CLINIC_B,
    receiptNumber: "20260905-0001",
    amountTotal: "123.00",
    status: "CONFIRMED",
    deletedAt: null,
  },
};

const dialect = new PgDialect();

/** Does the compiled predicate bind this literal value as a parameter? */
function predicateBinds(where: unknown, value: string): boolean {
  if (!where) return false;
  const compiled = dialect.sqlToQuery(where as never);
  return compiled.params.some((p) => p === value);
}

/**
 * A DB double that decides what a query "returns" based on whether the
 * predicate binds the caller's practice id. If the predicate is scoped to
 * CLINIC_A it cannot match CLINIC_B rows -> []. If the predicate is NOT
 * tenant-scoped (a bug), the victim rows are handed back so the assertion
 * catches the leak.
 */
function createTenantDb(opts: {
  callerPracticeId: string;
  victimRowsForUnscopedQuery?: unknown[];
  scopedResults?: unknown[][];
}) {
  const scopedResults = [...(opts.scopedResults ?? [])];
  const observedPredicates: unknown[] = [];
  const unscopedQueries: unknown[] = [];

  function resolve(where: unknown) {
    observedPredicates.push(where);
    const tenantScoped = predicateBinds(where, opts.callerPracticeId);
    if (!tenantScoped) {
      unscopedQueries.push(where);
      return opts.victimRowsForUnscopedQuery ?? [VICTIM_ROWS.patient];
    }
    return scopedResults.shift() ?? [];
  }

  const select = vi.fn(() => {
    let rows: unknown[] = [];
    const terminal = {
      limit: vi.fn(async () => rows),
      for: vi.fn(async () => rows),
      offset: vi.fn(async () => rows),
      then: (
        res: (v: unknown[]) => unknown,
        rej?: (e: unknown) => unknown,
      ) => Promise.resolve(rows).then(res, rej),
    };
    const afterWhere = {
      ...terminal,
      orderBy: vi.fn(() => terminal),
      groupBy: vi.fn(() => terminal),
      limit: vi.fn(() => ({
        ...terminal,
        offset: vi.fn(async () => rows),
        for: vi.fn(async () => rows),
      })),
    };
    const builder = {
      from: vi.fn(() => builder),
      innerJoin: vi.fn(() => builder),
      leftJoin: vi.fn(() => builder),
      where: vi.fn((where: unknown) => {
        rows = resolve(where);
        return afterWhere;
      }),
      orderBy: vi.fn(() => terminal),
      limit: vi.fn(async () => rows),
    };
    return builder;
  });

  const findFirst = vi.fn(async (args: { where?: unknown }) => {
    const rows = resolve(args?.where);
    return rows[0] ?? null;
  });
  const findMany = vi.fn(async (args: { where?: unknown }) =>
    resolve(args?.where),
  );

  const insertValues = vi.fn(() => ({
    returning: vi.fn(async () => []),
    onConflictDoNothing: vi.fn(() => ({ returning: vi.fn(async () => []) })),
  }));
  const insert = vi.fn(() => ({ values: insertValues }));
  const updateWhere = vi.fn((where: unknown) => {
    observedPredicates.push(where);
    if (!predicateBinds(where, opts.callerPracticeId)) unscopedQueries.push(where);
    return {
      returning: vi.fn(async () => []),
      then: (res: (v: unknown[]) => unknown) => Promise.resolve([]).then(res),
    };
  });
  const updateSet = vi.fn(() => ({ where: updateWhere }));
  const update = vi.fn(() => ({ set: updateSet }));

  const db: Record<string, unknown> = {
    select,
    insert,
    update,
    execute: vi.fn(async () => []),
    query: {
      ekasaReceipts: { findFirst, findMany },
      ekasaConfig: { findFirst, findMany },
      practices: { findFirst, findMany },
      patients: { findFirst, findMany },
      vaccinationRecords: { findFirst, findMany },
    },
  };
  db.transaction = async (fn: (tx: unknown) => unknown) => fn(db);
  return { db, insert, insertValues, update, updateSet, observedPredicates, unscopedQueries };
}

function callerFor(
  router: { createCaller: (ctx: never) => unknown },
  db: Record<string, unknown>,
  role = "veterinarian",
) {
  return router.createCaller({
    db,
    session: {
      user: {
        id: USER_A,
        email: "attacker@clinic-a.test",
        name: "Dr. Attacker",
        role,
        practiceId: CLINIC_A,
      },
    },
  } as never) as never;
}

beforeEach(() => {
  process.env.HOSTED_BILLING_ENABLED = "";
  process.env.NEXTAUTH_SECRET = "test-secret-not-blank";
  mocks.readPrimaryObject.mockResolvedValue({
    status: "available",
    body: Buffer.from("VICTIM BYTES"),
    contentType: "image/jpeg",
  });
});

afterEach(() => {
  vi.clearAllMocks();
  tenantDb.current = null;
});

// ---------------------------------------------------------------------------
// a) Horizontal cross-tenant reads
// ---------------------------------------------------------------------------
describe("a) horizontal cross-tenant data access", () => {
  it("Clinic A cannot read Clinic B's voice dictation (transcript) by id", async () => {
    const { db, unscopedQueries } = createTenantDb({
      callerPracticeId: CLINIC_A,
      victimRowsForUnscopedQuery: [VICTIM_ROWS.dictation],
    });
    const voice = callerFor(voiceRouter, db) as ReturnType<
      typeof voiceRouter.createCaller
    >;

    await expect(voice.get({ id: DICTATION_B })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(unscopedQueries).toHaveLength(0);
  });

  it("Clinic A cannot list Clinic B's dictations by patient id", async () => {
    const { db, unscopedQueries } = createTenantDb({
      callerPracticeId: CLINIC_A,
      victimRowsForUnscopedQuery: [VICTIM_ROWS.dictation],
    });
    const voice = callerFor(voiceRouter, db) as ReturnType<
      typeof voiceRouter.createCaller
    >;

    await expect(voice.listByPatient({ patientId: PATIENT_B })).resolves.toEqual(
      [],
    );
    expect(unscopedQueries).toHaveLength(0);
  });

  it("Clinic A cannot read Clinic B's AI imaging analysis", async () => {
    const { db, unscopedQueries } = createTenantDb({
      callerPracticeId: CLINIC_A,
      victimRowsForUnscopedQuery: [VICTIM_ROWS.analysis],
    });
    const imaging = callerFor(imagingRouter, db) as ReturnType<
      typeof imagingRouter.createCaller
    >;

    await expect(imaging.get({ id: ANALYSIS_B })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(
      imaging.listByPatient({ patientId: PATIENT_B }),
    ).resolves.toEqual([]);
    expect(unscopedQueries).toHaveLength(0);
  });

  it("Clinic A cannot read or print Clinic B's e-Kasa receipts", async () => {
    const { db, unscopedQueries } = createTenantDb({
      callerPracticeId: CLINIC_A,
      victimRowsForUnscopedQuery: [VICTIM_ROWS.receipt],
    });
    const ekasa = callerFor(ekasaRouter, db) as ReturnType<
      typeof ekasaRouter.createCaller
    >;

    await expect(ekasa.getReceipts({ limit: 50, offset: 0 })).resolves.toEqual(
      [],
    );
    await expect(
      ekasa.getReceiptForPayment({ invoiceId: RECEIPT_B }),
    ).resolves.toBeNull();
    await expect(
      ekasa.printReceipt({ receiptId: RECEIPT_B }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(unscopedQueries).toHaveLength(0);
  });

  it("Clinic A cannot retry-fiscalize Clinic B's receipt (write IDOR)", async () => {
    const { db, update, unscopedQueries } = createTenantDb({
      callerPracticeId: CLINIC_A,
      victimRowsForUnscopedQuery: [VICTIM_ROWS.receipt],
    });
    const ekasa = callerFor(ekasaRouter, db, "admin") as ReturnType<
      typeof ekasaRouter.createCaller
    >;

    await expect(
      ekasa.retryReceipt({ receiptId: RECEIPT_B }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(update).not.toHaveBeenCalled();
    expect(unscopedQueries).toHaveLength(0);
  });

  it("Clinic A cannot file a statutory rabies (RVPS) notification against Clinic B's vaccination record", async () => {
    const { db, insert, unscopedQueries } = createTenantDb({
      callerPracticeId: CLINIC_A,
      victimRowsForUnscopedQuery: [
        { id: VAX_B, practiceId: CLINIC_B, patientId: PATIENT_B, deletedAt: null },
      ],
    });
    const statutory = callerFor(statutoryRouter, db) as ReturnType<
      typeof statutoryRouter.createCaller
    >;

    await expect(
      statutory.recordRabiesNotification({
        vaccinationRecordId: VAX_B,
        rvpsOfficeName: "RVPS Rimavská Sobota",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(insert).not.toHaveBeenCalled();
    expect(unscopedQueries).toHaveLength(0);
  });

  it("Clinic A cannot attach a discharge report to Clinic B's patient", async () => {
    const { db, insert, unscopedQueries } = createTenantDb({
      callerPracticeId: CLINIC_A,
      victimRowsForUnscopedQuery: [VICTIM_ROWS.patient],
    });
    const discharge = callerFor(dischargeRouter, db) as ReturnType<
      typeof dischargeRouter.createCaller
    >;

    await expect(
      discharge.save({
        patientId: PATIENT_B,
        petName: "Victim Rex",
        diagnosis: "Dx",
        reportText: "text",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      discharge.listByPatient({ patientId: PATIENT_B }),
    ).resolves.toEqual([]);
    expect(insert).not.toHaveBeenCalled();
    expect(unscopedQueries).toHaveLength(0);
  });

  it("Clinic A cannot voice-dictate onto Clinic B's patient", async () => {
    const { db, insert, unscopedQueries } = createTenantDb({
      callerPracticeId: CLINIC_A,
      victimRowsForUnscopedQuery: [VICTIM_ROWS.patient],
    });
    const voice = callerFor(voiceRouter, db) as ReturnType<
      typeof voiceRouter.createCaller
    >;

    await expect(
      voice.start({
        patientId: PATIENT_B,
        audioFileKey: `${CLINIC_B}/voice/x.webm`,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(insert).not.toHaveBeenCalled();
    expect(unscopedQueries).toHaveLength(0);
  });

  it("every extension router binds ctx.practiceId in each DB read/write", () => {
    const dir = fileURLToPath(new URL("../routers/extensions/", import.meta.url));
    const files = [
      "voice.ts",
      "imaging.ts",
      "ekasa.ts",
      "statutory.ts",
      "discharge.ts",
      "lab-import.ts",
      "crsz.ts",
      "accounting.ts",
      "support.ts",
      "v2-import.ts",
      "marketing.ts",
    ];
    for (const file of files) {
      const src = readFileSync(`${dir}${file}`, "utf8");
      const touchesDb = /\.from\(|\.insert\(|\.update\(|findFirst|findMany/.test(src);
      if (!touchesDb) continue;
      expect(src, file).toMatch(/ctx\.practiceId|practiceId/);
      // No extension router may open a system (RLS-bypass) context.
      expect(src, file).not.toMatch(/withSystem\(/);
      expect(src, file).not.toMatch(/app\.rls_bypass/);
    }
  });
});

// ---------------------------------------------------------------------------
// b) IDOR on medical imaging / audio object keys
// ---------------------------------------------------------------------------
describe("b) direct-object-reference attacks on imaging & audio storage keys", () => {
  const filesParams = (key: string) => ({
    params: Promise.resolve({ path: key.split("/") }),
  });
  const req = (key: string) =>
    new Request(`https://openvpm.test/api/files/${key}`) as never;

  it("a Clinic A session is 403'd when fetching a Clinic B patient photo by exact key", async () => {
    const { db } = createTenantDb({ callerPracticeId: CLINIC_A });
    tenantDb.current = db;
    mocks.getServerSession.mockResolvedValue({
      user: { id: USER_A, practiceId: CLINIC_A },
    });

    const res = await filesGET(req(FILE_KEY_B), filesParams(FILE_KEY_B));

    expect(res.status).toBe(403);
    expect(mocks.readPrimaryObject).not.toHaveBeenCalled();
    expect(mocks.readReplicaObject).not.toHaveBeenCalled();
  });

  it("an unauthenticated request is 403'd for any non-branding key", async () => {
    const { db } = createTenantDb({ callerPracticeId: CLINIC_A });
    tenantDb.current = db;
    mocks.getServerSession.mockResolvedValue(null);

    for (const category of ["patient-photos", "documents", "lab-results", "consents"]) {
      const key = `${CLINIC_B}/${category}/${FILE_B}`;
      const res = await filesGET(req(key), filesParams(key));
      expect(res.status, category).toBe(403);
    }
    expect(mocks.readPrimaryObject).not.toHaveBeenCalled();
  });

  it("path traversal and malformed keys never reach the object store", async () => {
    const { db } = createTenantDb({ callerPracticeId: CLINIC_A });
    tenantDb.current = db;
    mocks.getServerSession.mockResolvedValue({
      user: { id: USER_A, practiceId: CLINIC_A },
    });

    const attempts: string[][] = [
      [CLINIC_A, "patient-photos", "..", FILE_B],
      [CLINIC_A, "patient-photos", `..%2F${CLINIC_B}%2Fphoto.jpg`],
      [CLINIC_A, "patient-photos", `${CLINIC_B}%2F${FILE_B}`],
      [CLINIC_A, "not-a-category", FILE_B],
      [CLINIC_A, "patient-photos"],
      [CLINIC_A, "patient-photos", "%E0%A4%A"],
    ];
    for (const path of attempts) {
      const res = await filesGET(
        new Request("https://openvpm.test/api/files/x") as never,
        { params: Promise.resolve({ path }) },
      );
      expect(res.status, path.join("/")).toBe(404);
    }
    expect(mocks.readPrimaryObject).not.toHaveBeenCalled();
  });

  it("a Clinic A session whose user row was removed cannot use its own tenant path either", async () => {
    // User deactivated after login: the users/practices join returns nothing.
    const { db } = createTenantDb({
      callerPracticeId: CLINIC_A,
      scopedResults: [[]],
    });
    tenantDb.current = db;
    mocks.getServerSession.mockResolvedValue({
      user: { id: USER_A, practiceId: CLINIC_A },
    });
    const key = `${CLINIC_A}/patient-photos/${FILE_B}`;

    const res = await filesGET(req(key), filesParams(key));

    expect(res.status).toBe(403);
    expect(mocks.readPrimaryObject).not.toHaveBeenCalled();
  });

  it("Clinic A cannot stream Clinic B's dictation audio via the tRPC audio getter", async () => {
    const { db, unscopedQueries } = createTenantDb({
      callerPracticeId: CLINIC_A,
      victimRowsForUnscopedQuery: [VICTIM_ROWS.dictation],
    });
    const voice = callerFor(voiceRouter, db) as ReturnType<
      typeof voiceRouter.createCaller
    >;

    await expect(
      voice.getAudio({ dictationId: DICTATION_B }),
    ).resolves.toBeNull();
    expect(mocks.readPrimaryObject).not.toHaveBeenCalled();
    expect(unscopedQueries).toHaveLength(0);
  });

  it("Clinic A cannot run AI analysis on Clinic B's file id", async () => {
    const { db, insert, unscopedQueries } = createTenantDb({
      callerPracticeId: CLINIC_A,
      victimRowsForUnscopedQuery: [
        { id: FILE_B, fileKey: FILE_KEY_B, mimeType: "image/jpeg", fileName: "x.jpg" },
      ],
    });
    const imaging = callerFor(imagingRouter, db) as ReturnType<
      typeof imagingRouter.createCaller
    >;

    await expect(
      imaging.analyze({ fileId: FILE_B, patientId: PATIENT_B, imageType: "xray" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(insert).not.toHaveBeenCalled();
    expect(mocks.readPrimaryObject).not.toHaveBeenCalled();
    expect(mocks.generateText).not.toHaveBeenCalled();
    expect(unscopedQueries).toHaveLength(0);
  });

  it("the files proxy verifies the session practice against the key prefix in source", () => {
    const src = readFileSync(
      fileURLToPath(
        new URL("../../app/api/files/[...path]/route.ts", import.meta.url),
      ),
      "utf8",
    );
    expect(src).toContain("session.user.practiceId !== practiceId");
    expect(src).toContain("eq(files.practiceId, practiceId)");
    expect(src).toContain("eq(files.fileKey, key)");
    expect(src).toContain("isAllowedUploadCategory(category)");
    // The public exception is branding only.
    expect(src.match(/category === "branding"/g)?.length ?? 0).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// c) Cross-practice token reuse on capability URLs
// ---------------------------------------------------------------------------
describe("c) cross-practice capability token reuse", () => {
  const signParams = (token: string) => ({
    params: Promise.resolve({ token }),
  });

  it("/api/sign/[token]: a token whose practice was deleted or is in recovery hold is a generic 404", async () => {
    // lookupConsent inner-joins live practices; a deleted / held practice
    // yields no row regardless of the token being otherwise valid.
    const { db } = createTenantDb({
      callerPracticeId: "no-tenant-context",
      victimRowsForUnscopedQuery: [],
    });
    tenantDb.current = db;
    const token = generateCaptureToken();

    const get = await signGET(
      new Request(`https://openvpm.test/api/sign/${token}`) as never,
      signParams(token),
    );
    expect(get.status).toBe(404);

    const post = await signPOST(
      new Request(`https://openvpm.test/api/sign/${token}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          signerName: "Attacker",
          signatureDataUrl: "data:image/png;base64,AAAA",
          signerAuthorityAccepted: true,
        }),
      }) as never,
      signParams(token),
    );
    expect(post.status).toBe(404);
    expect(mocks.readPrimaryObject).not.toHaveBeenCalled();
  });

  it("/api/sign/[token]: capability lookup is keyed on the hashed token AND practice liveness, never on caller identity", () => {
    const src = readFileSync(
      fileURLToPath(new URL("../../app/api/sign/[token]/route.ts", import.meta.url)),
      "utf8",
    );
    const lookup = src.slice(
      src.indexOf("async function lookupConsent"),
      src.indexOf("function billingBlocked"),
    );
    expect(lookup).toContain("eq(consentRequests.tokenHash, hashConsentToken(token))");
    expect(lookup).toContain("eq(practices.id, consentRequests.practiceId)");
    expect(lookup).toContain("eq(practices.recoveryHold, false)");
    expect(lookup).toContain("isNull(practices.deletedAt)");
    expect(lookup).toContain("eq(patients.practiceId, consentRequests.practiceId)");
    // A session cookie must never widen a capability URL.
    expect(src).not.toContain("getServerSession");
    // Every finalization path re-enters the *token's* tenant, never a caller-supplied one.
    expect(src).toMatch(/withTenant\(db, signing\.practiceId/);
    expect(src).not.toMatch(/withTenant\(db,\s*(request|body|input)\./);
  });

  it("/api/sign/[token]: a signed-PDF receipt token is bound to the consent's practice and file", () => {
    const src = readFileSync(
      fileURLToPath(new URL("../../app/api/sign/[token]/route.ts", import.meta.url)),
      "utf8",
    );
    const receipt = src.slice(src.indexOf("tx.insert(consentReceiptCapabilities)"));
    expect(receipt).toContain("practiceId: signing.practiceId");
    expect(receipt).toContain("consentRequestId: signing.id");
    expect(receipt).toContain("fileId: reservation.id");
    expect(receipt).toContain("tokenHash: hashConsentReceiptToken(receiptToken)");
  });

  it("portal session: a Clinic B session token resolves only to Clinic B's client; the tenant is never caller-controlled", async () => {
    const rawToken = "f".repeat(64);
    const victimSessionRow = {
      sessionId: SESSION_B,
      lastSeenAt: new Date(),
      clientId: CLIENT_B,
      practiceId: CLINIC_B,
      firstName: "Victim",
      lastName: "Owner",
      email: "owner@clinic-b.test",
      phone: null,
    };
    // Portal resolution runs under the system context (there is no tenant
    // yet), so we assert the predicate structure directly.
    const observed: unknown[] = [];
    const db: Record<string, unknown> = {
      select: () => {
        const b: Record<string, unknown> = {};
        b.from = () => b;
        b.innerJoin = () => b;
        b.where = (w: unknown) => {
          observed.push(w);
          return { limit: async () => [victimSessionRow] };
        };
        return b;
      },
      update: () => ({ set: () => ({ where: async () => undefined }) }),
    };

    const resolved = await resolvePortalSession(db as never, rawToken);

    expect(resolved?.client.practiceId).toBe(CLINIC_B);
    expect(resolved?.client.id).toBe(CLIENT_B);
    // The lookup binds the *hash* of the token — the raw credential never
    // reaches the database — and nothing else identifies the tenant.
    expect(predicateBinds(observed[0], hashPortalSessionToken(rawToken))).toBe(true);
    expect(predicateBinds(observed[0], rawToken)).toBe(false);
    expect(predicateBinds(observed[0], CLINIC_A)).toBe(false);
  });

  it("portal session: malformed, short, or non-hex tokens are rejected before any DB lookup", async () => {
    const select = vi.fn();
    const db = { select } as never;
    for (const bad of [
      null,
      "",
      "short",
      "g".repeat(64),
      "f".repeat(63),
      "f".repeat(65),
      `${"f".repeat(60)}' OR 1=1--`,
    ]) {
      await expect(resolvePortalSession(db, bad as never)).resolves.toBeNull();
    }
    expect(select).not.toHaveBeenCalled();
  });

  it("portal router: session client and practice are re-verified against live rows on every read", () => {
    const src = readFileSync(
      fileURLToPath(new URL("../routers/portal.ts", import.meta.url)),
      "utf8",
    );
    const resolver = src.slice(
      src.indexOf("async function getClientForPortalSession"),
      src.indexOf("async function practiceTimeZone"),
    );
    expect(resolver).toContain("eq(clients.id, sessionClient.id)");
    expect(resolver).toContain("eq(clients.practiceId, sessionClient.practiceId)");
    expect(resolver).toContain("where(activePracticeWhere(sessionClient.practiceId))");
    // Pet detail reads are scoped to the *session's* client and practice, so
    // a Clinic B session cannot enumerate Clinic A patient ids.
    const petDetail = src.slice(src.indexOf("getPetDetail: portalProcedure"));
    expect(petDetail).toContain("eq(patients.clientId, client.id)");
    expect(petDetail).toContain("eq(patients.practiceId, client.practiceId)");
  });

  it("consent capability classes are domain-separated so a view token cannot be replayed as a receipt or treatment-plan token", () => {
    const consentTokens = readFileSync(
      fileURLToPath(new URL("../../lib/consult/tokens.ts", import.meta.url)),
      "utf8",
    );
    expect(consentTokens).toContain('"openvpm:consent-receipt:v1:"');
    expect(consentTokens).toContain('"openvpm:treatment-plan-consent:v1:"');
    const raw = generateCaptureToken();
    expect(hashConsentReceiptToken(raw)).not.toBe(hashConsentToken(raw));
    // A treatment-plan consent token is derived one-way from the plan bearer
    // token: holding the derived signing capability never yields the plan
    // token, and the derivation is namespaced so it cannot collide with a
    // freshly minted capture token of another class.
    const derived = deriveTreatmentPlanConsentToken(raw);
    expect(derived).not.toBe(raw);
    expect(derived).not.toBe(hashConsentToken(raw));
    expect(derived).not.toBe(hashConsentReceiptToken(raw));
  });
});
