import { randomUUID } from "node:crypto";
import postgres from "postgres";

type SqlClient = ReturnType<typeof postgres>;

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function appRoleUrl(ownerUrl: string): string {
  const configured = process.env.OPENPIMS_APP_DATABASE_URL?.trim();
  if (configured) return configured;

  const url = new URL(ownerUrl);
  url.username = "openpims_app";
  url.password = process.env.OPENPIMS_APP_DB_PASSWORD?.trim() || "openpims_app";
  return url.toString();
}

async function expectRejected(
  label: string,
  operation: () => Promise<unknown>,
  expectedMessage: string,
): Promise<void> {
  try {
    await operation();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes(expectedMessage)) {
      throw new Error(`${label} failed for an unexpected reason: ${message}`);
    }
    return;
  }
  throw new Error(`${label} unexpectedly succeeded`);
}

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const ownerUrl = requiredEnv("DATABASE_URL");
const owner: SqlClient = postgres(ownerUrl, { max: 1 });
const app: SqlClient = postgres(appRoleUrl(ownerUrl), { max: 2 });
const ids = {
  practiceA: randomUUID(),
  practiceB: randomUUID(),
  clientA: randomUUID(),
  clientB: randomUUID(),
  patientA: randomUUID(),
  patientB: randomUUID(),
  appointmentA: randomUUID(),
  appointmentB: randomUUID(),
};

async function withPractice<T>(
  sql: SqlClient,
  practiceId: string,
  operation: (tx: SqlClient) => Promise<T>,
): Promise<T> {
  return sql.begin(async (tx) => {
    const transaction = tx as unknown as SqlClient;
    await transaction`select set_config('app.current_practice_id', ${practiceId}, true)`;
    return operation(transaction);
  }) as Promise<T>;
}

try {
  await owner`insert into practices (id, name) values
    (${ids.practiceA}, 'Data Classification Practice A'),
    (${ids.practiceB}, 'Data Classification Practice B')`;

  await owner`insert into clients
    (id, practice_id, first_name, last_name)
    values
    (${ids.clientA}, ${ids.practiceA}, 'Classification', 'Owner A'),
    (${ids.clientB}, ${ids.practiceB}, 'Classification', 'Owner B')`;

  await owner`insert into patients
    (id, practice_id, client_id, name, species)
    values
    (${ids.patientA}, ${ids.practiceA}, ${ids.clientA}, 'Patient A', 'canine'),
    (${ids.patientB}, ${ids.practiceB}, ${ids.clientB}, 'Patient B', 'feline')`;

  await owner`insert into appointments
    (id, practice_id, start_time, end_time)
    values
    (${ids.appointmentA}, ${ids.practiceA}, now(), now() + interval '30 minutes'),
    (${ids.appointmentB}, ${ids.practiceB}, now(), now() + interval '30 minutes')`;

  const defaults = await owner`
    select
      c.data_sensitivity_level as client_level,
      p.data_sensitivity_level as patient_level,
      a.data_sensitivity_level as appointment_level
    from clients c
    join patients p on p.client_id = c.id
    join appointments a on a.practice_id = c.practice_id
    where c.id = ${ids.clientA}
      and p.id = ${ids.patientA}
      and a.id = ${ids.appointmentA}`;
  check(defaults.length === 1, "classification fixtures were not created");
  check(defaults[0].client_level === "CONFIDENTIAL", "owner default must be CONFIDENTIAL");
  check(
    defaults[0].patient_level === "STRICTLY_CONFIDENTIAL",
    "patient default must be STRICTLY_CONFIDENTIAL",
  );
  check(
    defaults[0].appointment_level === "STRICTLY_CONFIDENTIAL",
    "encounter default must be STRICTLY_CONFIDENTIAL",
  );

  const visibleFromA = await withPractice(app, ids.practiceA, async (tx) => {
    const [clients, patients, appointments] = await Promise.all([
      tx`select id, data_sensitivity_level from clients order by id`,
      tx`select id, data_sensitivity_level from patients order by id`,
      tx`select id, data_sensitivity_level from appointments order by id`,
    ]);
    return { clients, patients, appointments };
  });

  check(visibleFromA.clients.length === 1, "RLS must hide the other practice's owner");
  check(visibleFromA.patients.length === 1, "RLS must hide the other practice's patient");
  check(
    visibleFromA.appointments.length === 1,
    "RLS must hide the other practice's encounter header",
  );
  check(visibleFromA.clients[0].id === ids.clientA, "wrong owner crossed the tenant boundary");
  check(visibleFromA.patients[0].id === ids.patientA, "wrong patient crossed the tenant boundary");
  check(
    visibleFromA.appointments[0].id === ids.appointmentA,
    "wrong encounter crossed the tenant boundary",
  );

  await expectRejected(
    "hosted app downgrade",
    () =>
      withPractice(app, ids.practiceA, async (tx) => {
        await tx`update clients
          set data_sensitivity_level = 'PUBLIC'
          where id = ${ids.clientA}`;
      }),
    "Data sensitivity downgrade requires owner-controlled maintenance",
  );

  await withPractice(app, ids.practiceA, async (tx) => {
    await tx`update clients
      set data_sensitivity_level = 'STRICTLY_CONFIDENTIAL'
      where id = ${ids.clientA}`;
  });

  const [tightened] = await owner`
    select data_sensitivity_level
    from clients
    where id = ${ids.clientA}`;
  check(
    tightened?.data_sensitivity_level === "STRICTLY_CONFIDENTIAL",
    "hosted app must be able to tighten classification",
  );

  console.log(
    "Data classification PostgreSQL contract passed: defaults, tenant RLS visibility, downgrade protection, and tightening verified.",
  );
} finally {
  await owner`delete from appointments where id in (${ids.appointmentA}, ${ids.appointmentB})`;
  await owner`delete from patients where id in (${ids.patientA}, ${ids.patientB})`;
  await owner`delete from clients where id in (${ids.clientA}, ${ids.clientB})`;
  await owner`delete from practices where id in (${ids.practiceA}, ${ids.practiceB})`;
  await app.end();
  await owner.end();
}
