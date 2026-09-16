import type { ElementType } from "react";
import {
  ReceiptText,
  Megaphone,
  Tv,
  Image as ImageIcon,
  Mic,
  FileText,
  Zap,
  Star,
  Globe,
  ShieldCheck,
  Heart,
  MessageSquare,
} from "lucide-react";

export type UserRole =
  | "admin"
  | "veterinarian"
  | "technician"
  | "front_desk"
  | "viewer";

export type NavSectionId =
  | "clinical"
  | "preventive"
  | "frontDesk"
  | "pharmacy"
  | "billing"
  | "marketing"
  | "admin";

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
    label: 'Správy & SMS',
    i18nKey: 'nav.marketingMessages',
    icon: MessageSquare,
    roles: ['admin', 'veterinarian', 'front_desk'],
    section: 'marketing',
  },
  {
    href: '/marketing/website',
    label: 'Web kliniky',
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
    label: 'Skripty recepcie',
    i18nKey: 'nav.receptionScripts',
    icon: ShieldCheck,
    roles: ['admin', 'veterinarian', 'front_desk'],
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
  // AI
  {
    href: "/agent/voice",
    label: "Hlasové Diktovanie",
    i18nKey: "nav.agentVoice",
    icon: Mic,
    roles: ["admin", "veterinarian", "technician", "front_desk", "viewer"],
    section: "clinical",
    badge: "AI",
  },
  // Finance / admin
  {
    href: "/billing/ekasa",
    label: "e-Kasa Doklady",
    i18nKey: "nav.ekasa",
    icon: ReceiptText,
    roles: ["admin", "veterinarian", "front_desk"],
    section: "billing",
  },
];
