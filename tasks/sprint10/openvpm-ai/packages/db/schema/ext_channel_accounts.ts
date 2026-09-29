import {
  pgTable,
  pgEnum,
  uuid,
  text,
  jsonb,
  timestamp,
  integer,
  index,
  uniqueIndex,
  foreignKey,
  check,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { baseColumns } from "./common";
import { practices } from "./practices";
import { users } from "./users";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const extChannelProviderEnum = pgEnum("ext_channel_provider", [
  "google_business",
  "facebook",
  "instagram",
  "youtube",
]);

export const extChannelAccountStatusEnum = pgEnum("ext_channel_account_status", [
  "connected",
  "expired",
  "revoked",
  "error",
]);

// ---------------------------------------------------------------------------
// Table 11 — ext_channel_accounts
// ---------------------------------------------------------------------------

/**
 * OAuth connection state for the social publishing surfaces (Pillar 1) and the
 * review inbox (Pillar 4).
 *
 * Fills gap G12 in EVENT-ENGINE-PLAN.md: without this table there is nowhere to
 * store the tokens the Facebook Page API, Instagram Content Publishing API,
 * Google Business Profile API and YouTube Data API all require.
 *
 * TOKEN HANDLING — read before implementing:
 *
 * `auth-tokens.ts` is NOT the precedent here. It stores a one-way SHA-256 hash
 * (`tokenHash`, auth-tokens.ts:L20) because those are single-use verification
 * tokens that are never read back. An OAuth access token MUST be decryptable in
 * order to call the provider, so hashing is useless for this table.
 *
 * The correct in-repo precedent is
 * `apps/web/lib/messaging/registration-crypto.ts`: AES-256-GCM, a versioned
 * `v1:<iv>:<ciphertext>:<tag>` envelope, and a base64-encoded 32-byte key read
 * from the environment. Mirror that module with a
 * `CHANNEL_ACCOUNT_ENCRYPTION_KEY` rather than inventing a second scheme.
 *
 * Tokens must never be returned over tRPC — expose only
 * { provider, displayName, status, scopesGranted, tokenExpiresAt }.
 */
export const extChannelAccounts = pgTable(
  "ext_channel_accounts",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    provider: extChannelProviderEnum("provider").notNull(),
    /** GBP location name / Facebook page id / Instagram user id / YouTube channel id. */
    externalAccountId: text("external_account_id").notNull(),
    displayName: text("display_name"),
    /** Audit: the scopes the provider actually granted, which may be fewer than asked for. */
    scopesGranted: text("scopes_granted").array().notNull().default([]),
    /** AES-256-GCM envelope. Never logged, never returned to the client. */
    encryptedAccessToken: text("encrypted_access_token"),
    encryptedRefreshToken: text("encrypted_refresh_token"),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
    tokenRefreshedAt: timestamp("token_refreshed_at", { withTimezone: true }),
    connectedBy: uuid("connected_by").references(() => users.id),
    connectedAt: timestamp("connected_at", { withTimezone: true }),
    /** Soft revoke — keeps the audit trail of a disconnected account. */
    disconnectedAt: timestamp("disconnected_at", { withTimezone: true }),
    status: extChannelAccountStatusEnum("status")
      .notNull()
      .default("connected"),
    lastError: text("last_error"),
    /**
     * Instagram Content Publishing API enforces a rolling 24h per-account quota.
     * Snapshot only — always re-check with the provider before publishing.
     */
    publishingQuotaRemaining: integer("publishing_quota_remaining"),
    publishingQuotaFetchedAt: timestamp("publishing_quota_fetched_at", {
      withTimezone: true,
    }),
    meta: jsonb("meta").notNull().default({}),
  },
  (table) => ({
    connectorTenantFk: foreignKey({
      columns: [table.practiceId, table.connectedBy],
      foreignColumns: [users.practiceId, users.id],
      name: "ext_channel_accounts_connector_tenant_fk",
    }),
    practiceProviderAccountUq: uniqueIndex(
      "ext_channel_accounts_practice_provider_account_uq",
    )
      .on(table.practiceId, table.provider, table.externalAccountId)
      .where(sql`${table.deletedAt} is null`),
    /** "Which live accounts can we publish to right now?" */
    practiceProviderStatusIdx: index(
      "ext_channel_accounts_provider_status_idx",
    )
      .on(table.practiceId, table.provider, table.status)
      .where(sql`${table.disconnectedAt} is null and ${table.deletedAt} is null`),
    /** Token-refresh sweeper. */
    tokenExpiryIdx: index("ext_channel_accounts_token_expiry_idx")
      .on(table.tokenExpiresAt)
      .where(
        sql`${table.tokenExpiresAt} is not null and ${table.disconnectedAt} is null`,
      ),
    disconnectStateCheck: check(
      "ext_channel_accounts_disconnect_state_check",
      sql`(${table.status} = 'revoked') = (${table.disconnectedAt} is not null)`,
    ),
    quotaCheck: check(
      "ext_channel_accounts_quota_check",
      sql`${table.publishingQuotaRemaining} is null
        or ${table.publishingQuotaRemaining} >= 0`,
    ),
  }),
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const extChannelAccountsRelations = relations(
  extChannelAccounts,
  ({ one }) => ({
    practice: one(practices, {
      fields: [extChannelAccounts.practiceId],
      references: [practices.id],
    }),
    connectedByUser: one(users, {
      fields: [extChannelAccounts.connectedBy],
      references: [users.id],
    }),
  }),
);