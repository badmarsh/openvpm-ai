import type { ElementType } from "react";
import {
  ReceiptText,
  BookOpen,
  Megaphone,
  Image as ImageIcon,
  Mic,
  FileText,
  Zap,
  Star,
  Globe,
  ShieldCheck,
  Heart,
  MessageSquare,
  FlaskConical,
  Tractor,
  ScanLine,
  Pill,
  Bot,
  Waypoints,
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
  // Field visits & large animal farm care
  {
    href: "/field-visits",
    label: "Terénna prax & Farmy",
    i18nKey: "nav.fieldVisits",
    icon: Tractor,
    roles: ["admin", "veterinarian"],
    section: "billing",
    badge: "FARMA",
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
    href: '/marketing/website',
    label: 'Web kliniky',
    i18nKey: 'nav.marketingWebsite',
    icon: Globe,
    roles: ['admin', 'veterinarian'],
    section: 'marketing',
  },
  {
    href: "/settings?tab=simulation",
    label: "Klinická simulácia",
    i18nKey: "nav.simulation",
    icon: FlaskConical,
    roles: ["admin", "veterinarian"],
    section: "admin",
    badge: "SIM",
  },

  {
    href: '/automations',
    label: 'Automatizácie',
    i18nKey: 'nav.automations',
    icon: Zap,
    roles: ['admin', 'veterinarian'],
    section: 'admin',
  },
  {
    href: "/admin/ai-swarm",
    label: "AI Swarm & AgentOS",
    i18nKey: "nav.aiSwarm",
    icon: Bot,
    roles: ["admin"],
    section: "admin",
    badge: "SWARM",
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
  // AI imaging (RTG / USG / CT / MRI) — radiology work needs a nav entry of
  // its own; it used to be reachable only from the /agent hub.
  {
    href: "/agent/imaging",
    label: "RTG & zobrazovacia AI",
    i18nKey: "nav.imaging",
    icon: ScanLine,
    roles: ["admin", "veterinarian", "technician"],
    section: "clinical",
    badge: "AI",
  },
  // Medication oversight over every prescription in the practice.
  {
    href: "/prescriptions",
    label: "Lieky & dohľad",
    i18nKey: "nav.medications",
    icon: Pill,
    roles: ["admin", "veterinarian", "technician"],
    section: "pharmacy",
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
  {
    href: "/statutory",
    label: "Zákonné registre",
    i18nKey: "nav.statutory",
    icon: BookOpen,
    roles: ["admin", "veterinarian"],
    section: "billing",
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
  // Sprint 27 — VPM input contract schema validation (Ajv + openvpm/schemas).
  {
    href: "/settings/schema-validation",
    label: "Validácia schém",
    i18nKey: "nav.schemaValidation",
    icon: FileText,
    roles: ["admin", "veterinarian"],
    section: "admin",
  },
  // Sprint 30 — Secure Interop Bridge v1 → v2. Encrypted, schema-validated
  // message exchange with the legacy runtime; admin-only infrastructure.
  {
    href: "/admin/interop-bridge",
    label: "Interop most v1 → v2",
    i18nKey: "nav.interopBridge",
    icon: Waypoints,
    roles: ["admin"],
    section: "admin",
    badge: "v1→v2",
  },
];
