"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  PawPrint,
  Users,
  Calendar,
  FileText,
  Receipt,
  Package,
  MessageSquare,
  Syringe,
  BellRing,
  ClipboardList,
  BarChart3,
  BookOpen,
  Settings,
  ShieldAlert,
  Bot,
  FlaskConical,
  Archive,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Sparkles,
} from "lucide-react";
import { PawMark } from "@/components/brand/paw-mark";
import {
  customNavItems,
  type CustomNavItem,
  type NavSectionId,
} from "@/config/custom-nav";
import { useI18n } from "@/lib/i18n";

type UserRole =
  | "admin"
  | "veterinarian"
  | "technician"
  | "front_desk"
  | "viewer";

const allRoles: UserRole[] = [
  "admin",
  "veterinarian",
  "technician",
  "front_desk",
  "viewer",
];

function isUserRole(role?: string | null): role is UserRole {
  return allRoles.includes(role as UserRole);
}

interface NavItem {
  href: string;
  label: string;
  i18nKey?: string;
  icon: React.ElementType;
  roles: UserRole[];
  badge?: string;
  exact?: boolean;
}

interface NavSection {
  id: NavSectionId;
  titleKey: string;
  titleFallback: string;
  items: NavItem[];
}

// ── Vanilla nav items grouped into sections ───────────────────
const vanillaSections: NavSection[] = [
  {
    id: "clinical",
    titleKey: "nav.sectionClinical",
    titleFallback: "Klinická Prax",
    items: [
      {
        href: "/",
        label: "Prehľad",
        i18nKey: "nav.dashboard",
        icon: LayoutDashboard,
        roles: allRoles,
        exact: true,
      },
      {
        href: "/patients",
        label: "Pacienti",
        i18nKey: "nav.patients",
        icon: PawPrint,
        roles: allRoles,
      },
      {
        href: "/clients",
        label: "Klienti",
        i18nKey: "nav.clients",
        icon: Users,
        roles: allRoles,
      },
      {
        href: "/schedule",
        label: "Rozvrh",
        i18nKey: "nav.schedule",
        icon: Calendar,
        roles: allRoles,
      },
      {
        href: "/records",
        label: "Záznamy",
        i18nKey: "nav.records",
        icon: FileText,
        roles: allRoles,
      },
      {
        href: "/lab-results",
        label: "Laboratórium",
        i18nKey: "nav.labResults",
        icon: FlaskConical,
        roles: ["admin", "veterinarian", "technician", "front_desk", "viewer"],
      },
      {
        href: "/billing",
        label: "Fakturácia",
        i18nKey: "nav.billing",
        icon: Receipt,
        roles: allRoles,
        exact: true,
      },
      {
        href: "/inventory",
        label: "Sklad",
        i18nKey: "nav.inventory",
        icon: Package,
        roles: allRoles,
      },
      {
        href: "/inbox",
        label: "Schránka",
        i18nKey: "nav.inbox",
        icon: MessageSquare,
        roles: allRoles,
      },
      {
        href: "/recalls",
        label: "Pripomienky",
        i18nKey: "nav.recalls",
        icon: Syringe,
        roles: ["admin", "veterinarian", "front_desk"],
      },
      {
        href: "/care-reminders",
        label: "Zdravotné pripomienky",
        i18nKey: "nav.careReminders",
        icon: BellRing,
        roles: allRoles,
      },
      {
        href: "/whiteboard",
        label: "Hospitalizácia",
        i18nKey: "nav.whiteboard",
        icon: ClipboardList,
        roles: allRoles,
      },
      {
        href: "/migration-archive",
        label: "Archív (V2)",
        i18nKey: "nav.migrationArchive",
        icon: Archive,
        roles: allRoles,
      },
      {
        href: "/controlled-substances",
        label: "Omamné látky",
        i18nKey: "nav.controlledSubstances",
        icon: ShieldAlert,
        roles: ["admin", "veterinarian"],
      },
      {
        href: "/statutory",
        label: "Zákonné registre",
        i18nKey: "nav.statutory",
        icon: BookOpen,
        roles: ["admin", "veterinarian"],
      },
      {
        href: "/reports",
        label: "Prehľady",
        i18nKey: "nav.reports",
        icon: BarChart3,
        roles: ["admin", "veterinarian"],
      },
    ],
  },
  {
    id: "marketing",
    titleKey: "nav.sectionMarketing",
    titleFallback: "Marketing Studio",
    items: [], // populated from customNavItems
  },
  {
    id: "ai",
    titleKey: "nav.sectionAi",
    titleFallback: "AI Veterinary",
    items: [
      {
        href: "/agent",
        label: "Agent",
        i18nKey: "nav.agent",
        icon: Bot,
        roles: ["admin", "veterinarian"],
        badge: "AI",
        exact: true,
      },
    ],
  },
  {
    id: "settings",
    titleKey: "nav.sectionSettings",
    titleFallback: "Správa Kliniky",
    items: [
      {
        href: "/settings",
        label: "Nastavenia",
        i18nKey: "nav.settings",
        icon: Settings,
        roles: ["admin"],
      },
    ],
  },
];

type SidebarProps = {
  className?: string;
  collapsible?: boolean;
  onNavigate?: () => void;
  width?: "fixed" | "full";
};

export function Sidebar({
  className,
  collapsible = true,
  onNavigate,
  width = "fixed",
}: SidebarProps = {}) {
  const { t } = useI18n();
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const role = isUserRole(session?.user?.role) ? session.user.role : undefined;
  const { data: branding } = trpc.settings.getBranding.useQuery();
  const isCollapsed = collapsible && collapsed;
  const canShowNav = status === "authenticated" && role !== undefined;
  const { data: unreadInbox } =
    trpc.communications.listConversations.useQuery(
      { inboxFilter: "unread", limit: 1, offset: 0 },
      {
        enabled: canShowNav,
        refetchInterval: 60000,
        refetchOnWindowFocus: false,
        retry: false,
      },
    );
  const unreadInboxCount = Math.max(0, Number(unreadInbox?.total ?? 0));
  const unreadInboxLabel =
    unreadInboxCount > 99 ? "99+" : String(unreadInboxCount);

  // Merge customNavItems into their declared sections
  const sections: NavSection[] = vanillaSections.map((section) => {
    const extra = customNavItems
      .filter((item) => item.section === section.id)
      .map((item) => ({
        href: item.href,
        label: item.label,
        i18nKey: item.i18nKey,
        icon: item.icon,
        roles: item.roles,
        badge: item.badge,
        exact: item.exact,
      }));
    return { ...section, items: [...section.items, ...extra] };
  });

  return (
    <aside
      className={cn(
        "flex h-screen flex-col border-r border-border bg-surface transition-all duration-150 shadow-sm",
        width === "full" ? "w-full" : isCollapsed ? "w-16" : "w-64",
        className,
      )}
    >
      {/* Brand Header */}
      <div className="flex h-14 items-center border-b border-border px-4 justify-between">
        <Link
          href="/"
          prefetch={false}
          className="flex items-center gap-2.5 min-w-0"
        >
          {branding?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={branding.logoUrl}
              alt={branding.name ?? "Practice logo"}
              className="h-8 w-8 rounded-lg object-cover shrink-0"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shrink-0 shadow-xs">
              <PawMark className="h-4 w-4 text-primary-foreground" />
            </div>
          )}
          {!isCollapsed && (
            <div className="min-w-0">
              <span className="font-heading text-base font-bold tracking-tight block truncate">
                {branding?.name ?? "OpenVPM"}
              </span>
              <span className="text-[10px] text-muted-foreground block -mt-0.5 font-medium truncate">
                OpenVPM Suite
              </span>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation Sections */}
      <nav
        className="flex-1 overflow-y-auto px-2 py-3 space-y-5 custom-scrollbar"
        role="navigation"
        aria-label="Main navigation"
      >
        {canShowNav &&
          sections.map((section, idx) => {
            const visibleItems = section.items.filter((item) =>
              item.roles.includes(role),
            );
            if (visibleItems.length === 0) return null;

            return (
              <div key={section.id} className="space-y-1">
                {!isCollapsed && (
                  <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 flex items-center justify-between">
                    <span>{t(section.titleKey, section.titleFallback)}</span>
                    {section.id === "ai" && (
                      <Sparkles className="h-3 w-3 text-amber-500" />
                    )}
                  </div>
                )}
                {isCollapsed && idx > 0 && (
                  <div className="my-2 border-t border-border/50 mx-2" />
                )}

                <ul className="space-y-0.5">
                  {visibleItems.map((item) => {
                    const isActive = item.exact
                      ? pathname === item.href
                      : pathname === item.href ||
                        (item.href !== "/" &&
                          pathname.startsWith(item.href));

                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          prefetch={false}
                          data-tour={`nav-${item.href}`}
                          aria-current={isActive ? "page" : undefined}
                          onClick={onNavigate}
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-semibold transition-all group relative",
                            isActive
                              ? "bg-primary text-primary-foreground shadow-xs font-bold"
                              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                          )}
                        >
                          <span className="relative shrink-0">
                            <item.icon
                              className={cn(
                                "h-4 w-4 transition-transform group-hover:scale-105",
                                isActive
                                  ? "text-primary-foreground"
                                  : "text-muted-foreground",
                              )}
                            />
                            {isCollapsed &&
                            item.href === "/inbox" &&
                            unreadInboxCount > 0 ? (
                              <span
                                aria-label={`${unreadInboxCount} unread inbox conversations`}
                                className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-surface"
                              />
                            ) : null}
                          </span>

                          {!isCollapsed && (
                            <span className="truncate flex-1 text-left">
                              {item.i18nKey
                                ? t(item.i18nKey, item.label)
                                : item.label}
                            </span>
                          )}

                          {!isCollapsed &&
                            item.href === "/inbox" &&
                            unreadInboxCount > 0 && (
                              <span
                                aria-label={`${unreadInboxCount} unread inbox conversations`}
                                className="ml-auto rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground"
                              >
                                {unreadInboxLabel}
                              </span>
                            )}

                          {!isCollapsed && item.badge && (
                            <span
                              className={cn(
                                "ml-auto rounded-full px-1.5 py-0.5 text-[9px] font-extrabold uppercase leading-none tracking-wider",
                                isActive
                                  ? "bg-white/20 text-white"
                                  : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
                              )}
                            >
                              {item.badge}
                            </span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
      </nav>

      {/* User Footer & Collapse */}
      <div className="border-t border-border p-2 space-y-1">
        {session?.user && !isCollapsed && (
          <div className="flex items-center gap-3 rounded-lg bg-accent/40 px-3 py-2 border border-border/50">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary shrink-0">
              {session.user.name
                ?.split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-foreground">
                {session.user.name}
              </p>
              <p className="truncate text-[10px] text-muted-foreground capitalize font-medium">
                {session.user.role
                  ? t(
                      `roles.${session.user.role}`,
                      session.user.role.replace("_", " "),
                    )
                  : ""}
              </p>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              aria-label={t("common.signOut", "Odhlásiť sa")}
              title={t("common.signOut", "Odhlásiť sa")}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
        {collapsible && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="flex w-full items-center justify-center gap-2 rounded-lg p-2 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4" />
                <span>Zbaliť menu</span>
              </>
            )}
          </button>
        )}
      </div>
    </aside>
  );
}
