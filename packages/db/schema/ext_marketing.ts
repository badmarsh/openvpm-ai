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

export const extMarketingContentItems = pgTable("ext_marketing_content_items", {
  ...baseColumns(),
  practiceId: uuid("practice_id").notNull().references(() => practices.id),
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

export const extMarketingContentItemsRelations = relations(extMarketingContentItems, ({ one }) => ({
  practice: one(practices, { fields: [extMarketingContentItems.practiceId], references: [practices.id] }),
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
