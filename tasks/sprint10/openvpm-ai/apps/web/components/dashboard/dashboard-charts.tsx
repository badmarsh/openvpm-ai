"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import { formatCurrency, localeForCountry } from "@/lib/locale/format";
import { useI18n } from "@/lib/i18n";

const SPECIES_COLORS: Record<string, string> = {
  Canine: "#3b82f6",
  Feline: "#f59e0b",
  Avian: "#10b981",
  Rabbit: "#8b5cf6",
  Reptile: "#ef4444",
  Equine: "#06b6d4",
  Other: "#6b7280",
};

const MONTH_SK: Record<string, string> = {
  Jan: "jan",
  Feb: "feb",
  Mar: "mar",
  Apr: "apr",
  May: "máj",
  Jun: "jún",
  Jul: "júl",
  Aug: "aug",
  Sep: "sep",
  Oct: "okt",
  Nov: "nov",
  Dec: "dec",
};

const WEEKDAY_SK_SHORT: Record<string, string> = {
  Mon: "Po",
  Tue: "Ut",
  Wed: "St",
  Thu: "Št",
  Fri: "Pi",
  Sat: "So",
  Sun: "Ne",
};

const WEEKDAY_SK_FULL: Record<string, string> = {
  Mon: "Pondelok",
  Tue: "Utorok",
  Wed: "Streda",
  Thu: "Štvrtok",
  Fri: "Piatok",
  Sat: "Sobota",
  Sun: "Nedeľa",
};

type AppointmentChartPoint = {
  date: string;
  completed: number;
  scheduled: number;
  cancelled: number;
};

type SpeciesChartPoint = {
  name: string;
  value: number;
};

type RevenueChartPoint = {
  date: string;
  revenue: number;
};

type ProductionByDoctorPoint = {
  doctorName: string;
  production: number;
};

function PieLabel({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
  name,
}: {
  cx: number;
  cy: number;
  midAngle: number;
  innerRadius: number;
  outerRadius: number;
  percent: number;
  name: string;
}) {
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 1.4;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  if (percent < 0.03) return null;
  return (
    <text
      x={x}
      y={y}
      fill="currentColor"
      className="text-xs fill-foreground"
      textAnchor={x > cx ? "start" : "end"}
      dominantBaseline="central"
    >
      {name} ({(percent * 100).toFixed(0)}%)
    </text>
  );
}

export function DashboardCharts({
  appointmentsByDay,
  speciesDistribution,
  revenueByDay,
  productionByDoctor,
  currency,
  country,
}: {
  appointmentsByDay: AppointmentChartPoint[];
  speciesDistribution: SpeciesChartPoint[];
  revenueByDay: RevenueChartPoint[];
  productionByDoctor: ProductionByDoctorPoint[];
  currency: string;
  country: string;
}) {
  const { t, locale } = useI18n();

  const fmtMoney = (value: number) => formatCurrency(value, currency, country);
  const fmtAxisMoney = (value: number) =>
    new Intl.NumberFormat(localeForCountry(country), {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);

  const fmtWeekdayTick = (day: string) => {
    if (locale === "sk") {
      return WEEKDAY_SK_SHORT[day] ?? day;
    }
    return day;
  };

  const fmtWeekdayTooltip = (day: string) => {
    if (locale === "sk") {
      return WEEKDAY_SK_FULL[day] ?? day;
    }
    return day;
  };

  const fmtDateTick = (dateStr: string) => {
    if (locale === "sk") {
      const match = dateStr.match(/^([A-Za-z]{3})\s+(\d{1,2})$/);
      if (match) {
        const month = match[1];
        const day = parseInt(match[2], 10);
        const skMonth = MONTH_SK[month] ?? month;
        return `${day}. ${skMonth}`;
      }
      const isoMatch = dateStr.match(/^\d{4}-(\d{2})-(\d{2})$/);
      if (isoMatch) {
        const day = parseInt(isoMatch[2], 10);
        const mNum = parseInt(isoMatch[1], 10);
        const months = [
          "jan",
          "feb",
          "mar",
          "apr",
          "máj",
          "jún",
          "júl",
          "aug",
          "sep",
          "okt",
          "nov",
          "dec",
        ];
        const skMonth = months[mNum - 1] ?? isoMatch[1];
        return `${day}. ${skMonth}`;
      }
    }
    return dateStr;
  };

  const localizedSpeciesDistribution = useMemo(() => {
    return speciesDistribution.map((entry) => ({
      ...entry,
      rawName: entry.name,
      name: t(`species.${entry.name.toLowerCase()}`, entry.name),
    }));
  }, [speciesDistribution, t]);

  const localizedDoctorProduction = useMemo(() => {
    return productionByDoctor.map((item) => ({
      ...item,
      doctorName:
        item.doctorName === "Unassigned"
          ? t("encounters.workspace.unassignedProvider", "Unassigned")
          : item.doctorName,
    }));
  }, [productionByDoctor, t]);

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 font-heading text-lg font-semibold">
            {t(
              "dashboard.charts.appointmentsThisWeek",
              "Appointments This Week",
            )}
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={appointmentsByDay}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="date"
                className="text-xs fill-muted-foreground"
                tick={{ fontSize: 12 }}
                tickFormatter={fmtWeekdayTick}
              />
              <YAxis
                allowDecimals={false}
                className="text-xs fill-muted-foreground"
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "0.5rem",
                  fontSize: "0.875rem",
                }}
                labelFormatter={(label) => fmtWeekdayTooltip(String(label))}
              />
              <Legend wrapperStyle={{ fontSize: "0.75rem" }} />
              <Bar
                dataKey="completed"
                name={t("dashboard.charts.completed", "Completed")}
                stackId="a"
                fill="#22c55e"
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="scheduled"
                name={t("dashboard.charts.scheduled", "Scheduled")}
                stackId="a"
                fill="#3b82f6"
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="cancelled"
                name={t("dashboard.charts.cancelled", "Cancelled")}
                stackId="a"
                fill="#ef4444"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 font-heading text-lg font-semibold">
            {t("dashboard.charts.speciesDistribution", "Species Distribution")}
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={localizedSpeciesDistribution}
                cx="50%"
                cy="50%"
                outerRadius={100}
                dataKey="value"
                label={PieLabel}
              >
                {localizedSpeciesDistribution.map((entry) => (
                  <Cell
                    key={entry.rawName ?? entry.name}
                    fill={
                      SPECIES_COLORS[entry.rawName ?? entry.name] ?? "#6b7280"
                    }
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "0.5rem",
                  fontSize: "0.875rem",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 font-heading text-lg font-semibold">
            {t("dashboard.charts.revenueLast30Days", "Revenue (Last 30 Days)")}
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={revenueByDay}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="date"
                className="text-xs fill-muted-foreground"
                tick={{ fontSize: 12 }}
                tickFormatter={fmtDateTick}
              />
              <YAxis
                className="text-xs fill-muted-foreground"
                tick={{ fontSize: 12 }}
                tickFormatter={fmtAxisMoney}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "0.5rem",
                  fontSize: "0.875rem",
                }}
                labelFormatter={(label) => fmtDateTick(String(label))}
                formatter={(value: number) => [
                  fmtMoney(value),
                  t("dashboard.charts.revenue", "Revenue"),
                ]}
              />
              <Line
                type="monotone"
                dataKey="revenue"
                name={t("dashboard.charts.revenue", "Revenue")}
                stroke="#0d9488"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: "#0d9488" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 font-heading text-lg font-semibold">
            {/* Production by Doctor (MTD) */}
            {t(
              "dashboard.charts.productionByDoctor",
              "Production by Doctor (MTD)",
            )}
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={localizedDoctorProduction}
              layout="vertical"
              margin={{ left: 16, right: 24 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                type="number"
                className="text-xs fill-muted-foreground"
                tick={{ fontSize: 12 }}
                tickFormatter={fmtAxisMoney}
              />
              <YAxis
                dataKey="doctorName"
                type="category"
                width={120}
                className="text-xs fill-muted-foreground"
                tick={{ fontSize: 12 }}
              />
              {/* formatter={(value: number) => [fmtMoney(value), "Production"]} */}
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "0.5rem",
                  fontSize: "0.875rem",
                }}
                formatter={(value: number) => [
                  fmtMoney(value),
                  t("dashboard.charts.production", "Production"),
                ]}
              />
              <Bar
                dataKey="production"
                name={t("dashboard.charts.production", "Production")}
                fill="#14b8a6"
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
}
