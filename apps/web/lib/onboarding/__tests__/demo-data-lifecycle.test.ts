import { describe, expect, it } from "vitest";
import type { DemoDataIds } from "../defaults";
import {
  hasLiveDemoData,
  mergeDemoDataProvenance,
} from "../demo-data-lifecycle";

function demoIds(prefix: string): DemoDataIds {
  return {
    clientIds: [`${prefix}-client`],
    patientIds: [`${prefix}-patient`],
    appointmentIds: [`${prefix}-appointment`],
    soapNoteIds: [`${prefix}-soap`],
    vaccinationIds: [`${prefix}-vaccination`],
    problemIds: [`${prefix}-problem`],
    invoiceIds: [`${prefix}-invoice`],
    invoiceItemIds: [`${prefix}-invoice-item`],
    communicationIds: [`${prefix}-communication`],
    productIds: [`${prefix}-product`],
    marketingTvSlideIds: [`${prefix}-tv-slide`],
    marketingHandoutIds: [`${prefix}-handout`],
    marketingReviewIds: [`${prefix}-review`],
    marketingContentBatchIds: [`${prefix}-content-batch`],
    marketingContentItemIds: [`${prefix}-content-item`],
    marketingMediaConsentIds: [`${prefix}-media-consent`],
    marketingMediaAssetIds: [`${prefix}-media-asset`],
    marketingStaffTaskIds: [`${prefix}-staff-task`],
    marketingMessageTemplateIds: [`${prefix}-msg-template`],
    marketingMessageLogIds: [`${prefix}-msg-log`],
    marketingAutomationRuleIds: [`${prefix}-auto-rule`],
    marketingScriptIds: [`${prefix}-script`],
    marketingRecallScheduleIds: [`${prefix}-recall-schedule`],
    marketingCompetitorSnapshotIds: [`${prefix}-competitor`],
  };
}

describe("demo data provenance", () => {
  it("retains every historical sample id when a clinic reseeds", () => {
    const historical = {
      ...demoIds("old"),
      clientIds: ["shared-client", "old-client"],
      clearedAt: "2026-08-09T12:00:00.000Z",
    };
    const latest = {
      ...demoIds("new"),
      clientIds: ["shared-client", "new-client"],
    };

    expect(mergeDemoDataProvenance(historical, latest)).toEqual({
      clientIds: ["shared-client", "old-client", "new-client"],
      patientIds: ["old-patient", "new-patient"],
      appointmentIds: ["old-appointment", "new-appointment"],
      soapNoteIds: ["old-soap", "new-soap"],
      vaccinationIds: ["old-vaccination", "new-vaccination"],
      problemIds: ["old-problem", "new-problem"],
      invoiceIds: ["old-invoice", "new-invoice"],
      invoiceItemIds: ["old-invoice-item", "new-invoice-item"],
      communicationIds: [
        "old-communication",
        "new-communication",
      ],
      productIds: ["old-product", "new-product"],
      marketingTvSlideIds: ["old-tv-slide", "new-tv-slide"],
      marketingHandoutIds: ["old-handout", "new-handout"],
      marketingReviewIds: ["old-review", "new-review"],
      marketingContentBatchIds: ["old-content-batch", "new-content-batch"],
      marketingContentItemIds: ["old-content-item", "new-content-item"],
      marketingMediaConsentIds: ["old-media-consent", "new-media-consent"],
      marketingMediaAssetIds: ["old-media-asset", "new-media-asset"],
      marketingStaffTaskIds: ["old-staff-task", "new-staff-task"],
      marketingMessageTemplateIds: ["old-msg-template", "new-msg-template"],
      marketingMessageLogIds: ["old-msg-log", "new-msg-log"],
      marketingAutomationRuleIds: ["old-auto-rule", "new-auto-rule"],
      marketingScriptIds: ["old-script", "new-script"],
      marketingRecallScheduleIds: ["old-recall-schedule", "new-recall-schedule"],
      marketingCompetitorSnapshotIds: ["old-competitor", "new-competitor"],
      clearedAt: null,
    });
  });

  it("only treats uncleared sample data as live", () => {
    const live = { ...demoIds("live"), clearedAt: null };
    const cleared = {
      ...demoIds("cleared"),
      clearedAt: "2026-08-09T12:00:00.000Z",
    };

    expect(hasLiveDemoData(live)).toBe(true);
    expect(hasLiveDemoData(cleared)).toBe(false);
    expect(hasLiveDemoData(undefined)).toBe(false);
  });
});
