import { and, desc, eq, gt, isNull, ne, sql } from "drizzle-orm";
import type { Database } from "@openpims/db/client";
import {
  practices,
  patients,
  clients,
  extMarketingMediaAssets,
  extMarketingMediaConsents,
  extMarketingContentBatches,
  extMarketingContentItems,
} from "@openpims/db";
import { RECIPES, seasonFor, type Recipe } from "./recipes";
import { validateMarketingText, type ValidatorReport } from "./validator";
import { composePost } from "./composer";

export interface ClinicBrand {
  id: string;
  name: string;
  phone: string;
  email: string;
  bookingUrl: string;
  reviewUrl: string;
  defaultLanguage: string;
  languages: string[];
  tone: string;
  voicePrompt: string;
  disclaimer: string;
  brandColor: string;
  accentColor: string;
  marketingRateLimitDays: number;
  quietHoursStart: number;
  quietHoursEnd: number;
  emergencyPhone?: string;
  openingHours?: Record<string, string>;
  autoReply5star?: boolean;
}

export async function getBrand(db: Database | any, practiceId: string): Promise<ClinicBrand> {
  const [practice] = await db
    .select({
      id: practices.id,
      name: practices.name,
      phone: practices.phone,
      email: practices.email,
      website: practices.website,
      settings: practices.settings,
    })
    .from(practices)
    .where(eq(practices.id, practiceId))
    .limit(1);

  if (!practice) {
    throw new Error("Klinika nebola nájdená.");
  }

  const settings = (practice.settings ?? {}) as Record<string, any>;
  const bk = (settings.brandKit ?? {}) as Record<string, any>;

  return {
    id: practice.id,
    name: practice.name,
    phone: practice.phone ?? "+421 2 1234 5678",
    email: practice.email ?? "info@klinika.sk",
    bookingUrl: (bk.bookingUrl as string) ?? practice.website ?? "https://klinika.sk/objednanie",
    reviewUrl: (bk.reviewUrl as string) ?? "https://g.page/r/openvpm/review",
    defaultLanguage: (bk.defaultLanguage as string) ?? "sk",
    languages: (bk.languages as string[]) ?? ["sk", "en"],
    tone: (bk.toneOfVoice as string) ?? "Súcitný, jasný, upokojujúci, komunitne orientovaný.",
    voicePrompt: (bk.brandVoiceInstructions as string) ?? "",
    disclaimer:
      (bk.disclaimer as string) ??
      "Len pre všeobecné informácie o zdraví zvierat. Vždy sa poraďte s naším veterinárnym tímom.",
    brandColor: (settings.brandColor as string) ?? "#0d9488",
    accentColor: (bk.secondaryColor as string) ?? "#f5f5f4",
    marketingRateLimitDays: (bk.marketingRateLimitDays as number) ?? 7,
    quietHoursStart: (bk.quietHoursStart as number) ?? 20,
    quietHoursEnd: (bk.quietHoursEnd as number) ?? 8,
    emergencyPhone: (bk.emergencyPhone as string) ?? practice.phone ?? undefined,
    openingHours: (bk.openingHours as Record<string, string>) ?? {
      po_pia: "08:00 - 19:00",
      so: "09:00 - 13:00",
      ne: "Pohotovosť na telefóne",
    },
    autoReply5star: (bk.autoReply5star as boolean) ?? false,
  };
}

export function mondayOf(d: Date): Date {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // pondelok = 0
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

function utm(url: string, week: string): string {
  if (!url) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}utm_source=social&utm_medium=post&utm_campaign=week_${week}`;
}

export interface Candidate {
  asset: typeof extMarketingMediaAssets.$inferSelect;
  consentValid: boolean;
  patientName?: string;
}

async function validPhotoCandidates(db: Database | any, practiceId: string): Promise<Candidate[]> {
  const used = db
    .select({ id: extMarketingContentItems.mediaAssetId })
    .from(extMarketingContentItems)
    .where(
      and(
        eq(extMarketingContentItems.practiceId, practiceId),
        ne(extMarketingContentItems.status, "blocked")
      )
    );

  const rows = await db
    .select({
      asset: extMarketingMediaAssets,
      consent: extMarketingMediaConsents,
      patient: patients,
    })
    .from(extMarketingMediaAssets)
    .innerJoin(
      extMarketingMediaConsents,
      eq(extMarketingMediaAssets.consentId, extMarketingMediaConsents.id)
    )
    .leftJoin(patients, eq(extMarketingMediaConsents.patientId, patients.id))
    .where(
      and(
        eq(extMarketingMediaAssets.practiceId, practiceId),
        eq(extMarketingMediaConsents.scope, "photo_social"),
        isNull(extMarketingMediaConsents.revokedAt),
        isNull(extMarketingMediaAssets.deletedAt),
      )
    )
    .orderBy(desc(extMarketingMediaAssets.createdAt));

  const usedIds = new Set(
    (await used).map((r: { id: string | null }) => r.id).filter((x: string | null): x is string => !!x)
  );

  return rows
    .filter((r: { asset: typeof extMarketingMediaAssets.$inferSelect }) => !usedIds.has(r.asset.id))
    .map((r: { asset: typeof extMarketingMediaAssets.$inferSelect; patient: typeof patients.$inferSelect | null }) => ({
      asset: r.asset,
      consentValid: true,
      patientName: r.patient?.name ?? undefined,
    }));
}

export async function nameGuards(db: Database | any, practiceId: string) {
  const clientRows = await db
    .select({ firstName: clients.firstName, lastName: clients.lastName })
    .from(clients)
    .where(and(eq(clients.practiceId, practiceId), isNull(clients.deletedAt)));

  const patientRows = await db
    .select({ name: patients.name })
    .from(patients)
    .where(and(eq(patients.practiceId, practiceId), isNull(patients.deletedAt)));

  const knownNames = [
    ...clientRows.flatMap((cl: { firstName: string | null; lastName: string | null }) => [cl.firstName, cl.lastName]),
    ...patientRows.map((p: { name: string | null }) => p.name),
  ].filter((n: string | null): n is string => !!n && n.trim().length > 2);

  const storyConsents = await db
    .select({
      clientId: extMarketingMediaConsents.clientId,
      patientId: extMarketingMediaConsents.patientId,
      scope: extMarketingMediaConsents.scope,
    })
    .from(extMarketingMediaConsents)
    .where(
      and(
        eq(extMarketingMediaConsents.practiceId, practiceId),
        isNull(extMarketingMediaConsents.revokedAt),
      )
    );

  const allowedClientIds = new Set(
    storyConsents
      .filter((c: { scope: string }) => c.scope === "story" || c.scope === "testimonial")
      .map((c: { clientId: string }) => c.clientId)
  );
  const allowedPatientIds = new Set(
    storyConsents
      .filter((c: { scope: string; patientId: string | null }) => (c.scope === "story" || c.scope === "testimonial") && c.patientId)
      .map((c: { patientId: string | null }) => c.patientId!)
  );

  const allowedNames: string[] = [];
  if (allowedPatientIds.size > 0) {
    const allowedPatients = await db
      .select({ name: patients.name })
      .from(patients)
      .where(and(eq(patients.practiceId, practiceId), isNull(patients.deletedAt)));
    allowedNames.push(...allowedPatients.map((p: { name: string }) => p.name).filter(Boolean));
  }
  if (allowedClientIds.size > 0) {
    const allowedClients = await db
      .select({ firstName: clients.firstName, lastName: clients.lastName })
      .from(clients)
      .where(and(eq(clients.practiceId, practiceId), isNull(clients.deletedAt)));
    allowedNames.push(
      ...allowedClients.flatMap((c: { firstName: string; lastName: string }) => [c.firstName, c.lastName]).filter(Boolean)
    );
  }

  return {
    knownNames: [...new Set(knownNames)],
    allowedNames: [...new Set(allowedNames)],
  };
}

interface Slot {
  day: number; // 0=po
  hour: number;
}

export const SLOTS: Slot[] = [
  { day: 1, hour: 10 }, // utorok 10:00
  { day: 3, hour: 17 }, // štvrtok 17:00
  { day: 5, hour: 9 }, // sobota 9:00
  { day: 2, hour: 12 },
  { day: 4, hour: 12 },
];

export function slotDate(monday: Date, s: Slot): Date {
  const d = new Date(monday);
  d.setDate(d.getDate() + s.day);
  d.setHours(s.hour, 0, 0, 0);
  return d;
}

export interface ProposedItem {
  recipeKey: string;
  type: "post" | "tv_slide";
  title: string;
  body: string;
  translations: Record<string, string>;
  platforms: string[];
  scheduledAt: Date;
  status: "proposed" | "blocked";
  mediaAssetId: string | null;
  validatorVerdict: "pass" | "warn" | "block";
  validatorFindings: any;
}

export interface ProposedWeeklyPlan {
  weekStart: string;
  themeTitle: string;
  items: ProposedItem[];
}

export interface GenResult {
  batchId: string;
  weekStart: string;
  created: boolean;
  items: number;
  blocked: number;
}

export async function generateWeeklyBatch(
  db: Database | any,
  practiceId: string,
  opts?: {
    weekStart?: Date;
    reason?: string;
    save?: boolean;
    userId?: string;
  }
): Promise<{ result: GenResult; plan: ProposedWeeklyPlan }> {
  const brand = await getBrand(db, practiceId);
  const monday = mondayOf(opts?.weekStart ?? new Date());
  const week = iso(monday);
  const save = opts?.save ?? true;

  const existing = await db
    .select()
    .from(extMarketingContentBatches)
    .where(
      and(
        eq(extMarketingContentBatches.practiceId, practiceId),
        eq(extMarketingContentBatches.weekStart, week)
      )
    )
    .limit(1);

  if (existing[0] && save) {
    const items = await db
      .select()
      .from(extMarketingContentItems)
      .where(
        and(
          eq(extMarketingContentItems.practiceId, practiceId),
          eq(extMarketingContentItems.batchId, existing[0].id)
        )
      );
    return {
      result: {
        batchId: existing[0].id,
        weekStart: week,
        created: false,
        items: items.length,
        blocked: items.filter((i: { status: string }) => i.status === "blocked").length,
      },
      plan: {
        weekStart: week,
        themeTitle: "",
        items: items.map((i: any) => ({
          recipeKey: "custom",
          type: "post",
          title: i.title,
          body: i.body,
          translations: { [brand.defaultLanguage]: i.body },
          platforms: ["facebook", "instagram"],
          scheduledAt: i.scheduledFor ?? monday,
          status: i.status,
          mediaAssetId: i.mediaAssetId,
          validatorVerdict: i.validatorVerdict ?? "pass",
          validatorFindings: i.validatorFindings ?? [],
        })),
      },
    };
  }

  const month = monday.getMonth() + 1;
  const theme = seasonFor(month);
  const bookingUtm = utm(brand.bookingUrl, week);

  const [photos, guards] = await Promise.all([
    validPhotoCandidates(db, practiceId),
    nameGuards(db, practiceId),
  ]);

  interface Draft {
    recipe: Recipe;
    title: string;
    facts: Record<string, string>;
    assetId?: string | null;
    slot: Slot;
  }
  const drafts: Draft[] = [];
  const link = bookingUtm;

  if (photos[0]) {
    drafts.push({
      recipe: RECIPES.find((r) => r.key === "patient_photo")!,
      title: "Na klinike dnes",
      facts: { pet_name: photos[0].patientName ?? "", seed: week, booking_url: link },
      assetId: photos[0].asset.id,
      slot: SLOTS[0],
    });
  }

  if (theme) {
    drafts.push({
      recipe: RECIPES.find((r) => r.key === "seasonal_tip")!,
      title: theme.title[brand.defaultLanguage] ?? theme.title.sk ?? "Sezónna prevencia",
      facts: {
        title: theme.title[brand.defaultLanguage] ?? theme.title.sk ?? "",
        tip_sk: theme.tip.sk ?? "",
        tip_en: theme.tip.en ?? "",
        tip_hu: theme.tip.hu ?? "",
        booking_url: link,
      },
      assetId: null,
      slot: drafts.length ? SLOTS[1] : SLOTS[0],
    });
  }

  drafts.push({
    recipe: RECIPES.find((r) => r.key === "service_spotlight")!,
    title: "Preventívna starostlivosť a prehliadky",
    facts: {
      title: "Komplexná starostlivosť o vašich miláčikov",
      detail: "Pravidelné kontroly chránia pred skrytými ochoreniami.",
      booking_url: link,
    },
    assetId: null,
    slot: SLOTS[Math.min(drafts.length, SLOTS.length - 1)],
  });

  if (photos[1] && drafts.length < 5) {
    drafts.push({
      recipe: RECIPES.find((r) => r.key === "patient_of_week")!,
      title: "Pacient týždňa",
      facts: { pet_name: photos[1].patientName ?? "", booking_url: link },
      assetId: photos[1].asset.id,
      slot: SLOTS[Math.min(drafts.length, SLOTS.length - 1)],
    });
  }

  const proposedItems: ProposedItem[] = [];
  let blockedCount = 0;

  for (const d of drafts.slice(0, 5)) {
    const allowName =
      d.assetId != null &&
      !!d.facts.pet_name &&
      guards.allowedNames.some(
        (n) => n.toLowerCase() === d.facts.pet_name.toLowerCase()
      );

    const translations: Record<string, string> = {};
    let worst: ValidatorReport = {
      verdict: "pass",
      findings: [],
      checkedAt: new Date().toISOString(),
      canApprove: true,
    };

    for (const lang of brand.languages) {
      const text = await composePost({
        recipeKey: d.recipe.key,
        lang,
        brand,
        facts: { ...d.facts, seed: week, hashtags: "1" },
        allowName,
      });
      translations[lang] = text;
      const rep = validateMarketingText({
        text,
        context: "marketing",
        allowPrice: d.recipe.allowPrice,
        allowedClientNames: guards.allowedNames,
        knownClientNames: guards.knownNames,
      });

      if (rep.verdict === "block") {
        worst = rep;
      } else if (rep.verdict === "warn" && worst.verdict === "pass") {
        worst = rep;
      }
    }

    const defLang = brand.defaultLanguage;
    const body = translations[defLang] ?? Object.values(translations)[0] ?? "";
    const status = worst.verdict === "block" ? "blocked" : "proposed";
    if (status === "blocked") blockedCount++;

    proposedItems.push({
      recipeKey: d.recipe.key,
      type: d.recipe.type,
      title: d.title,
      body,
      translations,
      platforms: d.recipe.platforms,
      scheduledAt: slotDate(monday, d.slot),
      status,
      mediaAssetId: d.assetId ?? null,
      validatorVerdict: worst.verdict,
      validatorFindings: worst.findings,
    });
  }

  let batchId = "";
  if (save) {
    const [batch] = await db
      .insert(extMarketingContentBatches)
      .values({
        practiceId,
        weekStart: week,
        status: "in_review",
      })
      .returning();
    batchId = batch.id;

    for (const item of proposedItems) {
      await db.insert(extMarketingContentItems).values({
        practiceId,
        batchId: batch.id,
        createdBy: opts?.userId ?? practiceId,
        title: item.title,
        body: item.body,
        channel: "facebook",
        status: item.status,
        scheduledFor: item.scheduledAt,
        mediaAssetId: item.mediaAssetId,
        validatorVerdict: item.validatorVerdict,
        validatorFindings: item.validatorFindings,
      });
    }
  }

  return {
    result: {
      batchId,
      weekStart: week,
      created: save,
      items: proposedItems.length,
      blocked: blockedCount,
    },
    plan: {
      weekStart: week,
      themeTitle: theme?.title[brand.defaultLanguage] ?? theme?.title.sk ?? "Týždenný plán",
      items: proposedItems,
    },
  };
}
