"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";

export default function BookAppointmentPage() {
  const params = useParams();
  const token = params.token as string;

  const client = trpc.portal.getClient.useQuery({ token });
  const types = trpc.portal.getAppointmentTypes.useQuery({ token });
  const request = trpc.portal.requestAppointment.useMutation();

  const [patientId, setPatientId] = useState("");
  const [typeId, setTypeId] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [reason, setReason] = useState("");

  // Suggested open times for the chosen date.
  const slots = trpc.portal.availableSlots.useQuery(
    { token, date: preferredDate, durationMinutes: 30 },
    { enabled: !!preferredDate }
  );

  const pets = client.data?.patients ?? [];
  const canSubmit =
    patientId && preferredDate && preferredTime && reason.trim() && !request.isPending;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    request.mutate({
      token,
      patientId,
      typeId: typeId || undefined,
      preferredDate,
      preferredTime,
      reason: reason.trim(),
    });
  }

  if (request.data?.success) {
    return (
      <div className="text-center py-16">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-teal-100 text-teal-600">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Request sent!</h1>
        <p className="text-gray-600 max-w-sm mx-auto mb-6">{request.data.message}</p>
        <Link
          href={`/portal/${token}/appointments`}
          className="inline-flex items-center gap-1 text-sm font-medium text-teal-600 hover:text-teal-700"
        >
          View your appointments
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-xl">
      <Link
        href={`/portal/${token}/appointments`}
        className="inline-flex items-center gap-1 text-sm text-teal-600 hover:text-teal-700 mb-6"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Back to appointments
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-2">Request an appointment</h1>
      <p className="text-gray-500 text-sm mb-8">
        Pick a time that works for you. The clinic will confirm the final time.
      </p>

      <form onSubmit={submit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Pet</label>
          <select
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          >
            <option value="">Select a pet…</option>
            {pets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Reason for visit
          </label>
          <select
            value={typeId}
            onChange={(e) => setTypeId(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          >
            <option value="">General visit</option>
            {(types.data ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Preferred date</label>
            <input
              type="date"
              value={preferredDate}
              onChange={(e) => setPreferredDate(e.target.value)}
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Preferred time</label>
            <input
              type="time"
              value={preferredTime}
              onChange={(e) => setPreferredTime(e.target.value)}
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>
        </div>

        {preferredDate && (slots.data?.length ?? 0) > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">
              Open times on {preferredDate} (tap to pick)
            </p>
            <div className="flex flex-wrap gap-2">
              {slots.data!.map((s) => (
                <button
                  key={s.iso}
                  type="button"
                  onClick={() => setPreferredTime(s.time)}
                  className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                    preferredTime === s.time
                      ? "border-teal-500 bg-teal-50 text-teal-700"
                      : "border-gray-200 text-gray-600 hover:border-teal-300"
                  }`}
                >
                  {s.time}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Anything we should know?
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            rows={3}
            placeholder="Briefly describe the reason for the visit"
            className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
        </div>

        {request.error && (
          <p className="text-sm text-red-600">{request.error.message}</p>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50 transition-colors"
        >
          {request.isPending ? "Sending…" : "Request appointment"}
        </button>
      </form>
    </div>
  );
}
