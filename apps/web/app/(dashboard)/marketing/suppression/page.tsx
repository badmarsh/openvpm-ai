import { redirect } from "next/navigation";

/**
 * Legacy route redirect: /marketing/suppression -> /automations?tab=suppression
 * The read-only suppression log (Sympathy Gate audit) lives in the
 * Automations hub. The tab query param is preserved so deep links land
 * on the correct panel.
 */
export default function SuppressionRedirectPage() {
  redirect("/automations?tab=suppression");
}
