import {
  pgTable,
  pgEnum,
  uuid,
  text,
  varchar,
  integer,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { baseColumns } from "./common";
import { practices } from "./practices";
import { patients } from "./patients";
import { clients } from "./clients";
import { users } from "./users";

export const analyzerTypeEnum = pgEnum("analyzer_type", [
  "IDEXX",
  "FUJI_DRI_CHEM",
  "MINDRAY",
  "GENERIC_CSV",
  "MANUAL",
]);

export const labReportStatusEnum = pgEnum("lab_report_status", [
  "UNASSIGNED",
  "ATTACHED",
  "REVIEWED",
]);

export interface LabAnalyteResult {
  code: string;
  name: string;
  value: number;
  valueString?: string;
  unit: string;
  refLow?: number | null;
  refHigh?: number | null;
  flag: "NORMAL" | "LOW" | "HIGH" | "CRITICAL";
  category?: "BIOCHEMISTRY" | "HEMATOLOGY" | "ELECTROLYTES" | "URINALYSIS" | "OTHER";
}

export const labAnalyzerReports = pgTable(
  "lab_analyzer_reports",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    patientId: uuid("patient_id").references(() => patients.id),
    clientId: uuid("client_id").references(() => clients.id),
    reviewedById: uuid("reviewed_by_id").references(() => users.id),

    analyzerType: analyzerTypeEnum("analyzer_type").notNull().default("GENERIC_CSV"),
    deviceModel: varchar("device_model", { length: 128 }),
    sampleId: varchar("sample_id", { length: 128 }),
    sampleDate: timestamp("sample_date", { withTimezone: true }),
    species: varchar("species", { length: 32 }),
    fileName: varchar("file_name", { length: 255 }),
    rawContent: text("raw_content"),

    parsedResults: jsonb("parsed_results").$type<LabAnalyteResult[]>().notNull(),
    abnormalCount: integer("abnormal_count").notNull().default(0),
    criticalCount: integer("critical_count").notNull().default(0),

    status: labReportStatusEnum("status").notNull().default("UNASSIGNED"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    notes: text("notes"),
  },
  (table) => ({
    practiceIdx: index("lab_analyzer_reports_practice_idx").on(table.practiceId),
    patientIdx: index("lab_analyzer_reports_patient_idx").on(table.patientId),
    statusIdx: index("lab_analyzer_reports_status_idx").on(table.status),
    createdAtIdx: index("lab_analyzer_reports_created_at_idx").on(table.createdAt),
  })
);

export const labAnalyzerReportsRelations = relations(
  labAnalyzerReports,
  ({ one }) => ({
    practice: one(practices, {
      fields: [labAnalyzerReports.practiceId],
      references: [practices.id],
    }),
    patient: one(patients, {
      fields: [labAnalyzerReports.patientId],
      references: [patients.id],
    }),
    client: one(clients, {
      fields: [labAnalyzerReports.clientId],
      references: [clients.id],
    }),
    reviewer: one(users, {
      fields: [labAnalyzerReports.reviewedById],
      references: [users.id],
    }),
  })
);

export type LabAnalyzerReport = typeof labAnalyzerReports.$inferSelect;
export type NewLabAnalyzerReport = typeof labAnalyzerReports.$inferInsert;
