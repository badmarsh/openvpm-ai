import { pgTable, uuid, text, timestamp, varchar, index } from "drizzle-orm/pg-core";

/**
 * Support session tracking for remote screen sharing.
 * Records who initiated, when, and session lifecycle state.
 */
export const extSupportSessions = pgTable(
  "ext_support_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    practiceId: varchar("practice_id", { length: 255 }).notNull(),
    clientId: varchar("client_id", { length: 255 }), // nullable for staff-initiated sessions
    createdBy: varchar("created_by", { length: 255 }).notNull(), // user ID
    status: varchar("status", { length: 20 }).notNull().default("pending"), // pending | active | ended
    sessionCode: text("session_code").notNull().unique(), // short code for agent to join
    startedAt: timestamp("started_at"),
    endedAt: timestamp("ended_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    practiceIdx: index("ext_support_sessions_practice_idx").on(table.practiceId),
    clientIdx: index("ext_support_sessions_client_idx").on(table.clientId),
    createdByIdx: index("ext_support_sessions_created_by_idx").on(table.createdBy),
  })
);

/**
 * Audit log for support sessions — who joined, when, duration.
 */
export const extSupportSessionAudit = pgTable(
  "ext_support_session_audit",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id").notNull().references(() => extSupportSessions.id),
    userId: varchar("user_id", { length: 255 }).notNull(),
    role: varchar("role", { length: 20 }).notNull(), // customer | agent
    action: varchar("action", { length: 30 }).notNull(), // joined | left | ended
    timestamp: timestamp("timestamp").defaultNow().notNull(),
  },
  (table) => ({
    sessionIdx: index("ext_support_audit_session_idx").on(table.sessionId),
    userIdx: index("ext_support_audit_user_idx").on(table.userId),
  })
);
