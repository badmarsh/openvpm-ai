import type { ElementType } from "react";
import {
  ReceiptText,
  Megaphone,
  Newspaper,
  Tv,
  Image as ImageIcon,
  Mic,
  FileText,
  Palette,
  CalendarDays,
  Zap,
  PenLine,
  Star,
  Globe,
  ShieldCheck,
  Heart,
  Building2,
  MessageSquare,
  Headphones,
} from "lucide-react";

export type UserRole =
  | "admin"
  | "veterinarian"
  | "technician"
  | "front_desk"
  | "viewer";

export type NavSectionId =
  | "clinical"
  | "marketing"
  | "ai"
  | "settings";

export interface CustomNavItem {
  href: string;
  label: string;
  i18nKey?: string;
  icon: ElementType;
  roles: UserRole[];
  section: NavSectionId;
  badge?: string;
  exact?: boolean;
}

/**
 * Custom navigation items for OpenVPM AI extensions.
 * Each item declares which section it belongs to.
 * Merged into the sidebar sections without modifying vanilla navItems.
 */
export const customNavItems: CustomNavItem[] = [
  // Clinical
  {
    href: "/billing/ekasa",
    label: "e-Kasa Doklady",
    i18nKey: "nav.ekasa",
    icon: ReceiptText,
    roles: ["admin", "veterinarian", "front_desk"],
    section: "clinical",
  },
  // Marketing
  {
    href: "/marketing",
    label: "Marketingové Štúdio",
    i18nKey: "nav.marketing",
    icon: Megaphone,
    roles: ["admin", "veterinarian", "front_desk"],
    section: "marketing",
    exact: true,
  },
  {
    href: "/marketing/brand-kit",
    label: "Brand Kit",
    i18nKey: "nav.marketingBrandKit",
    icon: Palette,
    roles: ["admin", "veterinarian"],
    section: "marketing",
  },
  {
    href: '/marketing/plan',
    label: 'Plán obsahu',
    i18nKey: 'nav.marketingPlan',
    icon: CalendarDays,
    roles: ['admin', 'veterinarian', 'front_desk'],
    section: 'marketing',
  },
  {
    href: '/marketing/reviews',
    label: 'Recenzie',
    i18nKey: 'nav.marketingReviews',
    icon: Star,
    roles: ['admin', 'veterinarian', 'front_desk'],
    section: 'marketing',
  },
  {
    href: '/marketing/handouts',
    label: 'Letáky',
    i18nKey: 'nav.marketingHandouts',
    icon: FileText,
    roles: ['admin', 'veterinarian', 'front_desk'],
    section: 'marketing',
  },
  {
    href: '/marketing/messages',
    label: 'Správy a SMS fronta',
    i18nKey: 'nav.marketingMessages',
    icon: MessageSquare,
    roles: ['admin', 'veterinarian', 'front_desk'],
    section: 'marketing',
  },
  {
    href: '/marketing/website',
    label: 'Webstránka kliniky',
    i18nKey: 'nav.marketingWebsite',
    icon: Globe,
    roles: ['admin', 'veterinarian'],
    section: 'marketing',
  },
  {
    href: '/marketing/tv',
    label: 'Čakáreň TV',
    i18nKey: 'nav.waitingRoomTv',
    icon: Tv,
    roles: ['admin', 'veterinarian', 'front_desk'],
    section: 'marketing',
  },
  {
    href: '/marketing/automations',
    label: 'Automatizácie',
    i18nKey: 'nav.marketingAutomations',
    icon: Zap,
    roles: ['admin', 'veterinarian'],
    section: 'marketing',
  },
  {
    href: '/marketing/consents',
    label: 'Súhlasy (GDPR)',
    i18nKey: 'nav.marketingConsents',
    icon: ShieldCheck,
    roles: ['admin', 'veterinarian', 'front_desk'],
    section: 'marketing',
  },
  {
    href: '/marketing/scripts',
    label: 'Operačné skripty',
    i18nKey: 'nav.marketingScripts',
    icon: PenLine,
    roles: ['admin', 'veterinarian'],
    section: 'marketing',
  },
  {
    href: '/marketing/media',
    label: 'Knižnica médií',
    i18nKey: 'nav.marketingMedia',
    icon: ImageIcon,
    roles: ['admin', 'veterinarian', 'front_desk'],
    section: 'marketing',
  },
  {
    href: '/marketing/wellness',
    label: 'Wellness balíčky',
    i18nKey: 'nav.marketingWellness',
    icon: Heart,
    roles: ['admin', 'veterinarian', 'front_desk'],
    section: 'marketing',
  },
  {
    href: "/vet-intel",
    label: "Vet Intelligence",
    i18nKey: "nav.vetIntel",
    icon: Building2,
    roles: ["admin", "veterinarian"],
    section: "marketing",
    badge: "AI",
  },
  // AI
  {
    href: "/agent/imaging",
    label: "Analýza Snímkov",
    i18nKey: "nav.agentImaging",
    icon: ImageIcon,
    roles: ["admin", "veterinarian"],
    section: "ai",
    badge: "AI",
  },
  {
    href: "/agent/voice",
    label: "Hlasové Diktovanie",
    i18nKey: "nav.agentVoice",
    icon: Mic,
    roles: ["admin", "veterinarian", "technician", "front_desk", "viewer"],
    section: "ai",
    badge: "AI",
  },
  {
    href: "/agent/discharge",
    label: "Prepúšťacie Správy",
    i18nKey: "nav.agentDischarge",
    icon: FileText,
    roles: ["admin", "veterinarian", "technician", "front_desk"],
    section: "ai",
    badge: "AI",
  },
  // Support
  {
    href: "/support",
    label: "Vzdialená Podpora",
    i18nKey: "nav.remoteSupport",
    icon: Headphones,
    roles: ["admin", "veterinarian", "technician", "front_desk"],
    section: "settings",
  },
  {
    href: "/admin/support",
    label: "Admin Podpora",
    i18nKey: "nav.adminSupport",
    icon: ShieldCheck,
    roles: ["admin"],
    section: "settings",
    badge: "Support",
  },
];
