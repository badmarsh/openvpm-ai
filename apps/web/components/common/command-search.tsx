"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Command } from "cmdk";
import {
  PawPrint,
  Users,
  Calendar,
  FileText,
  X,
  Search,
  Package,
  BarChart3,
  Settings,
  Clipboard,
  Mail,
  Loader2,
  AlertCircle,
  Syringe,
  FlaskConical,
  BellRing,
  Archive,
  ReceiptEuro,
  Shield,
  Sun,
  Moon,
  Mic,
  ChevronDown,
  ShoppingCart,
  Truck,
  PackagePlus,
  Pill,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { PATIENT_SPECIES_EMOJI } from "@/lib/patients/species";
import { useGuiTheme } from "@/lib/theme/theme-context";
import { useI18n } from "@/lib/i18n";
import skMessages from "@/messages/sk.json";
import enMessages from "@/messages/en.json";

const speciesEmoji: Record<string, string> = PATIENT_SPECIES_EMOJI;

type UserRole =
  | "admin"
  | "veterinarian"
  | "technician"
  | "front_desk"
  | "viewer";

type CommandItemConfig = {
  labelKey: string;
  fallbackLabel: string;
  href: string;
  Icon: React.ElementType;
  roles: UserRole[];
  searchAliases?: string[];
};

type ContextActionItem = {
  id: string;
  labelKey: string;
  fallbackLabel: string;
  href: string;
  Icon: React.ElementType;
  roles: UserRole[];
};

const allRoles: UserRole[] = [
  "admin",
  "veterinarian",
  "technician",
  "front_desk",
  "viewer",
];

const PRIMARY_NAV_KEYS = new Set([
  "commandSearch.navSchedule",
  "commandSearch.navPatients",
  "commandSearch.navClients",
  "commandSearch.navWhiteboard",
  "commandSearch.navBilling",
  "commandSearch.navRecords",
]);

const PRIMARY_NAV_ORDER = [
  "commandSearch.navSchedule",
  "commandSearch.navPatients",
  "commandSearch.navClients",
  "commandSearch.navWhiteboard",
  "commandSearch.navBilling",
  "commandSearch.navRecords",
];

const navigationItems: CommandItemConfig[] = [
  {
    labelKey: "commandSearch.navDashboard",
    fallbackLabel: "Dashboard",
    href: "/",
    Icon: BarChart3,
    roles: allRoles,
    searchAliases: ["prehlad", "statistika", "dashboard", "home", "stats"],
  },
  {
    labelKey: "commandSearch.navPatients",
    fallbackLabel: "Patients",
    href: "/patients",
    Icon: PawPrint,
    roles: allRoles,
    searchAliases: ["pacienti", "zvierata", "pets"],
  },
  {
    labelKey: "commandSearch.navClients",
    fallbackLabel: "Clients",
    href: "/clients",
    Icon: Users,
    roles: allRoles,
    searchAliases: ["klienti", "majitelia", "owners", "customers"],
  },
  {
    labelKey: "commandSearch.navSchedule",
    fallbackLabel: "Schedule",
    href: "/schedule",
    Icon: Calendar,
    roles: allRoles,
    searchAliases: ["rozvrh", "kalendar", "diar", "calendar", "schedule"],
  },
  {
    labelKey: "commandSearch.navWhiteboard",
    fallbackLabel: "Whiteboard",
    href: "/whiteboard",
    Icon: Clipboard,
    roles: allRoles,
    searchAliases: ["tabula", "hospitalizacia", "whiteboard", "hospital"],
  },
  {
    labelKey: "commandSearch.navRecords",
    fallbackLabel: "Records",
    href: "/records",
    Icon: FileText,
    roles: allRoles,
    searchAliases: ["zaznamy", "karty", "zdravotna dokumentacia", "records", "medical records"],
  },
  {
    labelKey: "commandSearch.navPrescriptions",
    fallbackLabel: "Medications & Oversight",
    href: "/prescriptions",
    Icon: Pill,
    roles: ["admin", "veterinarian", "technician"],
    searchAliases: ["recept", "recepty", "liek", "lieky", "predpis", "prescriptions", "medications"],
  },
  {
    labelKey: "commandSearch.navLabInbox",
    fallbackLabel: "Lab Inbox",
    href: "/lab-results",
    Icon: FlaskConical,
    roles: ["admin", "veterinarian", "technician", "front_desk", "viewer"],
    searchAliases: ["laboratorium", "vysledky", "lab", "tests"],
  },
  {
    labelKey: "commandSearch.navBilling",
    fallbackLabel: "Billing",
    href: "/billing",
    Icon: ReceiptEuro,
    roles: allRoles,
    searchAliases: ["faktúracia", "fakturacia", "faktúry", "faktury", "financie", "uctovnictvo", "účet", "billing", "invoices"],
  },
  {
    labelKey: "commandSearch.navInventory",
    fallbackLabel: "Inventory",
    href: "/inventory",
    Icon: Package,
    roles: allRoles,
    searchAliases: ["sklad", "zasoby", "lieky", "tovar", "inventory", "stock", "meds"],
  },
  {
    labelKey: "commandSearch.navInbox",
    fallbackLabel: "Inbox",
    href: "/inbox",
    Icon: Mail,
    roles: allRoles,
    searchAliases: ["schranka", "spravy", "inbox", "messages"],
  },
  {
    labelKey: "commandSearch.navRecalls",
    fallbackLabel: "Vaccination Recalls",
    href: "/recalls",
    Icon: Syringe,
    roles: ["admin", "veterinarian", "front_desk"],
    searchAliases: ["ockovanie", "vakcinacia", "odvolania", "recalls", "vaccines"],
  },
  {
    labelKey: "commandSearch.navCareReminders",
    fallbackLabel: "Care Reminders",
    href: "/care-reminders",
    Icon: BellRing,
    roles: allRoles,
    searchAliases: ["pripomienky", "prevencia", "reminders", "care"],
  },
  {
    labelKey: "commandSearch.navImportedHistory",
    fallbackLabel: "Imported History",
    href: "/migration-archive",
    Icon: Archive,
    roles: allRoles,
    searchAliases: ["archiv", "migracia", "historia", "archive", "history"],
  },
  {
    labelKey: "commandSearch.navEkasaTerminal",
    fallbackLabel: "e-Kasa Terminal",
    href: "/billing/ekasa",
    Icon: ReceiptEuro,
    roles: allRoles,
    searchAliases: ["ekasa", "pokladna", "terminal", "cash"],
  },
  {
    labelKey: "commandSearch.navControlledSubstances",
    fallbackLabel: "Controlled Substances",
    href: "/controlled-substances",
    Icon: Shield,
    roles: ["admin", "veterinarian"],
    searchAliases: ["kontrolovane latky", "opiaty", "omamne", "trezor", "narcotics", "controlled substances"],
  },
  { labelKey: "commandSearch.navSettings", fallbackLabel: "Settings", href: "/settings", Icon: Settings, roles: ["admin"] },
];

const quickActionItems: CommandItemConfig[] = [
  {
    labelKey: "commandSearch.newClient",
    fallbackLabel: "New Client",
    href: "/clients/new",
    Icon: Users,
    roles: ["admin", "veterinarian", "technician", "front_desk"],
    searchAliases: ["majitel", "majiteľ", "zakaznik", "zákazník", "klient", "owner", "customer"],
  },
  {
    labelKey: "commandSearch.newPatient",
    fallbackLabel: "New Patient",
    href: "/patients/new",
    Icon: PawPrint,
    roles: ["admin", "veterinarian", "technician", "front_desk"],
    searchAliases: ["zviera", "pes", "macka", "mačka", "pacient", "pet", "animal"],
  },
  {
    labelKey: "commandSearch.newAppointment",
    fallbackLabel: "New Appointment",
    href: "/schedule?new=1",
    Icon: Calendar,
    roles: ["admin", "veterinarian", "technician", "front_desk"],
    searchAliases: ["návšteva", "navsteva", "objednať", "objednat", "termín", "termin", "objednavka", "kalendár", "kalendar", "appointment", "booking", "visit", "encounter"],
  },
  {
    labelKey: "commandSearch.newSoapNote",
    fallbackLabel: "New SOAP Note",
    href: "/records?tab=soap&new=1",
    Icon: FileText,
    roles: ["admin", "veterinarian", "technician"],
    searchAliases: ["vyšetrenie", "vysetrenie", "záznam", "zaznam", "dekurz", "anamnéza", "anamneza", "diktat", "soap", "exam", "clinical", "note"],
  },
  {
    labelKey: "commandSearch.newInvoice",
    fallbackLabel: "New Invoice",
    href: "/billing/new",
    Icon: ReceiptEuro,
    roles: ["admin", "front_desk"],
    searchAliases: ["faktúra", "faktura", "účet", "ucet", "platba", "doklad", "účtenka", "uctenka", "bill", "invoice", "payment"],
  },
  {
    labelKey: "commandSearch.issueReceipt",
    fallbackLabel: "Issue Receipt",
    href: "/billing/new",
    Icon: ReceiptEuro,
    roles: ["admin", "front_desk"],
    searchAliases: ["blocek", "paragon", "pokladňa", "pokladna", "receipt"],
  },
  {
    labelKey: "commandSearch.openEkasa",
    fallbackLabel: "Open e-Kasa",
    href: "/billing/ekasa",
    Icon: ReceiptEuro,
    roles: ["admin", "veterinarian", "front_desk"],
    searchAliases: ["ekasa", "pokladňa", "pokladna", "terminal", "blocek", "cash register"],
  },
  {
    labelKey: "commandSearch.openPos",
    fallbackLabel: "POS Register",
    href: "/billing/pos",
    Icon: ShoppingCart,
    roles: ["admin", "veterinarian", "front_desk"],
    searchAliases: ["pokladňa", "pokladna", "pos", "pultový predaj", "pultovy predaj", "predaj", "kasa", "checkout", "cash register"],
  },
  {
    labelKey: "commandSearch.goodsReceipt",
    fallbackLabel: "Goods Receipt",
    href: "/inventory?import=1",
    Icon: Truck,
    roles: ["admin", "veterinarian", "technician", "front_desk"],
    searchAliases: ["príjem tovaru", "prijem tovaru", "príjem", "prijem", "dodací list", "dodaci list", "dodávka", "dodavka", "naskladniť", "naskladnit", "goods receipt", "delivery note", "stock in"],
  },
  {
    labelKey: "commandSearch.newProduct",
    fallbackLabel: "New Product",
    href: "/inventory?new=1",
    Icon: PackagePlus,
    roles: ["admin", "veterinarian", "technician", "front_desk"],
    searchAliases: ["produkt", "tovar", "položka", "polozka", "sklad", "new product", "stock item"],
  },
];

function isUserRole(role?: string | null): role is UserRole {
  return allRoles.includes(role as UserRole);
}

function normalizeSearchText(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function resolveI18nLabels(labelKey: string, fallbackLabel: string) {
  const shortKey = labelKey.replace(/^commandSearch\./, "");
  const sk = (skMessages.commandSearch as Record<string, string>)[shortKey] ?? "";
  const en = (enMessages.commandSearch as Record<string, string>)[shortKey] ?? fallbackLabel;
  return { sk, en };
}

/** Hard cap on the matched actions shown above the DB results. */
const MATCHED_ACTION_LIMIT = 5;

/**
 * Scores how well a quick action / navigation entry matches the typed query.
 * Higher is better: exact label > label prefix > label substring > alias hit.
 * Returns 0 when nothing matches. Labels are resolved in both Slovak and
 * English so a query typed in either language lands on the same entry, and
 * both sides are normalized, so diacritics never break a match.
 */
function scoreActionMatch(
  item: CommandItemConfig,
  queryNorm: string,
  labels: string[],
): number {
  if (!queryNorm) return 0;

  const haystacks = labels.map(normalizeSearchText).filter(Boolean);
  if (haystacks.some((label) => label === queryNorm)) return 4;
  if (haystacks.some((label) => label.startsWith(queryNorm))) return 3;
  if (haystacks.some((label) => label.includes(queryNorm))) return 2;

  const aliases = (item.searchAliases ?? []).map(normalizeSearchText).filter(Boolean);
  if (aliases.some((alias) => alias === queryNorm)) return 3;
  if (aliases.some((alias) => alias.startsWith(queryNorm))) return 2;
  return aliases.some((alias) => alias.includes(queryNorm)) ? 1 : 0;
}

/**
 * Route-aware boost rules for the no-query Quick Actions list: while the user
 * works inside one of these sections, the follow-up actions they are most
 * likely to need next float to the top of the palette.
 */
const ROUTE_QUICK_ACTION_BOOSTS: {
  paths: string[];
  /** Sub-routes where the boost no longer applies (the user is already there). */
  exclude?: string[];
  labelKeys: string[];
}[] = [
  {
    paths: ["/patients", "/clients"],
    exclude: ["/patients/new", "/clients/new"],
    labelKeys: ["commandSearch.newPatient", "commandSearch.newClient"],
  },
  {
    paths: ["/schedule", "/encounters"],
    labelKeys: ["commandSearch.newAppointment"],
  },
  {
    // `/billing/pos` is the full-screen POS register inside the billing section.
    paths: ["/billing", "/billing/pos"],
    exclude: ["/billing/new"],
    labelKeys: ["commandSearch.openPos", "commandSearch.newInvoice"],
  },
  {
    paths: ["/inventory"],
    labelKeys: ["commandSearch.goodsReceipt", "commandSearch.newProduct"],
  },
];

/** True when the active route is the section itself or a page inside it. */
function isWithinSection(pathname: string, section: string): boolean {
  return pathname === section || pathname.startsWith(`${section}/`);
}

/**
 * Moves the actions boosted for the active route to the front of the list,
 * preserving the configured order and the original order of everything else.
 */
function boostQuickActionsForRoute(
  items: CommandItemConfig[],
  pathname: string,
  extraLabelKeys: string[] = [],
): CommandItemConfig[] {
  const boostedLabelKeys = [
    ...ROUTE_QUICK_ACTION_BOOSTS.filter(
      (rule) =>
        rule.paths.some((section) => isWithinSection(pathname, section)) &&
        !(rule.exclude ?? []).some((section) => isWithinSection(pathname, section)),
    ).flatMap((rule) => rule.labelKeys),
    ...extraLabelKeys,
  ];
  if (boostedLabelKeys.length === 0) return items;

  const remaining = [...items];
  const boosted: CommandItemConfig[] = [];
  for (const labelKey of boostedLabelKeys) {
    const index = remaining.findIndex((item) => item.labelKey === labelKey);
    if (index >= 0) boosted.push(...remaining.splice(index, 1));
  }
  return [...boosted, ...remaining];
}

export function CommandSearch({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname() || "";
  const { data: session, status } = useSession();
  const { setMode } = useGuiTheme();
  const { t } = useI18n();
  const role = isUserRole(session?.user?.role) ? session.user.role : undefined;
  const canUseCommandSearch = status === "authenticated" && role !== undefined;
  const [search, setSearch] = useState("");
  const [showMoreNav, setShowMoreNav] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Ensure the input is focused as soon as the palette mounts (covers the
  // dynamic-import delay when opened via F1 or Cmd+K).
  useEffect(() => {
    if (open) {
      // requestAnimationFrame lets the DOM finish painting before we focus,
      // which is necessary after a lazy chunk load.
      const raf = requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [open]);

  const debouncedSearch = useDebounce(search, 200);
  const hasQuery = debouncedSearch.trim().length >= 1;

  const patients = trpc.patients.search.useQuery(
    { query: debouncedSearch },
    { enabled: open && hasQuery && canUseCommandSearch },
  );

  const clients = trpc.clients.search.useQuery(
    { query: debouncedSearch },
    { enabled: open && hasQuery && canUseCommandSearch },
  );

  const checkingSearchAccess = hasQuery && status === "loading";
  const isSearching =
    hasQuery &&
    (checkingSearchAccess ||
      (canUseCommandSearch && (patients.isFetching || clients.isFetching)));
  const searchAccessUnavailable =
    hasQuery && !checkingSearchAccess && !canUseCommandSearch;
  const searchUnavailable =
    hasQuery &&
    canUseCommandSearch &&
    !isSearching &&
    (Boolean(patients.error) ||
      Boolean(clients.error) ||
      !patients.data ||
      !clients.data);

  const visibleNavigationItems = useMemo(
    () =>
      status === "authenticated" && role !== undefined
        ? navigationItems.filter((item) => item.roles.includes(role))
        : [],
    [role, status],
  );
  const visibleQuickActionItems = useMemo(
    () =>
      status === "authenticated" && role !== undefined
        ? quickActionItems.filter((item) => item.roles.includes(role))
        : [],
    [role, status],
  );

  const itemLabel = useCallback(
    (item: CommandItemConfig) => t(item.labelKey, item.fallbackLabel),
    [t],
  );

  useEffect(() => {
    if (!open) {
      setSearch("");
      setShowMoreNav(false);
    }
  }, [open]);

  function navigate(path: string) {
    onClose();
    router.push(path);
  }

  // Section 1: Matching quick actions & navigation when typing (limit 5)
  const matchingActions = useMemo(() => {
    if (!hasQuery) return [];
    const queryNorm = normalizeSearchText(debouncedSearch);
    if (!queryNorm) return [];

    const searchableItems: CommandItemConfig[] = [
      ...visibleQuickActionItems.map((item) => item),
      ...visibleNavigationItems.map((item) => item),
    ];

    const scored: { item: CommandItemConfig; score: number }[] = [];
    const seenHrefs = new Set<string>();

    for (const item of searchableItems) {
      // One entry per destination keeps the list short and predictable.
      if (seenHrefs.has(item.href)) continue;

      const { sk, en } = resolveI18nLabels(item.labelKey, item.fallbackLabel);
      const score = scoreActionMatch(item, queryNorm, [
        sk,
        en,
        itemLabel(item),
        item.fallbackLabel,
      ]);

      if (score === 0) continue;

      seenHrefs.add(item.href);
      scored.push({ item, score });
    }

    // Best matches first; equal scores keep quick actions ahead of navigation.
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, MATCHED_ACTION_LIMIT)
      .map((entry) => entry.item);
  }, [
    hasQuery,
    debouncedSearch,
    itemLabel,
    visibleQuickActionItems,
    visibleNavigationItems,
  ]);

  // Section 2: Context-aware no-query ordering
  const clientMatch = pathname.match(/^\/clients\/([^/]+)$/);
  const clientId = clientMatch && clientMatch[1] !== "new" ? clientMatch[1] : null;

  const patientMatch = pathname.match(/^\/patients\/([^/]+)$/);
  const patientId =
    patientMatch && patientMatch[1] !== "new" && patientMatch[1] !== "duplicates"
      ? patientMatch[1]
      : null;

  const encounterMatch = pathname.match(/^\/encounters\/([^/]+)$/);
  const encounterId = encounterMatch ? encounterMatch[1] : null;

  const contextItems: ContextActionItem[] = useMemo(() => {
    const items: ContextActionItem[] = [];

    if (clientId) {
      items.push({
        id: "ctx-new-patient",
        labelKey: "commandSearch.ctxNewPatientForClient",
        fallbackLabel: "New Patient for this Client",
        href: `/patients/new?clientId=${encodeURIComponent(clientId)}`,
        Icon: PawPrint,
        roles: ["admin", "veterinarian", "technician", "front_desk"],
      });
    }

    if (patientId) {
      items.push({
        id: "ctx-voice-dictation",
        labelKey: "commandSearch.ctxVoiceDictation",
        fallbackLabel: "Voice Dictation",
        href: `/agent/voice?patientId=${encodeURIComponent(patientId)}`,
        Icon: Mic,
        roles: ["admin", "veterinarian", "technician", "front_desk"],
      });
      items.push({
        id: "ctx-new-soap",
        labelKey: "commandSearch.ctxNewSoapNote",
        fallbackLabel: "New SOAP Note",
        href: `/records?tab=soap&new=1&patientId=${encodeURIComponent(patientId)}`,
        Icon: FileText,
        roles: ["admin", "veterinarian", "technician"],
      });
    }

    if (encounterId) {
      items.push({
        id: "ctx-voice-dictation",
        labelKey: "commandSearch.ctxVoiceDictation",
        fallbackLabel: "Voice Dictation",
        href: "/agent/voice",
        Icon: Mic,
        roles: ["admin", "veterinarian", "technician", "front_desk"],
      });
      items.push({
        id: "ctx-new-invoice",
        labelKey: "commandSearch.ctxNewInvoice",
        fallbackLabel: "New Invoice",
        href: "/billing/new",
        Icon: ReceiptEuro,
        roles: ["admin", "front_desk"],
      });
    }

    return items;
  }, [clientId, patientId, encounterId]);

  const visibleContextItems = useMemo(() => {
    if (!role) return [];
    return contextItems.filter((item) => item.roles.includes(role));
  }, [contextItems, role]);

  // Quick actions boosting when the active route implies a next step
  // (e.g. booking a visit from a client record).
  const orderedQuickActionItems = useMemo(
    () =>
      boostQuickActionsForRoute(
        visibleQuickActionItems,
        pathname,
        clientId ? ["commandSearch.newAppointment"] : [],
      ),
    [visibleQuickActionItems, pathname, clientId],
  );

  // Section 3: Navigation tiering (Primary always, Secondary behind toggle)
  const primaryNavigationItems = useMemo(() => {
    const list: CommandItemConfig[] = [];
    for (const key of PRIMARY_NAV_ORDER) {
      const found = visibleNavigationItems.find((item) => item.labelKey === key);
      if (found) list.push(found);
    }
    return list;
  }, [visibleNavigationItems]);

  const secondaryNavigationItems = useMemo(() => {
    return visibleNavigationItems.filter((item) => !PRIMARY_NAV_KEYS.has(item.labelKey));
  }, [visibleNavigationItems]);

  if (!open) return null;

  const patientResults =
    searchUnavailable || !patients.data ? [] : patients.data;
  const clientResults = searchUnavailable || !clients.data ? [] : clients.data;
  const hasResults = patientResults.length > 0 || clientResults.length > 0;
  const hasAnyMatches = hasResults || matchingActions.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] p-4 animate-in fade-in duration-150"
      role="dialog"
      aria-label={t("commandSearch.title", "Search")}
      aria-modal="true"
    >
      <div className="fixed inset-0 bg-black/60 backdrop-blur-xs" onClick={onClose} />
      <div className="relative mx-auto w-full max-w-2xl overflow-hidden rounded-xl border border-border/80 bg-background/95 backdrop-blur-md shadow-2xl ring-1 ring-black/5 dark:ring-white/10 animate-in zoom-in-95 duration-150">
        <Command className="flex flex-col" shouldFilter={!hasQuery}>
          <div className="flex items-center border-b border-border/70 px-3 bg-muted/10">
            {isSearching ? (
              <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
            ) : (
              <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <Command.Input
              ref={inputRef}
              value={search}
              onValueChange={setSearch}
              placeholder={t("commandSearch.placeholder", "Search patients by name, chip, owner phone, or navigate...")}
              className="flex h-12 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground font-medium"
            />
            <button
              onClick={onClose}
              className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <Command.List className="max-h-96 overflow-y-auto p-2">
            {searchUnavailable && (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                <AlertCircle className="mx-auto mb-2 h-5 w-5 text-destructive" />
                <p className="font-medium text-foreground">
                  {t("commandSearch.unableToLoad", "Unable to load search results")}
                </p>
                <p className="mt-1">
                  {t("commandSearch.unableToLoadDesc", "Retry before deciding this client or patient is missing.")}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    void patients.refetch();
                    void clients.refetch();
                  }}
                  className="mt-3 rounded-md border border-input px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
                >
                  {t("commandSearch.retrySearch", "Retry search")}
                </button>
              </div>
            )}

            {searchAccessUnavailable && (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                <AlertCircle className="mx-auto mb-2 h-5 w-5 text-destructive" />
                <p className="font-medium text-foreground">
                  {t("commandSearch.accessUnavailable", "Unable to confirm search access")}
                </p>
                <p className="mt-1">
                  {t("commandSearch.accessUnavailableDesc", "Close and reopen search after your session is ready.")}
                </p>
              </div>
            )}

            {hasQuery &&
              !isSearching &&
              !searchAccessUnavailable &&
              !searchUnavailable &&
              !hasAnyMatches && (
                <Command.Empty className="px-3 py-6 text-center text-sm text-muted-foreground">
                  {t("commandSearch.noResults", "No patients or clients found.")}
                </Command.Empty>
              )}

            {/* Section 1: Matching quick actions & navigation ABOVE DB results when typing.
                The heading reuses the shared nav.actions label so the palette speaks the
                same vocabulary as the rest of the app, while the group keeps an explicit
                accessible name of its own. */}
            {hasQuery && matchingActions.length > 0 && (
              <Command.Group
                heading={t("nav.actions", "Akcie")}
                aria-label={t("commandSearch.headingMatchedActions", "Actions")}
                className="mb-2 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
              >
                {matchingActions.map((item) => (
                  <Command.Item
                    key={"match-" + item.href + item.labelKey}
                    value={`action-${item.labelKey}-${item.href}`}
                    onSelect={() => navigate(item.href)}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm aria-selected:bg-accent transition-colors"
                  >
                    <item.Icon className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-medium">{itemLabel(item)}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Live search results: Patients */}
            {hasQuery && !searchUnavailable && patientResults.length > 0 && (
              <Command.Group
                heading={t("commandSearch.headingPatients", "Patients")}
                className="mb-2 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
              >
                {patientResults.map((patient) => (
                  <Command.Item
                    key={patient.id}
                    value={`patient-${patient.id}`}
                    onSelect={() => navigate(`/patients/${patient.id}`)}
                    className="flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-sm aria-selected:bg-accent transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-base shrink-0">
                        {speciesEmoji[patient.species ?? "other"] ??
                          "\uD83D\uDC3E"}
                      </span>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">{patient.name}</span>
                          {patient.breed && (
                            <span className="text-xs text-muted-foreground truncate">
                              {patient.breed}
                            </span>
                          )}
                        </div>
                        {(patient.clientFirstName || patient.clientLastName) && (
                          <span className="text-xs text-muted-foreground truncate">
                            {t("commandSearch.ownerPrefix", "Owner: ")}
                            {[patient.clientFirstName, patient.clientLastName]
                              .filter(Boolean)
                              .join(" ")}
                            {patient.clientPhone && (
                              <span className="font-mono tabular-nums"> · {patient.clientPhone}</span>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                    {patient.microchipNumber && (
                      <span className="shrink-0 rounded border border-border/70 bg-muted/50 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground tabular-nums">
                        {t("commandSearch.chipPrefix", "Chip: ")}{patient.microchipNumber}
                      </span>
                    )}
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Live search results: Clients */}
            {hasQuery && !searchUnavailable && clientResults.length > 0 && (
              <Command.Group
                heading={t("commandSearch.headingClients", "Clients")}
                className="mb-2 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
              >
                {clientResults.map((client) => (
                  <Command.Item
                    key={client.id}
                    value={`client-${client.id}`}
                    onSelect={() => navigate(`/clients/${client.id}`)}
                    className="flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-sm aria-selected:bg-accent transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex flex-col min-w-0">
                        <span className="font-semibold text-foreground">
                          {client.firstName} {client.lastName}
                        </span>
                        {client.email && (
                          <span className="text-xs text-muted-foreground truncate">
                            {client.email}
                          </span>
                        )}
                      </div>
                    </div>
                    {client.phone && (
                      <span className="font-mono text-xs text-muted-foreground tabular-nums shrink-0">
                        {client.phone}
                      </span>
                    )}
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Section 2: Contextual items (shown when no search query, above Quick Actions) */}
            {!hasQuery && visibleContextItems.length > 0 && (
              <Command.Group
                heading={t("commandSearch.headingContextActions", "In Context")}
                className="mb-2 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
              >
                {visibleContextItems.map((item) => (
                  <Command.Item
                    key={item.id}
                    value={`ctx-${item.id}-${item.href}`}
                    onSelect={() => navigate(item.href)}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm aria-selected:bg-accent transition-colors"
                  >
                    <item.Icon className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-medium">{t(item.labelKey, item.fallbackLabel)}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Quick Actions (shown when no search query) */}
            {!hasQuery && visibleQuickActionItems.length > 0 && (
              <Command.Group
                heading={t("commandSearch.headingQuickActions", "Quick Actions")}
                className="mb-2 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
              >
                {orderedQuickActionItems.map((item) => (
                  <Command.Item
                    key={item.href + item.labelKey}
                    value={`quick-${item.labelKey}`}
                    onSelect={() => navigate(item.href)}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm aria-selected:bg-accent transition-colors"
                  >
                    <item.Icon className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-medium">{itemLabel(item)}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Section 3: Navigation tiering (Primary always, Secondary behind toggle) */}
            {!hasQuery && visibleNavigationItems.length > 0 && (
              <Command.Group
                heading={t("commandSearch.headingNavigation", "Navigation")}
                className="mb-2 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
              >
                {primaryNavigationItems.map((item) => (
                  <Command.Item
                    key={item.href}
                    value={`nav-${item.labelKey}`}
                    onSelect={() => navigate(item.href)}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm aria-selected:bg-accent transition-colors"
                  >
                    <item.Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span>{itemLabel(item)}</span>
                  </Command.Item>
                ))}

                {showMoreNav &&
                  secondaryNavigationItems.map((item) => (
                    <Command.Item
                      key={item.href}
                      value={`nav-${item.labelKey}`}
                      onSelect={() => navigate(item.href)}
                      className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm aria-selected:bg-accent transition-colors"
                    >
                      <item.Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span>{itemLabel(item)}</span>
                    </Command.Item>
                  ))}

                {secondaryNavigationItems.length > 0 && (
                  <Command.Item
                    value={showMoreNav ? "nav-toggle-show-less" : "nav-toggle-show-more"}
                    onSelect={() => setShowMoreNav((prev) => !prev)}
                    className="flex cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-accent transition-colors"
                  >
                    <ChevronDown
                      className={
                        showMoreNav
                          ? "h-3.5 w-3.5 rotate-180 transition-transform"
                          : "h-3.5 w-3.5 transition-transform"
                      }
                    />
                    <span>
                      {showMoreNav
                        ? t("commandSearch.navShowLess", "Show less")
                        : t("commandSearch.navShowMore", "Show more...")}
                    </span>
                  </Command.Item>
                )}
              </Command.Group>
            )}

            {/* Section 3: Theme Actions (moved to the very end) */}
            {!hasQuery && (
              <Command.Group
                heading={t("commandSearch.headingAppearance", "Appearance & Theme")}
                className="mb-2 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
              >
                <Command.Item
                  value="theme-light"
                  onSelect={() => {
                    setMode("light");
                    onClose();
                  }}
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm aria-selected:bg-accent transition-colors"
                >
                  <Sun className="h-4 w-4 text-amber-500 shrink-0" />
                  <span>{t("commandSearch.lightTheme", "Switch to Light Theme")}</span>
                </Command.Item>
                <Command.Item
                  value="theme-dark"
                  onSelect={() => {
                    setMode("dark");
                    onClose();
                  }}
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm aria-selected:bg-accent transition-colors"
                >
                  <Moon className="h-4 w-4 text-primary shrink-0" />
                  <span>{t("commandSearch.darkTheme", "Switch to Dark Theme")}</span>
                </Command.Item>
              </Command.Group>
            )}
          </Command.List>

          {/* Footer Shortcuts Bar */}
          <div className="flex items-center justify-between border-t border-border/60 bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-2">
              <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">↑↓</kbd>
              <span>{t("commandSearch.navToNavigate", "to navigate")}</span>
              <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">↵</kbd>
              <span>{t("commandSearch.navToSelect", "to select")}</span>
              <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">esc</kbd>
              <span>{t("commandSearch.navToClose", "to close")}</span>
            </div>
            <span className="font-mono text-[10px] opacity-70">{t("commandSearch.spotlightLabel", "Cmd+K Spotlight")}</span>
            <span className="font-mono text-[10px] opacity-50">·</span>
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">F1</kbd>
          </div>
        </Command>
      </div>
    </div>
  );
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
