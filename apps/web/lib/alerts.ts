/**
 * Ops alerting for background jobs (cron, webhook dispatch). These run with no
 * user watching, so a silent failure means a clinic never knows a reminder
 * didn't send or a backup didn't run. Posts to OPS_ALERT_WEBHOOK_URL (Slack-
 * style) if configured; always logs. Never throws into the caller.
 */

export function formatOpsAlert(subject: string, detail: string): { text: string } {
  return { text: `🚨 OpenVPM ops alert — ${subject}\n${detail}` };
}

export async function alertOps(subject: string, detail: string): Promise<void> {
  console.error(`[ops-alert] ${subject}: ${detail}`);
  const url = process.env.OPS_ALERT_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formatOpsAlert(subject, detail)),
    });
  } catch (err) {
    console.error("[ops-alert] failed to deliver alert:", err);
  }
}
