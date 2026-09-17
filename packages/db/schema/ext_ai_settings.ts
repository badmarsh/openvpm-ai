import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { baseColumns } from "./common";
import { practices } from "./practices";

// ---------------------------------------------------------------------------
// Model cache & Feature mapping types
// ---------------------------------------------------------------------------

export interface CachedAiModel {
  id: string;
  name?: string;
  contextLength?: number;
  isVision?: boolean;
  isImageGeneration?: boolean;
  isVideoGeneration?: boolean;
}

export interface FeatureAiMapping {
  provider: "openai" | "gemini" | "alibaba" | "default";
  model: string;
  temperature?: number;
  maxTokens?: number;
  size?: string; // for image generation: e.g. "1024*1024", "720*1280", "1280*720"
  duration?: number; // for video generation: e.g. 5, 10 seconds
}

export interface PracticeAiFeatureMappings {
  assistant?: FeatureAiMapping;
  imagingRtg?: FeatureAiMapping;
  voiceSoap?: FeatureAiMapping;
  labParser?: FeatureAiMapping;
  imageGeneration?: FeatureAiMapping;
  videoGeneration?: FeatureAiMapping;
  marketingCopy?: FeatureAiMapping;
  [featureKey: string]: FeatureAiMapping | undefined;
}

// ---------------------------------------------------------------------------
// Table: ext_ai_settings — Konfigurácia AI modelov a poskytovateľov pre kliniku
// ---------------------------------------------------------------------------

export const extAiSettings = pgTable(
  "ext_ai_settings",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),

    // 1. OpenAI Compatible Gateway
    openaiBaseUrl: text("openai_base_url"),
    openaiApiKeyEncrypted: text("openai_api_key_encrypted"),
    openaiIsActive: boolean("openai_is_active").notNull().default(false),
    openaiCachedModels: jsonb("openai_cached_models").$type<CachedAiModel[]>().default([]),
    openaiLastTestedAt: timestamp("openai_last_tested_at", { withTimezone: true }),
    openaiLastStatus: text("openai_last_status"), // "ok" | "error"
    openaiLastStatusMessage: text("openai_last_status_message"),

    // 2. Google Gemini
    geminiBaseUrl: text("gemini_base_url"),
    geminiApiKeyEncrypted: text("gemini_api_key_encrypted"),
    geminiIsActive: boolean("gemini_is_active").notNull().default(false),
    geminiCachedModels: jsonb("gemini_cached_models").$type<CachedAiModel[]>().default([]),
    geminiLastTestedAt: timestamp("gemini_last_tested_at", { withTimezone: true }),
    geminiLastStatus: text("gemini_last_status"),
    geminiLastStatusMessage: text("gemini_last_status_message"),

    // 3. Alibaba Cloud (DashScope) & Lokálny AliProxy
    alibabaMode: text("alibaba_mode").default("aliproxy_local"), // "aliproxy_local" | "dashscope_intl" | "dashscope_cn" | "custom"
    alibabaBaseUrl: text("alibaba_base_url").default("http://127.0.0.1:8080/v1"),
    alibabaApiKeyEncrypted: text("alibaba_api_key_encrypted"),
    alibabaIsActive: boolean("alibaba_is_active").notNull().default(false),
    alibabaCachedModels: jsonb("alibaba_cached_models").$type<CachedAiModel[]>().default([]),
    alibabaLastTestedAt: timestamp("alibaba_last_tested_at", { withTimezone: true }),
    alibabaLastStatus: text("alibaba_last_status"),
    alibabaLastStatusMessage: text("alibaba_last_status_message"),

    // 4. Feature Mappings: Priradenie funkcií k poskytovateľom a modelom
    featureMappings: jsonb("feature_mappings")
      .$type<PracticeAiFeatureMappings>()
      .notNull()
      .default({}),

    isActive: boolean("is_active").notNull().default(true),
  },
  (table) => ({
    practiceIdx: index("ext_ai_settings_practice_idx").on(
      table.practiceId,
      table.deletedAt,
    ),
    practiceActiveIdx: uniqueIndex("ext_ai_settings_practice_active_uq").on(
      table.practiceId,
      table.isActive,
    ),
  }),
);

export const extAiSettingsRelations = relations(extAiSettings, ({ one }) => ({
  practice: one(practices, {
    fields: [extAiSettings.practiceId],
    references: [practices.id],
  }),
}));
