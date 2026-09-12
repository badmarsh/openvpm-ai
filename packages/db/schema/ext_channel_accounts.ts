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
import { users } from "./users";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/**
 * Social media platform types for channel accounts.
 */
export const extChannelPlatformEnum = pgEnum("ext_channel_platform", [
  "facebook",
  "instagram",
  "google_business",
  "youtube",
  "tiktok",
  "linkedin",
]);

/**
 * Account connection status.
 */
export const extChannelAccountStatusEnum = pgEnum("ext_channel_account_status", [
  "connected",
  "token_expired",
  "revoked",
  "error",
]);

// ---------------------------------------------------------------------------
// Encrypted OAuth token storage
// ---------------------------------------------------------------------------

/**
 * OAuth access tokens and refresh tokens are encrypted at rest using
 * AES-256-GCM via lib/messaging/registration-crypto.ts.
 *
 * The encryption key is derived from a practice-specific key material
 * stored in environment variables, ensuring tenant isolation.
 */
export type EncryptedToken = {
  /** AES-256-GCM encrypted token value (base64-encoded ciphertext). */
  ciphertext: string;
  /** Initialization vector (base64-encoded). */
  iv: string;
  /** Authentication tag (base64-encoded). */
  authTag: string;
  /** Key derivation salt (base64-encoded). */
  salt: string;
};

// ---------------------------------------------------------------------------
// ext_channel_accounts — OAuth account connections
// ---------------------------------------------------------------------------

/**
 * Connected social media accounts for automated publishing.
 *
 * This table stores OAuth tokens for platforms like Facebook, Instagram,
 * Google Business, YouTube, etc. Tokens are encrypted at rest using
 * AES-256-GCM (see lib/messaging/registration-crypto.ts).
 *
 * This fills gap G12 from ARCHITECTURE-RESEARCH.md: "No ext_channel_accounts.
 * Social publishing (Phase 2) has nowhere to store OAuth tokens."
 */
export const extChannelAccounts = pgTable(
  "ext_channel_accounts",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    /** Platform identifier (facebook, instagram, google_business, etc.). */
    platform: extChannelPlatformEnum("platform").notNull(),
    /**
     * Platform-specific account ID (e.g. Facebook Page ID, Instagram Business ID).
     * This is the stable identifier used for API calls.
     */
    platformAccountId: text("platform_account_id").notNull(),
    /** Human-readable account name (e.g. "VET.IS Bratislava Facebook"). */
    accountName: text("account_name"),
    /** Current connection status. */
    status: extChannelAccountStatusEnum("status")
      .notNull()
      .default("connected"),
    /**
     * Encrypted OAuth access token.
     * Stored as JSONB: { ciphertext, iv, authTag, salt }
     * Decrypted only at application layer using practice-specific key.
     */
    accessTokenEncrypted: jsonb("access_token_encrypted").$type<EncryptedToken>(),
    /**
     * Encrypted OAuth refresh token (if applicable).
     * Some platforms (Facebook) provide long-lived tokens that don't expire.
     * Others (Google) provide refresh tokens for token renewal.
     */
    refreshTokenEncrypted: jsonb("refresh_token_encrypted").$type<EncryptedToken>(),
    /**
     * Token expiration time (if applicable).
     * Null for long-lived tokens (Facebook: 60-day tokens).
     */
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
    /**
     * When the token was last refreshed.
     * Used to detect stale tokens that need renewal.
     */
    lastTokenRefreshAt: timestamp("last_token_refresh_at", {
      withTimezone: true,
    }),
    /**
     * Platform-specific scopes granted during OAuth flow.
     * E.g. ["pages_manage_posts", "pages_read_engagement"] for Facebook.
     */
    grantedScopes: text("granted_scopes").array(),
    /**
     * Additional platform-specific metadata.
     * E.g. page access token permissions, YouTube channel ID, etc.
     */
    platformMetadata: jsonb("platform_metadata"),
    /**
     * Error details when status = 'error'.
     * Includes error message, last error timestamp, and retry count.
     */
    errorDetails: jsonb("error_details"),
    /** When the connection was last verified successful. */
    lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
    /** User who initiated the OAuth connection. */
    connectedBy: uuid("connected_by").references(() => users.id),
    /** When the connection was revoked by the user. */
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    /** User who revoked the connection. */
    revokedBy: uuid("revoked_by").references(() => users.id),
  },
  (t) => ({
    practicePlatformIdx: index("ext_channel_accounts_practice_platform_idx").on(
      t.practiceId,
      t.platform,
    ),
    /**
     * Unique (practice, platform, platformAccountId): prevents duplicate
     * connections to the same social media account.
     */
    practicePlatformAccountUq: uniqueIndex(
      "ext_channel_accounts_practice_platform_account_uq",
    ).on(t.practiceId, t.platform, t.platformAccountId),
    /** Index for finding accounts needing token refresh. */
    tokenExpiryIdx: index("ext_channel_accounts_token_expiry_idx").on(
      t.practiceId,
      t.tokenExpiresAt,
    ),
    /** Index for finding accounts with errors. */
    statusIdx: index("ext_channel_accounts_status_idx").on(
      t.practiceId,
      t.status,
    ),
    appendOnlyCheck: check(
      "ext_channel_accounts_append_only",
      sql`${t.deletedAt} IS NULL`,
    ),
    /**
     * CHECK: if accessTokenEncrypted is NOT NULL, then platformAccountId must be NOT NULL.
     * This ensures we don't have orphaned tokens without account identifiers.
     */
    tokenAccountCheck: check(
      "ext_channel_accounts_token_account_check",
      sql`(${t.accessTokenEncrypted} IS NULL) OR (${t.platformAccountId} IS NOT NULL)`,
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
    connector: one(users, {
      fields: [extChannelAccounts.connectedBy],
      references: [users.id],
    }),
    revoker: one(users, {
      fields: [extChannelAccounts.revokedBy],
      references: [users.id],
    }),
  }),
);
