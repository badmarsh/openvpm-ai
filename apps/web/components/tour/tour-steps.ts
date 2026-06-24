/**
 * Ordered steps for the in-app value tour. Each step optionally navigates to a
 * route and anchors a coachmark to an element marked `data-tour="<anchor>"`.
 * Anchoring the sidebar nav links keeps anchors stable across route changes and
 * page data loading; steps without an anchor render as a centered card.
 */
export interface TourStep {
  id: string;
  /** Route to navigate to before showing this step. */
  route?: string;
  /** `data-tour` value of the element to spotlight. Absent = centered card. */
  anchor?: string;
  title: string;
  body: string;
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    route: "/",
    title: "Welcome to OpenVPM 🐾",
    body: "Your practice is live with sample patients and a working schedule. Take a 60-second tour of the essentials — then explore on your own.",
  },
  {
    id: "schedule",
    route: "/schedule",
    anchor: "nav-/schedule",
    title: "Run your day from the schedule",
    body: "Book, drag, and check patients in. Your trial is pre-loaded with today's appointments so it feels real from minute one.",
  },
  {
    id: "records",
    route: "/records",
    anchor: "nav-/records",
    title: "Complete medical records",
    body: "SOAP notes, vaccines, prescriptions, labs, and problems — every patient's history in one place, ready to chart.",
  },
  {
    id: "billing",
    route: "/billing",
    anchor: "nav-/billing",
    title: "Invoice in a click",
    body: "Turn any visit into an itemized invoice or estimate from your service catalog, and take payment online.",
  },
  {
    id: "agent",
    route: "/agent",
    anchor: "nav-/agent",
    title: "Your built-in AI assistant",
    body: "Ask plain-English questions about your practice data. The agent uses real tools and never invents records.",
  },
  {
    id: "finish",
    route: "/",
    title: "You're ready to go 🎉",
    body: "That's the tour. Explore freely during your trial — and when you're ready to keep your data, add billing from Settings.",
  },
];
