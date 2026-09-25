"use client";

import { useDebounce } from "@/lib/hooks/use-debounce";
import { Suspense, useState, useRef, useEffect, useId, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
  User,
  Filter,
  X,
  Loader2,
  Plus,
  Mail,
  Repeat2,
  Stethoscope,
  MapPin,
  Trash2,
  Pencil,
  Check,
  UserCheck,
  UserX,
  CalendarX,
  ArrowUpRight,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { translateOutboundEmailError } from "@/lib/outbound-email-errors";
import { useI18n } from "@/lib/i18n";
import { useConfirmDialog } from "@/lib/hooks/use-confirm-dialog";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/common/empty-state";
import { CalendarSubscribe } from "@/components/schedule/calendar-subscribe";
import { PageHeader } from "@/components/layout/page-header";
import { cn } from "@/lib/utils";
import { formatDoctorName, formatSpecies } from "@/lib/locale/format";
import { dateInputTimeUtcInstant } from "@/lib/date-input";
import {
  addCalendarDays,
  addCalendarMonths,
  buildMonthGrid,
  buildWeekDays,
  groupByCalendarDate,
  startOfCalendarDay,
  toISODate,
  type CalendarDay,
  type CalendarView,
} from "@/lib/scheduling/calendar-views";
import {
  APPOINTMENT_DURATION_MAX_MINUTES,
  APPOINTMENT_DURATION_MIN_MINUTES,
  APPOINTMENT_DURATION_STEP_MINUTES,
  APPOINTMENT_NOTES_MAX_LENGTH,
  APPOINTMENT_PATIENT_SEARCH_MAX_LENGTH,
  APPOINTMENT_RECURRENCE_INTERVAL_MAX,
  APPOINTMENT_RECURRENCE_INTERVAL_MIN,
  APPOINTMENT_RECURRENCE_OCCURRENCES_MAX,
  APPOINTMENT_RECURRENCE_OCCURRENCES_MIN,
  isAppointmentDateInputValid,
  isAppointmentDurationInputValid,
  isAppointmentNotesInputValid,
  isAppointmentPatientSearchInputValid,
  isAppointmentRecurrenceIntervalInputValid,
  isAppointmentRecurrenceOccurrencesInputValid,
} from "@/lib/scheduling/appointment-policy";
import {
  layoutOverlaps,
  type OverlapPosition,
} from "@/lib/scheduling/overlap-layout";

// --- Constants ---

const START_HOUR = 8;
const END_HOUR = 18;
const HOUR_HEIGHT = 60; // px per hour
const TOTAL_HOURS = END_HOUR - START_HOUR;
const CALENDAR_HEIGHT = TOTAL_HOURS * HOUR_HEIGHT;
const DEFAULT_APPOINTMENT_COLOR = "#0d9488";
const DIALOG_FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusElementAfterNavigation(elementId: string) {
  const startedAt = performance.now();
  function moveFocus() {
    const target = document.getElementById(elementId);
    if (target) {
      if (!target.hasAttribute("tabindex"))
        target.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: true });
      return;
    }
    if (performance.now() - startedAt < 5_000) {
      window.requestAnimationFrame(moveFocus);
    }
  }
  window.requestAnimationFrame(moveFocus);
}

type AppointmentStatus =
  | "scheduled"
  | "confirmed"
  | "checked_in"
  | "in_exam"
  | "checked_out"
  | "no_show"
  | "cancelled";

type ConfirmationContactMethod = "phone" | "email";

type RecurrenceFrequency = "weekly" | "monthly" | "annual";

const STATUS_COLORS: Record<AppointmentStatus, string> = {
  scheduled: "bg-blue-500",
  confirmed: "bg-blue-500",
  checked_in: "bg-amber-500",
  in_exam: "bg-amber-500",
  checked_out: "bg-green-500",
  no_show: "bg-red-500",
  cancelled: "bg-red-500",
};

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled: "Scheduled",
  confirmed: "Confirmed",
  checked_in: "Checked In",
  in_exam: "In Exam",
  checked_out: "Checked Out",
  no_show: "No Show",
  cancelled: "Cancelled",
};

function canCreateAppointmentsRole(role?: string | null): boolean {
  return role === "admin" || role === "veterinarian" || role === "front_desk";
}

function canUpdateAppointmentStatusRole(role?: string | null): boolean {
  return (
    role === "admin" ||
    role === "veterinarian" ||
    role === "technician" ||
    role === "front_desk"
  );
}

function canSendAppointmentRemindersRole(role?: string | null): boolean {
  return role === "admin" || role === "veterinarian" || role === "front_desk";
}

// --- Helpers ---

const SCHEDULE_DAY_KEYS = [
  "sun",
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
] as const;

function formatDayShort(
  date: Date,
  t: (key: string, fallback?: string) => string,
  locale = "sk"

): string {
  const key = SCHEDULE_DAY_KEYS[date.getDay()]!;
  const dateLocale = locale === "sk" ? "sk-SK" : "en-US";
  const defaultShort = date.toLocaleDateString(dateLocale, { weekday: "short" });
  return t("schedule.daysShort." + key, defaultShort);
}

function formatDate(date: Date, locale = "sk-SK"): string {
  const formatted = date.toLocaleDateString(locale, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function formatTime(date: Date, timeZone?: string | null): string {
  const loc = typeof document !== "undefined" && document.documentElement.lang === "sk" ? "sk-SK" : "en-US";
  return date.toLocaleTimeString(loc, {
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
    timeZone: timeZone ?? undefined,
  });
}

function getZonedHourMinute(
  date: Date,
  timeZone?: string | null
): { hour: number; minute: number } {
  if (!timeZone) return { hour: date.getHours(), minute: date.getMinutes() };

  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      hour: "2-digit",
      minute: "2-digit",
    }).formatToParts(date);
    const hour = Number(parts.find((part) => part.type === "hour")?.value);
    const minute = Number(parts.find((part) => part.type === "minute")?.value);
    if (Number.isFinite(hour) && Number.isFinite(minute)) {
      return { hour, minute };
    }
  } catch {
    // Fall back to browser-local positioning if the saved timezone is invalid.
  }

  return { hour: date.getHours(), minute: date.getMinutes() };
}

function formatTimeInput(date: Date, timeZone?: string | null): string {
  const { hour, minute } = getZonedHourMinute(date, timeZone);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function appointmentDurationMinutes(start: Date, end: Date): number {
  const minutes = Math.round((end.getTime() - start.getTime()) / 60000);
  return isAppointmentDurationInputValid(minutes) ? minutes : 30;
}

function getTopOffset(time: Date, timeZone?: string | null): number {
  const { hour, minute } = getZonedHourMinute(time, timeZone);
  const hours = hour + minute / 60;
  return (hours - START_HOUR) * HOUR_HEIGHT;
}

function getAppointmentLayout(
  start: Date,
  end: Date,
  timeZone?: string | null
): {
  top: number;
  height: number;
} {
  const rawTop = getTopOffset(start, timeZone);
  const rawBottom = getTopOffset(end, timeZone);
  const top = Math.min(Math.max(rawTop, 0), CALENDAR_HEIGHT - 20);
  const bottom = Math.min(Math.max(rawBottom, top + 20), CALENDAR_HEIGHT);
  return { top, height: bottom - top };
}

function getAppointmentColor(appointment: Appointment): string {
  if (
    appointment.typeColor &&
    appointment.typeColor !== DEFAULT_APPOINTMENT_COLOR
  ) {
    return appointment.typeColor;
  }
  const typeLower = (appointment.typeName ?? "").toLowerCase();
  if (
    typeLower.includes("well") ||
    typeLower.includes("prevent") ||
    typeLower.includes("vakc") ||
    typeLower.includes("vacc") ||
    typeLower.includes("očkov") ||
    typeLower.includes("checkup")
  ) {
    return "#10b981"; // Emerald/teal (Wellness)
  }
  if (
    typeLower.includes("surg") ||
    typeLower.includes("oper") ||
    typeLower.includes("chirurg") ||
    typeLower.includes("dent") ||
    typeLower.includes("zákrok")
  ) {
    return "#8b5cf6"; // Purple/violet (Surgery)
  }
  if (
    typeLower.includes("urg") ||
    typeLower.includes("emerg") ||
    typeLower.includes("akút") ||
    typeLower.includes("pohot") ||
    typeLower.includes("stat") ||
    typeLower.includes("urgent")
  ) {
    return "#f43f5e"; // Rose/amber (Urgent/Emergency)
  }
  if (
    typeLower.includes("follow") ||
    typeLower.includes("kontr") ||
    typeLower.includes("recheck")
  ) {
    return "#0284c7"; // Sky/indigo (Follow-up)
  }
  return appointment.typeColor || DEFAULT_APPOINTMENT_COLOR;
}

function appointmentStatusLabel(
  appointment: Appointment,
  t?: (key: string, fallback?: string, params?: Record<string, string | number>) => string
): string {
  if (
    appointment.status === "scheduled" &&
    (appointment.notes?.startsWith("[Online request]") ||
      appointment.notes?.startsWith("[Portal request]"))
  ) {
    return t ? t("schedule.needsConfirmation", "Needs confirmation") : "Needs confirmation";
  }
  if (t) {
    const statusKeys: Record<AppointmentStatus, string> = {
      scheduled: t("schedule.statusScheduled", "Scheduled"),
      confirmed: t("schedule.statusConfirmed", "Confirmed"),
      checked_in: t("schedule.statusCheckedIn", "Checked In"),
      in_exam: t("schedule.statusInExam", "In Exam"),
      checked_out: t("schedule.statusCheckedOut", "Checked Out"),
      no_show: t("schedule.statusNoShow", "No Show"),
      cancelled: t("schedule.statusCancelled", "Cancelled"),
    };
    return statusKeys[appointment.status as AppointmentStatus] || appointment.status;
  }
  return (
    STATUS_LABELS[appointment.status as AppointmentStatus] || appointment.status
  );
}

function sortAppointments(appointments: Appointment[]): Appointment[] {
  return [...appointments].sort(
    (a, b) =>
      new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );
}

/** Side-by-side columns for concurrent appointments (never stacked). */
function buildOverlapLayout(
  appointments: Appointment[]
): Map<string, OverlapPosition> {
  return layoutOverlaps(
    appointments.map((appt) => ({
      id: appt.id,
      startMs: new Date(appt.startTime).getTime(),
      endMs: new Date(appt.endTime).getTime(),
    }))
  );
}

/**
 * One lane per doctor for the day view, derived from the day's own
 * appointments (works even when the only provider is the practice admin).
 * Unassigned appointments (tech work like nail trims) share a Team lane.
 */
function buildDayLanes(
  appointments: Appointment[],
  teamLabel = "Team",
  doctorFallback = "Doctor"
): { key: string; label: string; appointments: Appointment[] }[] {
  const byDoctor = new Map<string, { label: string; appointments: Appointment[] }>();
  for (const appt of appointments) {
    const key = appt.doctorId ?? "team";
    const existing = byDoctor.get(key);
    if (existing) {
      existing.appointments.push(appt);
    } else {
      byDoctor.set(key, {
        label: appt.doctorId ? appt.doctorName ?? doctorFallback : teamLabel,
        appointments: [appt],
      });
    }
  }
  const lanes = [...byDoctor.entries()].map(([key, lane]) => ({
    key,
    label: lane.label,
    appointments: lane.appointments,
  }));
  // Doctors alphabetically, the shared Team lane last.
  lanes.sort((a, b) => {
    if (a.key === "team") return 1;
    if (b.key === "team") return -1;
    return a.label.localeCompare(b.label);
  });
  return lanes;
}

function formatToolbarDate(date: Date, view: CalendarView, locale = "sk-SK"): string {
  if (view === "month") {
    const formatted = date.toLocaleDateString(locale, {
      month: "long",
      year: "numeric",
    });
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  }

  if (view === "week") {
    const days = buildWeekDays(date);
    const start = days[0]!;
    const end = days[6]!;
    const sameMonth =
      start.getMonth() === end.getMonth() &&
      start.getFullYear() === end.getFullYear();

    if (sameMonth) {
      const monthStr = start.toLocaleDateString(locale, {
        month: "short",
      });
      const capMonth = monthStr.charAt(0).toUpperCase() + monthStr.slice(1);
      return capMonth + " " + start.getDate() + "-" + end.getDate() + ", " + end.getFullYear();
    }

    const startMonth = start.toLocaleDateString(locale, {
      month: "short",
      day: "numeric",
    });
    const endMonth = end.toLocaleDateString(locale, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    return startMonth + " - " + endMonth;
  }

  return formatDate(date, locale);
}

function getSnappedTimeFromY(y: number): string {
  const hoursFromTop = y / HOUR_HEIGHT;
  const totalMinutes = Math.round((START_HOUR + hoursFromTop) * 60);
  const snapped = Math.round(totalMinutes / 30) * 30;
  const clamped = Math.min(
    Math.max(snapped, START_HOUR * 60),
    (END_HOUR - 0.5) * 60
  );
  const hour = Math.floor(clamped / 60);
  const min = clamped % 60;
  return `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function appointmentInstantFromDateAndTime(
  date: string,
  time: string,
  timeZone?: string | null
): Date {
  const [hour = 0, minute = 0] = time.split(":").map(Number);
  return dateInputTimeUtcInstant(date, { hour, minute }, timeZone);
}

// --- Types for appointment from API ---

type Appointment = {
  id: string;
  startTime: Date | string;
  endTime: Date | string;
  status: string;
  notes: string | null;
  recurringSeriesId: string | null;
  patientName: string | null;
  patientSpecies: string | null;
  patientId: string | null;
  clientFirstName: string | null;
  clientLastName: string | null;
  clientEmail: string | null;
  clientPhone: string | null;
  clientId: string | null;
  doctorName: string | null;
  doctorId: string | null;
  typeName: string | null;
  typeColor: string | null;
  typeDuration: number | null;
  typeRequiresDoctor: number | null;
  roomName: string | null;
  roomId: string | null;
  locationName: string | null;
  locationId: string | null;
};

// --- Components ---

function StatusDot({ status }: { status: string }) {
  const colorClass = STATUS_COLORS[status as AppointmentStatus] || "bg-gray-400";
  return (
    <span
      className={cn("inline-block h-2 w-2 rounded-full shrink-0", colorClass)}
    />
  );
}

function TimeSlots() {
  const slots = [];
  for (let hour = START_HOUR; hour <= END_HOUR; hour++) {
    const label =
      hour === 0
        ? "12 AM"
        : hour < 12
          ? `${hour} AM`
          : hour === 12
            ? "12 PM"
            : `${hour - 12} PM`;
    slots.push(
      <div
        key={hour}
        className="relative"
        style={{ height: hour < END_HOUR ? HOUR_HEIGHT : 0 }}
      >
        <span className="absolute -top-3 right-3 text-xs text-muted-foreground select-none font-mono tabular-nums">
          {label}
        </span>
      </div>
    );
  }
  return <div className="w-16 shrink-0 pt-0">{slots}</div>;
}

function GridLines() {
  const lines = [];
  for (let hour = START_HOUR; hour < END_HOUR; hour++) {
    lines.push(
      <div
        key={`h-${hour}`}
        className="absolute left-0 right-0 border-t border-border"
        style={{ top: (hour - START_HOUR) * HOUR_HEIGHT }}
      />
    );
    // Half-hour dashed line
    lines.push(
      <div
        key={`hh-${hour}`}
        className="absolute left-0 right-0 border-t border-border/40 border-dashed"
        style={{ top: (hour - START_HOUR) * HOUR_HEIGHT + HOUR_HEIGHT / 2 }}
      />
    );
  }
  // Bottom line
  lines.push(
    <div
      key="bottom"
      className="absolute left-0 right-0 border-t border-border"
      style={{ top: TOTAL_HOURS * HOUR_HEIGHT }}
    />
  );
  return <>{lines}</>;
}

function AppointmentBlock({
  appointment,
  timeZone,
  onClick,
  position,
}: {
  appointment: Appointment;
  timeZone?: string | null;
  onClick: () => void;
  position?: OverlapPosition;
}) {
  const { t } = useI18n();
  const start = new Date(appointment.startTime);
  const end = new Date(appointment.endTime);
  const { top, height } = getAppointmentLayout(start, end, timeZone);
  const bgColor = getAppointmentColor(appointment);
  // Concurrent appointments split the column width; a lone appointment
  // keeps the old full-width look.
  const widthPct = 100 / (position?.columns ?? 1);
  const leftPct = (position?.column ?? 0) * widthPct;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group absolute rounded-lg px-2.5 py-1 text-left text-xs overflow-hidden cursor-pointer transition-all duration-150 hover:brightness-95 hover:shadow-xs focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 border border-border/40"
      style={{
        top,
        height,
        left: `calc(${leftPct}% + 3px)`,
        width: `calc(${widthPct}% - 6px)`,
        backgroundColor: `${bgColor}18`,
        borderLeft: `3.5px solid ${bgColor}`,
      }}
    >
      <div className="flex min-w-0 items-center gap-1.5 font-medium text-foreground overflow-hidden">
        <StatusDot status={appointment.status} />
        <span className="min-w-0 truncate font-semibold tracking-tight">{appointment.patientName || t("schedule.unknownPatient", "Unknown Patient")}</span>
      </div>
      {height >= 36 && (
        <div className="min-w-0 text-muted-foreground overflow-hidden text-ellipsis truncate mt-0.5 font-mono tabular-nums text-[11px]">
          <span className="font-sans font-medium text-foreground/80">{appointment.typeName || t("schedule.appointmentFallback", "Appointment")}</span> &middot;{" "}
          <span>{formatTime(start, timeZone)} - {formatTime(end, timeZone)}</span>
          {appointment.locationName ? ` · ${appointment.locationName}` : ""}
        </div>
      )}
    </button>
  );
}

function DayCalendar({
  appointments,
  timeZone,
  showNowLine,
  nowTop,
  onSlotClick,
  onAppointmentClick,
}: {
  appointments: Appointment[];
  timeZone?: string | null;
  showNowLine: boolean;
  nowTop: number;
  onSlotClick?: (y: number) => void;
  onAppointmentClick: (appointment: Appointment) => void;
}) {
  const { t } = useI18n();
  // A real clinic day: one lane per doctor (plus a Team lane for
  // unassigned/tech work). With one provider or none it stays the single
  // clean column it always was.
  const lanes = buildDayLanes(
    appointments,
    t("schedule.teamLane", "Team"),
    t("schedule.doctorLaneFallback", "Doctor")
  );
  const showLanes = lanes.length > 1;

  const laneColumn = (laneAppointments: Appointment[], key: string) => {
    const layout = buildOverlapLayout(laneAppointments);
    return (
      <div
        key={key}
        className={cn(
          "relative flex-1 border-l border-border",
          onSlotClick && "cursor-pointer"
        )}
        style={{ height: CALENDAR_HEIGHT, minWidth: showLanes ? 160 : undefined }}
        onClick={(e) => {
          if (!onSlotClick) return;
          if ((e.target as HTMLElement).closest("button")) return;
          const rect = e.currentTarget.getBoundingClientRect();
          onSlotClick(e.clientY - rect.top);
        }}
      >
        <GridLines />

        {showNowLine && (
          <div
            className="absolute left-0 right-0 z-20 flex items-center pointer-events-none"
            style={{ top: nowTop }}
          >
            <div className="relative flex h-3 w-3 -ml-1.5 items-center justify-center">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.9)]" />
            </div>
            <div className="flex-1 border-t-2 border-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.7)]" />
          </div>
        )}

        {laneAppointments.map((appt) => (
          <AppointmentBlock
            key={appt.id}
            appointment={appt}
            timeZone={timeZone}
            onClick={() => onAppointmentClick(appt)}
            position={layout.get(appt.id)}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-border bg-card">
      <div className="overflow-x-auto">
        <div
          style={{
            minWidth: showLanes ? 64 + lanes.length * 160 : undefined,
          }}
        >
          {showLanes && (
            <div className="flex border-b border-border bg-muted/30">
              <div className="w-16 shrink-0" />
              {lanes.map((lane) => (
                <div
                  key={lane.key}
                  className="flex-1 border-l border-border px-3 py-2"
                  style={{ minWidth: 160 }}
                >
                  <p className="truncate text-sm font-medium">{lane.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {lane.appointments.length === 1
                      ? t("schedule.appointmentCountOne", "1 appointment")
                      : t("schedule.appointmentCountMany", "{count} appointments", {
                          count: lane.appointments.length,
                        })}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div
            className="flex overflow-y-auto"
            style={{ maxHeight: "calc(100vh - 220px)" }}
          >
            <TimeSlots />

            {appointments.length > 0 ? (
              showLanes ? (
                lanes.map((lane) => laneColumn(lane.appointments, lane.key))
              ) : (
                laneColumn(appointments, "all")
              )
            ) : (
              <div
                className={cn(
                  "relative flex-1 border-l border-border",
                  onSlotClick && "cursor-pointer"
                )}
                style={{ height: CALENDAR_HEIGHT }}
                onClick={(e) => {
                  if (!onSlotClick) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  onSlotClick(e.clientY - rect.top);
                }}
              >
                <GridLines />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center">
                    <Calendar className="mx-auto h-8 w-8 text-muted-foreground/40" />
                    <p className="mt-2 text-sm text-muted-foreground">
                      {t("schedule.noAppointmentsDay", "No appointments for this day")}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {appointments.length > 0 && (
        <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
          {appointments.length === 1
            ? t("schedule.appointmentCountOne", "1 appointment")
            : t("schedule.appointmentCountMany", "{count} appointments", {
                count: appointments.length,
              })}
          {showLanes &&
            t("schedule.lanesCount", " · {count} lanes", {
              count: lanes.length,
            })}
        </div>
      )}
    </div>
  );
}

function PhoneAgenda({
  appointments,
  timeZone,
  view,
  onAppointmentClick,
}: {
  appointments: Appointment[];
  timeZone?: string | null;
  view: CalendarView;
  onAppointmentClick: (appointment: Appointment) => void;
}) {
  const { t, locale } = useI18n();
  const dateLocale = locale === "sk" ? "sk-SK" : "en-US";
  const appointmentsByDay = new Map<string, Appointment[]>();

  for (const appointment of appointments) {
    const dateKey = toISODate(new Date(appointment.startTime), timeZone);
    const dayAppointments = appointmentsByDay.get(dateKey);
    if (dayAppointments) {
      dayAppointments.push(appointment);
    } else {
      appointmentsByDay.set(dateKey, [appointment]);
    }
  }

  const rangeLabel =
    view === "day"
      ? t("schedule.viewDay", "Day")
      : view === "week"
        ? t("schedule.viewWeek", "Week")
        : t("schedule.viewMonth", "Month");

  return (
    <section
      aria-label={t("schedule.agendaAria", "{range} appointment agenda", { range: rangeLabel })}
      className="mt-4 max-w-full space-y-4 overflow-hidden sm:hidden"
    >
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold">{t("schedule.agendaTitle", "{range} agenda", { range: rangeLabel })}</h4>
        <span className="text-xs text-muted-foreground">
          {appointments.length === 1
            ? t("schedule.appointmentCountOne", "1 appointment")
            : t("schedule.appointmentCountMany", "{count} appointments", {
                count: appointments.length,
              })}
        </span>
      </div>

      {appointments.length === 0 ? (
        <div className="rounded-lg border border-border bg-card px-4 py-8 text-center">
          <Calendar className="mx-auto h-8 w-8 text-muted-foreground/40" />
          <p className="mt-2 text-sm font-medium">{t("schedule.noAppointmentsAgenda", "No appointments")}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("schedule.agendaClear", "The selected {view} is clear.", {
              view: rangeLabel.toLowerCase(),
            })}
          </p>
        </div>
      ) : (
        Array.from(appointmentsByDay.entries()).map(
          ([dateKey, dayAppointments]) => (
            <div key={dateKey} className="min-w-0 space-y-2">
              {view !== "day" && (
                <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {new Date(
                    dayAppointments[0]!.startTime
                  ).toLocaleDateString(dateLocale, {
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                    timeZone: timeZone ?? undefined,
                  })}
                </h5>
              )}
              {dayAppointments.map((appointment) => {
                const start = new Date(appointment.startTime);
                const end = new Date(appointment.endTime);
                const patientName =
                  appointment.patientName || t("schedule.unknownPatient", "Unknown Patient");
                const clientName = [
                  appointment.clientFirstName,
                  appointment.clientLastName,
                ]
                  .filter(Boolean)
                  .join(" ");
                const careTeam = appointment.doctorName
                  ? formatDoctorName(appointment.doctorName, t)
                  : t("schedule.teamLane", "Team");
                const place = [
                  appointment.locationName,
                  appointment.roomName,
                ]
                  .filter(Boolean)
                  .join(" · ");

                return (
                  <button
                    key={appointment.id}
                    type="button"
                    onClick={() => onAppointmentClick(appointment)}
                    aria-label={t("schedule.openAppointmentAria", "Open {patientName} appointment at {time}", { patientName, time: formatTime(start, timeZone) })}
                    className="min-h-11 w-full overflow-hidden rounded-lg border border-border bg-card p-3 text-left transition-colors hover:bg-muted/30 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    style={{
                      borderLeftColor: getAppointmentColor(appointment),
                      borderLeftWidth: 3,
                    }}
                  >
                    <span className="flex min-w-0 items-start justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block text-xs font-medium text-muted-foreground">
                          {formatTime(start, timeZone)}–
                          {formatTime(end, timeZone)}
                        </span>
                        <span className="mt-0.5 block truncate text-sm font-semibold text-foreground">
                          {patientName}
                        </span>
                      </span>
                      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground">
                        <StatusDot status={appointment.status} />
                        {appointmentStatusLabel(appointment, t)}
                      </span>
                    </span>
                    <span className="mt-2 block min-w-0 space-y-1 text-xs text-muted-foreground">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <User className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">
                          {clientName || t("schedule.clientNotListed", "Client not listed")}
                          {appointment.patientSpecies
                            ? ` · ${formatSpecies(appointment.patientSpecies, t)}`
                            : ""}
                        </span>
                      </span>
                      <span className="flex min-w-0 items-center gap-1.5">
                        <Stethoscope className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">
                          {careTeam}
                          {place ? ` · ${place}` : ""}
                        </span>
                      </span>
                      <span className="block truncate font-medium text-foreground">
                        {appointment.typeName || t("schedule.appointmentFallback", "Appointment")}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )
        )
      )}
    </section>
  );
}

function WeekCalendar({
  days,
  appointmentsByDate,
  timeZone,
  todayKey,
  showNowLine,
  nowTop,
  onSlotClick,
  onAppointmentClick,
}: {
  days: Date[];
  appointmentsByDate: Record<string, Appointment[]>;
  timeZone?: string | null;
  todayKey: string;
  showNowLine: boolean;
  nowTop: number;
  onSlotClick?: (date: Date, y: number) => void;
  onAppointmentClick: (appointment: Appointment) => void;
}) {
  const { t, locale } = useI18n();
  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-border bg-card">
      <div className="overflow-auto">
        <div className="min-w-[920px]">
          <div className="flex border-b border-border bg-muted/30">
            <div className="w-16 shrink-0" />
            <div className="grid flex-1 grid-cols-7">
              {days.map((day) => {
                const key = toISODate(day);
                const dayAppointments = appointmentsByDate[key] ?? [];
                const isToday = key === todayKey;

                return (
                  <div
                    key={key}
                    className={cn(
                      "border-l border-border px-3 py-2",
                      isToday && "bg-primary/5"
                    )}
                  >
                    <div className="flex min-w-0 items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium uppercase text-muted-foreground">
                          {formatDayShort(day, t, locale)}
                        </p>
                        <p
                          className={cn(
                            "text-lg font-semibold",
                            isToday && "text-primary"
                          )}
                        >
                          {day.getDate()}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-background px-2 py-0.5 text-xs text-muted-foreground">
                        {dayAppointments.length}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex overflow-auto" style={{ maxHeight: "calc(100vh - 270px)" }}>
            <TimeSlots />
            <div className="grid flex-1 grid-cols-7" style={{ height: CALENDAR_HEIGHT }}>
              {days.map((day) => {
                const key = toISODate(day);
                const isToday = key === todayKey;
                const dayAppointments = sortAppointments(appointmentsByDate[key] ?? []);
                const dayLayout = buildOverlapLayout(dayAppointments);

                return (
                  <div
                    key={key}
                    className={cn(
                      "relative border-l border-border",
                      onSlotClick && "cursor-pointer",
                      isToday && "bg-primary/5"
                    )}
                    onClick={(e) => {
                      if (!onSlotClick) return;
                      if ((e.target as HTMLElement).closest("button")) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      onSlotClick(day, e.clientY - rect.top);
                    }}
                  >
                    <GridLines />
                    {showNowLine && isToday && (
                      <div
                        className="absolute left-0 right-0 z-20 flex items-center pointer-events-none"
                        style={{ top: nowTop }}
                      >
                        <div className="relative flex h-3 w-3 -ml-1.5 items-center justify-center">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.9)]" />
                        </div>
                        <div className="flex-1 border-t-2 border-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.7)]" />
                      </div>
                    )}
                    {dayAppointments.map((appt) => (
                      <AppointmentBlock
                        key={appt.id}
                        appointment={appt}
                        timeZone={timeZone}
                        onClick={() => onAppointmentClick(appt)}
                        position={dayLayout.get(appt.id)}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AppointmentChip({
  appointment,
  timeZone,
  onClick,
}: {
  appointment: Appointment;
  timeZone?: string | null;
  onClick: () => void;
}) {
  const { t } = useI18n();
  const start = new Date(appointment.startTime);
  const color = getAppointmentColor(appointment);

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-6 w-full min-w-0 items-center gap-1.5 overflow-hidden rounded-md border px-2 py-1 text-left text-[11px] leading-tight transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
      style={{
        backgroundColor: `${color}18`,
        borderColor: `${color}55`,
      }}
    >
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="min-w-0 flex-1 truncate">
        {formatTime(start, timeZone)} {appointment.patientName || t("schedule.unknownPatient", "Unknown")}
        {appointment.locationName ? ` · ${appointment.locationName}` : ""}
      </span>
    </button>
  );
}

function MonthCalendar({
  days,
  appointmentsByDate,
  currentDate,
  timeZone,
  todayKey,
  canCreateAppointments,
  onCreateClick,
  onDayOpen,
  onAppointmentClick,
}: {
  days: CalendarDay[];
  appointmentsByDate: Record<string, Appointment[]>;
  currentDate: Date;
  timeZone?: string | null;
  todayKey: string;
  canCreateAppointments: boolean;
  onCreateClick: (date: Date) => void;
  onDayOpen: (date: Date) => void;
  onAppointmentClick: (appointment: Appointment) => void;
}) {
  const { t, locale } = useI18n();
  const dateLocale = locale === "sk" ? "sk-SK" : "en-US";
  const weekLabels = buildWeekDays(currentDate).map((day) =>
    formatDayShort(day, t, locale)
  );

  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-border bg-card">
      <div className="grid grid-cols-7 border-b border-border bg-muted/30">
        {weekLabels.map((label) => (
          <div
            key={label}
            className="border-l border-border px-3 py-2 first:border-l-0"
          >
            <p className="text-xs font-medium uppercase text-muted-foreground">
              {label}
            </p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const appointments = sortAppointments(
            appointmentsByDate[day.dateKey] ?? []
          );
          const isToday = day.dateKey === todayKey;
          const visibleAppointments = appointments.slice(0, 3);
          const hiddenCount = appointments.length - visibleAppointments.length;

          return (
            <div
              key={day.dateKey}
              className={cn(
                "min-h-[8.5rem] border-l border-t border-border p-2 first:border-l-0",
                !day.isCurrentMonth && "bg-muted/20 text-muted-foreground",
                isToday && "bg-primary/5"
              )}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <button
                  type="button"
                  className={cn(
                    "h-7 min-w-7 rounded-md px-2 text-sm font-medium hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring",
                    isToday && "bg-primary text-primary-foreground hover:bg-primary/90"
                  )}
                  onClick={() => onDayOpen(day.date)}
                >
                  {day.date.getDate()}
                </button>
                {canCreateAppointments && (
                  <button
                    type="button"
                    className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    onClick={() => onCreateClick(day.date)}
                    aria-label={t(
                      "schedule.createAppointmentOnAria",
                      "Create appointment on {date}",
                      { date: day.date.toLocaleDateString(dateLocale) }
                    )}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <div className="space-y-1">
                {visibleAppointments.map((appt) => (
                  <AppointmentChip
                    key={appt.id}
                    appointment={appt}
                    timeZone={timeZone}
                    onClick={() => onAppointmentClick(appt)}
                  />
                ))}
                {hiddenCount > 0 && (
                  <button
                    type="button"
                    className="w-full rounded-md px-2 py-1 text-left text-[11px] font-medium text-muted-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
                    onClick={() => onDayOpen(day.date)}
                  >
                    {t("schedule.moreAppointments", "+{count} more", { count: hiddenCount })}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AppointmentDetailPopover({
  appointment,
  timeZone,
  onClose,
  onStatusChange,
  onReschedule,
  onCancelRecurringSeries,
  onDelete,
  isDeleting,
  canUpdateStatus,
  canManageSchedule,
  canSendReminders,
  isUpdating,
  isRescheduling,
  isCancellingSeries,
}: {
  appointment: Appointment;
  timeZone?: string | null;
  onClose: () => void;
  onStatusChange: (
    id: string,
    status: AppointmentStatus,
    confirmationContactMethod?: ConfirmationContactMethod,
    doctorId?: string
  ) => void;
  onReschedule: (input: {
    id: string;
    startTime: string;
    endTime: string;
    locationId: string;
    doctorId: string | null;
    roomId: string | null;
  }) => void;
  onCancelRecurringSeries: (seriesId: string) => void;
  onDelete: (id: string, reason: string) => void;
  isDeleting: boolean;
  canUpdateStatus: boolean;
  canManageSchedule: boolean;
  canSendReminders: boolean;
  isUpdating: boolean;
  isRescheduling: boolean;
  isCancellingSeries: boolean;
}) {
  const { t } = useI18n();
  const [inlineDoctorId, setInlineDoctorId] = useState<string>("");
  const [deleteReason, setDeleteReason] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const restoreFocusRef = useRef(true);
  const dialogTitleId = useId();
  const rescheduleDateId = `${dialogTitleId}-date`;
  const rescheduleTimeId = `${dialogTitleId}-time`;
  const rescheduleDurationId = `${dialogTitleId}-duration`;
  const rescheduleLocationFieldId = `${dialogTitleId}-location`;
  const rescheduleDoctorFieldId = `${dialogTitleId}-doctor`;
  const rescheduleRoomFieldId = `${dialogTitleId}-room`;
  const confirmationPhoneFieldId = `${dialogTitleId}-confirmation-phone`;
  const confirmationEmailFieldId = `${dialogTitleId}-confirmation-email`;
  const start = new Date(appointment.startTime);
  const end = new Date(appointment.endTime);
  const [showRescheduleForm, setShowRescheduleForm] = useState(false);
  const [showConfirmationForm, setShowConfirmationForm] = useState(false);
  const [confirmationContactMethod, setConfirmationContactMethod] =
    useState<ConfirmationContactMethod | "">("");
  const [rescheduleDate, setRescheduleDate] = useState(() =>
    toISODate(start, timeZone)
  );
  const [rescheduleTime, setRescheduleTime] = useState(() =>
    formatTimeInput(start, timeZone)
  );
  const [rescheduleDuration, setRescheduleDuration] = useState(() =>
    appointmentDurationMinutes(start, end)
  );
  const [rescheduleLocationId, setRescheduleLocationId] = useState(
    appointment.locationId ?? ""
  );
  const [rescheduleDoctorId, setRescheduleDoctorId] = useState(
    appointment.doctorId ?? ""
  );
  const [rescheduleRoomId, setRescheduleRoomId] = useState(
    appointment.roomId ?? ""
  );
  const doctorsQuery = trpc.appointments.listDoctors.useQuery(undefined, {
    enabled: canManageSchedule && showRescheduleForm,
  });
  const locationsQuery = trpc.appointments.listLocations.useQuery(undefined, {
    enabled: canManageSchedule && showRescheduleForm,
  });
  const roomsQuery = trpc.appointments.listRooms.useQuery(
    { locationId: rescheduleLocationId || undefined },
    {
      enabled:
        canManageSchedule &&
        showRescheduleForm &&
        Boolean(rescheduleLocationId),
    },
  );
  const eligibleRescheduleDoctors = doctorsQuery.data ?? [];

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previouslyFocusedElement =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const focusFrame = window.requestAnimationFrame(() => {
      popoverRef.current?.focus();
    });

    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onCloseRef.current();
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !popoverRef.current) return;

      const focusableElements = Array.from(
        popoverRef.current.querySelectorAll<HTMLElement>(
          DIALOG_FOCUSABLE_SELECTOR,
        ),
      );
      if (focusableElements.length === 0) {
        e.preventDefault();
        popoverRef.current.focus();
        return;
      }

      const firstElement = focusableElements[0]!;
      const lastElement = focusableElements[focusableElements.length - 1]!;
      const activeElement = document.activeElement;
      if (activeElement === popoverRef.current) {
        e.preventDefault();
        (e.shiftKey ? lastElement : firstElement).focus();
      } else if (
        e.shiftKey &&
        (activeElement === firstElement ||
          !popoverRef.current.contains(activeElement))
      ) {
        e.preventDefault();
        lastElement.focus();
      } else if (
        !e.shiftKey &&
        (activeElement === lastElement ||
          !popoverRef.current.contains(activeElement))
      ) {
        e.preventDefault();
        firstElement.focus();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
      if (restoreFocusRef.current && previouslyFocusedElement?.isConnected) {
        previouslyFocusedElement.focus();
      }
    };
  }, []);

  useEffect(() => {
    // Derive start/end locally from the appointment times that are already in
    // the dependency array — `start`/`end` from the render scope are recreated
    // on every render and would re-run (and reset) this form each time.
    const start = new Date(appointment.startTime);
    const end = new Date(appointment.endTime);
    setShowRescheduleForm(false);
    setShowConfirmationForm(false);
    setConfirmationContactMethod("");
    setRescheduleDate(toISODate(start, timeZone));
    setRescheduleTime(formatTimeInput(start, timeZone));
    setRescheduleDuration(appointmentDurationMinutes(start, end));
    setRescheduleLocationId(appointment.locationId ?? "");
    setRescheduleDoctorId(appointment.doctorId ?? "");
    setRescheduleRoomId(appointment.roomId ?? "");
  }, [
    appointment.id,
    appointment.startTime,
    appointment.endTime,
    appointment.locationId,
    appointment.doctorId,
    appointment.roomId,
    timeZone,
  ]);

  const clientName = [appointment.clientFirstName, appointment.clientLastName]
    .filter(Boolean)
    .join(" ") || t("schedule.unknownPatient", "Unknown Client");

  const statusActions: {
    label: string;
    status: AppointmentStatus;
    variant: "default" | "outline" | "destructive";
    disabled?: boolean;
    disabledReason?: string;
  }[] = [];
  const current = appointment.status as AppointmentStatus;
  const canMoveAppointment = current === "scheduled" || current === "confirmed";
  const needsDoctorAssignment =
    appointment.typeRequiresDoctor === 1 && !appointment.doctorId;
  const doctorRequiredForAdvance =
    current === "scheduled" &&
    needsDoctorAssignment;
  const resourceOptionsUnavailable =
    !rescheduleLocationId ||
    locationsQuery.isLoading ||
    doctorsQuery.isLoading ||
    roomsQuery.isLoading ||
    Boolean(locationsQuery.error || doctorsQuery.error || roomsQuery.error);

  if (current === "scheduled") {
    statusActions.push({
      label: t("schedule.statusConfirm", "Confirm"), /* label: "Confirm", */
      status: "confirmed",
      variant: "default",
      disabled: doctorRequiredForAdvance,
      disabledReason: doctorRequiredForAdvance
        ? t(
            "schedule.assignDoctorConfirm",
            "Assign a doctor before confirming this appointment."
          )
        : undefined,
    });
    statusActions.push({
      label: needsDoctorAssignment
        ? t("schedule.assignAndCheckIn", "Assign & Check In")
        : t("schedule.statusCheckIn", "Check In"),
      status: "checked_in",
      variant: "outline",
      disabled: needsDoctorAssignment ? !inlineDoctorId : false,
      disabledReason: needsDoctorAssignment && !inlineDoctorId
        ? t("schedule.selectDoctorPrompt", "Select a doctor to assign and check in")
        : undefined,
    });
    statusActions.push({
      label: t("schedule.statusNoShowAction", "No Show"),
      status: "no_show",
      variant: "outline",
    });
    statusActions.push({
      label: t("schedule.statusCancelAction", "Cancel"),
      status: "cancelled",
      variant: "destructive",
    });
  } else if (current === "confirmed") {
    statusActions.push({
      label: needsDoctorAssignment
        ? t("schedule.assignAndCheckIn", "Assign & Check In")
        : t("schedule.statusCheckIn", "Check In"),
      status: "checked_in",
      variant: "default",
      disabled: needsDoctorAssignment ? !inlineDoctorId : false,
      disabledReason: needsDoctorAssignment && !inlineDoctorId
        ? t("schedule.selectDoctorPrompt", "Select a doctor to assign and check in")
        : undefined,
    });
    statusActions.push({
      label: t("schedule.statusNoShowAction", "No Show"),
      status: "no_show",
      variant: "outline",
    });
    statusActions.push({
      label: t("schedule.statusCancelAction", "Cancel"),
      status: "cancelled",
      variant: "destructive",
    });
  } else if (current === "checked_in") {
    const missingClinicalTarget =
      !appointment.patientId || !appointment.clientId;
    statusActions.push({
      label: t("schedule.statusInExamAction", "In Exam"),
      status: "in_exam",
      variant: "default",
      disabled: missingClinicalTarget,
      disabledReason: missingClinicalTarget
        ? t(
            "schedule.missingClinicalTarget",
            "Open the visit and attach a patient before starting the exam."
          )
        : undefined,
    });
    statusActions.push({
      label: t("schedule.statusNoShowAction", "No Show"),
      status: "no_show",
      variant: "outline",
    });
  } else if (current === "no_show" || current === "cancelled") {
    statusActions.push({
      label: t("schedule.statusReopen", "Reopen"), /* label: "Reopen", status: "scheduled" */
      status: "scheduled",
      variant: "outline",
    });
  }
  const visibleStatusActions = canUpdateStatus ? statusActions : [];
  const canSubmitReschedule =
    isAppointmentDateInputValid(rescheduleDate) &&
    isAppointmentDurationInputValid(rescheduleDuration) &&
    !resourceOptionsUnavailable &&
    !isRescheduling;

  const handleReschedule = () => {
    if (!canSubmitReschedule) return;
    const startDt = appointmentInstantFromDateAndTime(
      rescheduleDate,
      rescheduleTime,
      timeZone
    );
    const endDt = new Date(startDt.getTime() + rescheduleDuration * 60 * 1000);
    onReschedule({
      id: appointment.id,
      startTime: startDt.toISOString(),
      endTime: endDt.toISOString(),
      locationId: rescheduleLocationId,
      doctorId: rescheduleDoctorId || null,
      roomId: rescheduleRoomId || null,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150">
      <div
        ref={popoverRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={dialogTitleId}
        tabIndex={-1}
        className="max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-hidden rounded-xl border border-border/80 bg-card shadow-2xl sm:max-h-[calc(100dvh-2rem)] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/60 bg-muted/30 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border shadow-2xs",
              current === "scheduled" && "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800",
              current === "confirmed" && "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
              current === "checked_in" && "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
              current === "in_exam" && "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800",
              current === "checked_out" && "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900/60 dark:text-slate-300 dark:border-slate-800",
              current === "no_show" && "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800",
              current === "cancelled" && "bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-900/60 dark:text-gray-400 dark:border-gray-800"
            )}>
              <StatusDot status={appointment.status} />
              <span>{appointmentStatusLabel(appointment, t)}</span>
            </span>
          </div>

          <div className="flex items-center gap-1">
            {canManageSchedule && canMoveAppointment && (
              <button
                type="button"
                title={t("schedule.btnEditAppointment", "Edit appointment")}
                aria-label={t("schedule.btnEditAppointment", "Edit appointment")}
                onClick={() => {
                  setShowConfirmationForm(false);
                  setShowRescheduleForm((show) => !show);
                }}
                className={cn(
                  "rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                  showRescheduleForm && "bg-muted text-foreground"
                )}
              >
                <Pencil className="h-4 w-4" />
              </button>
            )}
            {canManageSchedule && ["scheduled", "confirmed", "cancelled", "no_show"].includes(current) && (
              <button
                type="button"
                title={t("schedule.deleteAppointment.button", "Delete appointment")}
                aria-label={t("schedule.deleteAppointment.button", "Delete appointment")}
                disabled={isDeleting}
                onClick={() => setConfirmDelete(true)}
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              aria-label={t("schedule.closeDetailsAria", "Close appointment details")}
              onClick={onClose}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground ml-0.5"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="px-5 py-4 space-y-3.5 overflow-y-auto">
          {/* Patient Header */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 id={dialogTitleId} className="font-semibold text-lg text-foreground tracking-tight">
                  {appointment.patientName || t("schedule.unknownPatient", "Unknown Patient")}
                </h3>
                {appointment.patientSpecies && (
                  <span className="inline-flex items-center rounded-full bg-secondary/80 px-2.5 py-0.5 text-xs font-medium text-secondary-foreground border border-border/50">
                    {formatSpecies(appointment.patientSpecies, t)}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                <User className="h-3 w-3 shrink-0" />
                <span>{t("schedule.clientLabel", "Client: {name}", { name: clientName })}</span>
              </p>
            </div>

            {appointment.patientId && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2.5 text-xs gap-1 text-muted-foreground hover:text-foreground shrink-0 border-border/80"
                asChild
              >
                <Link
                  href={`/patients/${appointment.patientId}`}
                  onNavigate={() => {
                    restoreFocusRef.current = false;
                  }}
                >
                  <span>{t("schedule.btnViewChart", "View chart")}</span>
                  <ArrowUpRight className="h-3 w-3" />
                </Link>
              </Button>
            )}
          </div>

          {/* Appointment Meta Details Card */}
          <div className="rounded-lg border border-border/70 bg-muted/20 p-3 space-y-2 text-xs">
            <div className="flex items-center gap-2 text-foreground font-medium">
              <Clock className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>
                {formatTime(start, timeZone)} – {formatTime(end, timeZone)}
              </span>
              {appointment.typeName && (
                <span className="text-muted-foreground font-normal">
                  · {appointment.typeName}
                </span>
              )}
            </div>

            {(appointment.doctorName || appointment.roomName) && (
              <div className="flex items-center gap-3 text-muted-foreground flex-wrap">
                {appointment.doctorName && (
                  <div className="flex items-center gap-1.5">
                    <User className="h-3 w-3 shrink-0" />
                    <span>{formatDoctorName(appointment.doctorName, t)}</span>
                  </div>
                )}
                {appointment.roomName && (
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-[11px] text-muted-foreground">#</span>
                    <span>{appointment.roomName}</span>
                  </div>
                )}
              </div>
            )}

            {appointment.locationName && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <MapPin className="h-3 w-3 shrink-0" />
                <span>{appointment.locationName}</span>
              </div>
            )}

            {appointment.recurringSeriesId && (
              <div className="flex items-center gap-1.5 text-primary">
                <Repeat2 className="h-3 w-3 shrink-0" />
                <span className="font-medium">{t("schedule.recurringSeriesLabel", "Recurring series")}</span>
              </div>
            )}

            {appointment.notes && (
              <p className="text-muted-foreground text-xs pt-1.5 mt-1 border-t border-border/50 italic leading-relaxed">
                {appointment.notes}
              </p>
            )}
          </div>

          {doctorRequiredForAdvance && (
            <p className="rounded-md bg-amber-50 px-2.5 py-2 text-xs text-amber-900 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-200 dark:border-amber-900">
              {t(
                "schedule.assignDoctorAdvance",
                "Assign a doctor before confirming or checking in this appointment request."
              )}
            </p>
          )}

          {/* Delete Confirmation Inline Card */}
          {confirmDelete && (
            <div className="space-y-2.5 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs animate-in fade-in duration-150">
              <p className="text-xs text-foreground/90 leading-relaxed font-medium">
                {t(
                  "schedule.deleteAppointment.confirmPrompt",
                  "Remove this appointment from the schedule? Appointments with clinical or billing records must be corrected in the visit workspace."
                )}
              </p>
              <Input
                aria-label={t("schedule.deleteAppointment.reasonAriaLabel", "Reason for deleting appointment")}
                placeholder={t("schedule.deleteAppointment.reasonPlaceholder", "Reason for deleting (required)")}
                value={deleteReason}
                maxLength={500}
                onChange={(event) => setDeleteReason(event.target.value)}
                className="h-8 text-xs bg-background"
              />
              <div className="flex items-center justify-end gap-2 pt-0.5">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => {
                    setConfirmDelete(false);
                    setDeleteReason("");
                  }}
                >
                  {t("schedule.deleteAppointment.cancelButton", "Keep appointment")}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-7 text-xs"
                  disabled={isDeleting || deleteReason.trim().length < 3}
                  onClick={() => onDelete(appointment.id, deleteReason.trim())}
                >
                  {isDeleting ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : null}
                  {t("schedule.deleteAppointment.confirmButton", "Confirm deletion")}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Reschedule Form */}
        {showRescheduleForm && (
          <div className="border-t border-border px-4 py-3 bg-muted/20">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div>
                <label
                  htmlFor={rescheduleDateId}
                  className="text-xs font-medium text-muted-foreground"
                >
                  {t("schedule.labelDate", "Date")}
                </label>
                <Input
                  id={rescheduleDateId}
                  type="date"
                  value={rescheduleDate}
                  aria-invalid={!isAppointmentDateInputValid(rescheduleDate)}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="mt-1 h-9 text-sm"
                />
              </div>
              <div>
                <label
                  htmlFor={rescheduleTimeId}
                  className="text-xs font-medium text-muted-foreground"
                >
                  {t("schedule.labelTime", "Time")}
                </label>
                <select
                  id={rescheduleTimeId}
                  value={rescheduleTime}
                  onChange={(e) => setRescheduleTime(e.target.value)}
                  className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {TIME_SLOTS.map((slot) => (
                    <option key={slot.value} value={slot.value}>
                      {slot.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor={rescheduleDurationId}
                  className="text-xs font-medium text-muted-foreground"
                >
                  {t("schedule.labelDuration", "Duration")}
                </label>
                <Input
                  id={rescheduleDurationId}
                  type="number"
                  min={APPOINTMENT_DURATION_MIN_MINUTES}
                  max={APPOINTMENT_DURATION_MAX_MINUTES}
                  step={APPOINTMENT_DURATION_STEP_MINUTES}
                  value={rescheduleDuration}
                  aria-invalid={!isAppointmentDurationInputValid(rescheduleDuration)}
                  onChange={(e) => setRescheduleDuration(Number(e.target.value))}
                  className="mt-1 h-9 text-sm"
                />
              </div>
            </div>
            {current === "confirmed" ? (
              <p className="mt-2 rounded-md bg-amber-50 px-2.5 py-2 text-xs text-amber-900">
                {t(
                  "schedule.rescheduleWarning",
                  "Changing the date, time, duration, or clinic location returns this appointment to requested status. Contact the client and record confirmation again before reminders can be sent."
                )}
              </p>
            ) : null}
            <div className="mt-3">
              <label
                htmlFor={rescheduleLocationFieldId}
                className="text-xs font-medium text-muted-foreground"
              >
                {t("schedule.labelClinicLocation", "Clinic Location")}
              </label>
              <select
                id={rescheduleLocationFieldId}
                value={rescheduleLocationId}
                aria-label="Filter schedule by clinic location"
                onChange={(event) => {
                  setRescheduleLocationId(event.target.value);
                  setRescheduleRoomId("");
                }}
                disabled={locationsQuery.isLoading || Boolean(locationsQuery.error)}
                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
              >
                <option value="">{t("schedule.selectLocationPlaceholder", "Select location...")}</option>
                {(locationsQuery.data ?? []).map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>
                <label
                  htmlFor={rescheduleDoctorFieldId}
                  className="text-xs font-medium text-muted-foreground"
                >
                  {t("schedule.labelDoctor", "Doctor")}
                </label>
                <select
                  id={rescheduleDoctorFieldId}
                  value={rescheduleDoctorId}
                  onChange={(e) => setRescheduleDoctorId(e.target.value)}
                  disabled={resourceOptionsUnavailable}
                  className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
                >
                  <option value="">{t("schedule.unassigned", "Unassigned")}</option>
                  {eligibleRescheduleDoctors.map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>
                      {formatDoctorName(doctor.name, t)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor={rescheduleRoomFieldId}
                  className="text-xs font-medium text-muted-foreground"
                >
                  {t("schedule.labelRoom", "Room")}
                </label>
                <select
                  id={rescheduleRoomFieldId}
                  value={rescheduleRoomId}
                  onChange={(e) => setRescheduleRoomId(e.target.value)}
                  disabled={resourceOptionsUnavailable}
                  className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
                >
                  <option value="">{t("schedule.unassigned", "Unassigned")}</option>
                  {(roomsQuery.data ?? []).map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {(locationsQuery.error || doctorsQuery.error || roomsQuery.error) && (
              <div className="mt-2 flex items-center justify-between gap-2 rounded-md bg-destructive/10 px-2.5 py-2">
                <p className="text-xs text-destructive">
                  {t(
                    "schedule.errorLoadingResources",
                    "Location, doctor, or room options could not be loaded. Retry before changing this appointment."
                  )}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    void Promise.all([
                      locationsQuery.refetch(),
                      doctorsQuery.refetch(),
                      roomsQuery.refetch(),
                    ]);
                  }}
                >
                  {t("schedule.btnRetryOptions", "Retry options")}
                </Button>
              </div>
            )}
            <div className="mt-3 flex justify-end gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowRescheduleForm(false)}
              >
                {t("schedule.btnCancel", "Cancel")}
              </Button>
              <Button
                size="sm"
                disabled={!canSubmitReschedule}
                onClick={handleReschedule}
              >
                {isRescheduling && (
                  <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                )}
                {t("schedule.btnSaveChanges", "Save changes")}
              </Button>
            </div>
          </div>
        )}

        {/* Confirmation Form */}
        {showConfirmationForm && (
          <div className="border-t border-border px-4 py-3 bg-muted/20">
            <fieldset>
              <legend className="text-sm font-semibold">
                {t("schedule.recordConfirmationTitle", "Record client confirmation")}
              </legend>
              <p className="mt-1 text-xs text-muted-foreground">
                {t(
                  "schedule.recordConfirmationDesc",
                  "Contact the client first. This records how they agreed to the appointment; it does not send a message."
                )}
              </p>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <label
                  htmlFor={confirmationPhoneFieldId}
                  className="flex items-start gap-2 rounded-md border border-border p-2.5 text-sm has-[:checked]:border-teal-500 has-[:checked]:bg-teal-50"
                >
                  <input
                    id={confirmationPhoneFieldId}
                    type="radio"
                    name={`${dialogTitleId}-confirmation-method`}
                    value="phone"
                    checked={confirmationContactMethod === "phone"}
                    disabled={!appointment.clientPhone}
                    onChange={() => setConfirmationContactMethod("phone")}
                    className="mt-0.5 h-4 w-4"
                  />
                  <span>
                    {t("schedule.methodPhone", "Phone")}
                    {!appointment.clientPhone ? (
                      <span className="block text-xs text-muted-foreground">
                        {t("schedule.noPhoneOnFile", "No phone on file")}
                      </span>
                    ) : null}
                  </span>
                </label>
                <label
                  htmlFor={confirmationEmailFieldId}
                  className="flex items-start gap-2 rounded-md border border-border p-2.5 text-sm has-[:checked]:border-teal-500 has-[:checked]:bg-teal-50"
                >
                  <input
                    id={confirmationEmailFieldId}
                    type="radio"
                    name={`${dialogTitleId}-confirmation-method`}
                    value="email"
                    checked={confirmationContactMethod === "email"}
                    disabled={!appointment.clientEmail}
                    onChange={() => setConfirmationContactMethod("email")}
                    className="mt-0.5 h-4 w-4"
                  />
                  <span>
                    {t("schedule.methodEmail", "Email")}
                    {!appointment.clientEmail ? (
                      <span className="block text-xs text-muted-foreground">
                        {t("schedule.noEmailOnFile", "No email on file")}
                      </span>
                    ) : null}
                  </span>
                </label>
              </div>
            </fieldset>
            <div className="mt-3 flex justify-end gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setShowConfirmationForm(false);
                  setConfirmationContactMethod("");
                }}
              >
                {t("schedule.btnCancel", "Cancel")}
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={!confirmationContactMethod || isUpdating}
                onClick={() => {
                  if (!confirmationContactMethod) return;
                  onStatusChange(
                    appointment.id,
                    "confirmed",
                    confirmationContactMethod
                  );
                }}
              >
                {isUpdating ? (
                  <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                ) : null}
                {t("schedule.btnRecordConfirmation", "Record confirmation")}
              </Button>
            </div>
          </div>
        )}

        {/* Actions Footer */}
        {(appointment.id || visibleStatusActions.length > 0) && (
          <div className="border-t border-border/70 bg-muted/10 p-4 space-y-2.5 mt-auto">
            {/* 1. Primary Action: Open visit */}
            <Button
              size="default"
              className="w-full justify-center font-medium shadow-xs h-10 text-sm bg-emerald-600 hover:bg-emerald-700 text-white transition-all hover:shadow"
              asChild
            >
              <Link
                href={
                  current === "in_exam"
                    ? `/encounters/${appointment.id}#visit-closeout`
                    : `/encounters/${appointment.id}`
                }
                onNavigate={() => {
                  restoreFocusRef.current = false;
                  if (current === "in_exam") {
                    focusElementAfterNavigation("visit-closeout");
                  }
                }}
              >
                <Stethoscope className="mr-2 h-4 w-4" />
                {current === "in_exam"
                  ? t("schedule.btnReviewCloseout", "Review closeout")
                  : t("schedule.btnOpenVisit", "Open visit")}
              </Link>
            </Button>

            {/* 2. Status Actions Grid */}
            {visibleStatusActions.length > 0 && (
              <div className={cn(
                "grid gap-2",
                visibleStatusActions.length === 4 ? "grid-cols-2" :
                visibleStatusActions.length === 3 ? "grid-cols-3" :
                visibleStatusActions.length === 2 ? "grid-cols-2" :
                "grid-cols-1"
              )}>
                {visibleStatusActions.map((action) => {
                  if (action.status === "checked_in" && needsDoctorAssignment) {
                    return (
                      <div key="inline-doctor-checkin" className="col-span-full flex items-center gap-1.5">
                        <select
                          aria-label={t("schedule.selectDoctorToAssign", "Select doctor to assign")}
                          value={inlineDoctorId}
                          onChange={(e) => setInlineDoctorId(e.target.value)}
                          className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                          <option value="">{t("schedule.selectDoctorToAssign", "Select doctor...")}</option>
                          {eligibleRescheduleDoctors.map((doc) => (
                            <option key={doc.id} value={doc.id}>
                              {formatDoctorName(doc.name, t)}
                            </option>
                          ))}
                        </select>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs shrink-0 h-8"
                          disabled={isUpdating || !inlineDoctorId}
                          title={!inlineDoctorId ? t("schedule.selectDoctorPrompt", "Select a doctor to assign and check in") : undefined}
                          onClick={() => onStatusChange(appointment.id, "checked_in", undefined, inlineDoctorId)}
                        >
                          {isUpdating ? (
                            <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                          ) : null}
                          {action.label}
                        </Button>
                      </div>
                    );
                  }

                  const isCancel = action.status === "cancelled";
                  const isConfirm = action.status === "confirmed";
                  const isCheckIn = action.status === "checked_in";
                  const isNoShow = action.status === "no_show";

                  return (
                    <Button
                      key={action.status}
                      size="sm"
                      variant="outline"
                      disabled={isUpdating || action.disabled}
                      title={action.disabledReason}
                      className={cn(
                        "h-8 text-xs font-medium justify-center transition-colors shadow-2xs",
                        isConfirm && "border-emerald-200 bg-emerald-50/50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300",
                        isCheckIn && "border-blue-200 bg-blue-50/50 text-blue-700 hover:bg-blue-100 hover:text-blue-800 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-300",
                        isNoShow && "border-border text-muted-foreground hover:text-foreground hover:bg-muted/80",
                        isCancel && "border-rose-200 bg-rose-50/40 text-rose-700 hover:bg-rose-100 hover:text-rose-800 hover:border-rose-300 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-300"
                      )}
                      onClick={() => {
                        if (action.status === "confirmed") {
                          setShowRescheduleForm(false);
                          setShowConfirmationForm(true);
                          return;
                        }
                        onStatusChange(appointment.id, action.status);
                      }}
                    >
                      {isUpdating ? (
                        <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                      ) : isConfirm ? (
                        <Check className="mr-1.5 h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      ) : isCheckIn ? (
                        <UserCheck className="mr-1.5 h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                      ) : isNoShow ? (
                        <UserX className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
                      ) : isCancel ? (
                        <CalendarX className="mr-1.5 h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                      ) : null}
                      {action.label}
                    </Button>
                  );
                })}
              </div>
            )}

            {/* Send reminder (if confirmed) */}
            {canSendReminders && current === "confirmed" && (
              <SendReminderButton appointmentId={appointment.id} />
            )}

            {/* Cancel recurring series */}
            {canManageSchedule && appointment.recurringSeriesId && (
              <div className="pt-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-full text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 justify-center"
                  disabled={isCancellingSeries}
                  onClick={() => onCancelRecurringSeries(appointment.recurringSeriesId!)}
                >
                  {isCancellingSeries ? (
                    <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                  ) : (
                    <Repeat2 className="mr-1.5 h-3 w-3" />
                  )}
                  {t("schedule.btnCancelFutureSeries", "Cancel Future Series")}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


function SendReminderButton({ appointmentId }: { appointmentId: string }) {
  const { t } = useI18n();
  const sendReminder = trpc.notifications.sendAppointmentReminder.useMutation({
    onSuccess: () => {
      toast.success(t("schedule.toastReminderSent", "Reminder sent"));
    },
    onError: (err) => {
      toast.error(translateOutboundEmailError(err.message, t));
    },
  });

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={sendReminder.isPending}
      onClick={() => sendReminder.mutate({ appointmentId })}
    >
      {sendReminder.isPending ? (
        <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
      ) : (
        <Mail className="mr-1.5 h-3 w-3" />
      )}
      {t("schedule.btnSendReminder", "Send Reminder")}
    </Button>
  );
}

// --- Time slot helpers for booking form ---

function generateTimeSlots(): { label: string; value: string }[] {
  const slots: { label: string; value: string }[] = [];
  for (let hour = 8; hour <= 17; hour++) {
    for (const min of [0, 30]) {
      if (hour === 17 && min > 30) break;
      const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      const ampm = hour < 12 ? "AM" : "PM";
      const label = `${h12}:${String(min).padStart(2, "0")} ${ampm}`;
      const value = `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
      slots.push({ label, value });
    }
  }
  return slots;
}

const TIME_SLOTS = generateTimeSlots();



function BookingForm({
  onClose,
  defaultDate,
  defaultTime,
  defaultLocationId,
  defaultPatientSearch,
  timeZone,
}: {
  onClose: () => void;
  defaultDate: Date;
  defaultTime?: string;
  defaultLocationId?: string;
  defaultPatientSearch?: string;
  timeZone?: string | null;
}) {
  const { t } = useI18n();
  const modalRef = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();

  // Form state
  const [patientSearch, setPatientSearch] = useState(defaultPatientSearch ?? "");
  const [selectedPatient, setSelectedPatient] = useState<{
    id: string;
    name: string;
    species: string | null;
    clientFirstName: string | null;
    clientLastName: string | null;
  } | null>(null);
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const [typeId, setTypeId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [locationId, setLocationId] = useState(defaultLocationId ?? "");
  const [date, setDate] = useState(toISODate(defaultDate));
  const [startTime, setStartTime] = useState(defaultTime || "09:00");
  const [duration, setDuration] = useState(30);
  const [notes, setNotes] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceFrequency, setRecurrenceFrequency] =
    useState<RecurrenceFrequency>("weekly");
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const [recurrenceOccurrences, setRecurrenceOccurrences] = useState(4);

  const debouncedSearch = useDebounce(patientSearch, 300);
  const canSearchPatients = isAppointmentPatientSearchInputValid(patientSearch);
  const canRunPatientSearch =
    debouncedSearch.trim().length >= 1 &&
    isAppointmentPatientSearchInputValid(debouncedSearch);
  const hasPatientSearch = patientSearch.trim().length > 0;
  const hasValidDate = isAppointmentDateInputValid(date);
  const hasValidDuration = isAppointmentDurationInputValid(duration);
  const hasValidNotes = isAppointmentNotesInputValid(notes);
  const hasValidRecurrenceInterval =
    isAppointmentRecurrenceIntervalInputValid(recurrenceInterval);
  const hasValidRecurrenceOccurrences =
    isAppointmentRecurrenceOccurrencesInputValid(recurrenceOccurrences);
  const hasRecurringPatient = !isRecurring || Boolean(selectedPatient?.id);

  // Queries
  const {
    data: searchResults,
    isLoading: isSearchingPatients,
    error: patientSearchError,
  } = trpc.patients.search.useQuery(
    { query: debouncedSearch },
    {
      enabled: canRunPatientSearch,
    }
  );
  const patientSearchMissing =
    canRunPatientSearch &&
    !selectedPatient &&
    !isSearchingPatients &&
    !patientSearchError &&
    !searchResults;
  const appointmentTypesQuery = trpc.appointments.listTypes.useQuery();
  const locationsQuery = trpc.appointments.listLocations.useQuery();
  const doctorsQuery = trpc.appointments.listDoctors.useQuery();
  const roomsQuery = trpc.appointments.listRooms.useQuery(
    { locationId: locationId || undefined },
    { enabled: Boolean(locationId) },
  );
  const appointmentTypes = appointmentTypesQuery.data;
  const doctors = doctorsQuery.data;
  const roomsList = roomsQuery.data;
  const locations = locationsQuery.data;
  // A provider's saved location is their home base, not a prohibition on
  // covering another clinic location.
  const eligibleDoctors = doctors;
  const appointmentTypesMissing =
    !appointmentTypesQuery.isLoading &&
    !appointmentTypesQuery.error &&
    !appointmentTypes;
  const doctorsMissing =
    !doctorsQuery.isLoading && !doctorsQuery.error && !doctors;
  const roomsMissing = !roomsQuery.isLoading && !roomsQuery.error && !roomsList;
  const appointmentTypesUnavailable =
    appointmentTypesQuery.isLoading ||
    Boolean(appointmentTypesQuery.error) ||
    appointmentTypesMissing;
  const doctorsUnavailable =
    doctorsQuery.isLoading || Boolean(doctorsQuery.error) || doctorsMissing;
  const roomsUnavailable =
    !locationId ||
    roomsQuery.isLoading ||
    Boolean(roomsQuery.error) ||
    roomsMissing;
  const locationsMissing =
    !locationsQuery.isLoading && !locationsQuery.error && !locations;
  const locationsUnavailable =
    locationsQuery.isLoading ||
    Boolean(locationsQuery.error) ||
    locationsMissing;

  const createAppointment = trpc.appointments.create.useMutation({
    onSuccess: (appointment) => {
      toast.success(t("schedule.toastAppointmentCreated", "Appointment created"), { /* toast.success("Appointment created", { */
        action: {
          label: t("schedule.btnOpenVisit", "Open visit"), /* label: "Open visit" */
          onClick: () =>
            window.location.assign(`/encounters/${appointment.id}`),
        },
      });
      void utils.appointments.list.invalidate();
      onClose();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const createRecurringAppointment = trpc.appointments.createRecurring.useMutation({
    onSuccess: (result) => {
      const skippedMessage =
        result.skipped > 0
          ? t("schedule.skippedConflicts", "; skipped {count} conflicts", {
              count: result.skipped,
            })
          : "";
      toast.success(
        t(
          "schedule.toastRecurringCreated",
          "Created {count} recurring appointments{skipped}", /* Created ${result.created} recurring appointments */
          { count: result.created, skipped: skippedMessage }
        )
      );
      utils.appointments.list.invalidate();
      onClose();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const canSaveAppointment =
    Boolean(locationId) &&
    hasValidDate &&
    hasValidDuration &&
    hasValidNotes &&
    hasRecurringPatient &&
    (!isRecurring ||
      (hasValidRecurrenceInterval && hasValidRecurrenceOccurrences)) &&
    !createAppointment.isPending &&
    !createRecurringAppointment.isPending;

  useEffect(() => {
    if (!locationId && locations?.length === 1) {
      setLocationId(locations[0]!.id);
    }
  }, [locationId, locations]);

  // When appointment type changes, update duration
  useEffect(() => {
    if (typeId && appointmentTypes) {
      const found = appointmentTypes.find((t) => t.id === typeId);
      if (found?.durationMinutes) {
        setDuration(found.durationMinutes);
      }
    }
  }, [typeId, appointmentTypes]);

  // Close on escape / click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  const handleSave = () => {
    if (!canSaveAppointment) return;
    const startDt = appointmentInstantFromDateAndTime(
      date,
      startTime,
      timeZone
    );
    const endDt = new Date(startDt.getTime() + duration * 60 * 1000);

    if (isRecurring) {
      if (!selectedPatient?.id) return;
      createRecurringAppointment.mutate({
        patientId: selectedPatient.id,
        startTime: startDt.toISOString(),
        endTime: endDt.toISOString(),
        frequency: recurrenceFrequency,
        interval: recurrenceInterval,
        occurrences: recurrenceOccurrences,
        locationId,
        typeId: typeId || undefined,
        doctorId: doctorId || undefined,
        roomId: roomId || undefined,
        notes: notes.trim() || undefined,
      });
      return;
    }

    createAppointment.mutate({
      startTime: startDt.toISOString(),
      endTime: endDt.toISOString(),
      patientId: selectedPatient?.id,
      typeId: typeId || undefined,
      doctorId: doctorId || undefined,
      roomId: roomId || undefined,
      locationId,
      notes: notes.trim() || undefined,
    });
  };

  const clientName = selectedPatient
    ? [selectedPatient.clientFirstName, selectedPatient.clientLastName]
        .filter(Boolean)
        .join(" ")
    : "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div
        ref={modalRef}
        className="w-full max-w-md rounded-lg border border-border bg-card shadow-lg max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold">{t("schedule.modalNewAppointment", "New Appointment")}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 py-3 space-y-4">
          <div>
            <label
              htmlFor="new-appointment-location"
              className="text-xs font-medium text-muted-foreground"
            >
              {t("schedule.labelClinicLocation", "Clinic Location")}
            </label>
            <select
              id="new-appointment-location"
              value={locationId}
              onChange={(event) => {
                setLocationId(event.target.value);
                setDoctorId("");
                setRoomId("");
              }}
              disabled={locationsUnavailable}
              className="mt-1 h-9 w-full appearance-none rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">
                {locationsUnavailable
                  ? t("schedule.locationsUnavailable", "Locations unavailable")
                  : t("schedule.selectLocationPlaceholder", "Select location...")}
              </option>
              {locations?.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
            {locationsQuery.error || locationsMissing ? (
              <p className="mt-1 text-xs text-destructive">
                {locationsQuery.error?.message ??
                  t(
                    "schedule.errorLoadingLocations",
                    "Unable to load clinic locations. Please retry."
                  )}
              </p>
            ) : null}
          </div>

          {/* Patient search */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">{t("schedule.labelPatient", "Patient")}</label>
            {selectedPatient ? (
              <div className="mt-1 flex items-center gap-2 rounded-md border border-input bg-muted/50 px-3 py-2 text-sm">
                <span className="flex-1">
                  {selectedPatient.name}
                  {selectedPatient.species && (
                    <span className="text-muted-foreground"> ({formatSpecies(selectedPatient.species, t)})</span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPatient(null);
                    setPatientSearch("");
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div className="relative mt-1">
                <Input
                  placeholder={t("schedule.searchPatientsPlaceholder", "Search patients or owners...")}
                  value={patientSearch}
                  maxLength={APPOINTMENT_PATIENT_SEARCH_MAX_LENGTH}
                  aria-invalid={!canSearchPatients}
                  onChange={(e) => {
                    setPatientSearch(e.target.value);
                    setShowPatientDropdown(true);
                  }}
                  onFocus={() => setShowPatientDropdown(true)}
                  className="h-9 text-sm"
                />
                {showPatientDropdown &&
                  hasPatientSearch &&
                  canSearchPatients &&
                  (isSearchingPatients ||
                    patientSearchError ||
                    patientSearchMissing ||
                    searchResults) && (
                  <div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-popover shadow-md max-h-48 overflow-y-auto">
                    {patientSearchError || patientSearchMissing ? (
                      <div className="px-3 py-2 text-sm text-destructive">
                        {patientSearchError?.message ??
                          t(
                            "schedule.errorSearchingPatients",
                            "Unable to search patients. Please retry."
                          )}
                      </div>
                    ) : isSearchingPatients ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        {t("schedule.searchingPatients", "Searching patients...")}
                      </div>
                    ) : searchResults && searchResults.length > 0 ? (
                      searchResults.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
                          onClick={() => {
                            setSelectedPatient(p);
                            setShowPatientDropdown(false);
                            setPatientSearch("");
                          }}
                        >
                          <div className="font-medium">{p.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatSpecies(p.species, t)}
                            {(p.clientFirstName || p.clientLastName) && (
                              <> &middot; {t("schedule.ownerLabel", "Owner: {name}", { name: [p.clientFirstName, p.clientLastName].filter(Boolean).join(" ") })}</>
                            )}
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        {t("schedule.noPatientsFound", "No patients found")}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            {clientName && (
              <p className="mt-1 text-xs text-muted-foreground">{t("schedule.clientLabel", "Client: {name}", { name: clientName })}</p>
            )}
          </div>

          {/* Appointment Type */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">{t("schedule.appointmentType", "Appointment Type")}</label>
            <select
              value={typeId}
              onChange={(e) => setTypeId(e.target.value)}
              disabled={appointmentTypesUnavailable}
              className="mt-1 h-9 w-full appearance-none rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">
                {appointmentTypesUnavailable
                  ? t("schedule.appointmentTypesUnavailable", "Appointment types unavailable")
                  : t("schedule.selectTypePlaceholder", "Select type...")}
              </option>
              {appointmentTypes?.map((tItem) => (
                <option key={tItem.id} value={tItem.id}>
                  {tItem.name} ({t("schedule.durationMin", "{minutes} min", { minutes: tItem.durationMinutes })})
                </option>
              ))}
            </select>
            {appointmentTypesQuery.error || appointmentTypesMissing ? (
              <p className="mt-1 text-xs text-destructive">
                {appointmentTypesQuery.error?.message ??
                  t(
                    "schedule.errorLoadingTypes",
                    "Unable to load appointment types. Please retry."
                  )}
              </p>
            ) : appointmentTypesQuery.isLoading ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {t("schedule.loadingTypes", "Loading appointment types...")}
              </p>
            ) : null}
          </div>

          {/* Doctor */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">{t("schedule.labelDoctor", "Doctor")}</label>
            <select
              value={doctorId}
              onChange={(e) => setDoctorId(e.target.value)}
              disabled={doctorsUnavailable}
              className="mt-1 h-9 w-full appearance-none rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">
                {doctorsUnavailable
                  ? t("schedule.doctorsUnavailable", "Doctors unavailable")
                  : t("schedule.selectDoctorPlaceholder", "Select doctor...")}
              </option>
              {eligibleDoctors?.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {formatDoctorName(doc.name, t)}
                </option>
              ))}
            </select>
            {doctorsQuery.error || doctorsMissing ? (
              <p className="mt-1 text-xs text-destructive">
                {doctorsQuery.error?.message ??
                  t(
                    "schedule.errorLoadingDoctors",
                    "Unable to load doctors. Please retry."
                  )}
              </p>
            ) : doctorsQuery.isLoading ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {t("schedule.loadingDoctors", "Loading doctors...")}
              </p>
            ) : null}
          </div>

          {/* Room */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">{t("schedule.labelRoom", "Room")}</label>
            <select
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              disabled={roomsUnavailable}
              className="mt-1 h-9 w-full appearance-none rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">
                {roomsUnavailable
                  ? t("schedule.roomsUnavailable", "Rooms unavailable")
                  : t("schedule.selectRoomPlaceholder", "Select room...")}
              </option>
              {roomsList?.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            {roomsQuery.error || roomsMissing ? (
              <p className="mt-1 text-xs text-destructive">
                {roomsQuery.error?.message ??
                  t(
                    "schedule.errorLoadingRooms",
                    "Unable to load rooms. Please retry."
                  )}
              </p>
            ) : roomsQuery.isLoading ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {t("schedule.loadingRooms", "Loading rooms...")}
              </p>
            ) : null}
          </div>

          {/* Date */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">{t("schedule.labelDate", "Date")}</label>
            <Input
              type="date"
              value={date}
              aria-invalid={!hasValidDate}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 h-9 text-sm"
            />
          </div>

          {/* Start Time */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">{t("schedule.labelStartTime", "Start Time")}</label>
            <select
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="mt-1 h-9 w-full appearance-none rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {TIME_SLOTS.map((slot) => (
                <option key={slot.value} value={slot.value}>
                  {slot.label}
                </option>
              ))}
            </select>
          </div>

          {/* Duration */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">{t("schedule.labelDuration", "Duration (minutes)")}</label>
            <Input
              type="number"
              min={APPOINTMENT_DURATION_MIN_MINUTES}
              max={APPOINTMENT_DURATION_MAX_MINUTES}
              step={APPOINTMENT_DURATION_STEP_MINUTES}
              value={duration}
              aria-invalid={!hasValidDuration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="mt-1 h-9 text-sm"
            />
          </div>

          {/* Recurrence */}
          <div className="rounded-md border border-border bg-muted/30 p-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <Checkbox
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
              />
              <Repeat2 className="h-3.5 w-3.5 text-muted-foreground" />
              {t("schedule.repeatAppointment", "Repeat appointment")}
            </label>
            {isRecurring && (
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    {t("schedule.frequency", "Frequency")}
                  </label>
                  <select
                    value={recurrenceFrequency}
                    onChange={(e) =>
                      setRecurrenceFrequency(e.target.value as RecurrenceFrequency)
                    }
                    className="mt-1 h-9 w-full appearance-none rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="weekly">{t("schedule.frequencyWeekly", "Weekly")}</option>
                    <option value="monthly">{t("schedule.frequencyMonthly", "Monthly")}</option>
                    <option value="annual">{t("schedule.frequencyAnnual", "Annual")}</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    {t("schedule.every", "Every")}
                  </label>
                  <Input
                    type="number"
                    min={APPOINTMENT_RECURRENCE_INTERVAL_MIN}
                    max={APPOINTMENT_RECURRENCE_INTERVAL_MAX}
                    step={1}
                    value={recurrenceInterval}
                    aria-invalid={!hasValidRecurrenceInterval}
                    onChange={(e) => setRecurrenceInterval(Number(e.target.value))}
                    className="mt-1 h-9 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    {t("schedule.occurrences", "Occurrences")}
                  </label>
                  <Input
                    type="number"
                    min={APPOINTMENT_RECURRENCE_OCCURRENCES_MIN}
                    max={APPOINTMENT_RECURRENCE_OCCURRENCES_MAX}
                    step={1}
                    value={recurrenceOccurrences}
                    aria-invalid={!hasValidRecurrenceOccurrences}
                    onChange={(e) =>
                      setRecurrenceOccurrences(Number(e.target.value))
                    }
                    className="mt-1 h-9 text-sm"
                  />
                </div>
                {!hasRecurringPatient && (
                  <p className="sm:col-span-3 text-xs text-destructive">
                    {t(
                      "schedule.selectPatientForRecurring",
                      "Select a patient for recurring appointments."
                    )}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">{t("schedule.notes", "Notes")}</label>
            <textarea
              value={notes}
              maxLength={APPOINTMENT_NOTES_MAX_LENGTH}
              aria-invalid={!hasValidNotes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              placeholder={t("schedule.optionalNotesPlaceholder", "Optional notes...")}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <Button variant="outline" size="sm" onClick={onClose}>
            {t("schedule.btnCancel", "Cancel")}
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!canSaveAppointment}
          >
            {(createAppointment.isPending ||
              createRecurringAppointment.isPending) && (
              <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
            )}
            {t("schedule.btnSave", "Save")}
          </Button>
        </div>
      </div>
    </div>
  );
}

// --- Main Page ---

function ScheduleLoading() {
  const { t } = useI18n();
  return (
    <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card p-8 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      {t("schedule.loadingSchedule", "Loading schedule...")}
    </div>
  );
}

export default function SchedulePage() {
  return (
    <Suspense fallback={<ScheduleLoading />}>
      <SchedulePageContent />
    </Suspense>
  );
}

function SchedulePageContent() {
  const { t, locale } = useI18n();
  const { confirm, dialogProps } = useConfirmDialog();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const userRole = session?.user?.role;
  const canCreateAppointments = canCreateAppointmentsRole(userRole);
  const canUpdateAppointmentStatus = canUpdateAppointmentStatusRole(userRole);
  const canSendAppointmentReminders =
    canSendAppointmentRemindersRole(userRole);
  const [currentDate, setCurrentDate] = useState(() =>
    startOfCalendarDay(new Date())
  );
  const [view, setView] = useState<CalendarView>("day");
  const [doctorFilter, setDoctorFilter] = useState<string>("all");
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [bookingDefaultDate, setBookingDefaultDate] = useState(() =>
    startOfCalendarDay(new Date())
  );
  const [bookingDefaultTime, setBookingDefaultTime] = useState<string | undefined>(undefined);
  const setupBookingOpened = useRef(false);
  const firstClinicDay = searchParams.get("setup") === "first-visit";
  const requestedPatientSearch = searchParams.get("patient")?.trim() ?? "";
  const setupPatientSearch = isAppointmentPatientSearchInputValid(
    requestedPatientSearch
  )
    ? requestedPatientSearch
    : "";

  const weekDays = useMemo(() => buildWeekDays(currentDate), [currentDate]);
  const monthDays = useMemo(() => buildMonthGrid(currentDate), [currentDate]);
  const calendarSettingsQuery = trpc.appointments.calendarSettings.useQuery();
  const scheduleLocationsQuery = trpc.appointments.listLocations.useQuery();
  const calendarSettings = calendarSettingsQuery.data;
  const calendarSettingsMissing =
    !calendarSettingsQuery.isLoading &&
    !calendarSettingsQuery.error &&
    !calendarSettings;
  const verifiedCalendarSettings =
    calendarSettingsQuery.error || calendarSettingsMissing || !calendarSettings
      ? null
      : calendarSettings;
  const calendarTimeZone = verifiedCalendarSettings
    ? verifiedCalendarSettings.timezone
    : null;
  const queryRangeInput = useMemo(() => {
    if (view === "week") {
      return {
        startDate: toISODate(weekDays[0]!),
        endDate: toISODate(weekDays[6]!),
      };
    }

    if (view === "month") {
      return {
        startDate: monthDays[0]!.dateKey,
        endDate: monthDays[monthDays.length - 1]!.dateKey,
      };
    }

    const dateKey = toISODate(currentDate);
    return { startDate: dateKey, endDate: dateKey };
  }, [currentDate, monthDays, view, weekDays]);

  const { data: appointmentsData, isLoading, error } =
    trpc.appointments.list.useQuery(
      {
        startDate: queryRangeInput.startDate,
        endDate: queryRangeInput.endDate,
        doctorId: doctorFilter !== "all" ? doctorFilter : undefined,
        locationId: locationFilter !== "all" ? locationFilter : undefined,
      },
      {
        enabled: verifiedCalendarSettings !== null,
      }
    );
  const scheduleError =
    calendarSettingsQuery.error ?? scheduleLocationsQuery.error ?? error;
  const isScheduleLoading =
    calendarSettingsQuery.isLoading ||
    scheduleLocationsQuery.isLoading ||
    isLoading;
  const appointmentsMissing =
    verifiedCalendarSettings !== null &&
    !isLoading &&
    !error &&
    !appointmentsData;
  const scheduleLocationsMissing =
    !scheduleLocationsQuery.isLoading &&
    !scheduleLocationsQuery.error &&
    !scheduleLocationsQuery.data;
  const scheduleMissing =
    calendarSettingsMissing || appointmentsMissing || scheduleLocationsMissing;
  const verifiedAppointmentsData =
    error || appointmentsMissing || !appointmentsData ? null : appointmentsData;

  const { data: doctors } = trpc.appointments.listDoctors.useQuery();
  const scheduleLocations = scheduleLocationsQuery.data ?? [];
  const appointments = useMemo(
    () => sortAppointments(verifiedAppointmentsData ?? []),
    [verifiedAppointmentsData]
  );
  const scheduleReady =
    !scheduleError &&
    !isScheduleLoading &&
    !scheduleMissing &&
    Boolean(verifiedCalendarSettings && verifiedAppointmentsData);
  const canUseScheduleInteractions = canCreateAppointments && scheduleReady;
  const selectedAppointmentFromList = selectedAppointment
    ? appointments.find((appt) => appt.id === selectedAppointment.id) ?? null
    : null;
  const selectedAppointmentStillListed = Boolean(selectedAppointmentFromList);
  const appointmentsByDate = useMemo(
    () =>
      groupByCalendarDate(
        appointments,
        (appt) => appt.startTime,
        calendarTimeZone
      ),
    [appointments, calendarTimeZone]
  );

  const updateStatus = trpc.appointments.updateStatus.useMutation({
    onSuccess: () => {
      toast.success(t("schedule.toastStatusUpdated", "Appointment status updated"));
      setSelectedAppointment(null);
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const utils = trpc.useUtils();

  const deleteAppointment = trpc.appointments.delete.useMutation({
    onSuccess: () => {
      toast.success(t("schedule.deleteAppointment.toastSuccess", "Appointment deleted from the schedule"));
      setSelectedAppointment(null);
      utils.appointments.list.invalidate();
      utils.dashboard.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const rescheduleAppointment = trpc.appointments.reschedule.useMutation({
    onSuccess: (result) => {
      toast.success(
        result.confirmationRequired
          ? t(
              "schedule.toastRescheduleConfirmation",
              "Appointment moved; contact the client and confirm the new time"
            )
          : t("schedule.toastRescheduleUpdated", "Appointment updated")
      );
      setSelectedAppointment(null);
      utils.appointments.list.invalidate();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const cancelRecurringSeries = trpc.appointments.cancelRecurringSeries.useMutation({
    onSuccess: (result) => {
      const message =
        result.cancelledCount === 0
          ? t(
              "schedule.toastSeriesEndedNoFuture",
              "Recurring series ended; no future appointments needed cancellation"
            )
          : result.cancelledCount === 1
            ? t(
                "schedule.toastSeriesCancelledOne",
                "Cancelled 1 future appointment in the recurring series"
              )
            : t(
                "schedule.toastSeriesCancelledMany",
                "Cancelled {count} future appointments in the recurring series",
                { count: result.cancelledCount }
              );
      toast.success(message);
      setSelectedAppointment(null);
      utils.appointments.list.invalidate();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const handleStatusChange = (
    id: string,
    status: AppointmentStatus,
    confirmationContactMethod?: ConfirmationContactMethod,
    doctorId?: string
  ) => {
    updateStatus.mutate(
      { id, status, confirmationContactMethod, doctorId },
      {
        onSuccess: () => {
          utils.appointments.list.invalidate();
        },
      }
    );
  };

  const handleRescheduleAppointment = (input: {
    id: string;
    startTime: string;
    endTime: string;
    locationId: string;
    doctorId: string | null;
    roomId: string | null;
  }) => {
    rescheduleAppointment.mutate(input);
  };

  const handleCancelRecurringSeries = async (seriesId: string) => {
    const confirmed = await confirm({
      title: t("schedule.cancelSeriesTitle", "Cancel recurring series"),
      description: t(
        "schedule.confirmCancelSeries",
        "Cancel future appointments in this recurring series? Past, completed, and in-progress appointments will stay unchanged."
      ),
      confirmVariant: "destructive",
      confirmLabel: t("schedule.cancelSeriesConfirm", "Cancel series"),
    });
    if (!confirmed) {
      return;
    }

    cancelRecurringSeries.mutate({ seriesId });
  };

  const openBookingForm = (date: Date, time?: string) => {
    if (!canUseScheduleInteractions) return;
    setBookingDefaultDate(startOfCalendarDay(date));
    setBookingDefaultTime(time);
    setShowBookingForm(true);
  };

  useEffect(() => {
    if (
      !firstClinicDay ||
      setupBookingOpened.current ||
      !canUseScheduleInteractions
    ) {
      return;
    }
    setupBookingOpened.current = true;
    setBookingDefaultDate(startOfCalendarDay(new Date()));
    setBookingDefaultTime(undefined);
    setShowBookingForm(true);
  }, [canUseScheduleInteractions, firstClinicDay]);

  const goToday = () => setCurrentDate(startOfCalendarDay(new Date()));
  const goPrev = () =>
    setCurrentDate((d) =>
      view === "month"
        ? addCalendarMonths(d, -1)
        : addCalendarDays(d, view === "week" ? -7 : -1)
    );
  const goNext = () =>
    setCurrentDate((d) =>
      view === "month"
        ? addCalendarMonths(d, 1)
        : addCalendarDays(d, view === "week" ? 7 : 1)
    );

  useEffect(() => {
    if (scheduleError || scheduleMissing) {
      setSelectedAppointment(null);
      setShowBookingForm(false);
      return;
    }
    if (
      verifiedAppointmentsData &&
      selectedAppointment &&
      !selectedAppointmentStillListed
    ) {
      setSelectedAppointment(null);
    }
  }, [
    scheduleError,
    scheduleMissing,
    selectedAppointment,
    selectedAppointmentStillListed,
    verifiedAppointmentsData,
  ]);

  const viewOptions: { id: CalendarView; label: string }[] = [
    { id: "day", label: t("schedule.viewDay", "Day") },
    { id: "week", label: t("schedule.viewWeek", "Week") },
    { id: "month", label: t("schedule.viewMonth", "Month") },
  ];

  // Current time indicator position
  const now = new Date();
  const todayKey = toISODate(now, calendarTimeZone);
  const currentDateKey = toISODate(currentDate);
  const isToday = currentDateKey === todayKey;
  const nowParts = getZonedHourMinute(now, calendarTimeZone);
  const showNowLine = nowParts.hour >= START_HOUR && nowParts.hour < END_HOUR;
  const showDayNowLine = isToday && showNowLine;
  const nowTop = getTopOffset(now, calendarTimeZone);

  return (
    <div>
      {firstClinicDay ? (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
            {t("schedule.firstVisitStep", "First clinic day · Step 3 of 3")}
          </p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {t("schedule.firstVisitTitle", "Book the pet's first real appointment.")}
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {t(
              "schedule.firstVisitDesc",
              "Choose the pet, time, location, and visit type. Your current PIMS can stay in place while the team validates this visit end to end."
            )}
          </p>
        </div>
      ) : null}
      <PageHeader
        icon={Calendar}
        title={t("schedule.title", "Schedule")}
        subtitle={t("schedule.subtitle", "Appointment calendar")}
        actions={<CalendarSubscribe />}
        className="mb-6"
      />

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        {/* Date navigation */}
        <div className="flex min-w-0 items-center justify-between gap-3 sm:justify-start">
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              onClick={goPrev}
              className="h-11 w-11 sm:h-9 sm:w-9"
              aria-label={t("schedule.prevRangeAria", "Previous date range")}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant={isToday ? "secondary" : "outline"}
              size="sm"
              onClick={goToday}
              className="h-11 sm:h-9"
            >
              {t("schedule.today", "Today")}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={goNext}
              className="h-11 w-11 sm:h-9 sm:w-9"
              aria-label={t("schedule.nextRangeAria", "Next date range")}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <h3 className="min-w-0 truncate text-right text-sm font-medium sm:text-left">
            {formatToolbarDate(currentDate, view, locale === "sk" ? "sk-SK" : "en-US")}
          </h3>
        </div>

        <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:ml-auto sm:w-auto sm:flex-nowrap">
          {/* View toggle */}
          <div className="grid h-11 w-full grid-cols-3 rounded-md border border-border sm:flex sm:h-9 sm:w-auto">
            {viewOptions.map((option, index) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setView(option.id)}
                className={cn(
                  "min-h-11 px-3 py-1.5 text-xs font-medium transition-colors sm:min-h-0",
                  index > 0 && "border-l border-border",
                  index === 0 && "rounded-l-md",
                  index === viewOptions.length - 1 && "rounded-r-md",
                  view === option.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          {/* Doctor filter */}
          {scheduleLocations.length > 1 && (
            <div className="relative min-w-0 flex-1 sm:flex-none">
              <MapPin className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <select
                aria-label={t("schedule.filterLocationAria", "Filter schedule by clinic location")} /* aria-label="Filter schedule by clinic location" */
                value={locationFilter}
                onChange={(event) => {
                  setLocationFilter(event.target.value);
                  setSelectedAppointment(null);
                }}
                className="h-11 w-full min-w-0 appearance-none rounded-md border border-input bg-background pl-8 pr-8 text-xs focus:outline-none focus:ring-2 focus:ring-ring sm:h-9 sm:w-auto"
              >
                <option value="all">{t("schedule.allLocations", "All Locations")}</option>
                {scheduleLocations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="relative min-w-0 flex-1 sm:flex-none">
            <Filter className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <select
              value={doctorFilter}
              onChange={(e) => setDoctorFilter(e.target.value)}
              className="h-11 w-full min-w-0 appearance-none rounded-md border border-input bg-background pl-8 pr-8 text-xs focus:outline-none focus:ring-2 focus:ring-ring sm:h-9 sm:w-auto"
            >
              <option value="all">{t("schedule.allDoctors", "All Doctors")}</option>
              {doctors?.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {formatDoctorName(doc.name, t)}
                </option>
              ))}
            </select>
          </div>

          {/* New Appointment button */}
          {canCreateAppointments && (
            <Button
              size="sm"
              className="h-11 w-full sm:h-9 sm:w-auto"
              disabled={!canUseScheduleInteractions}
              onClick={() => {
                openBookingForm(currentDate);
              }}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              {t("schedule.btnNewAppointment", "New Appointment")}
            </Button>
          )}
        </div>
      </div>

      {/* Calendar area (the "your day" guide spotlights this region) */}
      <div data-tour="schedule-calendar">
      {scheduleError || scheduleMissing ? (
        <div className="mt-4 rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
          {scheduleError?.message ?? t("schedule.errorLoadingSchedule", "Unable to load schedule. Please retry.")} {/* {scheduleError?.message ?? "Unable to load schedule. Please retry."} */}
        </div>
      ) : isScheduleLoading ? (
        <div className="mt-6 flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("schedule.loadingAppointments", "Loading appointments...")}
        </div>
      ) : (
        <>
          <PhoneAgenda
            appointments={appointments}
            timeZone={calendarTimeZone}
            view={view}
            onAppointmentClick={setSelectedAppointment}
          />
          <div className="hidden sm:block">
          {view === "week" ? (
        appointments.length > 0 ? (
          <WeekCalendar
            days={weekDays}
            appointmentsByDate={appointmentsByDate}
            timeZone={calendarTimeZone}
            todayKey={todayKey}
            showNowLine={showNowLine}
            nowTop={nowTop}
            onSlotClick={
              canUseScheduleInteractions
                ? (date, y) => openBookingForm(date, getSnappedTimeFromY(y))
                : undefined
            }
            onAppointmentClick={setSelectedAppointment}
          />
        ) : (
          <>
            <EmptyState
              icon={Calendar}
              title={t("schedule.noAppointmentsWeekTitle", "No appointments this week")}
              description={t(
                "schedule.noAppointmentsWeekDesc",
                "The selected schedule is clear for this week."
              )}
              className="mt-4"
            />
            <WeekCalendar
              days={weekDays}
              appointmentsByDate={appointmentsByDate}
              timeZone={calendarTimeZone}
              todayKey={todayKey}
              showNowLine={showNowLine}
              nowTop={nowTop}
              onSlotClick={
                canUseScheduleInteractions
                  ? (date, y) => openBookingForm(date, getSnappedTimeFromY(y))
                  : undefined
              }
              onAppointmentClick={setSelectedAppointment}
            />
          </>
        )
      ) : view === "month" ? (
        appointments.length > 0 ? (
          <MonthCalendar
            days={monthDays}
            appointmentsByDate={appointmentsByDate}
            currentDate={currentDate}
            timeZone={calendarTimeZone}
            todayKey={todayKey}
            canCreateAppointments={canUseScheduleInteractions}
            onCreateClick={(date) => openBookingForm(date)}
            onDayOpen={(date) => {
              setCurrentDate(startOfCalendarDay(date));
              setView("day");
            }}
            onAppointmentClick={setSelectedAppointment}
          />
        ) : (
          <>
            <EmptyState
              icon={Calendar}
              title={t("schedule.noAppointmentsMonthTitle", "No appointments in this month")}
              description={t(
                "schedule.noAppointmentsMonthDesc",
                "The selected schedule is clear for this month."
              )}
              className="mt-4"
            />
            <MonthCalendar
              days={monthDays}
              appointmentsByDate={appointmentsByDate}
              currentDate={currentDate}
              timeZone={calendarTimeZone}
              todayKey={todayKey}
              canCreateAppointments={canUseScheduleInteractions}
              onCreateClick={(date) => openBookingForm(date)}
              onDayOpen={(date) => {
                setCurrentDate(startOfCalendarDay(date));
                setView("day");
              }}
              onAppointmentClick={setSelectedAppointment}
            />
          </>
        )
      ) : (
        <DayCalendar
          appointments={appointments}
          timeZone={calendarTimeZone}
          showNowLine={showDayNowLine}
          nowTop={nowTop}
          onSlotClick={
            canUseScheduleInteractions
              ? (y) => openBookingForm(currentDate, getSnappedTimeFromY(y))
              : undefined
          }
          onAppointmentClick={setSelectedAppointment}
        />
          )}
          </div>
        </>
      )}
      </div>

      {/* Detail popover */}
      {selectedAppointmentFromList &&
        verifiedCalendarSettings &&
        scheduleReady &&
        selectedAppointmentStillListed && (
          <AppointmentDetailPopover
            appointment={selectedAppointmentFromList}
            timeZone={verifiedCalendarSettings.timezone}
            onClose={() => setSelectedAppointment(null)}
            onStatusChange={handleStatusChange}
            onReschedule={handleRescheduleAppointment}
            onDelete={(id, reason) => deleteAppointment.mutate({ id, reason })}
            isDeleting={deleteAppointment.isPending}
            onCancelRecurringSeries={handleCancelRecurringSeries}
            canUpdateStatus={canUpdateAppointmentStatus}
            canManageSchedule={canCreateAppointments}
            canSendReminders={canSendAppointmentReminders}
            isUpdating={updateStatus.isPending}
            isRescheduling={rescheduleAppointment.isPending}
            isCancellingSeries={cancelRecurringSeries.isPending}
          />
        )}

      {/* Booking form */}
      {canUseScheduleInteractions &&
        showBookingForm &&
        verifiedCalendarSettings && (
          <BookingForm
            onClose={() => setShowBookingForm(false)}
            defaultDate={bookingDefaultDate}
            defaultTime={bookingDefaultTime}
            defaultLocationId={
              locationFilter !== "all"
                ? locationFilter
                : scheduleLocations.length === 1
                  ? scheduleLocations[0]!.id
                  : undefined
            }
            defaultPatientSearch={setupPatientSearch || undefined}
            timeZone={verifiedCalendarSettings.timezone}
          />
        )
      }
      <ConfirmDialog {...dialogProps} />
    </div>
  );
}
