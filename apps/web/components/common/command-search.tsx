"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { PATIENT_SPECIES_EMOJI } from "@/lib/patients/species";
import { useGuiTheme } from "@/lib/theme/theme-context";
import { useI18n } from "@/lib/i18n";

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
};

const allRoles: UserRole[] = [
  "admin",
  "veterinarian",
  "technician",
  "front_desk",
  "viewer",
];

const navigationItems: CommandItemConfig[] = [
  { labelKey: "commandSearch.navDashboard", fallbackLabel: "Dashboard", href: "/", Icon: BarChart3, roles: allRoles },
  { labelKey: "commandSearch.navPatients", fallbackLabel: "Patients", href: "/patients", Icon: PawPrint, roles: allRoles },
  { labelKey: "commandSearch.navClients", fallbackLabel: "Clients", href: "/clients", Icon: Users, roles: allRoles },
  { labelKey: "commandSearch.navSchedule", fallbackLabel: "Schedule", href: "/schedule", Icon: Calendar, roles: allRoles },
  {
    labelKey: "commandSearch.navWhiteboard",
    fallbackLabel: "Whiteboard",
    href: "/whiteboard",
    Icon: Clipboard,
    roles: allRoles,
  },
  { labelKey: "commandSearch.navRecords", fallbackLabel: "Records", href: "/records", Icon: FileText, roles: allRoles },
  {
    labelKey: "commandSearch.navLabInbox",
    fallbackLabel: "Lab Inbox",
    href: "/lab-results",
    Icon: FlaskConical,
    roles: ["admin", "veterinarian", "technician", "front_desk", "viewer"],
  },
  { labelKey: "commandSearch.navBilling", fallbackLabel: "Billing", href: "/billing", Icon: ReceiptEuro, roles: allRoles },
  { labelKey: "commandSearch.navInventory", fallbackLabel: "Inventory", href: "/inventory", Icon: Package, roles: allRoles },
  { labelKey: "commandSearch.navInbox", fallbackLabel: "Inbox", href: "/inbox", Icon: Mail, roles: allRoles },
  {
    labelKey: "commandSearch.navRecalls",
    fallbackLabel: "Vaccination Recalls",
    href: "/recalls",
    Icon: Syringe,
    roles: ["admin", "veterinarian", "front_desk"],
  },
  {
    labelKey: "commandSearch.navCareReminders",
    fallbackLabel: "Care Reminders",
    href: "/care-reminders",
    Icon: BellRing,
    roles: allRoles,
  },
  {
    labelKey: "commandSearch.navImportedHistory",
    fallbackLabel: "Imported History",
    href: "/migration-archive",
    Icon: Archive,
    roles: allRoles,
  },
  {
    labelKey: "commandSearch.navEkasaTerminal",
    fallbackLabel: "e-Kasa Terminal",
    href: "/billing/ekasa",
    Icon: ReceiptEuro,
    roles: allRoles,
  },
  {
    labelKey: "commandSearch.navControlledSubstances",
    fallbackLabel: "Controlled Substances",
    href: "/controlled-substances",
    Icon: Shield,
    roles: ["admin", "veterinarian"],
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
  },
  {
    labelKey: "commandSearch.newPatient",
    fallbackLabel: "New Patient",
    href: "/patients/new",
    Icon: PawPrint,
    roles: ["admin", "veterinarian", "technician", "front_desk"],
  },
  {
    labelKey: "commandSearch.newAppointment",
    fallbackLabel: "New Appointment",
    href: "/schedule?new=1",
    Icon: Calendar,
    roles: ["admin", "veterinarian", "technician", "front_desk"],
  },
  {
    labelKey: "commandSearch.newSoapNote",
    fallbackLabel: "New SOAP Note",
    href: "/records?tab=soap&new=1",
    Icon: FileText,
    roles: ["admin", "veterinarian", "technician"],
  },
  {
    labelKey: "commandSearch.newInvoice",
    fallbackLabel: "New Invoice",
    href: "/billing/new",
    Icon: ReceiptEuro,
    roles: ["admin", "front_desk"],
  },
  {
    labelKey: "commandSearch.issueReceipt",
    fallbackLabel: "Issue Receipt",
    href: "/billing/new",
    Icon: ReceiptEuro,
    roles: ["admin", "front_desk"],
  },
  {
    labelKey: "commandSearch.openEkasa",
    fallbackLabel: "Open e-Kasa",
    href: "/billing/ekasa",
    Icon: ReceiptEuro,
    roles: ["admin", "veterinarian", "front_desk"],
  },
];

function isUserRole(role?: string | null): role is UserRole {
  return allRoles.includes(role as UserRole);
}

export function CommandSearch({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { setMode } = useGuiTheme();
  const { t } = useI18n();
  const role = isUserRole(session?.user?.role) ? session.user.role : undefined;
  const canUseCommandSearch = status === "authenticated" && role !== undefined;
  const [search, setSearch] = useState("");

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
  const visibleNavigationItems =
    status === "authenticated" && role !== undefined
      ? navigationItems.filter((item) => item.roles.includes(role))
      : [];
  const visibleQuickActionItems =
    status === "authenticated" && role !== undefined
      ? quickActionItems.filter((item) => item.roles.includes(role))
      : [];

  function itemLabel(item: CommandItemConfig) {
    return t(item.labelKey, item.fallbackLabel);
  }

  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  function navigate(path: string) {
    onClose();
    router.push(path);
  }

  if (!open) return null;

  const patientResults =
    searchUnavailable || !patients.data ? [] : patients.data;
  const clientResults = searchUnavailable || !clients.data ? [] : clients.data;
  const hasResults = patientResults.length > 0 || clientResults.length > 0;

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
              !hasResults && (
                <Command.Empty className="px-3 py-6 text-center text-sm text-muted-foreground">
                  {t("commandSearch.noResults", "No patients or clients found.")}
                </Command.Empty>
              )}

            {/* Live search results */}
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

            {/* Quick Actions (shown when no search query) */}
            {!hasQuery && visibleQuickActionItems.length > 0 && (
              <Command.Group
                heading={t("commandSearch.headingQuickActions", "Quick Actions")}
                className="mb-2 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
              >
                {visibleQuickActionItems.map((item) => (
                  <Command.Item
                    key={item.href + item.labelKey}
                    onSelect={() => navigate(item.href)}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm aria-selected:bg-accent transition-colors"
                  >
                    <item.Icon className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-medium">{itemLabel(item)}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Theme Actions */}
            {!hasQuery && (
              <Command.Group
                heading={t("commandSearch.headingAppearance", "Appearance & Theme")}
                className="mb-2 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
              >
                <Command.Item
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

            {/* Navigation (shown when no search query) */}
            {!hasQuery && visibleNavigationItems.length > 0 && (
              <Command.Group
                heading={t("commandSearch.headingNavigation", "Navigation")}
                className="mb-2 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
              >
                {visibleNavigationItems.map((item) => (
                  <Command.Item
                    key={item.href}
                    onSelect={() => navigate(item.href)}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm aria-selected:bg-accent transition-colors"
                  >
                    <item.Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span>{itemLabel(item)}</span>
                  </Command.Item>
                ))}
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
