import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Github } from "lucide-react";

export const metadata: Metadata = {
  title: "Updates",
  description:
    "What's new in OpenVPM — product updates, shipped features, and where the open-source veterinary PIMS is headed.",
};

interface Update {
  date: string;
  tag: "Platform" | "Clinical" | "AI" | "Direction";
  title: string;
  body: string;
  points?: string[];
}

const tagStyles: Record<Update["tag"], string> = {
  Platform: "bg-blue-50 text-blue-700 border-blue-200",
  Clinical: "bg-emerald-50 text-emerald-700 border-emerald-200",
  AI: "bg-purple-50 text-purple-700 border-purple-200",
  Direction: "bg-teal-50 text-teal-700 border-teal-200",
};

// Newest first. Update this list as work ships.
const updates: Update[] = [
  {
    date: "June 2, 2026",
    tag: "Platform",
    title: "A calendar you can trust",
    body: "Scheduling got a correctness overhaul. Back-to-back appointments no longer trip a false 'conflict' (a real bug — the old check counted touching time slots as overlaps), and the calendar now catches room double-bookings, not just doctor clashes. Appointments can be rescheduled — moved to a new time, doctor, or room — with the same conflict checks applied, so dragging an appointment can't quietly create a clash.",
    points: [
      "Strict overlap detection across both doctor and room.",
      "Reschedule with automatic conflict checking, excluding the appointment being moved.",
    ],
  },
  {
    date: "June 2, 2026",
    tag: "Clinical",
    title: "Deeper clinical tooling: vitals, treatment plans, wellness plans",
    body: "Closing the gap with the established systems. Per-visit vital signs now have a dedicated tab on the patient record, treatment plans link to a patient's problem list with progress tracking, and practices can offer wellness/membership plans with recurring billing schedules. Plus self-service online booking landed in the client portal.",
  },
  {
    date: "June 1, 2026",
    tag: "Direction",
    title: "Don't switch — connect. A second PIMS that you own.",
    body: "We heard it from every practice we talked to: changing your PIMS is a massive lift, and you won't do it on a whim. So we changed the ask. Instead of rip-and-replace, OpenVPM is becoming the open data layer that connects to the system you already run — giving you a live, exportable copy of your own data in a system you control.",
    points: [
      "New positioning: run OpenVPM alongside your current PIMS, read-only until you want more.",
      "Everything stays behind a documented, exportable API. No lock-in, ever.",
    ],
  },
  {
    date: "June 1, 2026",
    tag: "AI",
    title: "Meet the OpenVPM Agent",
    body: "OpenVPM now ships with an AI agent that operates on your practice data through real, typed tools — not guesses. It can find clients and patients, pull a clinical summary, list overdue vaccinations for recall, calculate a weight-based drug dose, and book appointments. Every write is gated for review, and the agent is scoped so it can only ever touch your own practice's data.",
    points: [
      "Bring your own model key. The agent is open source and fully inspectable.",
      "Foundation for an agent-operated clinic — the busywork runs itself.",
    ],
  },
  {
    date: "June 1, 2026",
    tag: "Platform",
    title: "Public REST API (v1) + scoped API keys",
    body: "A versioned, public REST API over your core records — clients, patients, and appointments — authenticated with scoped, per-practice API keys. Built so integrators and AI agents can plug in without touching the internal app, with response shapes frozen independently of the database so integrations never break on an internal change.",
    points: [
      "Scoped keys (clients:read, patients:read, appointments:write, …) with per-key rate limits.",
      "Appointment creation fires real webhooks. See docs/api for the full reference.",
    ],
  },
  {
    date: "June 1, 2026",
    tag: "Clinical",
    title: "Dosing calculator + vital signs tracking",
    body: "Two clinical-depth features that bring OpenVPM closer to parity with the leading systems. A weight-based drug dosing calculator with a curated formulary, species-specific reference ranges, tablet-split suggestions, and verify-before-prescribing guard rails — plus full vital-signs capture per visit (temperature, heart rate, respiration, weight, body condition, pain score, and more).",
  },
];

export default function UpdatesPage() {
  return (
    <div className="py-16 sm:py-24">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <h1 className="text-4xl sm:text-5xl font-bold font-heading text-gray-900 tracking-tight mb-4">
            Updates
          </h1>
          <p className="text-lg text-gray-600 max-w-xl mx-auto">
            What&apos;s shipping in OpenVPM and where we&apos;re headed. Built in the
            open, with the veterinary community.
          </p>
        </div>

        <div className="space-y-10">
          {updates.map((u, i) => (
            <article
              key={`${u.date}-${i}`}
              className="relative rounded-2xl border border-gray-100 bg-white p-6 sm:p-8 shadow-sm"
            >
              <div className="flex items-center gap-3 mb-3">
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${tagStyles[u.tag]}`}
                >
                  {u.tag}
                </span>
                <time className="text-sm text-gray-400">{u.date}</time>
              </div>
              <h2 className="text-xl font-semibold font-heading text-gray-900 mb-3">
                {u.title}
              </h2>
              <p className="text-gray-600 leading-relaxed">{u.body}</p>
              {u.points && (
                <ul className="mt-4 space-y-2">
                  {u.points.map((p) => (
                    <li key={p} className="flex items-start gap-2 text-sm text-gray-500">
                      <ArrowRight className="w-4 h-4 text-teal-500 mt-0.5 shrink-0" />
                      {p}
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </div>

        <div className="mt-14 rounded-2xl border border-teal-100 bg-teal-50/40 p-8 text-center">
          <h2 className="text-xl font-semibold font-heading text-gray-900 mb-2">
            Want these in your inbox?
          </h2>
          <p className="text-gray-600 mb-6">
            Follow along as we build. Join the list and we&apos;ll send the big ones.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/#waitlist"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-6 py-3 text-sm font-semibold text-white hover:bg-teal-700 transition-colors"
            >
              Join the list
              <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href="https://github.com/evangauer/openvpm"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-lg border-2 border-gray-200 bg-white px-6 py-3 text-sm font-semibold text-gray-700 hover:border-teal-200 hover:text-teal-600 transition-colors"
            >
              <Github className="w-4 h-4" />
              Watch on GitHub
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
