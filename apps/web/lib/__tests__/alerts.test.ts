import { describe, it, expect } from "vitest";
import { formatOpsAlert, alertOps } from "../alerts";

describe("formatOpsAlert", () => {
  it("includes the subject and detail in a Slack-style text payload", () => {
    const p = formatOpsAlert("Backup failed", "practice abc: timeout");
    expect(p.text).toContain("Backup failed");
    expect(p.text).toContain("practice abc: timeout");
    expect(p.text).toContain("OpenVPM");
  });
});

describe("alertOps", () => {
  it("never throws when no webhook is configured", async () => {
    const prev = process.env.OPS_ALERT_WEBHOOK_URL;
    delete process.env.OPS_ALERT_WEBHOOK_URL;
    await expect(alertOps("x", "y")).resolves.toBeUndefined();
    if (prev !== undefined) process.env.OPS_ALERT_WEBHOOK_URL = prev;
  });
});
