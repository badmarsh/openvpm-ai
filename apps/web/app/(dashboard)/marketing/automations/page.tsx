import { ClientAutomationsView } from "@/components/automations/client-automations-view";

/**
 * Marketing Autopilot console: deterministic rules, CRM segments,
 * publishing channels and the event-bus inspector.
 *
 * Journey editing and the suppression audit live in the /automations hub
 * (page-kit); this console keeps the rule/segment/channel/event tooling
 * that has no other home. Deep-linkable tabs: rules, segments, channels,
 * events (?tab=<id>).
 */
export default function MarketingAutomationsPage() {
  return <ClientAutomationsView />;
}
