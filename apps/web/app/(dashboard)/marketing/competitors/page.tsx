import { redirect } from "next/navigation";

/**
 * Legacy route redirect: /marketing/competitors -> /vet-intel
 * Market & competition intelligence lives in the Vet Intelligence hub.
 * (Previously this bounced through /vet-intel?tab=market, which no longer
 * exists — the query param was silently dropped.)
 */
export default function CompetitorsRedirectPage() {
  redirect("/vet-intel");
}
