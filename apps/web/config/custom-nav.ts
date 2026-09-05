import type { ElementType } from "react";
import {
  ReceiptText,
  Megaphone,
  Newspaper,
  Tv,
  Database,
  Image as ImageIcon,
  Mic,
  Palette,
  CalendarDays,
  Zap,
  PenLine,
  Star,
  Globe,
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
    label: "e-Kasa",
    i18nKey: "nav.ekasa",
    icon: ReceiptText,
    roles: ["admin", "veterinarian", "front_desk"],
    section: "clinical",
  },
  {
    href: "/settings/import-v2",
    label: "V2 Migrácia",
    i18nKey: "nav.v2Import",
    icon: Database,
    roles: ["admin", "veterinarian"],
    section: "clinical",
  },
  {
    href: "/waiting-room",
    label: "Čakáreň TV",
    i18nKey: "nav.waitingRoom",
    icon: Tv,
    roles: ["admin", "veterinarian", "technician", "front_desk", "viewer"],
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
    href: "/vet-intel",
    label: "Vet Intelligence",
    i18nKey: "nav.vetIntel",
    icon: Newspaper,
    roles: ["admin", "veterinarian"],
    section: "marketing",
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
];
