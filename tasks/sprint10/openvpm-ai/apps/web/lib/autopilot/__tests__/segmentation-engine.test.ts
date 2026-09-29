import { describe, expect, it } from "vitest";
import {
  CRM_SEGMENT_DEFINITIONS,
  CRM_SEGMENT_KEYS,
  planMembershipChanges,
  type MembershipRowLike,
} from "../segmentation-engine";

describe("CRM segmentation engine — canonical catalog", () => {
  it("defines exactly the 12 canonical veterinary segments", () => {
    expect(CRM_SEGMENT_DEFINITIONS).toHaveLength(12);
    expect(CRM_SEGMENT_KEYS).toEqual([
      "puppy_kitten",
      "senior_pet",
      "chronic_patient",
      "vip_clients",
      "churn_risk",
      "unvaccinated_overdue",
      "wellness_enrolled",
      "dental_attention",
      "post_op_recovery",
      "frequent_flyer",
      "weight_management",
      "lapsed_inactive",
    ]);
  });

  it("uses unique, machine-safe segment keys (db check format)", () => {
    const keys = CRM_SEGMENT_DEFINITIONS.map((d) => d.segmentKey);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) {
      // Mirrors ext_crm_segments_key_format_check.
      expect(key).toMatch(/^[a-z][a-z0-9_]{1,62}$/);
    }
  });

  it("ships fully localized (SK) names and descriptions", () => {
    for (const def of CRM_SEGMENT_DEFINITIONS) {
      expect(def.name.trim().length).toBeGreaterThan(2);
      expect(def.description.trim().length).toBeGreaterThan(20);
      expect(def.conditionSqlPreview.trim().length).toBeGreaterThan(5);
    }
  });
});

describe("planMembershipChanges (deterministic membership diff)", () => {
  const row = (id: string, clientId: string, excluded = false): MembershipRowLike => ({
    id,
    clientId,
    isManuallyExcluded: excluded,
  });

  it("inserts new matches, keeps existing ones, and soft-deletes stale rows", () => {
    const live = [row("m1", "client-a"), row("m2", "client-b")];
    const computed = new Set(["client-b", "client-c"]);

    const plan = planMembershipChanges(live, computed);

    expect(plan.toRemove).toEqual(["m1"]);
    expect(plan.toInsert).toEqual(["client-c"]);
    expect(plan.visibleMemberCount).toBe(2);
    expect(plan.manuallyExcluded).toEqual([]);
  });

  it("respects staff manual exclusions: never resurrects, never removes, never counts them", () => {
    const live = [row("m1", "client-a", true), row("m2", "client-b")];
    const computed = new Set(["client-a", "client-b"]);

    const plan = planMembershipChanges(live, computed);

    // client-a is computed but manually excluded: must NOT be re-inserted
    // and must NOT count towards the visible member count.
    expect(plan.toRemove).toEqual([]);
    expect(plan.toInsert).toEqual([]);
    expect(plan.manuallyExcluded).toEqual(["client-a"]);
    expect(plan.visibleMemberCount).toBe(1);
  });

  it("handles a full empty→populated materialization", () => {
    const plan = planMembershipChanges([], new Set(["c1", "c2", "c3"]));
    expect(plan.toRemove).toEqual([]);
    expect(plan.toInsert.sort()).toEqual(["c1", "c2", "c3"]);
    expect(plan.visibleMemberCount).toBe(3);
  });

  it("handles a full wipe-out when the segment no longer matches anyone", () => {
    const live = [row("m1", "c1"), row("m2", "c2", true)];
    const plan = planMembershipChanges(live, new Set());
    expect(plan.toRemove).toEqual(["m1"]);
    expect(plan.toInsert).toEqual([]);
    expect(plan.manuallyExcluded).toEqual(["c2"]);
    expect(plan.visibleMemberCount).toBe(0);
  });

  it("is idempotent under repeated recomputation", () => {
    const live = [row("m1", "c1"), row("m2", "c2", true)];
    const computed = new Set(["c1", "c2"]);
    const plan = planMembershipChanges(live, computed);
    expect(plan.toRemove).toEqual([]);
    expect(plan.toInsert).toEqual([]);
    expect(plan.visibleMemberCount).toBe(1);
  });
});
