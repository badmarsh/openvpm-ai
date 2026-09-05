import type { ElementType } from "react";
import { ReceiptText, Megaphone, Newspaper, Tv, HeartHandshake, Database, Image as ImageIcon, Mic } from "lucide-react";

export type UserRole =
  | "admin"
  | "veterinarian"
  | "technician"
  | "front_desk"
  | "viewer";

export interface CustomNavItem {
  href: string;
  label: string;
  i18nKey?: string;
  icon: ElementType;
  roles: UserRole[];
}

/**
 * Custom navigation items for OpenVPM AI extensions.
 * Injected into the sidebar without modifying the vanilla navItems list.
 */
export const customNavItems: CustomNavItem[] = [
  {
    href: "/billing/ekasa",
    label: "e-Kasa",
    i18nKey: "nav.ekasa",
    icon: ReceiptText,
    roles: ["admin", "veterinarian", "front_desk"],
  },
  {
    href: "/settings/import-v2",
    label: "V2 Migrácia",
    i18nKey: "nav.v2Import",
    icon: Database,
    roles: ["admin", "veterinarian"],
  },
  {
    href: "/marketing",
    label: "Marketing Studio",
    i18nKey: "nav.marketing",
    icon: Megaphone,
    roles: ["admin", "veterinarian"],
  },
  {
    href: "/vet-intel",
    label: "Vet Intelligence",
    i18nKey: "nav.vetIntel",
    icon: Newspaper,
    roles: ["admin", "veterinarian"],
  },
  {
    href: "/waiting-room",
    label: "Waiting Room TV",
    i18nKey: "nav.waitingRoom",
    icon: Tv,
    roles: ["admin", "veterinarian", "technician", "front_desk", "viewer"],
  },
  {
    href: "/agent/imaging",
    label: "Analýza Snímkov",
    i18nKey: "nav.agentImaging",
    icon: ImageIcon,
    roles: ["admin", "veterinarian"],
  },
  {
    href: "/agent/voice",
    label: "Hlasové Diktovanie",
    i18nKey: "nav.agentVoice",
    icon: Mic,
    roles: ["admin", "veterinarian"],
  },
];
