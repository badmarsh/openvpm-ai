/**
 * Statické dáta pre M1 mockup (bez DB/tRPC) — obsah kopíruje produkčné
 * stĺpce z /field-visits, len v prevedení pre mobilné layouty.
 */

export interface WithdrawalWindow {
  readonly days: number;
  readonly active: boolean;
  readonly remainingDays: number;
  readonly safeUntil: string;
}

export interface WithdrawalFixture {
  readonly id: string;
  readonly earTag: string;
  readonly patientName: string;
  readonly farmName: string;
  readonly medicationName: string;
  readonly administeredAt: string;
  readonly milk: WithdrawalWindow;
  readonly meat: WithdrawalWindow;
  readonly overallSafeUntil: string | null;
}

export interface TodayLogFixture {
  readonly id: string;
  readonly time: string;
  readonly farmName: string;
  readonly actions: readonly string[];
  readonly vetName: string;
  readonly animals: number;
  readonly signed: boolean;
  readonly invoice: { readonly amountEur: string } | null;
}

export type AgendaStopState = "done" | "enroute" | "planned";

export interface AgendaStopFixture {
  readonly id: string;
  readonly timeWindow: string;
  readonly farmName: string;
  readonly distanceKm: string;
  readonly animals: number;
  readonly plannedActions: readonly string[];
  readonly state: AgendaStopState;
  readonly withdrawalAlert?: boolean;
}

export const FARMS = [
  { name: "PD Bučko · F. 04, Lipt. Hrádok" },
  { name: "Rohožník — Agro stála" },
  { name: "Záhrada SNP 12, Malé Leváre" },
] as const;

export const WITHDRAWAL_WATCH: readonly WithdrawalFixture[] = [
  {
    id: "w-1",
    earTag: "SK 1234 5678 001",
    patientName: "Blesk",
    farmName: "PD Bučko · F. 04",
    medicationName: "Amoxicillin LA 15 % — 20 ml i.m.",
    administeredAt: "29. 9. 2026 9:40",
    milk: { days: 5, active: true, remainingDays: 4, safeUntil: "3. 10. 2026" },
    meat: { days: 18, active: true, remainingDays: 17, safeUntil: "17. 10. 2026" },
    overallSafeUntil: "17. 10. 2026",
  },
  {
    id: "w-2",
    earTag: "SK 1234 5678 214",
    patientName: "Muška",
    farmName: "PD Bučko · F. 04",
    medicationName: "Ivermectin 1 % — 8 ml s.c.",
    administeredAt: "24. 9. 2026 14:10",
    milk: { days: 0, active: false, remainingDays: 0, safeUntil: "—" },
    meat: { days: 28, active: true, remainingDays: 23, safeUntil: "22. 10. 2026" },
    overallSafeUntil: "22. 10. 2026",
  },
  {
    id: "w-3",
    earTag: "SK 1234 5678 509",
    patientName: "Zora",
    farmName: "Rohožník — Agro stála",
    medicationName: "Enrofloxacin 10 % — 12 ml s.c.",
    administeredAt: "18. 9. 2026 8:05",
    milk: { days: 7, active: false, remainingDays: 0, safeUntil: "25. 9. 2026" },
    meat: { days: 0, active: false, remainingDays: 0, safeUntil: "—" },
    overallSafeUntil: null,
  },
];

export const ACTIVE_WITHDRAWAL_COUNT = WITHDRAWAL_WATCH.filter((w) => w.overallSafeUntil).length;

export const TODAY_LOG: readonly TodayLogFixture[] = [
  {
    id: "v-1",
    time: "8:05",
    farmName: "PD Bučko · F. 04",
    actions: ["prevzia", "podania · 3"],
    vetName: "MVDr. Capáková",
    animals: 12,
    signed: true,
    invoice: { amountEur: "184,50" },
  },
  {
    id: "v-2",
    time: "10:20",
    farmName: "Rohožník — Agro stála",
    actions: ["očkovanie", "dehelminthizácia"],
    vetName: "MVDr. Hruška",
    animals: 34,
    signed: false,
    invoice: null,
  },
  {
    id: "v-3",
    time: "13:40",
    farmName: "Záhrada SNP 12",
    actions: ["kastrácia", "chov"],
    vetName: "MVDr. Capáková",
    animals: 2,
    signed: true,
    invoice: null,
  },
];

export const TODAY_AGENDA: readonly AgendaStopFixture[] = [
  {
    id: "s-1",
    timeWindow: "7:30 – 9:30",
    farmName: "PD Bučko · F. 04, Lipt. Hrádok",
    distanceKm: "18 km",
    animals: 12,
    plannedActions: ["prevzia", "podania · 3", "kontrola OL"],
    state: "done",
  },
  {
    id: "s-2",
    timeWindow: "10:00 – 11:30",
    farmName: "Rohožník — Agro stála",
    distanceKm: "34 km",
    animals: 34,
    plannedActions: ["očkovanie", "dehelminthizácia"],
    state: "enroute",
    withdrawalAlert: true,
  },
  {
    id: "s-3",
    timeWindow: "14:00 – 15:00",
    farmName: "Záhrada SNP 12, Malé Leváre",
    distanceKm: "51 km",
    animals: 2,
    plannedActions: ["kastrácia"],
    state: "planned",
  },
];
