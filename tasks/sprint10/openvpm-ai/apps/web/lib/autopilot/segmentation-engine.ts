/**
 * Veterinary CRM Segmentation Engine (ext_crm_segments).
 *
 * Materializes and recomputes the 12 canonical veterinary patient/client
 * segments used by the Marketing Autopilot:
 *
 *   1. puppy_kitten          — dogs & cats younger than 1 year
 *   2. senior_pet            — dogs & cats aged 7+ years
 *   3. chronic_patient       — long-term medication / repeated clinical visits
 *   4. vip_clients           — high-value spenders (>= 1 500 EUR / 12 months)
 *   5. churn_risk            — previously active, no visit in 6–12 months
 *   6. unvaccinated_overdue  — latest vaccination record past its due date
 *   7. wellness_enrolled     — active wellness plan enrollment
 *   8. dental_attention      — dental chart pathology in the last 18 months
 *   9. post_op_recovery      — surgery_completed event in the last 30 days
 *  10. frequent_flyer        — 6+ completed visits in the last 12 months
 *  11. weight_management     — elevated body-condition score in the last year
 *  12. lapsed_inactive       — no completed visit in 12+ months, nothing booked
 *
 * Design notes:
 * - Evaluation is a SINGLE parameterized UNION ALL query (12 branches over
 *   shared CTEs). practiceId is the only bound value — segment keys are
 *   compile-time constants, never user input.
 * - SKILL.md §3 Unconditional Sympathy Gate: deceased patients are excluded
 *   from every signal CTE and clients without at least one non-deceased
 *   patient are ineligible for ALL segments, so no segment can ever feed
 *   automated marketing for a deceased patient.
 * - Write path is a deterministic diff: computed snapshot vs. live
 *   memberships. Manual staff exclusions (is_manually_excluded) are never
 *   resurrected; stale rows are soft-deleted, new rows soft-inserted, so the
 *   (practice_id, segment_id, client_id) partial-unique index stays valid.
 */

import { sql, and, eq, isNull, inArray } from "drizzle-orm";
import type { Database } from "@openpims/db/client";
import {
  extCrmSegments,
  extCrmSegmentMemberships,
  type CrmSegmentCondition,
} from "@openpims/db";

// ---------------------------------------------------------------------------
// Canonical segment catalog
// ---------------------------------------------------------------------------

export interface CrmSegmentDefinition {
  segmentKey: string;
  /** Default (Slovak) display name persisted in ext_crm_segments.name. */
  name: string;
  /** Default (Slovak) description persisted in ext_crm_segments.description. */
  description: string;
  /** Human-readable, INERT rendering of the rule for staff audit. Never executed. */
  conditionSqlPreview: string;
  /** Machine condition shadow stored in condition_json for the audit trail. */
  condition: CrmSegmentCondition;
  sort: number;
}

export const VIP_MIN_SPEND_EUR = 1500;
export const FREQUENT_FLYER_MIN_VISITS = 6;
export const CHRONIC_MIN_PRESCRIPTIONS = 2;
export const CHRONIC_MIN_VISITS = 4;
export const SENIOR_MIN_AGE_YEARS = 7;
export const PUPPY_KITTEN_MAX_AGE_YEARS = 1;
export const POST_OP_WINDOW_DAYS = 30;
export const DENTAL_WINDOW_MONTHS = 18;
export const CHURN_RISK_MIN_DAYS = 180;
export const LAPSED_MIN_DAYS = 365;

export const CRM_SEGMENT_DEFINITIONS: readonly CrmSegmentDefinition[] = [
  {
    segmentKey: "puppy_kitten",
    name: "Šteniatka a mačiatka",
    description:
      "Klienti so psom alebo mačkou mladšou ako 1 rok. Vhodné pre puppy balíčky, prvé očkovanie a socializačné kampane.",
    conditionSqlPreview:
      "patients.species IN ('canine','feline') AND patients.dob >= current_date - interval '1 year'",
    condition: {
      species: ["canine", "feline"],
      maxAgeYears: PUPPY_KITTEN_MAX_AGE_YEARS,
    },
    sort: 10,
  },
  {
    segmentKey: "senior_pet",
    name: "Seniorski pacienti (7+ rokov)",
    description:
      "Klienti so psom alebo mačkou vo veku 7 a viac rokov. Geriatrické skríningy, senior panely a preventívne prehliadky.",
    conditionSqlPreview:
      "patients.species IN ('canine','feline') AND patients.dob <= current_date - interval '7 years'",
    condition: {
      species: ["canine", "feline"],
      minAgeYears: SENIOR_MIN_AGE_YEARS,
    },
    sort: 20,
  },
  {
    segmentKey: "chronic_patient",
    name: "Chronickí pacienti",
    description:
      "Pacienti s ≥2 receptami za posledných 6 mesiacov alebo ≥4 dokončenými návštevami za 12 mesiacov. Manažment dlhodobej liečby a kontroly.",
    conditionSqlPreview:
      "(prescriptions_180d >= 2) OR (completed_visits_365d >= 4)",
    condition: { activeWithinDays: 365 },
    sort: 30,
  },
  {
    segmentKey: "vip_clients",
    name: "VIP klienti",
    description:
      "Klienti s úhradami ≥ 1 500 € za posledných 12 mesiacov. Vernostný program, prioritné rezervácie a prémiová starostlivosť.",
    conditionSqlPreview:
      "sum(invoices.paid_amount last 365d) >= 1500 EUR",
    condition: {},
    sort: 40,
  },
  {
    segmentKey: "churn_risk",
    name: "Riziko odchodu",
    description:
      "Predtým aktívni klienti (≥2 návštevy) bez návštevy 6–12 mesiacov. Win-back kampane skôr, než prejdú k inej klinike.",
    conditionSqlPreview:
      "visit_count >= 2 AND last_visit BETWEEN 180d AND 365d ago",
    condition: { inactiveDays: CHURN_RISK_MIN_DAYS },
    sort: 50,
  },
  {
    segmentKey: "unvaccinated_overdue",
    name: "Po termíne očkovania",
    description:
      "Pacienti, ktorých posledný vakcinačný záznam má prekročený dátum ďalšej dávky. Pripomienky očkovania podľa zmluvného právneho základu.",
    conditionSqlPreview:
      "latest_vaccination.next_due_date < current_date",
    condition: {},
    sort: 60,
  },
  {
    segmentKey: "wellness_enrolled",
    name: "Členovia wellness programu",
    description:
      "Klienti s aktívnym wellness plánom. Preventívna starostlivosť, pripomienky čerpania benefítov a fakturácie.",
    conditionSqlPreview: "wellness_enrollments.status = 'active'",
    condition: {},
    sort: 70,
  },
  {
    segmentKey: "dental_attention",
    name: "Vyžadujú dentálnu starostlivosť",
    description:
      "Pacienti s patologickým nálezom v zubnej karte (kaz, zlomenina, vratkosť…) za posledných 18 mesiacov. Dentálne recall kampane.",
    conditionSqlPreview:
      "dental_charts.condition NOT IN ('HEALTHY','MISSING','CROWNED') within 18 months",
    condition: {},
    sort: 80,
  },
  {
    segmentKey: "post_op_recovery",
    name: "Po operačnej rekonvalescencii",
    description:
      "Pacienti so zaznamenanou operáciou (surgery_completed) za posledných 30 dní. Post-op kontroly 24 h / 3. deň / 10. deň.",
    conditionSqlPreview:
      "ext_automation_events.event_type = 'surgery_completed' within 30 days",
    condition: {},
    sort: 90,
  },
  {
    segmentKey: "frequent_flyer",
    name: "Častí návštevníci",
    description:
      "Klienti s ≥6 dokončenými návštevami za posledných 12 mesiacov. Loajalita, prednostné termíny a referenčné programy.",
    conditionSqlPreview: "completed_visits_365d >= 6",
    condition: { activeWithinDays: 365 },
    sort: 100,
  },
  {
    segmentKey: "weight_management",
    name: "Redukcia hmotnosti",
    description:
      "Pacienti so zvýšeným telesným skóre kondície (BCS ≥7/9 alebo ≥4/5) za posledný rok. Diétne programy a kontrolné váženia.",
    conditionSqlPreview:
      "vital_signs.body_condition_score >= threshold within 12 months",
    condition: {},
    sort: 110,
  },
  {
    segmentKey: "lapsed_inactive",
    name: "Neaktívni 12+ mesiacov",
    description:
      "Klienti bez dokončenej návštevy viac ako 12 mesiacov a bez budúcej rezervácie. Reaktivačné (recall) kampane.",
    conditionSqlPreview:
      "last_completed_visit < now() - interval '365 days' AND no future appointment",
    condition: { inactiveDays: LAPSED_MIN_DAYS },
    sort: 120,
  },
] as const;

export const CRM_SEGMENT_KEYS = CRM_SEGMENT_DEFINITIONS.map(
  (d) => d.segmentKey,
) as readonly string[];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SegmentRecalculationResult {
  segmentKey: string;
  segmentId: string;
  name: string;
  memberCount: number;
  added: number;
  removed: number;
  preservedExclusions: number;
  lastRefreshedAt: Date;
}

export interface RecalculateReport {
  practiceId: string;
  recalculatedAt: Date;
  totalMembers: number;
  segments: SegmentRecalculationResult[];
}

type DbLike = Pick<Database, "select" | "insert" | "update" | "execute">;

// ---------------------------------------------------------------------------
// ensureCanonicalSegments — idempotent materialization of the 12 definitions
// ---------------------------------------------------------------------------

/**
 * Upserts the 12 canonical segments for the practice (is_system = true).
 * Existing rows keep staff edits to is_active; definition metadata refreshes.
 */
export async function ensureCanonicalSegments(
  db: DbLike,
  practiceId: string,
): Promise<(typeof extCrmSegments.$inferSelect)[]> {
  const now = new Date();
  for (const def of CRM_SEGMENT_DEFINITIONS) {
    await db
      .insert(extCrmSegments)
      .values({
        practiceId,
        segmentKey: def.segmentKey,
        name: def.name,
        description: def.description,
        isSystem: true,
        isActive: true,
        conditionJson: def.condition,
        conditionSql: def.conditionSqlPreview,
        refreshStrategy: "scheduled",
      })
      .onConflictDoNothing();
  }

  const existing = await db
    .select()
    .from(extCrmSegments)
    .where(
      and(
        eq(extCrmSegments.practiceId, practiceId),
        isNull(extCrmSegments.deletedAt),
        inArray(extCrmSegments.segmentKey, [...CRM_SEGMENT_KEYS]),
      ),
    );

  // Refresh definition metadata (name/description/condition) without touching
  // staff-controlled is_active or membership caches. Write only on drift so
  // that read-time calls (e.g. from crmSegments.list) stay cheap and do not
  // churn updated_at on every page load.
  const byKey = new Map(existing.map((s) => [s.segmentKey, s]));
  for (const def of CRM_SEGMENT_DEFINITIONS) {
    const row = byKey.get(def.segmentKey);
    if (!row) continue;
    const drifted =
      !row.isSystem ||
      row.name !== def.name ||
      row.description !== def.description ||
      (row.conditionSql ?? "") !== def.conditionSqlPreview ||
      JSON.stringify(row.conditionJson ?? {}) !== JSON.stringify(def.condition);
    if (!drifted) continue;
    await db
      .update(extCrmSegments)
      .set({
        name: def.name,
        description: def.description,
        isSystem: true,
        conditionJson: def.condition,
        conditionSql: def.conditionSqlPreview,
        updatedAt: now,
      })
      .where(
        and(
          eq(extCrmSegments.practiceId, practiceId),
          eq(extCrmSegments.segmentKey, def.segmentKey),
          isNull(extCrmSegments.deletedAt),
        ),
      );
  }

  return db
    .select()
    .from(extCrmSegments)
    .where(
      and(
        eq(extCrmSegments.practiceId, practiceId),
        isNull(extCrmSegments.deletedAt),
        inArray(extCrmSegments.segmentKey, [...CRM_SEGMENT_KEYS]),
      ),
    );
}

// ---------------------------------------------------------------------------
// Membership computation — single parameterized UNION ALL query
// ---------------------------------------------------------------------------

/**
 * Computes the full client × segment matrix for the practice.
 *
 * EVERY branch is practice-scoped, ignores soft-deleted rows, and passes the
 * unconditional SKILL.md §3 sympathy gate:
 *   - `deceased` patient rows never contribute a signal;
 *   - clients without at least one non-deceased patient are ineligible for
 *     all segments (`eligible_clients` CTE).
 *
 * @returns Map of segmentKey → Set of clientIds.
 */
export async function computeSegmentMemberships(
  db: DbLike,
  practiceId: string,
): Promise<Map<string, Set<string>>> {
  const result = await db.execute(sql`
    with eligible_clients as (
      -- Sympathy Gate base: only clients with at least one non-deceased pitient
      -- may ever appear in a marketing segment.
      select c.id
      from clients c
      where c.practice_id = ${practiceId}
        and c.deleted_at is null
        and exists (
          select 1
          from patients p
          where p.practice_id = ${practiceId}
            and p.client_id = c.id
            and p.deleted_at is null
            and p.status is distinct from 'deceased'
        )
    ),
    active_patients as (
      select p.id, p.client_id, p.species, p.dob
      from patients p
      join eligible_clients ec on ec.id = p.client_id
      where p.practice_id = ${practiceId}
        and p.deleted_at is null
        and p.status is distinct from 'deceased'
    ),
    completed_visits as (
      select a.client_id, a.patient_id, a.start_time
      from appointments a
      join eligible_clients ec on ec.id = a.client_id
      where a.practice_id = ${practiceId}
        and a.deleted_at is null
        and a.status = 'checked_out'
    ),
    visit_stats as (
      select
        client_id,
        count(*) as visit_count_total,
        count(*) filter (where start_time >= now() - interval '365 days') as visit_count_365d,
        max(start_time) as last_visit_at
      from completed_visits
      group by client_id
    ),
    latest_vaccination as (
      select distinct on (vr.patient_id)
        vr.patient_id,
        vr.next_due_date
      from vaccination_records vr
      where vr.practice_id = ${practiceId}
        and vr.deleted_at is null
      order by vr.patient_id, vr.administered_at desc, vr.created_at desc
    ),
    future_bookings as (
      select distinct a.client_id
      from appointments a
      where a.practice_id = ${practiceId}
        and a.deleted_at is null
        and a.status in ('scheduled', 'confirmed')
        and a.start_time > now()
    )
    select membership.segment_key as "segmentKey", membership.client_id as "clientId"
    from (
      -- 1. puppy_kitten: dogs & cats younger than 1 year
      select 'puppy_kitten' as segment_key, ap.client_id
      from active_patients ap
      where ap.species in ('canine', 'feline')
        and ap.dob is not null
        and ap.dob >= current_date - interval '1 year'
      group by ap.client_id
      union all
      -- 2. senior_pet: dogs & cats aged 7+
      select 'senior_pet' as segment_key, ap.client_id
      from active_patients ap
      where ap.species in ('canine', 'feline')
        and ap.dob is not null
        and ap.dob <= current_date - interval '7 years'
      group by ap.client_id
      union all
      -- 3. chronic_patient: long-term medication or repeated clinical visits
      select 'chronic_patient' as segment_key, ap.client_id
      from active_patients ap
      where (
        select count(*)
        from prescriptions rx
        where rx.practice_id = ${practiceId}
          and rx.patient_id = ap.id
          and rx.deleted_at is null
          and rx.created_at >= now() - interval '180 days'
      ) >= ${CHRONIC_MIN_PRESCRIPTIONS}
        or (
          select count(*)
          from appointments av
          where av.practice_id = ${practiceId}
            and av.patient_id = ap.id
            and av.deleted_at is null
            and av.status = 'checked_out'
            and av.start_time >= now() - interval '365 days'
        ) >= ${CHRONIC_MIN_VISITS}
      group by ap.client_id
      union all
      -- 4. vip_clients: >= 1 500 EUR paid over the trailing 12 months
      select 'vip_clients' as segment_key, i.client_id
      from invoices i
      join eligible_clients ec on ec.id = i.client_id
      where i.practice_id = ${practiceId}
        and i.deleted_at is null
        and i.is_estimate = false
        and i.status <> 'void'
        and i.created_at >= now() - interval '365 days'
      group by i.client_id
      having coalesce(sum(i.paid_amount), 0) >= ${VIP_MIN_SPEND_EUR}
      union all
      -- 5. churn_risk: previously active, silent for 6–12 months
      select 'churn_risk' as segment_key, vs.client_id
      from visit_stats vs
      where vs.visit_count_total >= 2
        and vs.last_visit_at < now() - interval '180 days'
        and vs.last_visit_at >= now() - interval '365 days'
      union all
      -- 6. unvaccinated_overdue: latest vaccination record past due
      select 'unvaccinated_overdue' as segment_key, ap.client_id
      from latest_vaccination lv
      join active_patients ap on ap.id = lv.patient_id
      where lv.next_due_date is not null
        and lv.next_due_date < current_date
      group by ap.client_id
      union all
      -- 7. wellness_enrolled: active wellness plan
      select 'wellness_enrolled' as segment_key, we.client_id
      from wellness_enrollments we
      join eligible_clients ec on ec.id = we.client_id
      where we.practice_id = ${practiceId}
        and we.deleted_at is null
        and we.status = 'active'
      group by we.client_id
      union all
      -- 8. dental_attention: pathological dental finding within 18 months
      select 'dental_attention' as segment_key, ap.client_id
      from active_patients ap
      where exists (
        select 1
        from dental_charts dc
        where dc.practice_id = ${practiceId}
          and dc.patient_id = ap.id
          and dc.deleted_at is null
          and dc.condition in ('DECAYED', 'FRACTURED', 'MOBILE', 'ABRADED', 'OTHER')
          and dc.charted_at >= current_date - interval '18 months'
      )
      group by ap.client_id
      union all
      -- 9. post_op_recovery: surgery_completed event within 30 days (living patients only)
      select 'post_op_recovery' as segment_key, e.client_id
      from ext_automation_events e
      join active_patients ap on ap.id = e.patient_id
      where e.practice_id = ${practiceId}
        and e.event_type = 'surgery_completed'
        and e.occurred_at >= now() - interval '30 days'
      group by e.client_id
      union all
      -- 10. frequent_flyer: 6+ completed visits within 12 months
      select 'frequent_flyer' as segment_key, vs.client_id
      from visit_stats vs
      where vs.visit_count_365d >= ${FREQUENT_FLYER_MIN_VISITS}
      union all
      -- 11. weight_management: elevated body-condition score within 12 months
      select 'weight_management' as segment_key, ap.client_id
      from active_patients ap
      where exists (
        select 1
        from vital_signs vs
        where vs.practice_id = ${practiceId}
          and vs.patient_id = ap.id
          and vs.deleted_at is null
          and vs.recorded_at >= now() - interval '365 days'
          and vs.body_condition_score is not null
          and (
            (vs.body_condition_scale = 5 and vs.body_condition_score >= 4)
            or (vs.body_condition_scale <> 5 and vs.body_condition_score >= 7)
          )
      )
      group by ap.client_id
      union all
      -- 12. lapsed_inactive: no completed visit for 12+ months, nothing booked
      select 'lapsed_inactive' as segment_key, vs.client_id
      from visit_stats vs
      where vs.last_visit_at < now() - interval '365 days'
        and not exists (
          select 1 from future_bookings fb where fb.client_id = vs.client_id
        )
    ) membership
    order by membership.segment_key, membership.client_id
  `);

  const rows = ((result as unknown as { rows?: { segmentKey?: string; clientId?: string }[] })
    .rows ?? []) as { segmentKey: string; clientId: string }[];

  const bySegment = new Map<string, Set<string>>();
  for (const def of CRM_SEGMENT_DEFINITIONS) {
    bySegment.set(def.segmentKey, new Set<string>());
  }
  for (const row of rows) {
    if (!row.segmentKey || !row.clientId) continue;
    let bucket = bySegment.get(row.segmentKey);
    if (!bucket) {
      bucket = new Set<string>();
      bySegment.set(row.segmentKey, bucket);
    }
    bucket.add(row.clientId);
  }
  return bySegment;
}

// ---------------------------------------------------------------------------
// Diff planning (pure, unit-testable)
// ---------------------------------------------------------------------------

export interface MembershipRowLike {
  id: string;
  clientId: string;
  isManuallyExcluded: boolean;
}

export interface MembershipPlan {
  /** membership row ids to soft-delete (computed set no longer includes them). */
  toRemove: string[];
  /** clientIds needing a fresh membership row insert. */
  toInsert: string[];
  /** clientIds manually excluded by staff — engine must never resurrect these. */
  manuallyExcluded: string[];
  /** visible member count after the recalculation. */
  visibleMemberCount: number;
}

/**
 * Pure diff between live membership rows and the freshly computed client set.
 *
 * Rules:
 * - staff exclusions win: they are never re-inserted nor soft-deleted, and
 *   they never count toward memberCountCache;
 * - rows no longer matching are soft-deleted (audit preserved);
 * - new matches are inserted exactly once.
 */
export function planMembershipChanges(
  liveRows: MembershipRowLike[],
  computedClientIds: ReadonlySet<string>,
): MembershipPlan {
  const toRemove: string[] = [];
  const toInsert: string[] = [];
  const manuallyExcluded: string[] = [];
  const liveRegular = new Set<string>();

  for (const row of liveRows) {
    if (row.isManuallyExcluded) {
      manuallyExcluded.push(row.clientId);
      continue;
    }
    liveRegular.add(row.clientId);
    if (!computedClientIds.has(row.clientId)) {
      toRemove.push(row.id);
    }
  }

  let visibleMemberCount = 0;
  for (const clientId of computedClientIds) {
    if (manuallyExcluded.includes(clientId)) continue;
    visibleMemberCount++;
    if (!liveRegular.has(clientId)) {
      toInsert.push(clientId);
    }
  }

  return { toRemove, toInsert, manuallyExcluded, visibleMemberCount };
}

// ---------------------------------------------------------------------------
// recalculateSegments — full recompute + write path
// ---------------------------------------------------------------------------

/**
 * Recomputes all 12 canonical segments for the practice and persists the
 * membership diff + denormalized counters.
 *
 * Callers should wrap this in ctx.db.transaction when they need atomic
 * per-run semantics; the write path is idempotent so re-runs converge.
 */
export async function recalculateSegments(
  db: DbLike,
  practiceId: string,
  options?: { onlySegmentKeys?: string[] },
): Promise<RecalculateReport> {
  const segments = await ensureCanonicalSegments(db, practiceId);
  const targetKeys = new Set(options?.onlySegmentKeys ?? CRM_SEGMENT_KEYS);
  const targets = segments.filter((s) => targetKeys.has(s.segmentKey));

  const computed = await computeSegmentMemberships(db, practiceId);
  const now = new Date();
  const results: SegmentRecalculationResult[] = [];
  let totalMembers = 0;

  for (const segment of targets) {
    const liveRows = await db
      .select({
        id: extCrmSegmentMemberships.id,
        clientId: extCrmSegmentMemberships.clientId,
        isManuallyExcluded: extCrmSegmentMemberships.isManuallyExcluded,
      })
      .from(extCrmSegmentMemberships)
      .where(
        and(
          eq(extCrmSegmentMemberships.practiceId, practiceId),
          eq(extCrmSegmentMemberships.segmentId, segment.id),
          isNull(extCrmSegmentMemberships.deletedAt),
        ),
      );

    const computedSet = computed.get(segment.segmentKey) ?? new Set<string>();
    const plan = planMembershipChanges(liveRows, computedSet);

    if (plan.toRemove.length > 0) {
      await db
        .update(extCrmSegmentMemberships)
        .set({ deletedAt: now, updatedAt: now })
        .where(
          and(
            eq(extCrmSegmentMemberships.practiceId, practiceId),
            eq(extCrmSegmentMemberships.segmentId, segment.id),
            inArray(extCrmSegmentMemberships.id, plan.toRemove),
          ),
        );
    }

    if (plan.toInsert.length > 0) {
      await db
        .insert(extCrmSegmentMemberships)
        .values(
          plan.toInsert.map((clientId) => ({
            practiceId,
            segmentId: segment.id,
            clientId,
            enrolledAt: now,
            enrollmentReason: `recalculateSegments ${now.toISOString().slice(0, 10)}`,
            segmentVersion: segment.version,
          })),
        )
        .onConflictDoNothing();
    }

    await db
      .update(extCrmSegments)
      .set({
        memberCountCache: plan.visibleMemberCount,
        lastRefreshedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(extCrmSegments.id, segment.id),
          eq(extCrmSegments.practiceId, practiceId),
        ),
      );

    results.push({
      segmentKey: segment.segmentKey,
      segmentId: segment.id,
      name: segment.name,
      memberCount: plan.visibleMemberCount,
      added: plan.toInsert.length,
      removed: plan.toRemove.length,
      preservedExclusions: plan.manuallyExcluded.length,
      lastRefreshedAt: now,
    });
    totalMembers += plan.visibleMemberCount;
  }

  return {
    practiceId,
    recalculatedAt: now,
    totalMembers,
    segments: results,
  };
}
