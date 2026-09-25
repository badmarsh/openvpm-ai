import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Sprint 26 — Marketing Studio part 2: reviews (/marketing/reviews) and the
 * clinic website CMS (/marketing/website).
 *
 * Pins the dashboard UI-kit adoption (page shell, PageHeader icons, PageToolbar
 * filters, DataTableFrame queues, sentiment badges, the page-sections register
 * with its preview chip), the Sympathy Gate suppression indicator and the
 * SK/EN i18n coverage — while guarding the surfaces this sprint must not touch
 * (AI reply generation, the marketing router contract, webhook security).
 */

const WEB_ROOT = path.join(__dirname, "../..");
const REVIEWS_PAGE = "app/(dashboard)/marketing/reviews/page.tsx";
const WEBSITE_PAGE = "app/(dashboard)/marketing/website/page.tsx";
const MARKETING_ROUTER = "server/routers/extensions/marketing.ts";
const PAGE_KIT = "@/components/layout/page-kit";

type Dict = Record<string, unknown>;

function read(relativePath: string): string {
  return readFileSync(path.join(WEB_ROOT, relativePath), "utf8");
}

/** Value bindings of every `import { … } from "<moduleName>"` (type-only skipped). */
function namedImports(source: string, moduleName: string): Set<string> {
  const escaped = moduleName.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  const importRe = new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*["']${escaped}["']`, "g");
  const names = new Set<string>();
  for (const match of source.matchAll(importRe)) {
    for (const specifier of match[1].split(",")) {
      const trimmed = specifier.trim();
      if (!trimmed || trimmed.startsWith("type ")) continue;
      names.add(trimmed.split(/\s+as\s+/)[0].trim());
    }
  }
  return names;
}

/** Every literal key passed as the first argument of `t("…")`. */
function translationKeys(source: string, namespace: string): string[] {
  return [
    ...new Set(
      [
        ...source.matchAll(
          new RegExp(`\\bt\\(\\s*["'\`](${namespace.replace(/\./g, "\\.")}\\.[A-Za-z0-9_.]+)["'\`]`, "g"),
        ),
      ].map((match) => match[1]!),
    ),
  ];
}

function resolveKey(dict: Dict, key: string): unknown {
  return key
    .split(".")
    .reduce<unknown>(
      (node, part) =>
        node !== null && typeof node === "object" ? (node as Dict)[part] : undefined,
      dict,
    );
}

function leafKeys(node: unknown, prefix = ""): string[] {
  if (node === null || typeof node !== "object") return [prefix];
  return Object.entries(node as Dict)
    .flatMap(([key, value]) => leafKeys(value, prefix ? `${prefix}.${key}` : key))
    .sort();
}

function count(source: string, needle: string): number {
  return source.split(needle).length - 1;
}

const reviews = read(REVIEWS_PAGE);
const website = read(WEBSITE_PAGE);
const router = read(MARKETING_ROUTER);
const en = JSON.parse(read("messages/en.json")) as Dict;
const sk = JSON.parse(read("messages/sk.json")) as Dict;

describe("reviews page — page-kit harmonization", () => {
  const kit = namedImports(reviews, PAGE_KIT);

  it("imports the dashboard page-kit primitives", () => {
    for (const name of [
      "pageShellClass",
      "PageHeader",
      "PageToolbar",
      "SearchField",
      "DataTableFrame",
      "KpiGrid",
      "KpiCard",
      "TableSkeleton",
      "filterControlClass",
      "tableHeadClass",
      "tableCellClass",
      "tableRowClass",
    ]) {
      expect(kit.has(name), `${name} must be imported from ${PAGE_KIT}`).toBe(true);
    }
    expect(reviews).not.toContain('from "@/components/layout/page-header"');
    // EmptyState is the same component page-kit re-exports.
    expect(kit.has("EmptyState")).toBe(true);
  });

  it("uses pageShellClass rhythm and a Star PageHeader without an inline h1 icon", () => {
    expect(reviews).toContain("<div className={pageShellClass}>");
    expect(reviews).toContain("icon={Star}");
    expect(reviews).toContain('title={t("marketing.reviews.title", "Recenzie (Google & Facebook)")}');
    // The old hand-rolled header injected the icon inside the <h1> title node.
    expect(reviews).not.toContain('<Star className="w-6 h-6 text-amber-500 fill-amber-500" />');
    expect(reviews).not.toContain('title={\n          <span className="flex items-center gap-2">');
    // Header actions follow the size="sm" contract.
    expect(reviews).toMatch(/actions=\{\s*<Button\s*type="button"\s*size="sm"/);
    // No mixed sibling offsets on top-level blocks.
    expect(reviews).not.toContain('<div className="space-y-6">');
  });

  it("collects platform filter + date range + rating/status/sentiment in one PageToolbar", () => {
    expect(reviews).toContain("<PageToolbar>");
    expect(reviews).toContain(
      'aria-label={t("marketing.reviews.toolbar.platformLabel", "Filtrovať podľa platformy")}',
    );
    expect(count(reviews, 'type="date"')).toBe(2);
    expect(reviews).toContain('id="marketing-reviews-date-from"');
    expect(reviews).toContain('id="marketing-reviews-date-to"');
    expect(reviews).toContain('aria-label={t("marketing.reviews.toolbar.ratingLabel"');
    expect(reviews).toContain('aria-label={t("marketing.reviews.toolbar.statusLabel"');
    expect(reviews).toContain('aria-label={t("marketing.reviews.toolbar.sentimentLabel"');
    expect(reviews).toContain('aria-label={t("marketing.reviews.toolbar.escalationLabel"');
    expect(reviews).toContain("<SearchField");
    // Count of the filtered queue stays announced to assistive tech.
    expect(reviews).toContain('aria-live="polite"');
    expect(reviews).toContain("reviewCountLabel(reviews.length, t)");
    // The hand-rolled pill groups are gone.
    expect(reviews).not.toContain("inline-flex rounded-lg border bg-muted/40 p-1");
    expect(reviews).not.toContain("bg-muted/40 rounded-lg border border-border/40");
  });

  it("filters the received date by the picked range instead of the whole history", () => {
    expect(reviews).toContain("function startOfDay(value: string): number | null {");
    expect(reviews).toContain("function endOfDay(value: string): number | null {");
    expect(reviews).toContain("if (dateRangeFrom !== null && received < dateRangeFrom) return false;");
    expect(reviews).toContain("if (dateRangeTo !== null && received > dateRangeTo) return false;");
    expect(reviews).toContain("Number.isNaN(time) ? null : time");
  });

  it("renders the review queue in a DataTableFrame with the shared table tokens", () => {
    expect(count(reviews, "<DataTableFrame>")).toBe(1);
    expect(reviews).toContain("<th className={tableHeadClass}>");
    expect(reviews).toContain("<td className={tableCellClass}>");
    expect(reviews).toContain("cn(\n                          tableRowClass,");
    expect(reviews).toContain("colSpan={TABLE_COLUMNS}");
    expect(reviews).toContain("const TABLE_COLUMNS = 7;");
    // Whole-row click with stopPropagation on the inner row actions.
    expect(reviews).toContain("onClick={() => toggleExpand(review.id)}");
    expect(count(reviews, "event.stopPropagation();")).toBeGreaterThanOrEqual(6);
    // Card-grid list chrome is gone.
    expect(reviews).not.toContain("rounded-xl border bg-card p-5 shadow-sm space-y-4");
  });

  it("labels every review with a positive / neutral / negative sentiment badge", () => {
    expect(reviews).toContain("<SentimentBadge review={review} t={t} />");
    expect(reviews).toContain("function resolveSentiment(review: ReviewRow): Sentiment {");
    expect(reviews).toContain('if (review.sentimentLabel === "positive") return "positive";');
    expect(reviews).toContain('if (review.sentimentLabel === "negative") return "negative";');
    expect(reviews).toContain('if (review.sentimentLabel === "neutral") return "neutral";');
    expect(reviews).toContain("if (rating >= 4) return \"positive\";");
    expect(reviews).toContain("if (rating <= 2) return \"negative\";");
    expect(reviews).toContain('t("marketing.reviews.sentiment.positive", "Pozitívna")');
    expect(reviews).toContain('t("marketing.reviews.sentiment.neutral", "Neutrálna")');
    expect(reviews).toContain('t("marketing.reviews.sentiment.negative", "Negatívna")');
    // Sentiment badges use the semantic badge tokens, not raw palettes.
    expect(reviews).toContain('<Badge variant="success" className="gap-1 text-[11px] font-medium">');
    expect(reviews).toContain(
      '<Badge variant="destructive" className="gap-1 text-[11px] font-medium">',
    );
    expect(reviews).not.toContain("bg-emerald-50 text-emerald-700 border-emerald-200");
    expect(reviews).not.toContain("bg-rose-50 text-rose-700 border-rose-300");
  });

  it("flags Sympathy Gate suppression in the queue, in the KPI strip and in the filter", () => {
    expect(reviews).toContain('const SYMPATHY_GATE_REASON = "sympathy_gate";');
    expect(reviews).toContain("return review.requestBlockedReason === SYMPATHY_GATE_REASON;");
    expect(reviews).toContain('t("marketing.reviews.queue.colSympathy", "Sympathy Gate")');
    expect(reviews).toContain('"marketing.reviews.queue.sympathyTitle",');
    expect(reviews).toContain('"marketing.reviews.queue.sympathyNote",');
    expect(reviews).toContain('t("marketing.reviews.kpi.sympathyBlocked"');
    expect(reviews).toContain('t("marketing.reviews.toolbar.sympathyOnly", "Iba Sympathy Gate")');
    expect(reviews).toContain("aria-pressed={sympathyOnly}");
    expect(reviews).toContain("if (sympathyOnly && !isSympathyBlocked(review)) return false;");
    expect(reviews).toContain("if (isSympathyBlocked(review)) sympathyBlocked += 1;");
  });

  it("keeps the AI reply generation and escalation contract untouched", () => {
    expect(reviews).toContain("trpc.extensions.marketing.generateReviewReply.useMutation({");
    expect(reviews).toContain("reviewId: review.id,");
    expect(reviews).toContain(
      'platform: (review.platform as "google" | "facebook" | "internal") || "google",',
    );
    expect(reviews).toContain('tone: (review.rating ?? 5) < 3 ? "apologetic" : "warm",');
    expect(reviews).toContain("trpc.extensions.marketing.approveReviewReply.useMutation({");
    expect(reviews).toContain("trpc.extensions.marketing.escalateReview.useMutation({");
    expect(reviews).toContain("trpc.extensions.marketing.replyToReview.useMutation({");
    expect(reviews).toContain("approvedReplyText: replyText.trim(),");
    expect(reviews).not.toContain("ClinicalDiffConfirmModal");
  });

  it("routes every toast, label and canned reply through t()", () => {
    expect(reviews).not.toMatch(/toast\.(?:success|error|info|warning)\(\s*["'`]/);
    expect(reviews).not.toContain('err.message || "');
    expect(reviews).toContain("description: err.message || undefined,");
    // Canned SK replies were hardcoded constants before this sprint.
    expect(reviews).not.toContain("CANNED_RESPONSES");
    expect(reviews).toContain('"marketing.reviews.canned.generalLabel",');
    expect(reviews).toContain('"marketing.reviews.canned.complaintText",');
    // The demo-review seeder inserted fake clinics/reviewers — no UI trigger left.
    expect(reviews).not.toContain("seedReviews");
    expect(reviews).not.toContain("Vzorové recenzie");
  });

  it("formats dates by UI language instead of hardcoded sk-SK", () => {
    expect(reviews).not.toContain("toLocaleDateString(");
    expect(reviews).toContain("formatDate(review.receivedAt, undefined, locale)");
    expect(reviews).toContain("formatDate(review.repliedAt, undefined, locale)");
  });
});

describe("website CMS page — page-kit harmonization", () => {
  const kit = namedImports(website, PAGE_KIT);

  it("imports the dashboard page-kit primitives", () => {
    for (const name of [
      "pageShellClass",
      "PageHeader",
      "PageToolbar",
      "SearchField",
      "DataTableFrame",
      "KpiGrid",
      "KpiCard",
      "TableSkeleton",
      "filterControlClass",
      "tableHeadClass",
      "tableCellClass",
      "tableRowClass",
      "underlineTabsListClass",
      "underlineTabsTriggerClass",
    ]) {
      expect(kit.has(name), `${name} must be imported from ${PAGE_KIT}`).toBe(true);
    }
    expect(website).not.toContain('from "@/components/layout/page-header"');
    expect(website).toContain("<div className={pageShellClass}>");
    expect(website).not.toContain('className="w-full px-4 sm:px-6 py-4 flex flex-col gap-6"');
  });

  it("uses a Globe PageHeader and underline section tabs instead of button pills", () => {
    expect(website).toContain("icon={Globe}");
    expect(website).toContain('title={t("marketing.website.title", "Webstránka kliniky")}');
    expect(website).not.toContain('<Globe className="h-6 w-6 text-primary shrink-0" />');
    expect(website).toContain("className={underlineTabsListClass}");
    expect(count(website, "className={underlineTabsTriggerClass}")).toBe(3);
    for (const tab of ["builder", "sections", "inquiries"]) {
      expect(website).toContain(`<TabsContent value="${tab}" className="mt-0 space-y-3 pt-4">`);
    }
    expect(website).toContain('type WebsiteTab = "builder" | "sections" | "inquiries";');
  });

  it("lists page sections in a DataTableFrame with a content preview chip", () => {
    expect(count(website, "<DataTableFrame>")).toBe(2);
    expect(website).toContain('t("marketing.website.sections.colPreview", "Náhľad obsahu")');
    expect(website).toContain("function sectionPreviewText(section: WebsiteSection): string | null {");
    expect(website).toContain(
      'const PREVIEW_CONTENT_KEYS = ["title", "headline", "heading", "badge", "label"] as const;',
    );
    expect(website).toContain("const previewLabel = preview ?? sectionTypeLabel(section.type, t);");
    expect(website).toContain('t(\n                              "marketing.website.sections.previewChipTitle",');
    expect(website).toContain("function sectionItemCount(section: WebsiteSection): number | null {");
    expect(website).toContain('t("marketing.website.sections.itemCount", "{count} položiek", {');
    // Visibility + order come from the section model, never from a default state.
    expect(website).toContain(
      "section.visible\n                              ? t(\"marketing.website.sections.visible\"",
    );
    expect(website).toContain("{section.order + 1}");
    // Every row action reuses the canvas handlers (single source of truth).
    for (const handler of [
      "handleEditSection(section)",
      "handleDuplicateSection(section.id)",
      "handleToggleVisibility(section.id)",
      "handleDeleteSection(section.id)",
    ]) {
      expect(website).toContain(handler);
    }
    expect(website).toContain("const SECTION_COLUMNS = 5;");
    // Whole-row click opens the properties sheet; inner actions stopPropagation.
    expect(website).toContain("onClick={() => handleEditSection(section)}");
    expect(count(website, "event.stopPropagation();")).toBeGreaterThanOrEqual(6);
  });

  it("labels all 18 section types through t() with Slovak fallbacks", () => {
    for (const type of [
      "hero",
      "about",
      "services",
      "team",
      "reviews",
      "faq",
      "hours_location",
      "booking_cta",
      "gallery",
      "handouts",
      "trust_badges",
      "stats",
      "emergency_banner",
      "contact_form",
      "video_embed",
      "social_proof",
      "custom_rich_text",
      "wellness",
    ]) {
      expect(website).toContain(`marketing.website.sections.types.${type}`);
      expect(typeof resolveKey(en, `marketing.website.sections.types.${type}`)).toBe("string");
      expect(typeof resolveKey(sk, `marketing.website.sections.types.${type}`)).toBe("string");
    }
    expect(website).toContain("const SECTION_TYPE_ICONS: Record<SectionType, LucideIcon> = {");
  });

  it("turns the inquiry list into a DataTableFrame with the status workflow", () => {
    expect(website).toContain('t("marketing.website.inquiries.tableName", "Meno záujemcu")');
    expect(website).toContain('t("marketing.website.inquiries.tableStatus", "Stav")');
    expect(website).toContain("const INQUIRY_COLUMNS = 6;");
    expect(website).toContain('value={inquiryStatusFilter}');
    expect(website).toContain(
      'aria-label={t("marketing.website.inquiries.statusLabel", "Filtrovať podľa stavu dopytu")}',
    );
    expect(website).toContain('formatDateTime(inquiry.createdAt, { language: locale })');
    expect(website).not.toContain('toLocaleString("sk-SK")');
    // Status pills replaced by the kit toolbar select.
    expect(website).not.toContain("bg-muted/40 p-1 rounded-lg border border-border text-xs flex-wrap");
    for (const status of ["in_progress", "resolved", "archived", "new"]) {
      expect(website).toContain(`status: "${status}",`);
    }
  });

  it("keeps the autosave, publish and unsaved-changes guard behaviour", () => {
    expect(website).toContain("const AUTOSAVE_DEBOUNCE_MS = 1000;");
    expect(website).toContain("}, AUTOSAVE_DEBOUNCE_MS);");
    expect(website).toContain('window.addEventListener("beforeunload", handleBeforeUnload);');
    expect(website).toContain('saveMutation.mutate({ sections, publishLive: false });');
    expect(website).toContain("publishMutation.mutate({ sections });");
    expect(website).toContain("toggleMutation.mutate({ published: false, sections });");
    expect(website).toContain('t("marketing.website.autosaveSaving", "Ukladám zmeny...")');
    expect(website).toContain('t("marketing.website.autosaveSaved", "Všetky zmeny uložené v koncepte")');
    expect(website).toContain('t("marketing.website.autosaveUnsaved", "Neuložené zmeny")');
    // The drag-and-drop canvas and its palette/sheet stay mounted.
    expect(website).toContain("<WebsiteEditorPalette onAddSection={handleAddSection} />");
    expect(website).toContain("<WebsiteEditorCanvas");
    expect(website).toContain("<WebsiteEditorSheet");
  });

  it("routes every toast and tooltip through t()", () => {
    expect(website).not.toMatch(/toast\.(?:success|error|info|warning)\(\s*["'`]/);
    expect(website).not.toContain('err.message || "');
    expect(website).toContain("description: err.message || undefined,");
    expect(website).toContain('"marketing.website.toast.sectionAdded",');
    expect(website).toContain('"marketing.website.saveDraftTooltip",');
  });
});

describe("marketing reviews & website translations", () => {
  it.each([
    [REVIEWS_PAGE, reviews, "marketing.reviews"],
    [WEBSITE_PAGE, website, "marketing.website"],
  ])("resolves every t() key in %s in both en.json and sk.json", (_file, source, namespace) => {
    const keys = translationKeys(source, namespace);
    expect(keys.length).toBeGreaterThan(60);

    const missing = keys.flatMap((key) =>
      (
        [
          ["en", en],
          ["sk", sk],
        ] as const
      )
        .filter(([, dict]) => typeof resolveKey(dict, key) !== "string")
        .map(([lang]) => `${lang}:${key}`),
    );
    expect(missing).toEqual([]);
  });

  it("keeps the marketing.reviews.* and marketing.website.* subtrees leaf-symmetric", () => {
    for (const root of ["marketing.reviews", "marketing.website"]) {
      const enLeaves = leafKeys(resolveKey(en, root));
      expect(enLeaves.length).toBeGreaterThan(60);
      expect(leafKeys(resolveKey(sk, root))).toEqual(enLeaves);
    }
  });

  it("translates the new Sympathy Gate and section vocabulary in both locales", () => {
    for (const key of [
      "marketing.reviews.kpi.sympathyBlocked",
      "marketing.reviews.queue.sympathyNote",
      "marketing.reviews.toolbar.sympathyOnly",
      "marketing.reviews.sentiment.positive",
      "marketing.reviews.sentiment.neutral",
      "marketing.reviews.sentiment.negative",
      "marketing.website.tabSections",
      "marketing.website.sections.previewChipTitle",
      "marketing.website.sections.colPreview",
    ]) {
      expect((resolveKey(en, key) as string).trim().length, `en ${key}`).toBeGreaterThan(0);
      expect((resolveKey(sk, key) as string).trim().length, `sk ${key}`).toBeGreaterThan(0);
    }
  });
});

describe("do-not-touch surfaces stay intact", () => {
  it("keeps the marketing router review + website procedures unchanged", () => {
    for (const procedure of [
      "listReviews:",
      "createReview:",
      "replyToReview:",
      "approveReviewReply:",
      "escalateReview:",
      "generateReviewReply:",
      "seedReviews:",
      "getWebsiteConfig:",
      "updateWebsiteSections:",
      "publishWebsite:",
      "listWebsiteInquiries:",
      "updateWebsiteInquiryStatus:",
    ]) {
      expect(router).toContain(procedure);
    }
    // Webhook signature verification lives outside the two pages.
    expect(reviews).not.toContain("signature");
    expect(website).not.toContain("signature");
    expect(reviews).not.toContain("createHmac");
    expect(website).not.toContain("createHmac");
  });

  it("does not drag the clinical diff modal or controlled-substance gates into marketing", () => {
    for (const source of [reviews, website]) {
      expect(source).not.toContain("ClinicalDiffConfirmModal");
      expect(source).not.toContain("controlledSubstance");
    }
  });
});
