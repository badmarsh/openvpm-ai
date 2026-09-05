import {
  pgTable,
  pgEnum,
  uuid,
  text,
  jsonb,
  timestamp,
  integer,
  boolean,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { baseColumns } from "./common";
import { practices } from "./practices";
import { patients } from "./patients";
import { clients } from "./clients";
import { users } from "./users";
import { files } from "./files";
import { consentRequests } from "./consents";
import { appointments } from "./scheduling";
import { wellnessEnrollments } from "./wellness";

export const extMarketingContentStatusEnum = pgEnum("ext_marketing_content_status", ["proposed", "approved", "published", "blocked", "archived"]);
export const extMarketingChannelEnum = pgEnum("ext_marketing_channel", ["instagram", "facebook", "google_business", "sms", "email"]);
export const extMarketingConsentScopeEnum = pgEnum("ext_marketing_consent_scope", ["photo_social", "photo_web", "photo_tv", "story", "testimonial", "marketing_messages"]);
export const extMarketingConsentEvidenceEnum = pgEnum("ext_marketing_consent_evidence", ["signature", "sms_confirm", "pdf"]);
export const extMarketingMediaKindEnum = pgEnum("ext_marketing_media_kind", ["photo", "brand_graphic", "video", "illustration"]);
export const extMarketingTaskStatusEnum = pgEnum("ext_marketing_task_status", ["open", "done"]);

export const extMarketingMediaConsents = pgTable("ext_marketing_media_consents", {
  ...baseColumns(),
  practiceId: uuid("practice_id").notNull().references(() => practices.id),
  clientId: uuid("client_id").notNull().references(() => clients.id),
  patientId: uuid("patient_id").references(() => patients.id),
  consentRequestId: uuid("consent_request_id").references(() => consentRequests.id),
  scope: extMarketingConsentScopeEnum("scope").notNull(),
  evidenceType: extMarketingConsentEvidenceEnum("evidence_type").notNull(),
  grantedAt: timestamp("granted_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  notes: text("notes"),
}, (table) => ({
  practiceClientIdx: index("ext_mkt_consents_practice_client_idx").on(table.practiceId, table.clientId),
  practicePatientIdx: index("ext_mkt_consents_practice_patient_idx").on(table.practiceId, table.patientId),
}));

export const extMarketingMediaAssets = pgTable("ext_marketing_media_assets", {
  ...baseColumns(),
  practiceId: uuid("practice_id").notNull().references(() => practices.id),
  uploadedBy: uuid("uploaded_by").notNull().references(() => users.id),
  fileId: uuid("file_id").references(() => files.id),
  kind: extMarketingMediaKindEnum("kind").notNull(),
  caption: text("caption"),
  tags: text("tags").array(),
  consentId: uuid("consent_id").references(() => extMarketingMediaConsents.id),
}, (table) => ({
  practiceIdx: index("ext_mkt_media_practice_idx").on(table.practiceId, table.deletedAt),
  consentRequiredCheck: check("ext_mkt_media_consent_required", sql`(kind NOT IN ('photo', 'video') OR consent_id IS NOT NULL)`),
}));

export const extMarketingContentBatches = pgTable("ext_marketing_content_batches", {
  ...baseColumns(),
  practiceId: uuid("practice_id").notNull().references(() => practices.id),
  weekStart: text("week_start").notNull(), // ISO date YYYY-MM-DD
  status: text("status").notNull().default("in_review"), // draft | in_review | approved
}, (t) => ({
  practiceWeekUq: uniqueIndex("ext_mkt_batches_practice_week_uq").on(t.practiceId, t.weekStart),
}));

export const extMarketingContentItems = pgTable("ext_marketing_content_items", {
  ...baseColumns(),
  practiceId: uuid("practice_id").notNull().references(() => practices.id),
  batchId: uuid("batch_id").references(() => extMarketingContentBatches.id),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  title: text("title").notNull(),
  body: text("body").notNull(),
  channel: extMarketingChannelEnum("channel").notNull(),
  status: extMarketingContentStatusEnum("status").notNull().default("proposed"),
  scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  mediaAssetId: uuid("media_asset_id").references(() => extMarketingMediaAssets.id),
  validatorVerdict: text("validator_verdict"),
  validatorFindings: jsonb("validator_findings"),
  approvedBy: uuid("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
}, (table) => ({
  practiceIdx: index("ext_mkt_content_practice_idx").on(table.practiceId, table.deletedAt),
  scheduleIdx: index("ext_mkt_content_schedule_idx").on(table.practiceId, table.status, table.scheduledFor),
}));

export const extMarketingTvSlides = pgTable("ext_marketing_tv_slides", {
  ...baseColumns(),
  practiceId: uuid("practice_id").notNull().references(() => practices.id),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  title: text("title").notNull(),
  body: text("body"),
  mediaAssetId: uuid("media_asset_id").references(() => extMarketingMediaAssets.id),
  durationSeconds: integer("duration_seconds").notNull().default(12),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
}, (table) => ({
  activeIdx: index("ext_mkt_tv_active_idx").on(table.practiceId, table.isActive, table.sortOrder),
}));

export const extMarketingHandouts = pgTable("ext_marketing_handouts", {
  ...baseColumns(),
  practiceId: uuid("practice_id").notNull().references(() => practices.id),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  species: text("species").array(),
  tags: text("tags").array(),
  isPublic: boolean("is_public").notNull().default(true),
}, (table) => ({
  practiceIdx: index("ext_mkt_handouts_practice_idx").on(table.practiceId, table.deletedAt),
  slugUq: uniqueIndex("ext_mkt_handouts_slug_uq").on(table.practiceId, table.slug),
}));

export const extMarketingReviews = pgTable("ext_marketing_reviews", {
  ...baseColumns(),
  practiceId: uuid("practice_id").notNull().references(() => practices.id),
  patientId: uuid("patient_id").references(() => patients.id),
  clientId: uuid("client_id").references(() => clients.id),
  appointmentId: uuid("appointment_id").references(() => appointments.id),
  externalReviewId: text("external_review_id"),
  rating: integer("rating"),
  reviewText: text("review_text"),
  reviewerName: text("reviewer_name"),
  receivedAt: timestamp("received_at", { withTimezone: true }),
  replyText: text("reply_text"),
  repliedAt: timestamp("replied_at", { withTimezone: true }),
  repliedBy: uuid("replied_by").references(() => users.id),
  requestSentAt: timestamp("request_sent_at", { withTimezone: true }),
  requestBlockedReason: text("request_blocked_reason"),
}, (table) => ({
  practiceIdx: index("ext_mkt_reviews_practice_idx").on(table.practiceId, table.deletedAt),
  receivedIdx: index("ext_mkt_reviews_received_idx").on(table.practiceId, table.receivedAt),
}));

export const extMarketingRecallSchedules = pgTable("ext_marketing_recall_schedules", {
  ...baseColumns(),
  practiceId: uuid("practice_id").notNull().references(() => practices.id),
  vaccinationRecallEnabled: boolean("vaccination_recall_enabled").notNull().default(false),
  vaccinationRecallLeadDays: integer("vaccination_recall_lead_days").notNull().default(14),
  postVisitReviewEnabled: boolean("post_visit_review_enabled").notNull().default(false),
  postVisitReviewDelayHours: integer("post_visit_review_delay_hours").notNull().default(24),
  postVisitHandoutEnabled: boolean("post_visit_handout_enabled").notNull().default(false),
  inactiveRecallEnabled: boolean("inactive_recall_enabled").notNull().default(false),
  inactiveRecallMonths: integer("inactive_recall_months").notNull().default(18),
}, (table) => ({
  practiceUq: uniqueIndex("ext_mkt_recall_practice_uq").on(table.practiceId),
}));

export const extMarketingWellnessRedemptions = pgTable("ext_marketing_wellness_redemptions", {
  ...baseColumns(),
  practiceId: uuid("practice_id").notNull().references(() => practices.id),
  enrollmentId: uuid("enrollment_id").notNull().references(() => wellnessEnrollments.id),
  benefitKey: text("benefit_key").notNull(),
  redeemedAt: timestamp("redeemed_at", { withTimezone: true }).notNull(),
  appointmentId: uuid("appointment_id").references(() => appointments.id),
  notes: text("notes"),
}, (table) => ({
  enrollmentIdx: index("ext_mkt_redemptions_enrollment_idx").on(table.practiceId, table.enrollmentId),
}));

export const extMarketingMediaConsentsRelations = relations(extMarketingMediaConsents, ({ one }) => ({
  practice: one(practices, { fields: [extMarketingMediaConsents.practiceId], references: [practices.id] }),
  client: one(clients, { fields: [extMarketingMediaConsents.clientId], references: [clients.id] }),
  patient: one(patients, { fields: [extMarketingMediaConsents.patientId], references: [patients.id] }),
  consentRequest: one(consentRequests, { fields: [extMarketingMediaConsents.consentRequestId], references: [consentRequests.id] }),
}));

export const extMarketingMediaAssetsRelations = relations(extMarketingMediaAssets, ({ one }) => ({
  practice: one(practices, { fields: [extMarketingMediaAssets.practiceId], references: [practices.id] }),
  uploadedBy: one(users, { fields: [extMarketingMediaAssets.uploadedBy], references: [users.id] }),
  file: one(files, { fields: [extMarketingMediaAssets.fileId], references: [files.id] }),
  consent: one(extMarketingMediaConsents, { fields: [extMarketingMediaAssets.consentId], references: [extMarketingMediaConsents.id] }),
}));

export const extMarketingContentBatchesRelations = relations(extMarketingContentBatches, ({ one, many }) => ({
  practice: one(practices, { fields: [extMarketingContentBatches.practiceId], references: [practices.id] }),
  items: many(extMarketingContentItems),
}));

export const extMarketingContentItemsRelations = relations(extMarketingContentItems, ({ one }) => ({
  practice: one(practices, { fields: [extMarketingContentItems.practiceId], references: [practices.id] }),
  batch: one(extMarketingContentBatches, { fields: [extMarketingContentItems.batchId], references: [extMarketingContentBatches.id] }),
  createdBy: one(users, { fields: [extMarketingContentItems.createdBy], references: [users.id] }),
  approvedBy: one(users, { fields: [extMarketingContentItems.approvedBy], references: [users.id] }),
  mediaAsset: one(extMarketingMediaAssets, { fields: [extMarketingContentItems.mediaAssetId], references: [extMarketingMediaAssets.id] }),
}));

export const extMarketingTvSlidesRelations = relations(extMarketingTvSlides, ({ one }) => ({
  practice: one(practices, { fields: [extMarketingTvSlides.practiceId], references: [practices.id] }),
  createdBy: one(users, { fields: [extMarketingTvSlides.createdBy], references: [users.id] }),
  mediaAsset: one(extMarketingMediaAssets, { fields: [extMarketingTvSlides.mediaAssetId], references: [extMarketingMediaAssets.id] }),
}));

export const extMarketingHandoutsRelations = relations(extMarketingHandouts, ({ one }) => ({
  practice: one(practices, { fields: [extMarketingHandouts.practiceId], references: [practices.id] }),
  createdBy: one(users, { fields: [extMarketingHandouts.createdBy], references: [users.id] }),
}));

export const extMarketingReviewsRelations = relations(extMarketingReviews, ({ one }) => ({
  practice: one(practices, { fields: [extMarketingReviews.practiceId], references: [practices.id] }),
  patient: one(patients, { fields: [extMarketingReviews.patientId], references: [patients.id] }),
  client: one(clients, { fields: [extMarketingReviews.clientId], references: [clients.id] }),
  appointment: one(appointments, { fields: [extMarketingReviews.appointmentId], references: [appointments.id] }),
  repliedBy: one(users, { fields: [extMarketingReviews.repliedBy], references: [users.id] }),
}));

export const extMarketingRecallSchedulesRelations = relations(extMarketingRecallSchedules, ({ one }) => ({
  practice: one(practices, { fields: [extMarketingRecallSchedules.practiceId], references: [practices.id] }),
}));

export const extMarketingWellnessRedemptionsRelations = relations(extMarketingWellnessRedemptions, ({ one }) => ({
  practice: one(practices, { fields: [extMarketingWellnessRedemptions.practiceId], references: [practices.id] }),
  enrollment: one(wellnessEnrollments, { fields: [extMarketingWellnessRedemptions.enrollmentId], references: [wellnessEnrollments.id] }),
  appointment: one(appointments, { fields: [extMarketingWellnessRedemptions.appointmentId], references: [appointments.id] }),
}));

export const extMarketingStaffTasks = pgTable("ext_marketing_staff_tasks", {
  ...baseColumns(),
  practiceId: uuid("practice_id").notNull().references(() => practices.id),
  kind: text("kind").notNull().default("info"), // condolence | postop_escalation | info
  title: text("title").notNull(),
  detail: text("detail").notNull().default(""),
  status: text("status").notNull().default("open"),
  clientId: uuid("client_id").references(() => clients.id),
}, (t) => ({
  practiceIdx: index("ext_mkt_staff_tasks_practice_idx").on(t.practiceId, t.deletedAt),
}));

export const extMarketingStaffTasksRelations = relations(extMarketingStaffTasks, ({ one }) => ({
  practice: one(practices, { fields: [extMarketingStaffTasks.practiceId], references: [practices.id] }),
  client: one(clients, { fields: [extMarketingStaffTasks.clientId], references: [clients.id] }),
}));

// ---------------------------------------------------------------------------
// Message Templates (Task 3.2)
// ---------------------------------------------------------------------------
export const extMarketingMessageTemplates = pgTable("ext_marketing_message_templates", {
  ...baseColumns(),
  practiceId: uuid("practice_id").notNull().references(() => practices.id),
  key: text("key").notNull(),
  language: text("language").notNull().default("sk"),
  channel: text("channel").notNull(), // sms | email | push
  body: text("body").notNull(), // uses {{pet_name}}, {{clinic_name}} etc.
  legalBasis: text("legal_basis").notNull().default("contract"),
  version: integer("version").notNull().default(1),
  isActive: boolean("is_active").notNull().default(true),
}, (t) => ({
  practiceKeyLangUq: uniqueIndex("ext_mkt_tpl_practice_key_lang_uq").on(t.practiceId, t.key, t.language),
}));

export const extMarketingMessageTemplatesRelations = relations(extMarketingMessageTemplates, ({ one }) => ({
  practice: one(practices, { fields: [extMarketingMessageTemplates.practiceId], references: [practices.id] }),
}));

// ---------------------------------------------------------------------------
// Message Logs (Task 3.3)
// ---------------------------------------------------------------------------
export const extMarketingMessageStatusEnum = pgEnum("ext_marketing_message_status", [
  "queued", "sent", "delivered", "failed",
  "suppressed_quiet", "suppressed_rate", "suppressed_no_consent",
  "blocked_sympathy",
]);

export const extMarketingMessageLogs = pgTable("ext_marketing_message_logs", {
  ...baseColumns(),
  practiceId: uuid("practice_id").notNull().references(() => practices.id),
  clientId: uuid("client_id").notNull().references(() => clients.id),
  patientId: uuid("patient_id").references(() => patients.id),
  templateId: uuid("template_id").references(() => extMarketingMessageTemplates.id),
  templateKey: text("template_key").notNull(),
  templateVersion: integer("template_version").notNull(),
  legalBasis: text("legal_basis").notNull(),
  channel: text("channel").notNull(),
  language: text("language").notNull().default("sk"),
  bodyRendered: text("body_rendered").notNull(),
  triggerKey: text("trigger_key").notNull(),
  status: extMarketingMessageStatusEnum("status").notNull().default("queued"),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
}, (t) => ({
  clientIdx: index("ext_mkt_msg_log_client_idx").on(t.clientId, t.createdAt),
  practiceIdx: index("ext_mkt_msg_log_practice_idx").on(t.practiceId),
}));

export const extMarketingMessageLogsRelations = relations(extMarketingMessageLogs, ({ one }) => ({
  practice: one(practices, { fields: [extMarketingMessageLogs.practiceId], references: [practices.id] }),
  client: one(clients, { fields: [extMarketingMessageLogs.clientId], references: [clients.id] }),
  patient: one(patients, { fields: [extMarketingMessageLogs.patientId], references: [patients.id] }),
  template: one(extMarketingMessageTemplates, { fields: [extMarketingMessageLogs.templateId], references: [extMarketingMessageTemplates.id] }),
}));

// ---------------------------------------------------------------------------
// SMS Delivery Log - Unified Rate Limit (Task 3.4 / F1 Option B)
// ---------------------------------------------------------------------------
export const extSmsDeliveryLog = pgTable("ext_sms_delivery_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  practiceId: uuid("practice_id").notNull().references(() => practices.id),
  clientId: uuid("client_id").notNull().references(() => clients.id),
  source: text("source").notNull(), // "vanilla" | "marketing"
  sourceRecordId: text("source_record_id"), // communications.id or message_log.id
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  clientRecentIdx: index("ext_sms_delivery_client_idx").on(t.clientId, t.sentAt),
}));

export const extSmsDeliveryLogRelations = relations(extSmsDeliveryLog, ({ one }) => ({
  practice: one(practices, { fields: [extSmsDeliveryLog.practiceId], references: [practices.id] }),
  client: one(clients, { fields: [extSmsDeliveryLog.clientId], references: [clients.id] }),
}));

// ---------------------------------------------------------------------------
// Automation Rules (Task 3.5)
// ---------------------------------------------------------------------------
export const extMarketingAutomationRules = pgTable("ext_marketing_automation_rules", {
  ...baseColumns(),
  practiceId: uuid("practice_id").notNull().references(() => practices.id),
  key: text("key").notNull(),
  label: text("label").notNull(),
  description: text("description").notNull().default(""),
  triggerKey: text("trigger_key").notNull(),
  timing: text("timing").notNull().default(""),
  channel: text("channel").notNull().default("sms"),
  legalBasis: text("legal_basis").notNull().default("contract"),
  enabled: boolean("enabled").notNull().default(true),
  sort: integer("sort").notNull().default(0),
}, (t) => ({
  practiceKeyUq: uniqueIndex("ext_mkt_auto_rule_practice_key_uq").on(t.practiceId, t.key),
}));

export const extMarketingAutomationRulesRelations = relations(extMarketingAutomationRules, ({ one }) => ({
  practice: one(practices, { fields: [extMarketingAutomationRules.practiceId], references: [practices.id] }),
}));

// ---------------------------------------------------------------------------
// Post-op Responses (Task 3.6)
// ---------------------------------------------------------------------------
export const extMarketingPostopResponses = pgTable("ext_marketing_postop_responses", {
  ...baseColumns(),
  practiceId: uuid("practice_id").notNull().references(() => practices.id),
  messageLogId: uuid("message_log_id").references(() => extMarketingMessageLogs.id),
  clientId: uuid("client_id").notNull().references(() => clients.id),
  patientId: uuid("patient_id").references(() => patients.id),
  outcome: text("outcome").notNull(), // ok | question | concern
  note: text("note").notNull().default(""),
}, (t) => ({
  practiceIdx: index("ext_mkt_postop_practice_idx").on(t.practiceId),
}));

export const extMarketingPostopResponsesRelations = relations(extMarketingPostopResponses, ({ one }) => ({
  practice: one(practices, { fields: [extMarketingPostopResponses.practiceId], references: [practices.id] }),
  client: one(clients, { fields: [extMarketingPostopResponses.clientId], references: [clients.id] }),
  patient: one(patients, { fields: [extMarketingPostopResponses.patientId], references: [patients.id] }),
  messageLog: one(extMarketingMessageLogs, { fields: [extMarketingPostopResponses.messageLogId], references: [extMarketingMessageLogs.id] }),
}));

// ---------------------------------------------------------------------------
// Operative Scripts (Task 3.7)
// ---------------------------------------------------------------------------
export const extMarketingOperativeScripts = pgTable("ext_marketing_operative_scripts", {
  ...baseColumns(),
  practiceId: uuid("practice_id").notNull().references(() => practices.id),
  category: text("category").notNull(), // discharge_ask | crisis | condolence | review_ask
  title: text("title").notNull(),
  body: text("body").notNull(),
  note: text("note").notNull().default(""),
  sort: integer("sort").notNull().default(0),
}, (t) => ({
  practiceIdx: index("ext_mkt_scripts_practice_idx").on(t.practiceId),
}));

export const extMarketingOperativeScriptsRelations = relations(extMarketingOperativeScripts, ({ one }) => ({
  practice: one(practices, { fields: [extMarketingOperativeScripts.practiceId], references: [practices.id] }),
}));


